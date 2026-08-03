/**
 * 压力引擎(SPEC §4 §5)
 *
 * 统一入口:applyStress(ctx, effect)
 *   1. 应用被动修饰(折磨 +X% / 美德 -X%)
 *   2. 写入 stress (clamp 0-200)
 *   3. 触发 STRESS_APPLIED / STRESS_REDUCED Domain Event
 *   4. 若 100 阈值跨越:触发意志检定
 *   5. 若 200 阈值跨越:触发心脏病
 *
 * 派生事件用 derivedEventDepth 限制递归(SPEC §11.3),默认上限 200。
 */

import type { ExpeditionContext } from '../expedition/context.js';
import type { HeroInstance, MentalOverlay } from '../expedition/types.js';
import { AFFLICTIONS, AFFLICTION_IDS, getAfflictionDef } from './afflictions.js';
import { VIRTUES, VIRTUE_IDS, getVirtueDef } from './virtues.js';
import { applyDeathsDoorRecovery, triggerPermanentDeath } from './death-engine.js';

export const STRESS_DERIVED_LIMIT = 200;

export interface ApplyStressEffect {
  type: 'apply-stress';
  heroId: string;
  amount: number; // 正=加, 负=减
  source: string; // 来源标签,用于日志
  canTriggerResolveCheck?: boolean; // 默认 true
}

export interface ApplyPartyStressPulse {
  sourceHeroId?: string;
  sourceEventId: string;
  deltas: { heroId: string; amount: number }[];
  reason: string;
}

const VIRTUE_BASE_CHANCE = 0.25; // 25% 美德, 75% 折磨
const VIRTUE_MIN_CHANCE = 0.05;
const VIRTUE_MAX_CHANCE = 0.6;

/** 给一个 hero 算当前美德概率(基于灯/职业/HP/同伴美德) */
export function computeVirtueChance(state: import('../expedition/types.js').GameState, hero: HeroInstance): number {
  let chance = VIRTUE_BASE_CHANCE;
  // 火把 >= 76: +0.1
  if (state.expedition.torch >= 76) chance += 0.1;
  // 灯低: -0.05
  if (state.expedition.torch < 26) chance -= 0.05;
  // 自身美德存在: +0.15(已是美德,不再变)
  if (hero.virtueId) chance += 0.2;
  // 同伴有美德: +0.05 每个
  const allyVirtue = Object.values(state.party).filter((h) => h.id !== hero.id && h.virtueId).length;
  chance += allyVirtue * 0.05;
  // HP 极低: -0.1
  if (hero.hp > 0 && hero.hp < hero.maxHp * 0.25) chance -= 0.1;
  // 折磨存在: -0.1
  if (hero.afflictionId) chance -= 0.1;
  return Math.max(VIRTUE_MIN_CHANCE, Math.min(VIRTUE_MAX_CHANCE, chance));
}

/** 应用压力变化(SPEC §4.5 统一入口) */
export function applyStress(ctx: ExpeditionContext, effect: ApplyStressEffect): void {
  const hero = ctx.state.party[effect.heroId];
  if (!hero || hero.isDead) return;
  if (effect.amount === 0) return;

  // 1. 被动修饰
  let amount = effect.amount;
  if (amount > 0) {
    if (hero.afflictionId) {
      const def = getAfflictionDef(hero.afflictionId);
      if (def?.passiveStressGain) amount = Math.round(amount * def.passiveStressGain);
    }
    if (hero.virtueId) {
      const def = getVirtueDef(hero.virtueId);
      if (def?.passiveStressGain) amount = Math.round(amount * def.passiveStressGain);
    }
  }

  // 2. clamp
  const from = hero.stress;
  const to = Math.max(0, Math.min(200, from + amount));
  if (to === from) return;
  hero.stress = to;

  if (amount > 0) {
    ctx.emit('STRESS_APPLIED', { heroId: hero.id, amount: to - from, source: effect.source, newTotal: to });
  } else {
    ctx.emit('STRESS_REDUCED', { heroId: hero.id, amount: from - to, source: effect.source, newTotal: to });
  }

  // 3. 阈值检测
  if (effect.canTriggerResolveCheck !== false) {
    if (from < 100 && to >= 100) {
      triggerResolveCheck(ctx, hero);
      // resolve check 可能把 stress 降回 <100(<200),需要重新评估
      // heart attack 仅在 resolve check 后 stress 仍 ≥ 200 才触发
      if (hero.stress >= 200 && from < 200) {
        triggerHeartAttack(ctx, hero);
      }
    } else if (from < 200 && to >= 200) {
      triggerHeartAttack(ctx, hero);
    }
  }
}

/** 意志检定(SPEC §5) */
export function triggerResolveCheck(ctx: ExpeditionContext, hero: HeroInstance): void {
  if (ctx.state.derivedEventDepth >= STRESS_DERIVED_LIMIT) {
    ctx.state.mode = 'game-error';
    return;
  }
  if (hero.resolveState !== 'stable') return; // 已经在 check/afflicted/virtuous

  ctx.state.derivedEventDepth += 1;
  const virtueChance = computeVirtueChance(ctx.state, hero);
  const roll = ctx.nextFloat();
  const isVirtue = roll < virtueChance;

  // 显示覆盖层
  ctx.emit('RESOLVE_CHECK_STARTED', { heroId: hero.id, stress: hero.stress, virtueChance });
  showOverlay(ctx, {
    kind: 'resolve-check',
    heroId: hero.id,
    fromStress: hero.stress,
  });

  if (isVirtue) {
    // 美德:随机选一个
    const virtueId = VIRTUE_IDS[ctx.nextInt(0, VIRTUE_IDS.length - 1)]!;
    grantVirtue(ctx, hero, virtueId);
  } else {
    // 折磨:随机选一个
    const afflictionId = AFFLICTION_IDS[ctx.nextInt(0, AFFLICTION_IDS.length - 1)]!;
    grantAffliction(ctx, hero, afflictionId);
  }
  ctx.state.derivedEventDepth -= 1;
}

/** 赐予折磨 */
export function grantAffliction(ctx: ExpeditionContext, hero: HeroInstance, afflictionId: string): void {
  if (!AFFLICTIONS[afflictionId]) return;
  // 清理旧美德(如果存在)
  if (hero.virtueId) {
    hero.virtueId = null;
  }
  hero.afflictionId = afflictionId;
  hero.resolveState = 'afflicted';
  // 自身压力 -25(折磨降低压力至 75)
  if (hero.stress > 75) {
    const newStress = Math.max(75, hero.stress - 25);
    ctx.emit('STRESS_REDUCED', { heroId: hero.id, amount: hero.stress - newStress, source: 'affliction-onset', newTotal: newStress });
    hero.stress = newStress;
  }
  ctx.emit('AFFLICTION_GAINED', { heroId: hero.id, afflictionId, stress: hero.stress });
  ctx.emit('RESOLVE_CHECK_SUCCEEDED', { heroId: hero.id, result: 'afflicted', afflictionId });
  showOverlay(ctx, { kind: 'affliction-reveal', heroId: hero.id, afflictionId });
  // 队伍压力脉冲
  applyPartyStressPulse(ctx, {
    sourceHeroId: hero.id,
    sourceEventId: 'affliction',
    deltas: Object.values(ctx.state.party)
      .filter((h) => h.id !== hero.id && !h.isDead)
      .map((h) => ({ heroId: h.id, amount: 5 })),
    reason: `${hero.name} 进入折磨`,
  });
}

/** 赐予美德 */
export function grantVirtue(ctx: ExpeditionContext, hero: HeroInstance, virtueId: string): void {
  if (!VIRTUES[virtueId]) return;
  if (hero.afflictionId) {
    hero.afflictionId = null;
  }
  hero.virtueId = virtueId;
  hero.resolveState = 'virtuous';
  ctx.emit('VIRTUE_GAINED', { heroId: hero.id, virtueId, stress: hero.stress });
  ctx.emit('RESOLVE_CHECK_SUCCEEDED', { heroId: hero.id, result: 'virtuous', virtueId });
  showOverlay(ctx, { kind: 'virtue-reveal', heroId: hero.id, virtueId });
  applyPartyStressPulse(ctx, {
    sourceHeroId: hero.id,
    sourceEventId: 'virtue',
    deltas: Object.values(ctx.state.party)
      .filter((h) => h.id !== hero.id && !h.isDead)
      .map((h) => ({ heroId: h.id, amount: -3 })),
    reason: `${hero.name} 获得美德`,
  });
}

/** 200 压力 → 心脏病(SPEC §12) */
export function triggerHeartAttack(ctx: ExpeditionContext, hero: HeroInstance): void {
  if (ctx.state.derivedEventDepth >= STRESS_DERIVED_LIMIT) {
    ctx.state.mode = 'game-error';
    return;
  }
  ctx.state.derivedEventDepth += 1;

  const def = hero.virtueId ? VIRTUES[hero.virtueId] : null;
  // 美德缓冲(SPEC §12.3):第一次 200 时只扣到 1 HP(不进入死亡之门)
  if (def?.heartAttackBuffer && hero.heartAttackCount === 0) {
    hero.heartAttackCount += 1;
    hero.stress = 170;
    hero.hp = 1;
    hero.virtueId = null;
    hero.resolveState = 'stable';
    ctx.emit('HEART_ATTACK_TRIGGERED', { heroId: hero.id, fromStress: 200, virtueBuffer: true, outcome: 'virtue-saved' });
    showOverlay(ctx, { kind: 'heart-attack', heroId: hero.id, fromStress: 200 });
    // 美德缓冲:不进死亡之门,但队友压力反馈
    applyPartyStressPulse(ctx, {
      sourceHeroId: hero.id,
      sourceEventId: 'heart-attack-buffered',
      deltas: Object.values(ctx.state.party)
        .filter((h) => h.id !== hero.id && !h.isDead)
        .map((h) => ({ heroId: h.id, amount: 3 })),
      reason: `${hero.name} 美德缓冲心脏病`,
    });
    ctx.state.derivedEventDepth -= 1;
    return;
  }

  if (hero.hp <= 0) {
    // 已经在死亡之门:立即永久死亡
    hero.heartAttackCount += 1;
    ctx.emit('HEART_ATTACK_TRIGGERED', { heroId: hero.id, fromStress: 200, virtueBuffer: false, outcome: 'permanent-death' });
    showOverlay(ctx, { kind: 'heart-attack', heroId: hero.id, fromStress: 200 });
    triggerPermanentDeath(ctx, hero, 'heart-attack');
  } else {
    // HP>0:扣到 0 + 进死亡之门 + 压力 170
    hero.heartAttackCount += 1;
    hero.stress = 170;
    ctx.emit('HEART_ATTACK_TRIGGERED', { heroId: hero.id, fromStress: 200, virtueBuffer: false, outcome: 'deaths-door' });
    showOverlay(ctx, { kind: 'heart-attack', heroId: hero.id, fromStress: 200 });
    enterDeathsDoor(ctx, hero, 'heart-attack', hero.hp);
  }
  ctx.state.derivedEventDepth -= 1;
}

/** 队伍压力脉冲(SPEC §11) */
export function applyPartyStressPulse(ctx: ExpeditionContext, pulse: ApplyPartyStressPulse): void {
  if (ctx.state.derivedEventDepth >= STRESS_DERIVED_LIMIT) {
    ctx.state.mode = 'game-error';
    return;
  }
  ctx.state.derivedEventDepth += 1;
  ctx.emit('PARTY_STRESS_PULSE_CREATED', pulse);
  showOverlay(ctx, {
    kind: 'party-pulse',
    sourceHeroId: pulse.sourceHeroId,
    deltas: pulse.deltas,
    reason: pulse.reason,
  });
  for (const delta of pulse.deltas) {
    applyStress(ctx, { type: 'apply-stress', heroId: delta.heroId, amount: delta.amount, source: pulse.reason });
  }
  ctx.state.derivedEventDepth -= 1;
}

/** 进入死亡之门(SPEC §13) */
export function enterDeathsDoor(ctx: ExpeditionContext, hero: HeroInstance, source: string, fromHp: number): void {
  if (hero.isDead) return;
  const preHp = hero.hp;
  hero.hp = 0;
  hero.atDeathsDoor = true;
  hero.stress = Math.min(200, hero.stress + 10);
  ctx.emit('HERO_HP_CHANGED', { heroId: hero.id, from: preHp, to: 0, source: `${source} (deaths-door)` });
  ctx.emit('DEATHS_DOOR_ENTERED', { heroId: hero.id, fromHp, source });
  showOverlay(ctx, { kind: 'deaths-door-entered', heroId: hero.id, cause: source });
  // 队友压力脉冲
  applyPartyStressPulse(ctx, {
    sourceHeroId: hero.id,
    sourceEventId: 'deaths-door',
    deltas: Object.values(ctx.state.party)
      .filter((h) => h.id !== hero.id && !h.isDead)
      .map((h) => ({ heroId: h.id, amount: 7 })),
    reason: `${hero.name} 进入死亡之门`,
  });
  // 生成死亡之门紧急选择
  ctx.state.pendingMentalFlags.push({ type: 'needs-emergency-care', heroId: hero.id, createdAt: Date.now() });
  ctx.state.pendingMentalFlags.push({ type: 'needs-cover', heroId: hero.id, createdAt: Date.now() });
  if (ctx.state.pendingDecision) {
    ctx.state.pendingDecision.generatedChoices.unshift(makeEmergencyChoice(hero, '紧急救治', 'emergency-care'));
    ctx.state.pendingDecision.generatedChoices.unshift(makeEmergencyChoice(hero, '掩护伤员', 'cover'));
  }
}

/** 离开死亡之门(SPEC §14) */
export function leaveDeathsDoor(ctx: ExpeditionContext, hero: HeroInstance, newHp: number): void {
  if (!hero.atDeathsDoor) return;
  hero.atDeathsDoor = false;
  hero.hp = newHp;
  hero.deathsDoorRecoveryStacks += 1;
  const maxHpPenalty = -Math.floor(hero.maxHp * 0.1);
  hero.maxHp = Math.max(1, hero.maxHp + maxHpPenalty);
  hero.dodge = Math.max(0, hero.dodge - 2);
  hero.protection = Math.max(0, hero.protection - 5);
  hero.deathblowPenalty += 0.05; // 致死抗性 -5%
  ctx.emit('DEATHS_DOOR_RECOVERY_APPLIED', {
    heroId: hero.id,
    maxHpDelta: maxHpPenalty,
    dodgeDelta: -2,
    protDelta: -5,
    deathResistDelta: -0.05,
  });
  ctx.emit('DEATHS_DOOR_EXITED', { heroId: hero.id, newHp, recoveryStacks: hero.deathsDoorRecoveryStacks });
  applyDeathsDoorRecovery(ctx, hero);
}

function makeEmergencyChoice(hero: HeroInstance, title: string, kind: 'emergency-care' | 'cover' | 'all-in' | 'retreat'): GeneratedChoiceLite {
  const id = `emergency-${kind}-${hero.id}`;
  return {
    id,
    sourceDefinitionId: id,
    title: `${title} (${hero.name})`,
    description: kind === 'emergency-care'
      ? `${hero.name} 已倒下。任何治疗都可能被敌方打断。`
      : kind === 'cover'
        ? `掩护 ${hero.name},有人会吸引火力。`
        : kind === 'all-in'
          ? `孤注一掷:尝试快速结束遭遇,风险极大。`
          : '立即撤离,放弃此役。',
    enabled: true,
    visibleCosts: [],
    visibleRisks: [{ kind: 'enemy-react', severity: 'high', description: '敌人获得较完整行动' }],
    tags: ['emergency', kind],
    reason: `deaths-door:${hero.id}:${kind}`,
  };
}

interface GeneratedChoiceLite {
  id: string;
  sourceDefinitionId: string;
  title: string;
  description: string;
  enabled: boolean;
  disabledReason?: string;
  visibleCosts: import('../expedition/types.js').CostPreview[];
  visibleRisks: import('../expedition/types.js').RiskPreview[];
  tags: string[];
  reason: string;
}

/** 显示覆盖层 */
export function showOverlay(ctx: ExpeditionContext, overlay: MentalOverlay): void {
  ctx.state.activeOverlay = overlay;
  ctx.emit('OVERLAY_SHOWN', { overlay });
}

/** 关闭覆盖层 */
export function dismissOverlay(ctx: ExpeditionContext): void {
  if (ctx.state.activeOverlay) {
    ctx.emit('OVERLAY_DISMISSED', { overlayKind: ctx.state.activeOverlay.kind });
    ctx.state.activeOverlay = null;
  }
}

/** 给定 ResolveState 检查 hero 是否稳定 */
export function isHeroStable(hero: HeroInstance): boolean {
  return !hero.isDead && hero.resolveState === 'stable';
}

/** 是否在死亡之门 */
export function isAtDeathsDoor(hero: HeroInstance): boolean {
  return hero.atDeathsDoor && !hero.isDead;
}

/** 检查 hero 是否可作为主要执行者 */
export function canBePrimaryActor(hero: HeroInstance): boolean {
  if (hero.isDead) return false;
  if (hero.atDeathsDoor) return true; // 死亡之门仍可行动(主要执行者用于 UI 显示)
  return true;
}

/** 应用折磨行为的冷却 (每"决策" 减 1) */
export function tickBehaviorCooldowns(hero: HeroInstance): void {
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(hero.behaviorCooldowns)) {
    if (v > 1) next[k] = v - 1;
  }
  hero.behaviorCooldowns = next;
}

/** 检查行为是否在冷却中 */
export function isBehaviorOnCooldown(hero: HeroInstance, behaviorId: string): boolean {
  return (hero.behaviorCooldowns[behaviorId] ?? 0) > 0;
}

/** 标记行为进入冷却 */
export function setBehaviorCooldown(hero: HeroInstance, behaviorId: string, cooldown: number): void {
  hero.behaviorCooldowns[behaviorId] = cooldown;
}

/** 计算美德行为触发概率(基础 * 状态修饰) */
export function adjustVirtueChance(def: import('../expedition/types.js').VirtueBehaviorDef, hero: HeroInstance, state: import('../expedition/types.js').GameState): number {
  let chance = def.baseChance;
  // 灯高:概率提升
  if (state.expedition.torch >= 76) chance += 0.1;
  if (state.expedition.torch < 26) chance -= 0.1;
  // 自身压力低:概率提升
  if (hero.stress < 50) chance += 0.1;
  if (hero.stress > 100) chance -= 0.1;
  return Math.max(0, Math.min(0.95, chance));
}

export function adjustAfflictionChance(def: import('../expedition/types.js').AfflictionBehaviorDef, hero: HeroInstance, state: import('../expedition/types.js').GameState): number {
  let chance = def.baseChance;
  chance += (def.stressModifier ?? 0) * hero.stress;
  chance += (def.torchModifier ?? 0) * state.expedition.torch;
  chance += (def.hpModifier ?? 0) * (hero.maxHp > 0 ? 1 - hero.hp / hero.maxHp : 0) * 100;
  return Math.max(0, Math.min(0.95, chance));
}
