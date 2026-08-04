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
  // Phase 4:怪癖 + 疾病
  | { type: 'GRANT_QUIRK'; heroId: string; quirkId: string; commandId: string }
  | { type: 'REMOVE_QUIRK'; heroId: string; quirkId: string; commandId: string }
  | { type: 'LOCK_POSITIVE_QUIRK'; heroId: string; quirkId: string; commandId: string }
  | { type: 'GRANT_DISEASE'; heroId: string; diseaseId: string; source: string; commandId: string }
  | { type: 'TREAT_DISEASE'; heroId: string; diseaseId: string; commandId: string }
  // Phase 4 饰品
  | { type: 'LOOT_TRINKET'; definitionId: string; week: number; source: string; commandId: string }
  | { type: 'EQUIP_TRINKET'; heroId: string; instanceId: string; slotIndex: number; commandId: string }
  | { type: 'UNEQUIP_TRINKET'; heroId: string; slotIndex: number; commandId: string }
  | { type: 'PROCESS_DEATH_RECOVERY'; heroId: string; choice: 'recover-one' | 'abandon-all' | 'emergency-retreat'; commandId: string }
  // Phase 4 成长深化
  | { type: 'GRANT_XP'; heroId: string; amount: number; commandId: string }
  // Phase 4 P4.4 露营系统(SPEC §10/§11/§12/§13/§14)
  | { type: 'START_CAMP'; commandId: string }
  | { type: 'CHOOSE_CAMP_FOOD'; choiceId: import('../camps/types.js').CampFoodChoiceId; commandId: string }
  | { type: 'CHOOSE_CAMP_ACTIVITY'; activityId: string; targetHeroId?: string; commandId: string }
  | { type: 'FINISH_CAMP'; commandId: string }
  | { type: 'RESOLVE_NIGHT_AMBUSH'; commandId: string }
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
  | { type: 'DEBUG_REVIVE_HERO'; heroId: string; commandId: string }
  // Phase 4 P4.4 露营调试
  | { type: 'DEBUG_FORCE_CAMP'; nodeId?: string; commandId: string }
  | { type: 'DEBUG_SET_CAMP_POINTS'; value: number; commandId: string }
  | { type: 'DEBUG_FORCE_NIGHT_AMBUSH'; prevent: boolean; commandId: string }
  | { type: 'DEBUG_ADD_EXPEDITION_BUFF'; tag: string; magnitude: number; remainingNodes: number; commandId: string }
  // Phase 5 区域系统
  | { type: 'SELECT_REGION'; regionId: import('../regions/types.js').RegionId; commandId: string }
  | { type: 'GENERATE_REGION_QUEST'; regionId: import('../regions/types.js').RegionId; questLength: 'short' | 'medium'; commandId: string }
  | { type: 'GRANT_REGION_EXPERIENCE'; regionId: import('../regions/types.js').RegionId; amount: number; commandId: string }
  | { type: 'DISCOVER_REGION_CONTENT'; regionId: import('../regions/types.js').RegionId; contentType: 'enemy' | 'curio' | 'trap' | 'disease' | 'trinket'; contentId: string; commandId: string }
  | { type: 'MARK_BOSS_QUEST_READY'; regionId: import('../regions/types.js').RegionId; commandId: string }
  // Phase 5 调试
  | { type: 'DEBUG_SET_REGION_LEVEL'; regionId: import('../regions/types.js').RegionId; level: number; commandId: string }
  | { type: 'DEBUG_FORCE_REGION_QUEST'; regionId: import('../regions/types.js').RegionId; commandId: string }
  | { type: 'DEBUG_FORCE_ELITE_NODE'; commandId: string }
  | { type: 'DEBUG_EXPORT_REGION_PACKAGE'; commandId: string }
  // Phase 6 Boss 命令(SPEC §24)
  | { type: 'START_BOSS_INVESTIGATION'; bossId: import('../boss/types.js').BossId; commandId: string }
  | { type: 'GRANT_BOSS_INTELLIGENCE'; bossId: import('../boss/types.js').BossId; entryId: string; commandId: string }
  | { type: 'COMPLETE_BOSS_INVESTIGATION_QUEST'; questId: string; commandId: string }
  | { type: 'COMPLETE_BOSS_WEAKENING_QUEST'; questId: string; commandId: string }
  | { type: 'UNLOCK_BOSS_HUNT'; bossId: import('../boss/types.js').BossId; commandId: string }
  | { type: 'START_BOSS_FINAL_QUEST'; bossId: import('../boss/types.js').BossId; commandId: string }
  | { type: 'ENTER_BOSS_ENCOUNTER'; bossId: import('../boss/types.js').BossId; commandId: string }
  | { type: 'SELECT_BOSS_TACTICAL_OPTION'; decisionId: string; choiceId: string; commandId: string }
  | { type: 'RESOLVE_BOSS_PHASE_TRANSITION'; bossId: import('../boss/types.js').BossId; commandId: string }
  | { type: 'INTERACT_BOSS_ENVIRONMENT_TARGET'; targetId: string; choiceId: string; commandId: string }
  | { type: 'ATTEMPT_BOSS_RETREAT'; bossId: import('../boss/types.js').BossId; commandId: string }
  | { type: 'RESOLVE_BOSS_DEFEAT'; bossId: import('../boss/types.js').BossId; commandId: string }
  | { type: 'RESOLVE_BOSS_FAILURE'; bossId: import('../boss/types.js').BossId; commandId: string }
  // Phase 6 Boss 调试(SPEC §39)
  | { type: 'DEBUG_SET_REGION_THREAT'; regionId: import('../regions/types.js').RegionId; value: number; commandId: string }
  | { type: 'DEBUG_SET_REGION_THREAT_STATE'; regionId: import('../regions/types.js').RegionId; state: import('../boss/types.js').RegionThreatState; commandId: string }
  | { type: 'DEBUG_SET_BOSS_STATUS'; bossId: import('../boss/types.js').BossId; status: import('../boss/types.js').BossStatus; commandId: string }
  | { type: 'DEBUG_GRANT_BOSS_INTELLIGENCE'; bossId: import('../boss/types.js').BossId; entryId: string; commandId: string }
  | { type: 'DEBUG_REMOVE_BOSS_INTELLIGENCE'; bossId: import('../boss/types.js').BossId; entryId: string; commandId: string }
  | { type: 'DEBUG_COMPLETE_BOSS_QUEST'; questId: string; commandId: string }
  | { type: 'DEBUG_ADD_BOSS_WEAKENING'; bossId: import('../boss/types.js').BossId; weakeningId: string; commandId: string }
  | { type: 'DEBUG_REMOVE_BOSS_WEAKENING'; bossId: import('../boss/types.js').BossId; weakeningId: string; commandId: string }
  | { type: 'DEBUG_UNLOCK_BOSS_HUNT'; bossId: import('../boss/types.js').BossId; commandId: string }
  | { type: 'DEBUG_JUMP_BOSS_PHASE'; bossId: import('../boss/types.js').BossId; phaseIndex: number; commandId: string }
  | { type: 'DEBUG_SET_BOSS_HP'; bossId: import('../boss/types.js').BossId; value: number; commandId: string }
  | { type: 'DEBUG_FORCE_BOSS_SUMMON'; bossId: import('../boss/types.js').BossId; summonId: string; commandId: string }
  | { type: 'DEBUG_FORCE_BOSS_PHASE_TRANSITION'; bossId: import('../boss/types.js').BossId; commandId: string }
  | { type: 'DEBUG_FORCE_BOSS_RETREAT'; bossId: import('../boss/types.js').BossId; success: boolean; commandId: string }
  | { type: 'DEBUG_FORCE_BOSS_DEFEAT'; bossId: import('../boss/types.js').BossId; commandId: string }
  | { type: 'DEBUG_RESET_BOSS_STATE'; bossId: import('../boss/types.js').BossId; commandId: string };

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
