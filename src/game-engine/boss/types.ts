/**
 * Boss 系统类型(Phase 6 §4-§19,§23)
 *
 * 三个区域 Boss(Phase 6B/6C/6D):
 *  - ruins 失落审判者
 *  - corrupted-woods 孢疫母巢
 *  - underground-burrows 饥渊吞噬者
 *
 * 数据驱动:
 *  - BossDefinition 完整描述
 *  - BossCampaignState 跨周持久化
 *  - BossEncounterState 远征内运行时
 *  - RegionThreatProgress 0-100 威胁
 *  - CampaignThreatState 三 Boss 战役进度
 *
 * Phase 6A 仅交付通用框架 + 1 个测试 Boss,不做正式三个 Boss 内容。
 */

import type {
  RuleCondition,
  RuleEffect,
} from '../expedition/types.js';

/**
 * RuleModifier:SPEC §9 / §42 描述的"规则修改器",实现上复用 RuleEffect
 * (Phase 6A 暂不抽取独立类型,后续如需细化可独立 export)。
 */
export type RuleModifier = RuleEffect;
import type { RegionId } from '../regions/types.js';

// =====================================================================
// 通用 Boss 标识
// =====================================================================

export type BossId = string;

/**
 * Boss 实例状态机(SPEC §5)
 *  - hidden        未发现,无任何线索
 *  - rumored       区域等级达标后,出现 Boss 任务接口
 *  - investigating 正在做调查任务
 *  - revealed      完成调查,获得至少 1 条情报
 *  - weakened      完成至少 1 个削弱任务
 *  - hunt-ready    完成所有可选削弱,可触发最终讨伐
 *  - active        Boss 战进行中
 *  - defeated      Boss 已击败(永久状态,不可回退)
 */
export type BossStatus =
  | 'hidden'
  | 'rumored'
  | 'investigating'
  | 'revealed'
  | 'weakened'
  | 'hunt-ready'
  | 'active'
  | 'defeated';

/**
 * 区域威胁状态(SPEC §6)
 *  - dormant            0-19  潜伏
 *  - stirring           20-39 躁动
 *  - active             40-59 活跃
 *  - uncontrolled       60-79 失控
 *  - boss-revealed      80-100 Boss 已显现
 *  - boss-defeated      Boss 已被击败
 */
export type RegionThreatState =
  | 'dormant'
  | 'stirring'
  | 'active'
  | 'uncontrolled'
  | 'boss-revealed'
  | 'boss-defeated';

// =====================================================================
// Boss 通用定义 (SPEC §4)
// =====================================================================

/**
 * 撤退规则(SPEC §15.1)
 */
export interface BossRetreatRules {
  /** 基础撤退成功率(0-1) */
  baseSuccessRate: number;
  /** 阶段修正:phaseIndex → 成功率增减 */
  phaseModifiers: Record<number, number>;
  /** 撤退成功后压力惩罚(per hero) */
  stressPenalty: number;
  /** 撤退成功后区域威胁增量 */
  threatIncrease: number;
  /** 哪些削弱效果在撤退后失效(规则 id 列表) */
  weakeningEffectLossRules: string[];
}

/**
 * Boss 通用定义(SPEC §4)
 * 全部数据驱动;不允许在 UI 中根据 Boss ID 写大量分支逻辑。
 */
export interface BossDefinition {
  id: BossId;
  name: string;
  regionId: RegionId;
  description: string;

  // 威胁标签 + 推荐
  threatTags: string[];
  recommendedHeroTags: string[];
  recommendedProvisionIds: string[];
  recommendedTrinketTags: string[];

  // 任务链
  intelligenceEntryIds: string[];
  investigationQuestIds: string[];
  weakeningQuestIds: string[];
  finalQuestId: string;

  // 战斗
  phaseDefinitionIds: string[];
  environmentTargetIds: string[];
  summonPoolIds: string[];

  // 撤退 / 奖励
  retreatRules: BossRetreatRules;
  rewardTableId: string;
  permanentRewardId: string;
}

// =====================================================================
// Boss 阶段 (SPEC §11)
// =====================================================================

/**
 * Boss 阶段 modifier(SPEC §9 phaseModifiers)
 * kind 复用 RuleEffectKind,叠加到当前阶段规则。
 */
export interface BossPhaseModifier {
  phaseIndex: number;
  modifiers: RuleModifier[];
}

/**
 * Boss 召唤规则
 */
export interface BossSummonRule {
  summonId: string;
  /** 每阶段最多召唤次数 */
  maxPerPhase: number;
  /** 阶段 modifier(可叠加 RuleModifier) */
  modifiers: RuleModifier[];
  /** 触发条件 */
  trigger: RuleCondition;
}

/**
 * Boss 阶段事件(enter / exit 触发)
 */
export interface BossPhaseEvent {
  trigger: 'enter' | 'exit';
  effects: RuleEffect[];
  narrativeHint?: string;
}

/**
 * Boss 战术选项规则
 *  - 用于 choice-generator 决定哪些战术对当前 Boss 有效
 */
export interface TacticalOptionRule {
  id: string;
  title: string;
  description: string;
  /** 可见性条件(全部满足才出现) */
  conditions: RuleCondition[];
  /** 权重(用于选择生成) */
  weight: number;
  /** 选项类别(SPEC §13 建议) */
  category:
    | 'attack-core'
    | 'handle-summon'
    | 'destroy-environment'
    | 'protect-hero'
    | 'stabilize-stress'
    | 'use-item'
    | 'force-phase'
    | 'retreat';
  /** 阶段索引(选项仅在指定阶段出现) */
  phaseIndex?: number;
  /** 应用效果 */
  effects: RuleEffect[];
  /** 风险预览(用于 UI) */
  riskTags: string[];
}

/**
 * Boss 阶段定义(SPEC §11)
 */
export interface BossPhaseDefinition {
  id: string;
  bossId: BossId;
  phaseIndex: number;
  name: string;
  description: string;

  /** 进入条件 */
  enterConditions: RuleCondition[];
  /** 退出条件 */
  exitConditions: RuleCondition[];

  /** 阶段 modifier(影响规则结算) */
  bossModifiers: RuleModifier[];
  /** 阶段启用环境目标 id */
  environmentTargetIds: string[];
  /** 阶段召唤规则 */
  summonRules: BossSummonRule[];

  /** 阶段战术选项(由 choice-generator 读取) */
  tacticalOptionRules: TacticalOptionRule[];
  /** 阶段事件(进入/退出触发) */
  phaseEvents: BossPhaseEvent[];
}

// =====================================================================
// Boss 环境目标 (SPEC §12)
// =====================================================================

/**
 * Boss 环境目标交互选项
 */
export interface EnvironmentInteractionChoice {
  id: string;
  title: string;
  description: string;
  conditions: RuleCondition[];
  effects: RuleEffect[];
  riskTags: string[];
}

/**
 * Boss 环境目标定义(SPEC §12)
 * 示例:召唤祭坛、孢子囊、储粮坑、封印柱、尸体堆
 */
export interface BossEnvironmentTargetDefinition {
  id: string;
  bossId: BossId;
  name: string;
  description: string;

  /** 初始 HP(可选,无则不可被攻击) */
  hp?: number;
  stateTags: string[];

  /** 存活时效果 */
  activeEffects: RuleEffect[];
  /** 摧毁效果 */
  destroyEffects: RuleEffect[];
  /** 玩家可执行的交互 */
  interactChoices: EnvironmentInteractionChoice[];
}

/**
 * Boss 环境目标运行时状态
 */
export interface BossEnvironmentTargetState {
  targetId: string;
  bossId: BossId;
  currentHp: number;
  status: 'intact' | 'damaged' | 'destroyed';
  /** 已应用效果 id 列表 */
  appliedEffectIds: string[];
}

// =====================================================================
// Boss 情报 (SPEC §7)
// =====================================================================

export type IntelligenceCategory =
  | 'attack-pattern'
  | 'status-threat'
  | 'phase-mechanic'
  | 'environment-target'
  | 'summon'
  | 'recommended-provision'
  | 'recommended-hero'
  | 'retreat-risk';

/**
 * 情报解锁来源
 */
export interface IntelligenceUnlockSource {
  type:
    | 'investigation-quest'
    | 'elite-encounter'
    | 'special-curio'
    | 'hidden-node'
    | 'region-quest-item'
    | 'class-analysis'
    | 'first-boss-failure'
    | 'first-phase-encounter';
  /** 来源 id(任务/奇物/节点/item 等) */
  sourceId: string;
  /** 解锁后是否已通知 UI */
  notified?: boolean;
}

/**
 * Boss 情报条目(SPEC §7.1)
 * 情报不是纯文本:必须改变准备或 Boss 战选择。
 */
export interface BossIntelligenceEntry {
  id: string;
  bossId: BossId;
  title: string;
  category: IntelligenceCategory;

  /** 摘要(已发现时显示) */
  summary: string;
  /** 完整细节(已确认后显示) */
  revealedDetail: string;

  /** 解锁来源 */
  unlockSources: IntelligenceUnlockSource[];
  /** 情报触发的 gameplay effect(SPEC §7.3) */
  gameplayEffects: RuleEffect[];
}

// =====================================================================
// Boss 削弱效果 (SPEC §9)
// =====================================================================

/**
 * 削弱效果持久性
 *  - until-next-attempt  下次挑战前有效
 *  - until-boss-defeated 击败前持续(失败撤退可能失效)
 *  - permanent           永久
 */
export type WeakeningPersistence =
  | 'until-next-attempt'
  | 'until-boss-defeated'
  | 'permanent';

/**
 * Boss 削弱效果(SPEC §9)
 */
export interface BossWeakeningEffect {
  id: string;
  bossId: BossId;
  sourceQuestId: string;

  name: string;
  description: string;

  /** 影响哪些阶段(空数组 = 全部阶段) */
  phaseModifiers: BossPhaseModifier[];
  /** 遭遇级 modifier(影响选择生成 / 战术效果) */
  encounterModifiers: RuleModifier[];
  /** 路线 modifier(影响 Boss 专属路线生成) */
  routeModifiers: RuleModifier[];

  /** 持久性 */
  persistence: WeakeningPersistence;
}

// =====================================================================
// Boss 永久奖励 (SPEC §18)
// =====================================================================

/**
 * Boss 永久奖励(SPEC §18)
 * 不要只奖励金币。
 */
export interface BossPermanentReward {
  id: string;
  bossId: BossId;
  name: string;
  description: string;

  /** 战役级 modifier(影响后续所有远征) */
  campaignModifiers: RuleModifier[];
  /** 解锁的饰品 id */
  unlockedTrinketIds: string[];
  /** 解锁的任务修正词 id */
  unlockedQuestModifierIds: string[];
}

// =====================================================================
// Boss 特殊任务物品 (SPEC §14)
// =====================================================================

/**
 * Boss 特殊任务物品(SPEC §14)
 * 占用背包空间或带来准备成本;非可选装备。
 */
export interface BossQuestItemDefinition {
  id: string;
  bossId: BossId;
  name: string;
  description: string;

  /** 占用背包槽数 */
  inventorySlots: number;
  /** 是否可用于 Boss 战 */
  availableInFinalEncounter: boolean;

  /** 该物品解锁的战术选项 id */
  tacticalChoiceIds: string[];
  /** 使用后是否消耗 */
  consumeOnUse: boolean;
}

// =====================================================================
// 区域威胁 (SPEC §6)
// =====================================================================

/**
 * 区域威胁进度(SPEC §6)
 * threatValue 范围 0-100。
 */
export interface RegionThreatProgress {
  regionId: RegionId;
  state: RegionThreatState;
  threatValue: number;
  /** 周增长(可正可负) */
  weeklyGrowth: number;
  /** 当前应用的威胁 modifier id */
  activeThreatModifierIds: string[];
}

// =====================================================================
// 战役总进度 (SPEC §19)
// =====================================================================

/**
 * 战役总进度(SPEC §19)
 * 击败 1 个 Boss → 进度 +1;击败 3 个 → finalCampaignGateReady = true。
 */
export interface CampaignThreatState {
  defeatedBossIds: BossId[];
  totalBossesDefeated: number;
  campaignThreatLevel: number;
  finalCampaignGateReady: boolean;
}

// =====================================================================
// Boss 跨周持久化状态 (SPEC §5)
// =====================================================================

/**
 * Boss 跨周持久化状态(SPEC §5)
 * 挂在 CampaignState.bossStates。
 */
export interface BossCampaignState {
  bossId: BossId;
  regionId: RegionId;

  status: BossStatus;

  /** 情报进度(0-8) */
  intelligenceProgress: number;
  /** 已发现情报 id */
  discoveredIntelligenceEntryIds: string[];

  /** 已完成调查任务 id */
  completedInvestigationQuestIds: string[];
  /** 已完成削弱任务 id */
  completedWeakeningQuestIds: string[];

  /** 当前生效的削弱效果 id(可能因撤退失效) */
  activeWeakeningEffectIds: string[];
  /** 失败尝试次数(累计) */
  failedAttemptCount: number;
  /** 撤退次数(累计) */
  retreatCount: number;

  /** 解锁周(ISO 周序号) */
  unlockedAtWeek: number | null;
  /** 击败周 */
  defeatedAtWeek: number | null;
}

// =====================================================================
// Boss 远征内运行时状态 (SPEC §23.3)
// =====================================================================

/**
 * Boss 远征内运行时状态(SPEC §23.3)
 * 挂在 ExpeditionState.bossEncounterState。
 */
export interface BossEncounterState {
  bossId: BossId;
  currentPhaseId: string;
  phaseIndex: number;
  round: number;

  bossHp: number;
  bossStatusTags: string[];

  environmentTargets: BossEnvironmentTargetState[];
  summonEnemyIds: string[];

  appliedWeakeningEffectIds: string[];
  /** 遭遇中临时发现的情报(由阶段首次遭遇触发) */
  discoveredDuringEncounterIds: string[];

  retreatAttemptCount: number;
  encounterStatus:
    | 'active'
    | 'retreating'
    | 'retreated'
    | 'failed'
    | 'victory';
}

// =====================================================================
// 辅助类型 / 扩展
// =====================================================================

/**
 * 威胁 modifier id(命名空间 boss-threat:<bossId>:<modifier>)
 */
export type ThreatModifierId = string;

/**
 * Boss 远征预览(用于 UI)
 * 不写入状态,只读派生。
 */
export interface BossExpeditionPreview {
  bossId: BossId;
  availableIntelligenceCount: number;
  appliedWeakeningCount: number;
  knownEnvironmentTargetCount: number;
  availableTacticalOptions: TacticalOptionRule[];
  threatState: RegionThreatState;
}

// =====================================================================
// 工厂(无依赖,放在 types.ts 避免循环 import)
// =====================================================================

/**
 * 创建初始 BossCampaignState(hidden 状态,SPEC §5)
 * 用于 dispatcher 初始化 CampaignState.bossStates 时调用
 */
export function createEmptyBossCampaignState(
  bossId: BossId,
  regionId: RegionId,
): BossCampaignState {
  return {
    bossId,
    regionId,
    status: 'hidden',
    intelligenceProgress: 0,
    discoveredIntelligenceEntryIds: [],
    completedInvestigationQuestIds: [],
    completedWeakeningQuestIds: [],
    activeWeakeningEffectIds: [],
    failedAttemptCount: 0,
    retreatCount: 0,
    unlockedAtWeek: null,
    defeatedAtWeek: null,
  };
}
