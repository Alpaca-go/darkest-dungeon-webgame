/**
 * 远征层命令(SPEC §28)
 *
 * 替代旧的战斗命令。新流程:
 *   START_EXPEDITION       启动一次远征
 *   SELECT_ROUTE           在 route-fork 节点选一条边
 *   SELECT_TRAVEL_PACE     选择行进方式(部分路线提供)
 *   CHOOSE_EVENT_OPTION    选一个事件选项
 *   CHOOSE_TACTICAL_OPTION 选一个战术方案
 *   DISCARD_INVENTORY_ITEM 丢弃物品
 *   USE_INVENTORY_ITEM     使用物品(在遭遇或节点)
 *   REQUEST_RETREAT        发起撤退
 *   CONFIRM_RETREAT        确认撤退
 *   CONTINUE_AFTER_RESULT  看完结果,继续
 *
 * 调试命令(SPEC §34):
 *   DEBUG_SET_TORCH / DEBUG_SET_FOOD / DEBUG_SET_HP
 *   DEBUG_GRANT_ITEM / DEBUG_MOVE_HERO
 *   DEBUG_TRIGGER_HUNGER / DEBUG_TRIGGER_TRAP
 *   DEBUG_FORCE_ENCOUNTER / DEBUG_TELEPORT_NODE
 *
 * 每个命令都带 commandId,dispatcher 去重。
 */

import type { ItemId } from './types.js';

let commandCounter = 0;

export function newCommandId(prefix = 'cmd'): string {
  commandCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${commandCounter.toString(36)}`;
}

export type TravelPace = 'normal' | 'careful' | 'rush';

export type GameCommand =
  // 远征主流程
  | { type: 'START_EXPEDITION'; loadoutId: string; commandId: string }
  | { type: 'SELECT_ROUTE'; decisionId: string; choiceId: string; commandId: string }
  | { type: 'SELECT_TRAVEL_PACE'; decisionId: string; pace: TravelPace; commandId: string }
  | { type: 'CHOOSE_EVENT_OPTION'; decisionId: string; choiceId: string; commandId: string }
  | { type: 'CHOOSE_TACTICAL_OPTION'; decisionId: string; choiceId: string; commandId: string }
  | { type: 'DISCARD_INVENTORY_ITEM'; decisionId: string; stackId: string; count: number; commandId: string }
  | { type: 'USE_INVENTORY_ITEM'; decisionId: string; stackId: string; targetHeroId?: string; commandId: string }
  | { type: 'REQUEST_RETREAT'; commandId: string }
  | { type: 'CONFIRM_RETREAT'; commandId: string }
  | { type: 'CONTINUE_AFTER_RESULT'; commandId: string }
  // Phase 3 庄园(SPEC §5 §6 §8 §15 §17)
  | { type: 'COMPLETE_EXPEDITION_RETURN'; commandId: string }
  | { type: 'ADVANCE_WEEK'; commandId: string }
  | { type: 'SET_HAMLET_MODE'; mode: 'weekly-summary' | 'roster' | 'treatment' | 'recruitment' | 'upgrades' | 'graveyard' | 'quest-selection' | 'party-formation' | 'provisioning'; commandId: string }
  | { type: 'RECRUIT_HERO'; candidateId: string; baseActor: { maxHp: number; dodge: number; speed: number; accuracy: number; crit: number; skills: string[]; rank: 1 | 2 | 3 | 4 }; commandId: string }
  | { type: 'DISMISS_HERO'; heroId: string; commandId: string }
  | { type: 'ASSIGN_HERO_TO_FACILITY'; heroId: string; facilityId: string; serviceId: string; commandId: string }
  | { type: 'CANCEL_FACILITY_ASSIGNMENT'; heroId: string; facilityId: string; commandId: string }
  | { type: 'UPGRADE_FACILITY'; facilityId: string; upgradeOptionId: string; commandId: string }
  | { type: 'UPGRADE_HERO_SKILL'; heroId: string; skillId: string; commandId: string }
  | { type: 'UPGRADE_HERO_WEAPON'; heroId: string; commandId: string }
  | { type: 'UPGRADE_HERO_ARMOR'; heroId: string; commandId: string }
  | { type: 'SELECT_WEEKLY_QUEST'; questId: string; commandId: string }
  | { type: 'SET_PARTY'; heroIds: string[]; commandId: string }
  | { type: 'BUY_PROVISION'; itemId: import('./types.js').ItemId; count: number; commandId: string }
  | { type: 'REMOVE_PROVISION'; itemId: import('./types.js').ItemId; count: number; commandId: string }
  | { type: 'SETTLE_PROVISION'; commandId: string }
  | { type: 'START_SELECTED_EXPEDITION'; commandId: string }
  // Phase 2:精神系统命令(由规则引擎自动派发,UI 不直接调用)
  | { type: 'APPLY_STRESS'; heroId: string; amount: number; source: string; commandId: string }
  | { type: 'RESOLVE_CHECK'; heroId: string; commandId: string }
  | { type: 'RESOLVE_AFFLICTION_BEHAVIOR'; heroId: string; trigger: string; commandId: string }
  | { type: 'RESOLVE_VIRTUE_BEHAVIOR'; heroId: string; trigger: string; commandId: string }
  | { type: 'CHOOSE_DEATHS_DOOR_RESPONSE'; decisionId: string; choiceId: string; commandId: string }
  | { type: 'RESOLVE_DEATHBLOW'; heroId: string; sourceId: string; commandId: string }
  | { type: 'CONFIRM_HERO_DEATH_RESULT'; deathRecordId: string; commandId: string }
  | { type: 'DISMISS_OVERLAY'; commandId: string }
  // 调试
  | { type: 'DEBUG_SET_TORCH'; value: number; commandId: string }
  | { type: 'DEBUG_SET_FOOD'; value: number; commandId: string }
  | { type: 'DEBUG_SET_HP'; heroId: string; value: number; commandId: string }
  | { type: 'DEBUG_GRANT_ITEM'; itemId: ItemId; count: number; commandId: string }
  | { type: 'DEBUG_MOVE_HERO'; heroId: string; rank: 1 | 2 | 3 | 4; commandId: string }
  | { type: 'DEBUG_TRIGGER_HUNGER'; commandId: string }
  | { type: 'DEBUG_TRIGGER_TRAP'; commandId: string }
  | { type: 'DEBUG_FORCE_ENCOUNTER'; encounterDefId: string; commandId: string }
  | { type: 'DEBUG_TELEPORT_NODE'; nodeId: string; commandId: string }
  // Phase 2 调试
  | { type: 'DEBUG_SET_STRESS'; heroId: string; value: number; commandId: string }
  | { type: 'DEBUG_SET_DEATHS_DOOR'; heroId: string; value: boolean; commandId: string }
  | { type: 'DEBUG_FORCE_AFFLICTION'; heroId: string; afflictionId: string; commandId: string }
  | { type: 'DEBUG_FORCE_VIRTUE'; heroId: string; virtueId: string; commandId: string }
  | { type: 'DEBUG_FORCE_HEART_ATTACK'; heroId: string; commandId: string }
  | { type: 'DEBUG_FORCE_DEATHBLOW_SUCCESS'; heroId: string; commandId: string }
  | { type: 'DEBUG_FORCE_DEATHBLOW_FAIL'; heroId: string; commandId: string }
  | { type: 'DEBUG_REVIVE_HERO'; heroId: string; commandId: string };

export type CommandType = GameCommand['type'];

/** 调试包导出(给 persistence / DebugPanel 用) */
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
