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
  | 'DECISION_RESOLVED';

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
  | BaseDomainEvent<'DECISION_RESOLVED', DecisionResolvedPayload>;
