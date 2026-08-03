/**
 * 远征层类型(Phase 1 v2.0)
 *
 * 设计目标:
 * - 单页、节点推进、回合战斗、资源管理
 * - 选择式遭遇(2-4 个战术方案 + 自动结算)
 * - 战斗规则继续走 BattleActor / SkillDefinition
 * - 移动端 390x844 优先
 *
 * 本文件只定义数据结构,业务逻辑散在 choice-generator / choice-resolver /
 * encounter-resolver / inventory / hunger / torch / trap / curio / retreat / report
 *
 * 重要:旧 Phase 1 的 BattleActor / BattleState / SkillDefinition 保留在
 * src/game-engine/types.ts,继续被 encounter-resolver 用作"选择式遭遇自动结算内核"。
 */

import type { BattleActor, Rank, SkillDefinition } from '../types.js';
import type { RngState } from '../rng/types.js';
import type { DomainEvent as BattleDomainEvent } from '../domain-events.js';
import type { ExpeditionDomainEvent } from './domain-events.js';

// =====================================================================
// 视图模式 (SPEC §6)
// =====================================================================

export type GameViewMode =
  | 'expedition-start'      // 远征开始前(选 loadout)
  | 'node-introduction'     // 进入新节点的过渡
  | 'route-choice'          // 路线分叉
  | 'event-choice'          // 普通事件选择
  | 'encounter-choice'      // 遭遇战选择
  | 'resolution'            // 一次选择结算后的反馈
  | 'inventory-decision'    // 背包取舍
  | 'expedition-success'    // 任务完成
  | 'expedition-retreat'    // 主动撤退
  | 'expedition-failure'    // 失败
  | 'game-error';           // 系统错误(规则不变量被破坏)

// =====================================================================
// 路线与节点 (SPEC §7)
// =====================================================================

export type RouteNodeType =
  | 'empty-room'
  | 'corridor'
  | 'route-fork'
  | 'encounter'
  | 'trap'
  | 'curio'
  | 'hunger'
  | 'obstacle'
  | 'treasure'
  | 'objective'
  | 'exit';

export type ScoutLevel = 'unknown' | 'vague' | 'category-known' | 'fully-scouted';

export interface RouteNode {
  id: string;
  type: RouteNodeType;
  sceneId: string;
  title: string;
  description: string;
  /** 该节点的初始侦察等级(路线生成时) */
  baseScoutLevel: ScoutLevel;
  /** 节点的"潜在类型"权重(用于动态生成事件) */
  weight: number;
  /** 若为 encounter 节点,引用的遭遇定义 id */
  encounterDefId?: string;
  /** 若为 route-fork,引用的分叉 id */
  forkId?: string;
  /** 若为 curio,引用的奇物 id */
  curioId?: string;
  /** 若为 trap,引用的陷阱 id */
  trapId?: string;
  /** 若为 obstacle,引用的路障 id */
  obstacleId?: string;
  /** 若为 objective,引用的目标事件 id */
  objectiveId?: string;
}

export interface RouteEdge {
  id: string;
  from: string;
  to: string;
  /** 移动时间 */
  timeCost: number;
  /** 火把基础消耗 */
  baseTorchCost: number;
  /** 节点描述(在分叉选择时显示) */
  description: string;
  /** 该路线的风险标签 */
  riskTag: 'low' | 'medium' | 'high';
  /** 该路线的侦察显示(更详细信息需要什么侦察等级) */
  revealLevel: ScoutLevel;
  /** 是否是高收益支路(用于确定性 Golden Expedition) */
  isHighReward?: boolean;
}

export interface RouteFork {
  id: string;
  nodeId: string;
  description: string;
  options: ForkOption[];
}

export interface ForkOption {
  edgeId: string;
  title: string;
  description: string;
  riskTag: 'low' | 'medium' | 'high' | 'extreme';
  rewardTag: 'low' | 'medium' | 'high' | 'extreme' | 'unknown';
  /** 需要至少多少侦察才能显示完整描述 */
  requiredScoutLevel?: ScoutLevel;
  /** 选项所需职业(若 hero 在前线做不了) */
  requiredActorTag?: string;
}

export interface ExpeditionRoute {
  id: string;
  regionId: string;
  seed: string;
  startNodeId: string;
  objectiveNodeId: string;
  exitNodeIds: string[];
  nodes: Record<string, RouteNode>;
  edges: RouteEdge[];
  forks: RouteFork[];
}

// =====================================================================
// 火把 (SPEC §9.2)
// =====================================================================

export type TorchLevel = 'radiant' | 'bright' | 'dim' | 'dark' | 'black';

export interface TorchState {
  /** 0-100 */
  value: number;
  level: TorchLevel;
}

export const TORCH_THRESHOLDS: Record<TorchLevel, [number, number]> = {
  radiant: [76, 100],
  bright: [51, 75],
  dim: [26, 50],
  dark: [1, 25],
  black: [0, 0],
};

export function torchLevel(value: number): TorchLevel {
  if (value >= 76) return 'radiant';
  if (value >= 51) return 'bright';
  if (value >= 26) return 'dim';
  if (value >= 1) return 'dark';
  return 'black';
}

// =====================================================================
// 行进方式 (SPEC §9.3)
// =====================================================================

// 注意:TravelPace 在 commands.ts 中定义,这里不重复导出

// =====================================================================
// 物品 / 背包 (SPEC §21)
// =====================================================================

export type ItemId =
  | 'food'
  | 'torch'
  | 'shovel'
  | 'skeleton-key'
  | 'holy-water'
  | 'bandage'
  | 'antivenom'
  | 'gold'
  | 'torch-fuel';

export const ITEM_DEFAULT_SUPPLY: Record<ItemId, number> = {
  food: 8,
  torch: 6,
  'torch-fuel': 0,
  shovel: 1,
  'skeleton-key': 1,
  'holy-water': 1,
  bandage: 1,
  antivenom: 0,
  gold: 0,
};

export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  /** 单格最大堆叠数 */
  maxStack: number;
  /** 物品分类(用于显示和选择过滤) */
  category: 'consumable' | 'tool' | 'supply' | 'key' | 'valuable';
}

export interface InventoryStack {
  id: string;
  itemId: ItemId;
  count: number;
}

export interface InventoryState {
  capacity: number;
  stacks: InventoryStack[];
}

// =====================================================================
// 英雄(运行时态,SPEC §18)
// =====================================================================

/** Phase 1 v2.0 不实现正式压力/折磨,只用 condition 字符串作占位 */
export type HeroCondition = 'starving' | 'well-fed' | 'wounded' | 'cursed' | 'blessed';

export interface HeroInstance {
  id: string;
  name: string;
  archetype: 'crusader' | 'highwayman' | 'vestal' | 'plague_doctor';
  /** 职业标签,用于选择生成时的过滤 */
  tags: string[];
  /** 1-4 号站位 */
  rank: Rank;
  hp: number;
  maxHp: number;
  /** 站位(同 BattleActor) */
  protection: number;
  dodge: number;
  speed: number;
  accuracy: number;
  crit: number;
  bleedResist: number;
  blightResist: number;
  stunResist: number;
  moveResist: number;
  /** DOT */
  bleed: BattleActor['bleed'];
  blight: BattleActor['blight'];
  /** 状态 */
  stun: BattleActor['stun'];
  mark: BattleActor['mark'];
  protBuff: BattleActor['protBuff'];
  cooldowns: Record<string, number>;
  isDead: boolean;
  /** 运行时条件(临时减益) */
  conditions: HeroCondition[];
  /** 装备的技能 */
  skills: string[];
}

// =====================================================================
// 遭遇 (SPEC §13)
// =====================================================================

export type EncounterStatus = 'intro' | 'awaiting-choice' | 'resolving' | 'victory' | 'defeat' | 'escaped';

export interface EncounterState {
  id: string;
  encounterDefId: string;
  sceneId: string;
  /** 遭遇轮次(用于选择式自动结算) */
  round: number;
  /** 参与的英雄 id(party 顺序) */
  heroActorIds: string[];
  /** 参与的敌人 id(从 EncounterDef 生成的副本) */
  enemyActorIds: string[];
  /** 临时战斗 actor 字典(包含 hero+enemy+可能的 corpse) */
  actors: Record<string, BattleActor>;
  /** 遭遇本地的技能注册表(只装本场需要的技能) */
  skillRegistry: Record<string, SkillDefinition>;
  status: EncounterStatus;
  /** 当前可用的战术选择 id 列表 */
  availableChoiceIds: string[];
  /** 玩家当前选中的战术方案 id */
  selectedChoiceId: string | null;
  /** 本次遭遇已发生的 Domain Event(从底层 battle 引擎继承) */
  events: (ExpeditionDomainEvent | BattleDomainEvent)[];
  /** 本次遭遇的 RNG 状态(初始从 expedition.rng 复制) */
  rng: RngState;
  /** 最高轮次上限(超出则自动撤离或失败) */
  maxRounds: number;
}

export interface EncounterDef {
  id: string;
  name: string;
  sceneId: string;
  description: string;
  /** 默认敌阵(对照敌人 lineup 里的 actor ids) */
  enemyFormation: string[];
  tags: string[];
  /** 预计轮次 */
  expectedRounds: [number, number];
  /** 最高轮次上限 */
  maxRounds: number;
  /** 难度(影响奖励和风险) */
  difficulty: 'easy' | 'medium' | 'hard';
}

// =====================================================================
// 战术选择 (SPEC §13.3 §14)
// =====================================================================

export type TacticalPlanType =
  | 'assault'         // 正面突破:前排英雄优先直伤
  | 'backline'        // 压制后排:远程/后排输出优先
  | 'control'         // 控制:眩晕/腐蚀/位移
  | 'stabilize'       // 稳住队伍:治疗/清理状态
  | 'reform'          // 调整阵型
  | 'use-item'        // 使用补给
  | 'retreat';        // 撤离

export interface TacticalPlan {
  planType: TacticalPlanType;
  /** 优先职业 tag(不指定则按全队) */
  preferredActorTags?: string[];
  /** 最多跑几轮后强制结束 */
  maxRounds: number;
  /** 偏好技能 filter */
  preferredSkillTags?: string[];
  /** planType-specific params */
  parameters: Record<string, unknown>;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme' | 'unknown';
export type RewardLevel = 'low' | 'medium' | 'high' | 'extreme' | 'stable' | 'delayed' | 'unknown';

export interface RiskPreview {
  kind: 'injury' | 'starvation' | 'ambush' | 'trap' | 'consume' | 'lost-time' | 'formation-break' | 'enemy-react';
  severity: RiskLevel;
  description: string;
}

export interface CostPreview {
  kind: 'torch' | 'food' | 'time' | 'item' | 'hp' | 'position' | 'flag';
  amount?: number;
  itemId?: ItemId;
  description: string;
}

export interface TacticalChoiceDef {
  id: string;
  title: string;
  description: string;
  /** 主要执行者的职业 tag */
  primaryActorTags: string[];
  /** 至少需要的侦察等级(影响是否显示) */
  requiredScoutLevel?: ScoutLevel;
  /** 至少需要的火把等级 */
  minTorchLevel?: TorchLevel;
  /** 需要背包里的某个物品 */
  requiresItem?: ItemId;
  /** 风险等级 */
  risk: RiskLevel;
  /** 收益倾向 */
  reward: RewardLevel;
  /** 触发的战术计划 */
  plan: TacticalPlan;
  tags: string[];
  /** 来源:标准 / 职业注入 / 补给注入 / 撤退注入 */
  source: 'standard' | 'class-injected' | 'supply-injected' | 'retreat-injected';
}

// =====================================================================
// 规则条件 / 效果 (SPEC §23 §24)
// =====================================================================

export type RuleConditionKind =
  | 'torch-lt' | 'torch-gte' | 'torch-eq'
  | 'food-lt' | 'food-gte'
  | 'time-lt' | 'time-gte'
  | 'has-item' | 'lacks-item'
  | 'tag-has' | 'all-tags'
  | 'hero-can-act' | 'hero-is-dead'
  | 'flag-eq' | 'flag-exists' | 'flag-lt' | 'flag-gte'
  | 'and' | 'or' | 'not'
  | 'scout-gte'
  | 'in-node' | 'depth-gte' | 'depth-eq'
  | 'formation-broken';

export interface RuleCondition {
  kind: RuleConditionKind;
  /** 条件值,根据 kind 解释 */
  value?: number | string;
  /** 子条件 */
  conditions?: RuleCondition[];
  /** 物品 id(对 has-item / lacks-item) */
  itemId?: ItemId;
  /** tag 列表 */
  tags?: string[];
  /** flag 名(对 flag-*) */
  flagName?: string;
  /** flag 值(对 flag-eq) */
  flagValue?: string | number | boolean;
  /** hero id(对 hero-*) */
  heroId?: string;
}

export type RuleEffectKind =
  | 'torch-delta' | 'food-delta' | 'time-delta'
  | 'hp-delta' | 'heal-flat' | 'heal-percent'
  | 'give-item' | 'take-item' | 'item-delta' | 'discard-stack'
  | 'grant-scout' | 'advance-time' | 'consume-time'
  | 'set-flag' | 'clear-flag' | 'inc-flag'
  | 'start-encounter' | 'queue-event'
  | 'apply-status' | 'remove-status' | 'move-hero' | 'set-hero-rank'
  | 'kill-hero' | 'reveal-next-node'
  | 'complete-objective' | 'fail-expedition' | 'succeed-expedition'
  | 'request-retreat';

export type HeroSelector = 'specific' | 'lowest-hp' | 'highest-hp' | 'all-alive' | 'front-rank' | 'back-rank';

export interface RuleEffect {
  kind: RuleEffectKind;
  amount?: number;
  itemId?: ItemId;
  /** 直接指定英雄(与 heroSelector 互斥) */
  heroId?: string;
  /** 选择器:lowest-hp / all-alive / 等等 */
  heroSelector?: HeroSelector;
  flagName?: string;
  flagValue?: string | number | boolean;
  /** give-item / take-item 数量 */
  count?: number;
  /** status 应用: bleed / blight / stun / mark / prot_buff */
  statusType?: 'bleed' | 'blight' | 'stun' | 'mark' | 'prot_buff';
  /** apply-status 持续回合数 */
  duration?: number;
  /** 推进 encounter / event 的目标 */
  targetId?: string;
  /** 角色位移方向(+front / -back / specific rank) */
  rankValue?: Rank;
  /** 叙事提示 */
  narrativeHint?: string;
}

export interface WeightedOutcome {
  weight: number;
  effects: RuleEffect[];
  narrativeHint?: string;
}

export interface EventChoiceDef {
  id: string;
  title: string;
  description: string;
  conditions?: RuleCondition[];
  costs?: RuleEffect[];
  riskPreview?: RiskPreview[];
  outcomeTable: WeightedOutcome[];
  /** 触发该选项后是否自动结束事件(默认 true) */
  terminatesEvent?: boolean;
}

export type EventTrigger =
  | 'node-enter' | 'travel-end' | 'time-milestone'
  | 'torch-low' | 'food-low' | 'scout-triggered'
  | 'manual' | 'debug';

export interface EventDef {
  id: string;
  trigger: EventTrigger;
  title: string;
  description: string;
  sceneId: string;
  conditions: RuleCondition[];
  weight: number;
  cooldown?: number;
  oncePerExpedition?: boolean;
  choices: EventChoiceDef[];
  /** 风险等级(用于顶部标签显示) */
  risk: RiskLevel;
}

// =====================================================================
// 选择生成 (SPEC §24)
// =====================================================================

export type DecisionType = 'route' | 'travel' | 'event' | 'encounter' | 'inventory' | 'retreat';

export interface GeneratedChoice {
  id: string;
  sourceDefinitionId: string;
  title: string;
  description: string;
  primaryHeroId?: string;
  enabled: boolean;
  disabledReason?: string;
  visibleCosts: CostPreview[];
  visibleRisks: RiskPreview[];
  tags: string[];
  /** 用于调试面板:为什么这个选项出现/消失 */
  reason: string;
}

export interface PendingDecision {
  id: string;
  type: DecisionType;
  contextId: string;
  generatedChoices: GeneratedChoice[];
  selectedChoiceId: string | null;
  transactionId: string | null;
  createdAtStepId: string;
}

// =====================================================================
// 结算反馈 (SPEC §26)
// =====================================================================

export interface HeroChange {
  heroId: string;
  hpDelta: number;
  /** 施加/移除的状态 */
  statusChanges: { gained: string[]; lost: string[] };
  rankChanged?: { from: Rank; to: Rank };
}

export interface ResourceChange {
  torch: number;
  food: number;
  time: number;
  itemsGained: { itemId: ItemId; count: number }[];
  itemsLost: { itemId: ItemId; count: number }[];
  flagsChanged: { name: string; value: string | number | boolean | null }[];
}

export interface ResolutionResult {
  choiceId: string;
  title: string;
  primaryHeroId?: string;
  narrative: string[];
  resourceChanges: ResourceChange;
  heroChanges: HeroChange[];
  /** 本次结果中包含的 domain event ids */
  eventIds: string[];
  /** 失败/成功标志 */
  status?: 'success' | 'failure' | 'partial';
}

// =====================================================================
// 远征状态 (SPEC §27)
// =====================================================================

export interface ExpeditionStats {
  deepestNodeReached: number;
  nodesVisited: number;
  encounterCount: number;
  trapCount: number;
  hungerCount: number;
  torchUsed: number;
  foodUsed: number;
  lowestTorch: number;
  lootGained: { itemId: ItemId; count: number }[];
  itemsDiscarded: { itemId: ItemId; count: number }[];
  heroLowestHp: { heroId: string; hp: number }[];
  retreatPosition?: { nodeId: string; depth: number };
}

export interface ExpeditionState {
  id: string;
  routeId: string;
  seed: string;
  /** 远征开始时间(ISO) */
  startedAt: string;
  /** 当前节点 id */
  currentNodeId: string;
  /** 走过的节点(按顺序) */
  visitedNodeIds: string[];
  /** 深度 = visitedNodeIds.length */
  depth: number;
  /** 时间累计 */
  timeElapsed: number;
  /** 火把 */
  torch: number;
  /** 触发过的关键选择摘要(用于失败链) */
  keyChoices: { nodeId: string; choiceTitle: string; risk: RiskLevel }[];
  /** 关键事件摘要(同上) */
  keyEvents: { eventId: string; nodeId: string; outcome: string }[];
  /** 已触发的 unique event ids(oncePerExpedition 检查) */
  firedEventIds: string[];
  /** 事件冷却 */
  eventCooldowns: Record<string, number>;
  /** 当前侦察等级(本节点) */
  scoutLevel: ScoutLevel;
  /** 路线(完整,便于调试面板查) */
  route: ExpeditionRoute;
  /** 关键 flag */
  flags: Record<string, string | number | boolean>;
  /** 统计 */
  stats: ExpeditionStats;
  /** 任务状态 */
  objectiveCompleted: boolean;
  /** 任务是否失败(不可恢复) */
  failed: boolean;
  failReason?: string;
}

// =====================================================================
// 顶层 GameState (SPEC §27)
// =====================================================================

export const GAME_STATE_VERSION = 2;

export interface GameState {
  version: typeof GAME_STATE_VERSION;
  mode: GameViewMode;
  seed: string;
  expedition: ExpeditionState;
  party: Record<string, HeroInstance>;
  /** 当前进行的遭遇(null 表示没有遭遇) */
  encounter: EncounterState | null;
  /** 当前等待玩家决策(没有则表示结算中或过渡) */
  pendingDecision: PendingDecision | null;
  /** 上一次结算反馈(显示在 ResolutionPanel) */
  lastResolution: ResolutionResult | null;
  inventory: InventoryState;
  /** 火把(冗余字段,expedition.torch 是真实值,这里方便 selectors) */
  torch: TorchState;
  /** 事件日志(所有 domain event,合并远征层 + 战斗层) */
  eventLog: (ExpeditionDomainEvent | BattleDomainEvent)[];
  /** 当前 RNG 状态 */
  rng: RngState;
  /** 最后事务 id */
  lastTransactionId: string | null;
}
