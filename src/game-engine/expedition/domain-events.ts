/**
 * 远征层域事件(SPEC §30)
 *
 * 所有远征级别状态变化都走事件。事件携带:
 * - id(全局唯一)
 * - transactionId
 * - sequence
 * - type
 * - payload
 * - rngBefore / rngAfter(可复现)
 * - createdAt
 *
 * 选择式遭遇自动结算时,底层 BattleDomainEvent 也会嵌入 encounter.events
 * (序列以 "enc.{encounterId}." 前缀),从而保留完整战斗日志。
 */

import type { RngState } from '../rng/types.js';
import type { ItemId, RiskLevel, TorchLevel, ScoutLevel, HeroCondition } from './types.js';

export type ExpeditionDomainEventType =
  // 远征生命周期
  | 'EXPEDITION_STARTED'
  | 'EXPEDITION_SUCCEEDED'
  | 'EXPEDITION_RETREATED'
  | 'EXPEDITION_FAILED'
  // 路线 / 节点
  | 'NODE_ENTERED'
  | 'ROUTE_SELECTED'
  | 'TRAVEL_STARTED'
  | 'TRAVEL_COMPLETED'
  // 资源
  | 'TORCH_CHANGED'
  | 'FOOD_CHANGED'
  | 'TIME_ADVANCED'
  | 'ITEM_CONSUMED'
  | 'ITEM_GRANTED'
  | 'ITEM_DISCARDED'
  | 'INVENTORY_FULL'
  // 侦察
  | 'SCOUT_GRANTED'
  // 英雄
  | 'HERO_HP_CHANGED'
  | 'HERO_RANK_CHANGED'
  | 'HERO_CONDITION_CHANGED'
  | 'HERO_DIED'
  // 状态
  | 'STATUS_APPLIED'
  | 'STATUS_WORE_OFF'
  // Phase 2: 精神
  | 'STRESS_APPLIED'
  | 'STRESS_REDUCED'
  | 'RESOLVE_CHECK_STARTED'
  | 'RESOLVE_CHECK_SUCCEEDED'
  | 'AFFLICTION_GAINED'
  | 'VIRTUE_GAINED'
  | 'AFFLICTION_BEHAVIOR_TRIGGERED'
  | 'AFFLICTION_CHOICE_REFUSED'
  | 'AFFLICTION_CHOICE_REPLACED'
  | 'VIRTUE_BEHAVIOR_TRIGGERED'
  | 'PARTY_STRESS_PULSE_CREATED'
  | 'HEART_ATTACK_TRIGGERED'
  | 'DEATHS_DOOR_ENTERED'
  | 'DEATHS_DOOR_EXITED'
  | 'DEATHS_DOOR_RECOVERY_APPLIED'
  | 'DEATHBLOW_CHECK_STARTED'
  | 'DEATHBLOW_RESISTED'
  | 'HERO_PERMANENTLY_DIED'
  | 'DEATH_RECORD_CREATED'
  | 'HERO_REMOVED_FROM_PARTY'
  | 'TACTICAL_OPTIONS_REGENERATED'
  // Phase 2: 覆盖层生命周期
  | 'OVERLAY_SHOWN'
  | 'OVERLAY_DISMISSED'
  // 事件
  | 'EVENT_STARTED'
  | 'CHOICE_SELECTED'
  | 'CHOICE_RESOLVED'
  // 遭遇
  | 'ENCOUNTER_STARTED'
  | 'TACTICAL_PLAN_SELECTED'
  | 'HERO_ACTION_RESOLVED'
  | 'ENEMY_ACTION_RESOLVED'
  | 'DAMAGE_APPLIED'
  | 'HEALING_APPLIED'
  | 'ACTOR_DEFEATED'
  | 'ACTOR_MOVED'
  | 'ENCOUNTER_WON'
  | 'ENCOUNTER_ESCAPED'
  // 任务
  | 'OBJECTIVE_COMPLETED'
  // 撤退
  | 'RETREAT_REQUESTED'
  // 饥饿 / 陷阱 / 奇物 / 路障
  | 'HUNGER_TRIGGERED'
  | 'TRAP_TRIGGERED'
  | 'CURIO_INTERACTED'
  | 'OBSTACLE_RESOLVED'
  // 决策生命周期
  | 'DECISION_CREATED'
  | 'DECISION_RESOLVED'
  // Phase 3 庄园
  | 'EXPEDITION_RETURNED'
  | 'WEEK_ADVANCED'
  | 'HAMLET_MODE_CHANGED'
  | 'HERO_RECRUITED'
  | 'HERO_DISMISSED'
  | 'HERO_ASSIGNED_TO_FACILITY'
  | 'HERO_REMOVED_FROM_FACILITY'
  | 'FACILITY_UPGRADED'
  | 'HERO_SKILL_UPGRADED'
  | 'HERO_WEAPON_UPGRADED'
  | 'HERO_ARMOR_UPGRADED'
  | 'QUEST_SELECTED'
  | 'PARTY_SET'
  | 'PROVISION_ADDED'
  | 'PROVISION_REMOVED'
  | 'PROVISION_SETTLED'
  | 'EXPEDITION_STARTED_FROM_HAMLET'
  // Phase 4:怪癖 + 疾病
  | 'QUIRK_GAINED'
  | 'QUIRK_REPLACED'
  | 'QUIRK_LOCKED'
  | 'QUIRK_REMOVED'
  | 'QUIRK_BEHAVIOR_TRIGGERED'
  | 'DISEASE_GAINED'
  | 'DISEASE_TREATED'
  | 'TRINKET_LOOTED'
  | 'TRINKET_EQUIPPED'
  | 'TRINKET_UNEQUIPPED'
  | 'TRINKET_LOST'
  | 'TRINKET_RECOVERED'
  | 'HERO_RESOLVE_LEVEL_INCREASED'
  | 'HERO_SKILL_LEVEL_INCREASED'
  | 'HERO_WEAPON_LEVEL_INCREASED'
  | 'HERO_ARMOR_LEVEL_INCREASED'
  | 'CAMP_STARTED'
  | 'CAMP_FOOD_CONSUMED'
  | 'CAMP_ACTIVITY_SELECTED'
  | 'CAMP_POINTS_SPENT'
  | 'CAMP_BUFF_APPLIED'
  | 'CAMP_STRESS_REDUCED'
  | 'CAMP_HEALING_APPLIED'
  | 'NIGHT_AMBUSH_CHECK_STARTED'
  | 'NIGHT_AMBUSH_PREVENTED'
  | 'NIGHT_AMBUSH_TRIGGERED'
  | 'CAMP_COMPLETED'
  // Phase 5 区域事件
  | 'REGION_SELECTED'
  | 'REGION_ROUTE_GENERATED'
  | 'REGION_RULE_APPLIED'
  | 'REGION_CONTENT_DISCOVERED'
  | 'REGION_ENEMY_DISCOVERED'
  | 'REGION_CURIO_DISCOVERED'
  | 'REGION_TRAP_DISCOVERED'
  | 'REGION_DISEASE_DISCOVERED'
  | 'REGION_TRINKET_DISCOVERED'
  | 'REGION_EXPERIENCE_GRANTED'
  | 'REGION_LEVEL_INCREASED'
  | 'REGION_CONTENT_UNLOCKED'
  | 'REGION_ELITE_UNLOCKED'
  | 'REGION_RARE_LOOT_UNLOCKED'
  | 'REGION_BOSS_QUEST_MARKED_READY'
  | 'QUEST_MODIFIER_APPLIED'
  | 'REGION_REWARD_GRANTED'
  // Phase 6 Boss 事件(SPEC §25)
  | 'BOSS_RUMOR_DISCOVERED'
  | 'BOSS_INVESTIGATION_STARTED'
  | 'BOSS_INTELLIGENCE_GRANTED'
  | 'BOSS_INVESTIGATION_QUEST_COMPLETED'
  | 'BOSS_WEAKENING_QUEST_COMPLETED'
  | 'BOSS_WEAKENING_EFFECT_APPLIED'
  | 'BOSS_HUNT_UNLOCKED'
  | 'BOSS_FINAL_QUEST_STARTED'
  | 'BOSS_ENCOUNTER_STARTED'
  | 'BOSS_PHASE_TRANSITIONED'
  | 'BOSS_PHASE_ENTERED'
  | 'BOSS_RETREAT_ATTEMPTED'
  | 'BOSS_RETREAT_SUCCEEDED'
  | 'BOSS_RETREAT_FAILED'
  | 'BOSS_ENCOUNTER_FAILED'
  | 'BOSS_DEFEATED'
  | 'BOSS_PERMANENT_REWARD_GRANTED'
  | 'REGION_THREAT_CHANGED'
  | 'REGION_THREAT_STATE_CHANGED'
  | 'CAMPAIGN_THREAT_ADVANCED'
  | 'FINAL_CAMPAIGN_GATE_MARKED_READY';

export interface BaseDomainEvent<T extends ExpeditionDomainEventType, P> {
  id: string;
  transactionId: string;
  sequence: number;
  type: T;
  payload: P;
  rngBefore: RngState;
  rngAfter: RngState;
  createdAt: string;
}

// ----- Payloads -----

export type ExpeditionStartedPayload = {
  expeditionId: string;
  routeId: string;
  seed: string;
  startNodeId: string;
};
export type ExpeditionSucceededPayload = {
  expeditionId: string;
  objectiveNodeId: string;
  exitNodeId: string;
};
export type ExpeditionRetreatedPayload = {
  expeditionId: string;
  fromNodeId: string;
  reason: 'manual' | 'forced';
};
export type ExpeditionFailedPayload = {
  expeditionId: string;
  reason: string;
  fromNodeId: string;
};

export type NodeEnteredPayload = {
  nodeId: string;
  nodeType: string;
  depth: number;
};
export type RouteSelectedPayload = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  riskTag: RiskLevel;
};
export type TravelStartedPayload = {
  edgeId: string;
  pace: 'normal' | 'careful' | 'rush';
  estimatedTime: number;
  estimatedTorch: number;
};
export type TravelCompletedPayload = {
  edgeId: string;
  actualTime: number;
  actualTorch: number;
  ambushed: boolean;
  trapTriggered: boolean;
};

export type TorchChangedPayload = {
  from: number;
  to: number;
  level: TorchLevel;
  reason: string;
};
export type FoodChangedPayload = {
  from: number;
  to: number;
  reason: string;
};
export type TimeAdvancedPayload = {
  from: number;
  to: number;
  reason: string;
};
export type ItemConsumedPayload = {
  itemId: ItemId;
  count: number;
  source: string;
  targetHeroId?: string;
};
export type ItemGrantedPayload = {
  itemId: ItemId;
  count: number;
  source: string;
};
export type ItemDiscardedPayload = {
  itemId: ItemId;
  count: number;
  reason: 'inventory-full' | 'manual' | 'abandoned';
};
export type InventoryFullPayload = { capacity: number; stacks: number };

export type ScoutGrantedPayload = {
  fromLevel: ScoutLevel;
  toLevel: ScoutLevel;
  source: string;
};

export type HeroHpChangedPayload = {
  heroId: string;
  from: number;
  to: number;
  source: string;
};
export type HeroRankChangedPayload = {
  heroId: string;
  from: number;
  to: number;
  reason: string;
};
export type HeroConditionChangedPayload = {
  heroId: string;
  gained: HeroCondition[];
  lost: HeroCondition[];
};
export type HeroDiedPayload = { heroId: string; cause: string };

export type StatusAppliedPayload = {
  heroId: string;
  status: 'bleed' | 'blight' | 'stun' | 'mark' | 'prot_buff';
  duration: number;
  source: string;
};
export type StatusWoreOffPayload = {
  heroId: string;
  status: 'bleed' | 'blight' | 'stun' | 'mark' | 'prot_buff';
};

export type EventStartedPayload = {
  eventId: string;
  nodeId: string;
  trigger: string;
};
export type ChoiceSelectedPayload = {
  decisionId: string;
  choiceId: string;
  sourceDefinitionId: string;
};
export type ChoiceResolvedPayload = {
  decisionId: string;
  choiceId: string;
  outcomes: { narrativeHint?: string; status: 'success' | 'failure' | 'partial' }[];
};

export type EncounterStartedPayload = {
  encounterId: string;
  encounterDefId: string;
  nodeId: string;
  heroIds: string[];
  enemyIds: string[];
};
export type TacticalPlanSelectedPayload = {
  encounterId: string;
  planType: string;
  choiceId: string;
  primaryHeroId?: string;
};
export type HeroActionResolvedPayload = {
  encounterId: string;
  heroId: string;
  skillId: string;
  targetIds: string[];
  hit: boolean;
  damage: number;
  crit: boolean;
  effects: string[];
};
export type EnemyActionResolvedPayload = {
  encounterId: string;
  enemyId: string;
  skillId: string;
  targetIds: string[];
  hit: boolean;
  damage: number;
  crit: boolean;
  effects: string[];
};
export type DamageAppliedPayload = {
  encounterId?: string;
  sourceId: string;
  targetId: string;
  amount: number;
  preHp: number;
  postHp: number;
  crit: boolean;
  blockedByProt: number;
};
export type HealingAppliedPayload = {
  encounterId?: string;
  sourceId: string;
  targetId: string;
  amount: number;
  preHp: number;
  postHp: number;
};
export type ActorDefeatedPayload = {
  encounterId?: string;
  actorId: string;
  side: 'ally' | 'enemy';
  cause: string;
};
export type ActorMovedPayload = {
  encounterId?: string;
  actorId: string;
  fromRank: number;
  toRank: number;
  reason: string;
};
export type EncounterWonPayload = {
  encounterId: string;
  encounterDefId: string;
  rounds: number;
};
export type EncounterEscapedPayload = {
  encounterId: string;
  encounterDefId: string;
  rounds: number;
};

export type ObjectiveCompletedPayload = {
  objectiveId: string;
  nodeId: string;
};
export type RetreatRequestedPayload = { fromNodeId: string; reason: string };
export type HungerTriggeredPayload = { nodeId: string; timeElapsed: number; food: number };
export type TrapTriggeredPayload = { trapId: string; nodeId: string; heroId?: string; effects: string[] };
export type CurioInteractedPayload = { curioId: string; nodeId: string; choiceId: string; outcome: 'positive' | 'negative' | 'mixed' | 'unknown' };
export type ObstacleResolvedPayload = { obstacleId: string; nodeId: string; method: string; cost: string };

export type DecisionCreatedPayload = {
  decisionId: string;
  type: string;
  contextId: string;
  choiceCount: number;
};
export type DecisionResolvedPayload = {
  decisionId: string;
  choiceId: string;
};

// ----- Phase 2 精神事件 Payloads -----

export type StressAppliedPayload = {
  heroId: string;
  amount: number;
  source: string;
  newTotal: number;
};
export type StressReducedPayload = {
  heroId: string;
  amount: number;
  source: string;
  newTotal: number;
};
export type ResolveCheckStartedPayload = {
  heroId: string;
  stress: number;
  virtueChance: number;
};
export type ResolveCheckSucceededPayload = {
  heroId: string;
  result: 'afflicted' | 'virtuous';
  afflictionId?: string;
  virtueId?: string;
};
export type AfflictionGainedPayload = {
  heroId: string;
  afflictionId: string;
  stress: number;
};
export type VirtueGainedPayload = {
  heroId: string;
  virtueId: string;
  stress: number;
};
export type AfflictionBehaviorTriggeredPayload = {
  heroId: string;
  afflictionId: string;
  behaviorId: string;
  effect: string;
  narrative: string;
};
export type AfflictionChoiceRefusedPayload = {
  heroId: string;
  afflictionId: string;
  originalChoiceId: string;
  reason: string;
};
export type AfflictionChoiceReplacedPayload = {
  heroId: string;
  afflictionId: string;
  originalChoiceId: string;
  newChoiceId: string;
  reason: string;
};
export type VirtueBehaviorTriggeredPayload = {
  heroId: string;
  virtueId: string;
  behaviorId: string;
  effect: string;
  narrative: string;
};
export type PartyStressPulseCreatedPayload = {
  sourceHeroId?: string;
  sourceEventId: string;
  deltas: { heroId: string; amount: number }[];
  reason: string;
};
export type HeartAttackTriggeredPayload = {
  heroId: string;
  fromStress: number;
  virtueBuffer: boolean;
  outcome: 'deaths-door' | 'permanent-death' | 'virtue-saved';
};
export type DeathsDoorEnteredPayload = {
  heroId: string;
  fromHp: number;
  source: string;
};
export type DeathsDoorExitedPayload = {
  heroId: string;
  newHp: number;
  recoveryStacks: number;
};
export type DeathsDoorRecoveryAppliedPayload = {
  heroId: string;
  maxHpDelta: number;
  dodgeDelta: number;
  protDelta: number;
  deathResistDelta: number;
};
export type DeathblowCheckStartedPayload = {
  heroId: string;
  finalResist: number;
};
export type DeathblowResistedPayload = {
  heroId: string;
  penalty: number;
};
export type HeroPermanentlyDiedPayload = {
  heroId: string;
  deathRecordId: string;
  cause: string;
};
export type DeathRecordCreatedPayload = {
  deathRecordId: string;
  heroId: string;
  cause: string;
};
export type HeroRemovedFromPartyPayload = {
  heroId: string;
  newPartySize: number;
};
export type TacticalOptionsRegeneratedPayload = {
  reason: string;
  heroId?: string;
};
export type OverlayShownPayload = {
  overlay: import('./types.js').MentalOverlay;
};
export type OverlayDismissedPayload = {
  overlayKind: string;
};

// ----- Phase 3 庄园事件 Payloads -----

export type ExpeditionReturnedPayload = {
  expeditionId: string;
  succeeded: boolean;
  heroIds: string[];
  deathCount: number;
  lootSummary: { gold: number; portraits: number; crests: number };
};
export type WeekAdvancedPayload = {
  newWeek: number;
  facilityCompleted: { heroId: string; serviceId: string }[];
  notices: { id: string; type: string; priority: number; message: string }[];
};
export type HamletModeChangedPayload = { mode: string };
export type HeroRecruitedPayload = { heroId: string; candidateId: string };
export type HeroDismissedPayload = { heroId: string };
export type HeroAssignedToFacilityPayload = { heroId: string; facilityId: string; serviceId: string };
export type HeroRemovedFromFacilityPayload = { heroId: string; facilityId: string };
export type FacilityUpgradedPayload = { facilityId: string; upgradeOptionId: string; newLevel: number };
export type HeroSkillUpgradedPayload = { heroId: string; skillId: string; newLevel: number };
export type HeroWeaponUpgradedPayload = { heroId: string; newLevel: number };
export type HeroArmorUpgradedPayload = { heroId: string; newLevel: number };
export type QuestSelectedPayload = { questId: string };
export type PartySetPayload = { heroIds: string[] };
export type ProvisionAddedPayload = { itemId: string; count: number };
export type ProvisionRemovedPayload = { itemId: string; count: number };
export type ProvisionSettledPayload = { totalCost: number };
export type ExpeditionStartedFromHamletPayload = { heroIds: string[]; questId: string | null };

// ----- Phase 4 怪癖 + 疾病 + 饰品 + 成长 + 露营 + 夜袭 Payloads -----

export type QuirkGainedPayload = { heroId: string; quirkId: string; replacedId?: string; source: string };
export type QuirkReplacedPayload = { heroId: string; oldQuirkId: string; newQuirkId: string };
export type QuirkLockedPayload = { heroId: string; quirkId: string };
export type QuirkRemovedPayload = { heroId: string; quirkId: string; costGold: number };
export type QuirkBehaviorTriggeredPayload = { heroId: string; quirkId: string; effect: string; narrative: string };
export type DiseaseGainedPayload = { heroId: string; diseaseId: string; source: string };
export type DiseaseTreatedPayload = { heroId: string; diseaseId: string; costGold: number };
export type TrinketLootedPayload = { trinketInstanceId: string; definitionId: string; source: string };
export type TrinketEquippedPayload = { heroId: string; trinketInstanceId: string; slotIndex: number };
export type TrinketUnequippedPayload = { heroId: string; slotIndex: number };
export type TrinketLostPayload = { heroId: string; trinketInstanceId: string; cause: 'death' | 'discard' };
export type TrinketRecoveredPayload = { heroId: string; trinketInstanceId: string };
export type HeroResolveLevelIncreasedPayload = { heroId: string; newLevel: number };
export type HeroSkillLevelIncreasedPayload = { heroId: string; skillId: string; newLevel: number };
export type HeroWeaponLevelIncreasedPayload = { heroId: string; newLevel: number };
export type HeroArmorLevelIncreasedPayload = { heroId: string; newLevel: number };
export type CampStartedPayload = { nodeId: string; totalPoints: number };
export type CampFoodConsumedPayload = { foodSpent: number; choice: 'feast' | 'normal' | 'frugal' | 'none' };
export type CampActivitySelectedPayload = { activityId: string; targetHeroId?: string; costPoints: number };
export type CampPointsSpentPayload = { remainingPoints: number };
export type CampBuffAppliedPayload = { buffId: string; sourceId: string };
export type CampStressReducedPayload = { heroId: string; amount: number };
export type CampHealingAppliedPayload = { heroId: string; amount: number };
export type NightAmbushCheckStartedPayload = { roll: number; prevented: boolean };
export type NightAmbushPreventedPayload = { reason: string };
export type NightAmbushTriggeredPayload = { outcome: 'stress' | 'torch' | 'food' | 'formation' | 'disease' | 'ambush' };
export type CampCompletedPayload = { totalBuffsApplied: number; totalStressReduced: number; totalHealing: number };

// ----- 联合类型 -----

export type ExpeditionDomainEvent =
  // 远征生命周期
  | BaseDomainEvent<'EXPEDITION_STARTED', ExpeditionStartedPayload>
  | BaseDomainEvent<'EXPEDITION_SUCCEEDED', ExpeditionSucceededPayload>
  | BaseDomainEvent<'EXPEDITION_RETREATED', ExpeditionRetreatedPayload>
  | BaseDomainEvent<'EXPEDITION_FAILED', ExpeditionFailedPayload>
  // 路线 / 节点
  | BaseDomainEvent<'NODE_ENTERED', NodeEnteredPayload>
  | BaseDomainEvent<'ROUTE_SELECTED', RouteSelectedPayload>
  | BaseDomainEvent<'TRAVEL_STARTED', TravelStartedPayload>
  | BaseDomainEvent<'TRAVEL_COMPLETED', TravelCompletedPayload>
  // 资源
  | BaseDomainEvent<'TORCH_CHANGED', TorchChangedPayload>
  | BaseDomainEvent<'FOOD_CHANGED', FoodChangedPayload>
  | BaseDomainEvent<'TIME_ADVANCED', TimeAdvancedPayload>
  | BaseDomainEvent<'ITEM_CONSUMED', ItemConsumedPayload>
  | BaseDomainEvent<'ITEM_GRANTED', ItemGrantedPayload>
  | BaseDomainEvent<'ITEM_DISCARDED', ItemDiscardedPayload>
  | BaseDomainEvent<'INVENTORY_FULL', InventoryFullPayload>
  // 侦察
  | BaseDomainEvent<'SCOUT_GRANTED', ScoutGrantedPayload>
  // 英雄
  | BaseDomainEvent<'HERO_HP_CHANGED', HeroHpChangedPayload>
  | BaseDomainEvent<'HERO_RANK_CHANGED', HeroRankChangedPayload>
  | BaseDomainEvent<'HERO_CONDITION_CHANGED', HeroConditionChangedPayload>
  | BaseDomainEvent<'HERO_DIED', HeroDiedPayload>
  // 状态
  | BaseDomainEvent<'STATUS_APPLIED', StatusAppliedPayload>
  | BaseDomainEvent<'STATUS_WORE_OFF', StatusWoreOffPayload>
  // 事件
  | BaseDomainEvent<'EVENT_STARTED', EventStartedPayload>
  | BaseDomainEvent<'CHOICE_SELECTED', ChoiceSelectedPayload>
  | BaseDomainEvent<'CHOICE_RESOLVED', ChoiceResolvedPayload>
  // 遭遇
  | BaseDomainEvent<'ENCOUNTER_STARTED', EncounterStartedPayload>
  | BaseDomainEvent<'TACTICAL_PLAN_SELECTED', TacticalPlanSelectedPayload>
  | BaseDomainEvent<'HERO_ACTION_RESOLVED', HeroActionResolvedPayload>
  | BaseDomainEvent<'ENEMY_ACTION_RESOLVED', EnemyActionResolvedPayload>
  | BaseDomainEvent<'DAMAGE_APPLIED', DamageAppliedPayload>
  | BaseDomainEvent<'HEALING_APPLIED', HealingAppliedPayload>
  | BaseDomainEvent<'ACTOR_DEFEATED', ActorDefeatedPayload>
  | BaseDomainEvent<'ACTOR_MOVED', ActorMovedPayload>
  | BaseDomainEvent<'ENCOUNTER_WON', EncounterWonPayload>
  | BaseDomainEvent<'ENCOUNTER_ESCAPED', EncounterEscapedPayload>
  // 任务
  | BaseDomainEvent<'OBJECTIVE_COMPLETED', ObjectiveCompletedPayload>
  // 撤退
  | BaseDomainEvent<'RETREAT_REQUESTED', RetreatRequestedPayload>
  // 饥饿 / 陷阱 / 奇物 / 路障
  | BaseDomainEvent<'HUNGER_TRIGGERED', HungerTriggeredPayload>
  | BaseDomainEvent<'TRAP_TRIGGERED', TrapTriggeredPayload>
  | BaseDomainEvent<'CURIO_INTERACTED', CurioInteractedPayload>
  | BaseDomainEvent<'OBSTACLE_RESOLVED', ObstacleResolvedPayload>
  // 决策生命周期
  | BaseDomainEvent<'DECISION_CREATED', DecisionCreatedPayload>
  | BaseDomainEvent<'DECISION_RESOLVED', DecisionResolvedPayload>
  // Phase 2 精神
  | BaseDomainEvent<'STRESS_APPLIED', StressAppliedPayload>
  | BaseDomainEvent<'STRESS_REDUCED', StressReducedPayload>
  | BaseDomainEvent<'RESOLVE_CHECK_STARTED', ResolveCheckStartedPayload>
  | BaseDomainEvent<'RESOLVE_CHECK_SUCCEEDED', ResolveCheckSucceededPayload>
  | BaseDomainEvent<'AFFLICTION_GAINED', AfflictionGainedPayload>
  | BaseDomainEvent<'VIRTUE_GAINED', VirtueGainedPayload>
  | BaseDomainEvent<'AFFLICTION_BEHAVIOR_TRIGGERED', AfflictionBehaviorTriggeredPayload>
  | BaseDomainEvent<'AFFLICTION_CHOICE_REFUSED', AfflictionChoiceRefusedPayload>
  | BaseDomainEvent<'AFFLICTION_CHOICE_REPLACED', AfflictionChoiceReplacedPayload>
  | BaseDomainEvent<'VIRTUE_BEHAVIOR_TRIGGERED', VirtueBehaviorTriggeredPayload>
  | BaseDomainEvent<'PARTY_STRESS_PULSE_CREATED', PartyStressPulseCreatedPayload>
  | BaseDomainEvent<'HEART_ATTACK_TRIGGERED', HeartAttackTriggeredPayload>
  | BaseDomainEvent<'DEATHS_DOOR_ENTERED', DeathsDoorEnteredPayload>
  | BaseDomainEvent<'DEATHS_DOOR_EXITED', DeathsDoorExitedPayload>
  | BaseDomainEvent<'DEATHS_DOOR_RECOVERY_APPLIED', DeathsDoorRecoveryAppliedPayload>
  | BaseDomainEvent<'DEATHBLOW_CHECK_STARTED', DeathblowCheckStartedPayload>
  | BaseDomainEvent<'DEATHBLOW_RESISTED', DeathblowResistedPayload>
  | BaseDomainEvent<'HERO_PERMANENTLY_DIED', HeroPermanentlyDiedPayload>
  | BaseDomainEvent<'DEATH_RECORD_CREATED', DeathRecordCreatedPayload>
  | BaseDomainEvent<'HERO_REMOVED_FROM_PARTY', HeroRemovedFromPartyPayload>
  | BaseDomainEvent<'TACTICAL_OPTIONS_REGENERATED', TacticalOptionsRegeneratedPayload>
  | BaseDomainEvent<'OVERLAY_SHOWN', OverlayShownPayload>
  | BaseDomainEvent<'OVERLAY_DISMISSED', OverlayDismissedPayload>
  // Phase 3 庄园
  | BaseDomainEvent<'EXPEDITION_RETURNED', ExpeditionReturnedPayload>
  | BaseDomainEvent<'WEEK_ADVANCED', WeekAdvancedPayload>
  | BaseDomainEvent<'HAMLET_MODE_CHANGED', HamletModeChangedPayload>
  | BaseDomainEvent<'HERO_RECRUITED', HeroRecruitedPayload>
  | BaseDomainEvent<'HERO_DISMISSED', HeroDismissedPayload>
  | BaseDomainEvent<'HERO_ASSIGNED_TO_FACILITY', HeroAssignedToFacilityPayload>
  | BaseDomainEvent<'HERO_REMOVED_FROM_FACILITY', HeroRemovedFromFacilityPayload>
  | BaseDomainEvent<'FACILITY_UPGRADED', FacilityUpgradedPayload>
  | BaseDomainEvent<'HERO_SKILL_UPGRADED', HeroSkillUpgradedPayload>
  | BaseDomainEvent<'HERO_WEAPON_UPGRADED', HeroWeaponUpgradedPayload>
  | BaseDomainEvent<'HERO_ARMOR_UPGRADED', HeroArmorUpgradedPayload>
  | BaseDomainEvent<'QUEST_SELECTED', QuestSelectedPayload>
  | BaseDomainEvent<'PARTY_SET', PartySetPayload>
  | BaseDomainEvent<'PROVISION_ADDED', ProvisionAddedPayload>
  | BaseDomainEvent<'PROVISION_REMOVED', ProvisionRemovedPayload>
  | BaseDomainEvent<'PROVISION_SETTLED', ProvisionSettledPayload>
  | BaseDomainEvent<'EXPEDITION_STARTED_FROM_HAMLET', ExpeditionStartedFromHamletPayload>
  // Phase 4
  | BaseDomainEvent<'QUIRK_GAINED', QuirkGainedPayload>
  | BaseDomainEvent<'QUIRK_REPLACED', QuirkReplacedPayload>
  | BaseDomainEvent<'QUIRK_LOCKED', QuirkLockedPayload>
  | BaseDomainEvent<'QUIRK_REMOVED', QuirkRemovedPayload>
  | BaseDomainEvent<'QUIRK_BEHAVIOR_TRIGGERED', QuirkBehaviorTriggeredPayload>
  | BaseDomainEvent<'DISEASE_GAINED', DiseaseGainedPayload>
  | BaseDomainEvent<'DISEASE_TREATED', DiseaseTreatedPayload>
  | BaseDomainEvent<'TRINKET_LOOTED', TrinketLootedPayload>
  | BaseDomainEvent<'TRINKET_EQUIPPED', TrinketEquippedPayload>
  | BaseDomainEvent<'TRINKET_UNEQUIPPED', TrinketUnequippedPayload>
  | BaseDomainEvent<'TRINKET_LOST', TrinketLostPayload>
  | BaseDomainEvent<'TRINKET_RECOVERED', TrinketRecoveredPayload>
  | BaseDomainEvent<'HERO_RESOLVE_LEVEL_INCREASED', HeroResolveLevelIncreasedPayload>
  | BaseDomainEvent<'HERO_SKILL_LEVEL_INCREASED', HeroSkillLevelIncreasedPayload>
  | BaseDomainEvent<'HERO_WEAPON_LEVEL_INCREASED', HeroWeaponLevelIncreasedPayload>
  | BaseDomainEvent<'HERO_ARMOR_LEVEL_INCREASED', HeroArmorLevelIncreasedPayload>
  | BaseDomainEvent<'CAMP_STARTED', CampStartedPayload>
  | BaseDomainEvent<'CAMP_FOOD_CONSUMED', CampFoodConsumedPayload>
  | BaseDomainEvent<'CAMP_ACTIVITY_SELECTED', CampActivitySelectedPayload>
  | BaseDomainEvent<'CAMP_POINTS_SPENT', CampPointsSpentPayload>
  | BaseDomainEvent<'CAMP_BUFF_APPLIED', CampBuffAppliedPayload>
  | BaseDomainEvent<'CAMP_STRESS_REDUCED', CampStressReducedPayload>
  | BaseDomainEvent<'CAMP_HEALING_APPLIED', CampHealingAppliedPayload>
  | BaseDomainEvent<'NIGHT_AMBUSH_CHECK_STARTED', NightAmbushCheckStartedPayload>
  | BaseDomainEvent<'NIGHT_AMBUSH_PREVENTED', NightAmbushPreventedPayload>
  | BaseDomainEvent<'NIGHT_AMBUSH_TRIGGERED', NightAmbushTriggeredPayload>
  | BaseDomainEvent<'CAMP_COMPLETED', CampCompletedPayload>
  // Phase 5
  | BaseDomainEvent<'REGION_SELECTED', { regionId: string }>
  | BaseDomainEvent<'REGION_ROUTE_GENERATED', { regionId: string; questId: string }>
  | BaseDomainEvent<'REGION_RULE_APPLIED', { regionId: string; rule: string }>
  | BaseDomainEvent<'REGION_CONTENT_DISCOVERED', { regionId: string; contentType: string; contentId: string }>
  | BaseDomainEvent<'REGION_ENEMY_DISCOVERED', { regionId: string; contentId: string }>
  | BaseDomainEvent<'REGION_CURIO_DISCOVERED', { regionId: string; contentId: string }>
  | BaseDomainEvent<'REGION_TRAP_DISCOVERED', { regionId: string; contentId: string }>
  | BaseDomainEvent<'REGION_DISEASE_DISCOVERED', { regionId: string; contentId: string }>
  | BaseDomainEvent<'REGION_TRINKET_DISCOVERED', { regionId: string; contentId: string }>
  | BaseDomainEvent<'REGION_EXPERIENCE_GRANTED', { regionId: string; amount: number; newExperience: number }>
  | BaseDomainEvent<'REGION_LEVEL_INCREASED', { regionId: string; newLevel: number }>
  | BaseDomainEvent<'REGION_CONTENT_UNLOCKED', { regionId: string; contentId: string }>
  | BaseDomainEvent<'REGION_ELITE_UNLOCKED', { regionId: string; enemyId: string }>
  | BaseDomainEvent<'REGION_RARE_LOOT_UNLOCKED', { regionId: string; lootId: string }>
  | BaseDomainEvent<'REGION_BOSS_QUEST_MARKED_READY', { regionId: string }>
  | BaseDomainEvent<'QUEST_MODIFIER_APPLIED', { regionId: string; modifierIds: string[] }>
  | BaseDomainEvent<'REGION_REWARD_GRANTED', { regionId: string; gold: number; trinketDefId?: string }>
  // Phase 6 Boss 事件(SPEC §25)
  | BaseDomainEvent<'BOSS_RUMOR_DISCOVERED', { bossId: string; regionId: string }>
  | BaseDomainEvent<'BOSS_INVESTIGATION_STARTED', { bossId: string }>
  | BaseDomainEvent<'BOSS_INTELLIGENCE_GRANTED', { bossId: string; entryId: string }>
  | BaseDomainEvent<'BOSS_INVESTIGATION_QUEST_COMPLETED', { bossId: string; questId: string }>
  | BaseDomainEvent<'BOSS_WEAKENING_QUEST_COMPLETED', { bossId: string; questId: string; weakeningId: string }>
  | BaseDomainEvent<'BOSS_WEAKENING_EFFECT_APPLIED', { bossId: string; weakeningId: string }>
  | BaseDomainEvent<'BOSS_HUNT_UNLOCKED', { bossId: string }>
  | BaseDomainEvent<'BOSS_FINAL_QUEST_STARTED', { bossId: string }>
  | BaseDomainEvent<'BOSS_ENCOUNTER_STARTED', { bossId: string; phaseIndex: number }>
  | BaseDomainEvent<'BOSS_PHASE_TRANSITIONED', { bossId: string; fromPhase: number; toPhase: number }>
  | BaseDomainEvent<'BOSS_PHASE_ENTERED', { bossId: string; phaseIndex: number }>
  | BaseDomainEvent<'BOSS_RETREAT_ATTEMPTED', { bossId: string; attemptCount: number }>
  | BaseDomainEvent<'BOSS_RETREAT_SUCCEEDED', { bossId: string; threatIncrease: number }>
  | BaseDomainEvent<'BOSS_RETREAT_FAILED', { bossId: string; attemptCount: number }>
  | BaseDomainEvent<'BOSS_ENCOUNTER_FAILED', { bossId: string; failedAttemptCount: number }>
  | BaseDomainEvent<'BOSS_DEFEATED', { bossId: string; week: number }>
  | BaseDomainEvent<'BOSS_PERMANENT_REWARD_GRANTED', { bossId: string; rewardId: string }>
  | BaseDomainEvent<'REGION_THREAT_CHANGED', { regionId: string; from: number; to: number }>
  | BaseDomainEvent<'REGION_THREAT_STATE_CHANGED', { regionId: string; from: string; to: string }>
  | BaseDomainEvent<'CAMPAIGN_THREAT_ADVANCED', { defeatedBossId: string; totalBossesDefeated: number }>
  | BaseDomainEvent<'FINAL_CAMPAIGN_GATE_MARKED_READY', {}>;
