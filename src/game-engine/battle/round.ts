/**
 * 回合管理
 *
 * - startRound: 重算所有存活单位的 initiative,建队列
 * - beginTurn: 行动者登场(结算 DOT、冷却、眩晕)
 * - endTurn: 行动者离场(标记/护甲衰减)
 *
 * 排序规则:
 *   initiative = speed + randInt(1, 8)
 *   高者先动
 *   平局:Boss > 稳定 id(字典序) > 之前的稳定 id
 *
 * Phase 0 没有 Boss,所以平局用 id 字典序。
 */

import type { BattleContext } from './context.js';
import { allActors, liveActors } from '../invariants.js';
import type { BattleActor, BattleState } from '../types.js';

export function startRound(ctx: BattleContext): void {
  const state = ctx.state;
  if (state.phase !== 'setup' && state.phase !== 'round-end') {
    throw new Error(`startRound: invalid phase ${state.phase}`);
  }

  state.round += 1;
  state.phase = 'round-start';

  const live = liveActors(state);
  // 每个人独立掷 initiative
  const rolls = live.map((a) => ({
    actor: a,
    roll: a.speed + ctx.rng.nextInt(1, 8),
  }));

  // 排序:roll desc,然后 id asc
  rolls.sort((a, b) => {
    if (b.roll !== a.roll) return b.roll - a.roll;
    return a.actor.id.localeCompare(b.actor.id);
  });

  state.initiativeQueue = rolls.map((r) => r.actor.id);
  state.activeActorId = null;

  ctx.emit('ROUND_STARTED', { round: state.round });
  ctx.emit('INITIATIVE_ROLLED', {
    rolls: rolls.map((r) => ({ actorId: r.actor.id, roll: r.roll })),
  });

  ctx.commit();
}

/**
 * 行动者登场:
 * - DOT 结算(每个 actor 自己)
 * - 冷却 -1
 * - 眩晕:剩余 -1,若 0 则解除
 * - 如果还在眩晕:跳过行动
 *
 * 返回值:
 *   { canAct: boolean, actor: BattleActor | null, reason?: 'stunned' | 'dead' | 'gone' }
 */
export function beginTurn(
  ctx: BattleContext,
  actorId: string,
): { canAct: boolean; actor: BattleActor | null; reason?: 'stunned' | 'dead' | 'gone' } {
  const state = ctx.state;
  if (state.phase !== 'round-start' && state.phase !== 'actor-turn') {
    throw new Error(`beginTurn: invalid phase ${state.phase}`);
  }
  if (state.activeActorId !== null && state.activeActorId !== actorId) {
    throw new Error(
      `beginTurn: actor ${actorId} but active is already ${state.activeActorId}`,
    );
  }

  // 从队列中弹出
  const idx = state.initiativeQueue.indexOf(actorId);
  if (idx < 0) {
    throw new Error(`beginTurn: actor ${actorId} not in initiative queue`);
  }
  state.initiativeQueue = state.initiativeQueue.filter((id) => id !== actorId);

  const actor = findActorInLists(state, actorId);
  if (!actor || actor.isDead || actor.kind === 'corpse') {
    // 罕见的:行动者本轮开始时已经死了/变尸体(在 beginTurn 之前的别处结算)
    state.activeActorId = null;
    return { canAct: false, actor: null, reason: 'dead' };
  }

  state.activeActorId = actorId;
  state.phase = 'actor-turn';

  ctx.emit('TURN_STARTED', { actorId, side: actor.side, rank: actor.rank });

  // 1. 眩晕结算
  if (actor.stun && actor.stun.remaining > 0) {
    const newStun = { ...actor.stun, remaining: actor.stun.remaining - 1 };
    if (newStun.remaining <= 0) {
      // 眩晕结束,获得短抗性
      ctx.updateActor({
        ...actor,
        stun: null,
      });
      // 应用短抗性(2 回合)
      const refreshed = findActorInLists(state, actorId)!;
      ctx.updateActor({
        ...refreshed,
        stun: { remaining: 0, resistRemaining: 2 },
      });
      ctx.emit('STUN_WORE_OFF', { targetId: actorId });
    } else {
      ctx.updateActor({ ...actor, stun: newStun });
    }
    state.activeActorId = null;
    ctx.emit('TURN_ENDED', { actorId });
    return { canAct: false, actor, reason: 'stunned' };
  }

  // 2. 眩晕抗性递减
  if (actor.stun && actor.stun.remaining <= 0 && actor.stun.resistRemaining > 0) {
    const newResist = actor.stun.resistRemaining - 1;
    ctx.updateActor({
      ...actor,
      stun: newResist > 0 ? { ...actor.stun, resistRemaining: newResist } : null,
    });
  }

  // 3. 冷却 -1
  const newCooldowns: Record<string, number> = {};
  for (const [k, v] of Object.entries(actor.cooldowns)) {
    if (v > 0) newCooldowns[k] = v - 1;
  }
  // 4. DOT 结算(每个 actor 自己的所有 DOT)
  let updated = findActorInLists(state, actorId)!;
  updated = { ...updated, cooldowns: newCooldowns };

  // 累计 DOT 伤害(保留供调试/将来使用)
  let totalDotDamage = 0;
  const newBleed: typeof updated.bleed = [];
  for (const dot of updated.bleed) {
    const dmg = dot.damagePerTurn;
    const preHp = updated.hp;
    const postHp = Math.max(0, preHp - dmg);
    totalDotDamage += dmg;
    ctx.emit('DOT_TICKED', {
      targetId: updated.id,
      sourceId: dot.sourceId,
      dotId: dot.id,
      type: 'bleed',
      damage: dmg,
      preHp,
      postHp,
    });
    updated = { ...updated, hp: postHp };
    const remaining = dot.remainingTurns - 1;
    if (remaining > 0) {
      newBleed.push({ ...dot, remainingTurns: remaining });
    } else {
      ctx.emit('DOT_WORE_OFF', { targetId: updated.id, dotId: dot.id, type: 'bleed' });
    }
  }
  const newBlight: typeof updated.blight = [];
  for (const dot of updated.blight) {
    const dmg = dot.damagePerTurn;
    const preHp = updated.hp;
    const postHp = Math.max(0, preHp - dmg);
    totalDotDamage += dmg;
    ctx.emit('DOT_TICKED', {
      targetId: updated.id,
      sourceId: dot.sourceId,
      dotId: dot.id,
      type: 'blight',
      damage: dmg,
      preHp,
      postHp,
    });
    updated = { ...updated, hp: postHp };
    const remaining = dot.remainingTurns - 1;
    if (remaining > 0) {
      newBlight.push({ ...dot, remainingTurns: remaining });
    } else {
      ctx.emit('DOT_WORE_OFF', { targetId: updated.id, dotId: dot.id, type: 'blight' });
    }
  }
  updated = { ...updated, bleed: newBleed, blight: newBlight };
  void totalDotDamage; // 保留供调试 / 未来扩展

  // 5. 死亡检测(由 DOT 引起)
  if (updated.hp <= 0 && !updated.isDead) {
    markActorDead(ctx, updated);
    state.activeActorId = null;
    return { canAct: false, actor: updated, reason: 'dead' };
  }

  ctx.updateActor(updated);
  ctx.commit();
  return { canAct: true, actor: updated };
}

export function endTurn(ctx: BattleContext): void {
  const state = ctx.state;
  if (state.phase !== 'actor-turn' && state.phase !== 'round-start') {
    throw new Error(`endTurn: invalid phase ${state.phase}`);
  }
  if (state.activeActorId) {
    ctx.emit('TURN_ENDED', { actorId: state.activeActorId });
    state.activeActorId = null;
  }
  if (state.initiativeQueue.length === 0) {
    state.phase = 'round-end';
  } else {
    state.phase = 'round-start';
  }
  ctx.commit();
}

// ===== helpers =====

export function findActorInLists(state: BattleState, id: string): BattleActor | undefined {
  return (
    state.heroes.find((a) => a.id === id) ??
    state.enemies.find((a) => a.id === id) ??
    state.corpses.find((a) => a.id === id)
  );
}

export function markActorDead(ctx: BattleContext, actor: BattleActor): void {
  if (actor.isDead) return;
  ctx.updateActor({ ...actor, isDead: true, hp: 0 });
  ctx.emit('ACTOR_DIED', { actorId: actor.id, side: actor.side, rank: actor.rank });

  // 敌人死亡 -> 在该 rank 生成尸体
  if (actor.side === 'enemy') {
    const corpseId = `corpse_${actor.id}`;
    const corpse: BattleActor = {
      ...actor,
      id: corpseId,
      kind: 'corpse',
      hp: 0,
      maxHp: actor.maxHp,
      isDead: true,
      corpseOfActorId: actor.id,
      bleed: [],
      blight: [],
      stun: null,
      mark: null,
      protBuff: null,
    };
    ctx.pushCorpse(corpse);
    ctx.emit('CORPSE_SPAWNED', { corpseId, fromActorId: actor.id, rank: actor.rank });
  }
}

/** 用于让 unit 的 update 不被 cast 阻挡 */
export function _allActorsForTyping(state: BattleState): BattleActor[] {
  return allActors(state);
}
