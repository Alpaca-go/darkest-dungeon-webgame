/**
 * 命令(Command)
 *
 * Phase 1 范围:
 * - 战斗命令(START_BATTLE, START_ROUND, BEGIN_TURN, USE_SKILL, END_TURN, END_BATTLE)
 * - 调试命令(DEBUG_SET_HP, DEBUG_APPLY_STATUS, DEBUG_FORCE_NEXT_ROLL, DEBUG_MOVE_ACTOR)
 *
 * 所有命令都带 commandId 用于去重
 */

import type { Rank } from './types.js';

export type GameCommand =
  | { type: 'START_BATTLE'; battleId: string; heroIds: string[]; enemyIds: string[]; commandId: string }
  | { type: 'START_ROUND'; commandId: string }
  | { type: 'BEGIN_TURN'; actorId: string; commandId: string }
  | { type: 'USE_SKILL'; actorId: string; skillId: string; targetIds: string[]; commandId: string }
  | { type: 'END_TURN'; commandId: string }
  | { type: 'END_BATTLE'; outcome: 'victory' | 'defeat'; commandId: string }
  // 调试命令
  | { type: 'DEBUG_SET_HP'; actorId: string; hp: number; commandId: string }
  | {
      type: 'DEBUG_APPLY_STATUS';
      actorId: string;
      status: 'bleed' | 'blight' | 'stun' | 'mark' | 'prot_buff';
      params: Record<string, number>;
      commandId: string;
    }
  | {
      type: 'DEBUG_FORCE_NEXT_ROLL';
      rollType: 'hit' | 'miss' | 'crit' | 'no-crit';
      commandId: string;
    }
  | { type: 'DEBUG_MOVE_ACTOR'; actorId: string; targetRank: Rank; commandId: string };

export type CommandType = GameCommand['type'];

let commandCounter = 0;

/** 生成一个唯一的 commandId */
export function newCommandId(prefix = 'cmd'): string {
  commandCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${commandCounter.toString(36)}`;
}

/** 调试包导出 */
export interface DebugPackage {
  gameVersion: string;
  contentVersion: string;
  seed: string;
  state: unknown;
  commands: unknown[];
  events: unknown[];
  rng: unknown;
  error?: { message: string; stack?: string };
}
