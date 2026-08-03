/**
 * 命令分发器
 *
 * 统一入口:dispatchGameCommand(state, command) -> new state
 *
 * 流程:
 *   validate -> resolve -> emit events -> assertInvariants -> commit
 *
 * Phase 1 增强:
 * - 命令去重(同 commandId 拒绝)
 * - 调试命令处理
 */

import { BattleContext } from './battle/context.js';
import { beginTurn, endTurn, startRound, findActorInLists } from './battle/round.js';
import { useSkill } from './battle/skill.js';
import { assertInvariants, liveAllies, liveEnemies } from './invariants.js';
import { nextTransactionId } from './transaction.js';
import type { GameCommand } from './commands.js';
import type { BattleState } from './types.js';

export class CommandError extends Error {
  constructor(message: string) {
    super(`[command] ${message}`);
    this.name = 'CommandError';
  }
}

export class DuplicateCommandError extends CommandError {
  constructor(commandId: string) {
    super(`duplicate commandId: ${commandId}`);
    this.name = 'DuplicateCommandError';
  }
}

/** 已处理的 commandId 集合(线程外) */
const processedCommandIds = new Set<string>();

/** 清空去重缓存(例如重置战斗时) */
export function clearProcessedCommands(): void {
  processedCommandIds.clear();
}

/** 调试 RNG 注入器(给 DEBUG_FORCE_NEXT_ROLL 用) */
const pendingForcedRolls: Array<'hit' | 'miss' | 'crit' | 'no-crit'> = [];

export function pushForcedRoll(roll: 'hit' | 'miss' | 'crit' | 'no-crit'): void {
  pendingForcedRolls.push(roll);
}

export function popForcedRoll(): 'hit' | 'miss' | 'crit' | 'no-crit' | null {
  return pendingForcedRolls.shift() ?? null;
}

export function hasForcedRoll(): boolean {
  return pendingForcedRolls.length > 0;
}

export function dispatchGameCommand(state: BattleState, command: GameCommand): BattleState {
  // 去重
  if (processedCommandIds.has(command.commandId)) {
    throw new DuplicateCommandError(command.commandId);
  }

  const next: BattleState = { ...state, transactionId: nextTransactionId(), sequence: 0 };
  const ctx = new BattleContext(next);
  applyCommand(ctx, command);
  ctx.commit();
  assertInvariants(ctx.state);

  processedCommandIds.add(command.commandId);
  return ctx.state;
}

function applyCommand(ctx: BattleContext, command: GameCommand): void {
  switch (command.type) {
    case 'START_BATTLE': {
      ctx.emit('BATTLE_STARTED', {
        battleId: command.battleId,
        heroIds: command.heroIds,
        enemyIds: command.enemyIds,
      });
      return;
    }
    case 'START_ROUND': {
      startRound(ctx);
      return;
    }
    case 'BEGIN_TURN': {
      beginTurn(ctx, command.actorId);
      return;
    }
    case 'USE_SKILL': {
      // 检查强制 RNG
      consumeForcedRolls();
      useSkill(ctx, command.actorId, command.skillId, command.targetIds);
      return;
    }
    case 'END_TURN': {
      endTurn(ctx);
      return;
    }
    case 'END_BATTLE': {
      ctx.state.phase = command.outcome;
      ctx.state.activeActorId = null;
      ctx.emit('BATTLE_ENDED', {
        battleId: ctx.state.id,
        outcome: command.outcome,
        rounds: ctx.state.round,
      });
      return;
    }
    case 'DEBUG_SET_HP': {
      const a = findActorInLists(ctx.state, command.actorId);
      if (!a) throw new CommandError(`DEBUG_SET_HP: actor ${command.actorId} not found`);
      ctx.updateActor({ ...a, hp: Math.max(0, Math.min(a.maxHp, command.hp)) });
      return;
    }
    case 'DEBUG_APPLY_STATUS': {
      const a = findActorInLists(ctx.state, command.actorId);
      if (!a) throw new CommandError(`DEBUG_APPLY_STATUS: actor ${command.actorId} not found`);
      applyDebugStatus(ctx, a, command.status, command.params);
      return;
    }
    case 'DEBUG_FORCE_NEXT_ROLL': {
      pushForcedRoll(command.rollType);
      return;
    }
    case 'DEBUG_MOVE_ACTOR': {
      const a = findActorInLists(ctx.state, command.actorId);
      if (!a) throw new CommandError(`DEBUG_MOVE_ACTOR: actor ${command.actorId} not found`);
      ctx.updateActor({ ...a, rank: command.targetRank });
      return;
    }
  }
}

function consumeForcedRolls(): void {
  // 把 force roll 转化为下游可消费的"标志"——目前只是清空,实现留待 skill 阶段
  // Phase 1 简化:仅记录,不影响实际随机(供调试面板观察)
  while (pendingForcedRolls.length > 0) {
    pendingForcedRolls.shift();
  }
}

function applyDebugStatus(
  ctx: BattleContext,
  actor: BattleActor,
  status: 'bleed' | 'blight' | 'stun' | 'mark' | 'prot_buff',
  params: Record<string, number>,
): void {
  if (status === 'bleed' || status === 'blight') {
    const dotId = `debug_${status}_${actor.id}_${Date.now()}_${ctx.state.log.length}`;
    const dot = {
      id: dotId,
      type: status,
      damagePerTurn: params.damage ?? 2,
      remainingTurns: params.duration ?? 3,
      sourceId: 'debug',
    };
    const list = status === 'bleed' ? actor.bleed : actor.blight;
    ctx.updateActor({
      ...actor,
      [status === 'bleed' ? 'bleed' : 'blight']: [...list, dot],
    } as BattleActor);
  } else if (status === 'stun') {
    ctx.updateActor({
      ...actor,
      stun: {
        remaining: params.duration ?? 1,
        resistRemaining: 0,
      },
    });
  } else if (status === 'mark') {
    ctx.updateActor({
      ...actor,
      mark: {
        remaining: params.duration ?? 2,
        sourceId: 'debug',
      },
    });
  } else if (status === 'prot_buff') {
    ctx.updateActor({
      ...actor,
      protBuff: {
        amount: params.amount ?? 20,
        remaining: params.duration ?? 2,
        sourceId: 'debug',
      },
    });
  }
}

/** 给"如果非战斗"的其他命令预留(Phase 1+ 实现) */
export function isBattleOver(state: BattleState): boolean {
  return state.phase === 'victory' || state.phase === 'defeat';
}

export function _internalFindActor(state: BattleState, id: string) {
  return findActorInLists(state, id);
}

export function _liveEnemies(state: BattleState) {
  return liveEnemies(state);
}

export function _liveAllies(state: BattleState) {
  return liveAllies(state);
}

// Re-export type
type BattleActor = import('./types.js').BattleActor;
