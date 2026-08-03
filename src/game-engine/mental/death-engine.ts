/**
 * 死亡之门 / 致死打击 / 永久死亡(SPEC §13 §14 §15 §16 §17)
 *
 * 这是 stress-engine 的依赖。
 *
 * 关键流程:
 *   - applyDeathsDoorRecovery:英雄被治愈离开死亡之门后的队伍反馈
 *   - checkDeathblow:死亡之门英雄再次受击的致死打击检定(RNG)
 *   - triggerPermanentDeath:原子写入死亡记录、从队伍移除、压缩站位
 *   - makeDeathRecord:构造死亡记录
 *
 * 重要:任何 RNG 都走 ctx.nextFloat() / ctx.chance(),保证刷新不重抽。
 */

import type { ExpeditionContext } from '../expedition/context.js';
import type { HeroInstance, DeathCause, DeathRecord } from '../expedition/types.js';

const DEATHBLOW_BASE_RESIST = 0.67;
const DEATHBLOW_MIN = 0.05;
const DEATHBLOW_MAX = 0.87;
const DEATHS_DOOR_RECOVERY_PARTY_STRESS = 5;

let deathRecordCounter = 0;
function nextDeathRecordId(): string {
  deathRecordCounter += 1;
  return `drec_${Date.now().toString(36)}_${deathRecordCounter.toString(36)}`;
}

let transactionCounter = 0;
function nextTxHint(): string {
  transactionCounter += 1;
  return `death-tx-${transactionCounter.toString(36)}`;
}

/**
 * 离开死亡之门后,给队友一个压力反馈 + 标记行为冷却刷新(SPEC §14)。
 * 注:enterDeathsDoor 已经 emit DEATHS_DOOR_ENTERED,这里处理离开后的余波。
 */
export function applyDeathsDoorRecovery(ctx: ExpeditionContext, hero: HeroInstance): void {
  if (ctx.state.derivedEventDepth >= 200) {
    ctx.state.mode = 'game-error';
    return;
  }
  ctx.state.derivedEventDepth += 1;
  // 队友压力:每人 +2(离开死亡之门是松一口气,但也有压力)
  const others = Object.values(ctx.state.party).filter((h) => h.id !== hero.id && !h.isDead);
  for (const ally of others) {
    ctx.emit('PARTY_STRESS_PULSE_CREATED', {
      sourceHeroId: hero.id,
      sourceEventId: 'deaths-door-recovery',
      deltas: [{ heroId: ally.id, amount: 2 }],
      reason: `${hero.name} 离开死亡之门`,
    });
    // 直接走 applyStress 但用 ctx.nextFloat 由 stress-engine 自己负责 RNG
    // 这里直接发事件 + 让 stress-engine 处理
    applySimpleStress(ctx, ally.id, 2, `${hero.name} 离开死亡之门`);
  }
  ctx.state.derivedEventDepth -= 1;
}

/**
 * 致死打击检定(SPEC §15)。
 *
 * 输入:hero 当前在死亡之门 + sourceId(谁造成的伤害)
 * 输出:true = 抵抗成功(继续活着),false = 永久死亡
 */
export function checkDeathblow(ctx: ExpeditionContext, hero: HeroInstance, sourceId: string): boolean {
  if (hero.isDead) return true; // 已死不算
  if (!hero.atDeathsDoor) return true; // 不在死亡之门不算

  const finalResist = clampResist(
    DEATHBLOW_BASE_RESIST - hero.deathblowPenalty - (hero.deathsDoorRecoveryStacks - 1) * 0.05,
    DEATHBLOW_MIN,
    DEATHBLOW_MAX,
  );

  ctx.emit('DEATHBLOW_CHECK_STARTED', { heroId: hero.id, finalResist });

  const roll = ctx.nextFloat();
  const survived = roll < finalResist;

  if (survived) {
    hero.deathblowPenalty += 0.05; // 连续抵抗惩罚
    ctx.emit('DEATHBLOW_RESISTED', { heroId: hero.id, penalty: 0.05 });
    ctx.emit('OVERLAY_SHOWN', {
      overlay: { kind: 'deathblow', heroId: hero.id, resisted: true, cause: sourceId },
    });
    return true;
  }
  // 致死打击失败 -> 永久死亡
  ctx.emit('OVERLAY_SHOWN', {
    overlay: { kind: 'deathblow', heroId: hero.id, resisted: false, cause: sourceId },
  });
  triggerPermanentDeath(ctx, hero, 'deathblow', sourceId);
  return false;
}

/**
 * 永久死亡(SPEC §16)。
 *
 * 原子操作:
 *   1. isDead = true, hp = 0
 *   2. 写 DeathRecord 并加到 state.deathRecords
 *   3. emit HERO_PERMANENTLY_DIED + DEATH_RECORD_CREATED + HERO_REMOVED_FROM_PARTY
 *   4. 队友压力 +5
 *   5. 压缩站位(活着的英雄重新排 1..n)
 *   6. emit HERO_DEATH overlay
 */
export function triggerPermanentDeath(
  ctx: ExpeditionContext,
  hero: HeroInstance,
  cause: DeathCause,
  sourceId?: string,
): void {
  if (hero.isDead) return;
  if (ctx.state.derivedEventDepth >= 200) {
    ctx.state.mode = 'game-error';
    return;
  }
  ctx.state.derivedEventDepth += 1;

  const encounter = ctx.state.encounter;
  const record = makeDeathRecord(
    hero,
    ctx.state.expedition.id,
    ctx.state.expedition.currentNodeId,
    encounter?.id,
    cause,
    sourceId,
    ctx.state.eventLog.length,
  );

  // 1. 标记
  hero.isDead = true;
  hero.hp = 0;
  hero.atDeathsDoor = false;

  // 2. 写记录
  ctx.state.deathRecords.push(record);

  // 3. 事件
  ctx.emit('DEATH_RECORD_CREATED', {
    deathRecordId: record.id,
    heroId: hero.id,
    cause,
  });
  ctx.emit('HERO_PERMANENTLY_DIED', {
    heroId: hero.id,
    deathRecordId: record.id,
    cause,
  });

  // 4. 队友压力(每人 +5)
  const alive = Object.values(ctx.state.party).filter((h) => !h.isDead);
  for (const ally of alive) {
    applySimpleStress(ctx, ally.id, DEATHS_DOOR_RECOVERY_PARTY_STRESS, `${hero.name} 永久死亡`);
  }

  // 5. 压缩站位(活着的英雄 rank 1..n)
  compactPartyRanks(ctx);

  // 6. 移除事件
  ctx.emit('HERO_REMOVED_FROM_PARTY', {
    heroId: hero.id,
    newPartySize: alive.length - 1,
  });

  // 7. 死亡覆盖层
  ctx.emit('OVERLAY_SHOWN', {
    overlay: { kind: 'hero-death', heroId: hero.id, cause },
  });

  // 8. 死亡事件日志条目(供报告使用)
  ctx.state.expedition.keyEvents.push({
    eventId: `hero_death_${cause}`,
    nodeId: ctx.state.expedition.currentNodeId,
    outcome: `${hero.name} 因 ${cause} 永久死亡`,
  });

  ctx.state.derivedEventDepth -= 1;
}

/**
 * 构造死亡记录(SPEC §17)。不修改 state。
 */
export function makeDeathRecord(
  hero: HeroInstance,
  expeditionId: string,
  nodeId: string,
  encounterId: string | undefined,
  cause: DeathCause,
  sourceId: string | undefined,
  eventSequence: number,
): DeathRecord {
  return {
    id: nextDeathRecordId(),
    heroId: hero.id,
    heroName: hero.name,
    heroClassId: hero.archetype,
    resolveLevel: hero.stress,
    expeditionId: expeditionId || 'unknown',
    nodeId: nodeId || 'unknown',
    encounterId,
    cause,
    sourceId,
    timestamp: new Date().toISOString(),
    eventSequence,
  };
}

// =============== Internal helpers ===============

function clampResist(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * 不走 mental 引擎,直接调 ctx.emit + 改 stress(避免死循环)。
 * 用于死亡引擎内部产生的压力反馈。
 */
function applySimpleStress(ctx: ExpeditionContext, heroId: string, amount: number, source: string): void {
  const hero = ctx.state.party[heroId];
  if (!hero || hero.isDead) return;
  const from = hero.stress;
  const to = Math.max(0, Math.min(200, from + amount));
  if (to === from) return;
  hero.stress = to;
  if (amount > 0) {
    ctx.emit('STRESS_APPLIED', { heroId, amount: to - from, source, newTotal: to });
  } else {
    ctx.emit('STRESS_REDUCED', { heroId, amount: from - to, source, newTotal: to });
  }
  // 100 阈值
  if (from < 100 && to >= 100) {
    // 委托 mental/index.ts 的意志检定;通过 import 避免循环
    runResolveCheckSafe(ctx, hero);
  }
  // 200 阈值
  if (from < 200 && to >= 200) {
    runHeartAttackSafe(ctx, hero);
  }
}

function compactPartyRanks(ctx: ExpeditionContext): void {
  const alive = Object.values(ctx.state.party)
    .filter((h) => !h.isDead)
    .sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < alive.length; i += 1) {
    const hero = alive[i]!;
    if (hero.rank !== i + 1) {
      const from = hero.rank;
      hero.rank = (i + 1) as HeroInstance['rank'];
      ctx.emit('HERO_RANK_CHANGED', { heroId: hero.id, from, to: hero.rank, reason: 'death-compact' });
    }
  }
}

// 延迟引用 mental index 里的意志检定 / 心脏病,避免循环 import。
// 这里用 require-like 模式:在 mental/index.ts 里注册 handler。
type ResolveCheckFn = (ctx: ExpeditionContext, hero: HeroInstance) => void;
type HeartAttackFn = (ctx: ExpeditionContext, hero: HeroInstance) => void;

let _resolveCheckHandler: ResolveCheckFn | null = null;
let _heartAttackHandler: HeartAttackFn | null = null;

/** mental/index.ts 在加载时调用,绑定真实实现 */
export function registerMentalHandlers(
  resolveCheck: ResolveCheckFn,
  heartAttack: HeartAttackFn,
): void {
  _resolveCheckHandler = resolveCheck;
  _heartAttackHandler = heartAttack;
}

function runResolveCheckSafe(ctx: ExpeditionContext, hero: HeroInstance): void {
  if (_resolveCheckHandler) _resolveCheckHandler(ctx, hero);
  else throw new Error(`[death-engine] resolveCheck handler not registered (${nextTxHint()})`);
}

function runHeartAttackSafe(ctx: ExpeditionContext, hero: HeroInstance): void {
  if (_heartAttackHandler) _heartAttackHandler(ctx, hero);
  else throw new Error(`[death-engine] heartAttack handler not registered (${nextTxHint()})`);
}
