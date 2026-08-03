/**
 * 战斗循环
 *
 * 提供两种推进方式:
 * - runBattleFull: 整个战斗由 AI 跑完(给模拟/测试用)
 * - stepActor: 单步推进一个 actor(给手动/玩家控制用)
 *
 * 流程:
 *   setup -> startRound -> beginTurn(每个 actor) -> endRound -> ... -> victory/defeat
 */

import { BattleContext } from './context.js';
import { beginTurn, endTurn, findActorInLists, startRound } from './round.js';
import { useSkill } from './skill.js';
import { decideAiAction } from './ai.js';
import { assertInvariants, liveAllies, liveEnemies } from '../invariants.js';
import type { BattleActor, BattleState } from '../types.js';

const MAX_ROUNDS = 200;

export interface RunBattleOptions {
  /** 最大回合数(默认 200,防止死循环) */
  maxRounds?: number;
  /** 如果为 true,英雄也由 AI 控制 */
  heroesControlledByAi: boolean;
  /** 提供给"玩家英雄"的回调(让手动模式可拦截) */
  onHeroTurn?: (state: BattleState, actorId: string) =>
    | { skillId: string; targetIds: string[] }
    | null;
}

export function runBattleFull(initial: BattleState, opts: RunBattleOptions): BattleState {
  let state = initial;
  // 初始事件
  const ctx0 = new BattleContext(state);
  ctx0.emit('BATTLE_STARTED', {
    battleId: state.id,
    heroIds: state.heroes.map((h) => h.id),
    enemyIds: state.enemies.map((e) => e.id),
  });
  ctx0.commit();
  state = ctx0.state;
  assertInvariants(state);

  const maxRounds = opts.maxRounds ?? MAX_ROUNDS;
  let safety = 0;

  while (state.phase !== 'victory' && state.phase !== 'defeat') {
    if (state.round >= maxRounds) {
      // 超过最大回合 -> 强制平局算作 defeat(对双方都不利,玩家丢失)
      state.phase = 'defeat';
      break;
    }

    // 过滤队列中已经死亡/变尸体的单位(在某 actor 行动中死亡)
    {
      const filtered = state.initiativeQueue.filter((id) => {
        const a = findActorInLists(state, id);
        if (!a) return false;
        if (a.isDead || a.kind === 'corpse') return false;
        return true;
      });
      if (filtered.length !== state.initiativeQueue.length) {
        state.initiativeQueue = filtered;
      }
    }

    if (state.initiativeQueue.length === 0) {
      const ctx = new BattleContext(state);
      if (state.phase === 'setup' || state.phase === 'round-end') {
        startRound(ctx);
      } else {
        // 当前轮次没结束,先把回合切到 round-end
        ctx.state.phase = 'round-end';
      }
      state = ctx.state;
      continue;
    }

    const actorId = state.initiativeQueue[0]!;
    const actor = findActorInLists(state, actorId);
    if (!actor || actor.isDead || actor.kind === 'corpse') {
      const ctx = new BattleContext(state);
      ctx.state.initiativeQueue = ctx.state.initiativeQueue.slice(1);
      ctx.commit();
      state = ctx.state;
      continue;
    }

    // 检查胜败
    if (liveAllies(state).length === 0) {
      const ctx = new BattleContext(state);
      ctx.state.phase = 'defeat';
      ctx.state.activeActorId = null;
      ctx.emit('BATTLE_ENDED', { battleId: state.id, outcome: 'defeat', rounds: state.round });
      ctx.commit();
      state = ctx.state;
      break;
    }
    if (liveEnemies(state).length === 0) {
      // 全部敌人已死,清除所有尸体
      const ctx = new BattleContext(state);
      const removed = state.corpses.map((c) => c.id);
      ctx.state.corpses = [];
      for (const cid of removed) {
        ctx.emit('CORPSE_CLEARED', { corpseId: cid, reason: 'all-enemies-dead' });
      }
      ctx.state.phase = 'victory';
      ctx.state.activeActorId = null;
      ctx.emit('BATTLE_ENDED', { battleId: state.id, outcome: 'victory', rounds: state.round });
      ctx.commit();
      state = ctx.state;
      break;
    }

    // 行动
    const ctx = new BattleContext(state);
    const turn = beginTurn(ctx, actorId);
    state = ctx.state;
    assertInvariants(state);

    if (turn.canAct && turn.actor) {
      // 决定动作
      const action = pickAction(state, turn.actor, opts);
      if (action) {
        const ctx2 = new BattleContext(state);
        useSkill(ctx2, turn.actor.id, action.skillId, action.targetIds);
        state = ctx2.state;
        // 用完技能后,过滤掉队列里新死的 actor
        state.initiativeQueue = state.initiativeQueue.filter((id) => {
          const a = findActorInLists(state, id);
          return a && !a.isDead && a.kind !== 'corpse';
        });
        assertInvariants(state);
      }
    }

    // 再次检查胜败(可能本回合直接团灭)
    if (liveAllies(state).length === 0) {
      const ctx = new BattleContext(state);
      ctx.state.phase = 'defeat';
      ctx.state.activeActorId = null;
      ctx.emit('BATTLE_ENDED', { battleId: state.id, outcome: 'defeat', rounds: state.round });
      ctx.commit();
      state = ctx.state;
      break;
    }
    if (liveEnemies(state).length === 0) {
      const ctx = new BattleContext(state);
      const removed = state.corpses.map((c) => c.id);
      ctx.state.corpses = [];
      for (const cid of removed) {
        ctx.emit('CORPSE_CLEARED', { corpseId: cid, reason: 'all-enemies-dead' });
      }
      ctx.state.phase = 'victory';
      ctx.state.activeActorId = null;
      ctx.emit('BATTLE_ENDED', { battleId: state.id, outcome: 'victory', rounds: state.round });
      ctx.commit();
      state = ctx.state;
      break;
    }

    // 结束本回合
    const ctxEnd = new BattleContext(state);
    endTurn(ctxEnd);
    state = ctxEnd.state;
    assertInvariants(state);

    safety += 1;
    if (safety > 10000) {
      throw new Error('runBattleFull: too many iterations, possible infinite loop');
    }
  }

  // 最终不变量
  assertInvariants(state);
  return state;
}

function pickAction(
  state: BattleState,
  actor: BattleActor,
  opts: RunBattleOptions,
): { skillId: string; targetIds: string[] } | null {
  if (actor.side === 'enemy') {
    const ctx = new BattleContext(state);
    const decision = decideAiAction(ctx, actor.id);
    if (!decision) {
      return null;
    }
    const targetIds = decision.targetId ? [decision.targetId] : [];
    return { skillId: decision.skillId, targetIds };
  }
  // 英雄
  if (opts.onHeroTurn) {
    return opts.onHeroTurn(state, actor.id);
  }
  if (opts.heroesControlledByAi) {
    const ctx = new BattleContext(state);
    const decision = decideAiAction(ctx, actor.id);
    if (!decision) return null;
    return { skillId: decision.skillId, targetIds: decision.targetId ? [decision.targetId] : [] };
  }
  return null;
}
