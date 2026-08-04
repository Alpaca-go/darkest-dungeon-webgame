/**
 * Boss 注册表(Phase 6A)
 *
 * 6A 阶段只交付 1 个测试 Boss `boss-test-arbiter` 用于验证框架。
 * 6B/6C/6D 将分别覆盖为三个正式区域 Boss:
 *  - 失落审判者 / 孢疫母巢 / 饥渊吞噬者
 *
 * 数据驱动:registry 集中管理所有 Boss 静态定义,UI 只读不写。
 */

import type {
  BossDefinition,
  BossEnvironmentTargetDefinition,
  BossIntelligenceEntry,
  BossPermanentReward,
  BossPhaseDefinition,
  BossQuestItemDefinition,
  BossRetreatRules,
  BossWeakeningEffect,
} from './types.js';

// =====================================================================
// 1. 调查任务 / 削弱任务 / 最终讨伐任务定义
// =====================================================================
//
// Phase 6A 仅占位;具体任务实现(调查+削弱+讨伐)在 6B/6C/6D 提供。
// 此处定义 id + 名称 + 描述,任务本体逻辑由 dispatcher 处理。
// =====================================================================

/** 任务元数据(供 registry 引用) */
export interface BossTaskMeta {
  id: string;
  bossId: string;
  type: 'investigation' | 'weakening' | 'final';
  name: string;
  description: string;
  /** 关联的情报/削弱 id 列表(任务完成后授予) */
  grantsIds: string[];
}

export const BOSS_TASKS: Record<string, BossTaskMeta> = {
  // ---- 调查任务 ----
  'task-test-investigate-1': {
    id: 'task-test-investigate-1',
    bossId: 'boss-test-arbiter',
    type: 'investigation',
    name: '调查远古审判厅',
    description: '在遗迹深处找到审判厅的入口,确认审判者确实存在。',
    grantsIds: ['intel-attack-1', 'intel-status-1', 'intel-phase-1'],
  },
  // ---- 削弱任务 ----
  'task-test-weaken-1': {
    id: 'task-test-weaken-1',
    bossId: 'boss-test-arbiter',
    type: 'weakening',
    name: '摧毁召唤祭坛',
    description: '找到遗迹内的两座祭坛并摧毁,削弱 Boss 的召唤能力。',
    grantsIds: ['weaken-summon-altar'],
  },
  'task-test-weaken-2': {
    id: 'task-test-weaken-2',
    bossId: 'boss-test-arbiter',
    type: 'weakening',
    name: '找到破咒圣物',
    description: '在古墓中找到能解除审判者诅咒的圣物,削弱其压力攻击。',
    grantsIds: ['weaken-stress-curse'],
  },
  // ---- 最终讨伐 ----
  'task-test-final-1': {
    id: 'task-test-final-1',
    bossId: 'boss-test-arbiter',
    type: 'final',
    name: '审判者讨伐',
    description: '进入审判厅,在三阶段中选择战术击败审判者。',
    grantsIds: [],
  },
};

// =====================================================================
// 2. Boss 撤退规则
// =====================================================================

const TEST_BOSS_RETREAT: BossRetreatRules = {
  baseSuccessRate: 0.65,
  phaseModifiers: {
    0: 0,    // 阶段 0 (识别) 容易撤退
    1: -0.15, // 阶段 1 (升级) 难一点
    2: -0.30, // 阶段 2 (绝境) 极难
  },
  stressPenalty: 8,
  threatIncrease: 15,
  weakeningEffectLossRules: ['weaken-stress-curse'], // 撤退时诅咒削弱失效
};

// =====================================================================
// 3. 环境目标
// =====================================================================

export const BOSS_ENVIRONMENT_TARGETS: Record<string, BossEnvironmentTargetDefinition> = {
  'env-test-altar': {
    id: 'env-test-altar',
    bossId: 'boss-test-arbiter',
    name: '审判祭坛',
    description: '高耸的石质祭坛,持续向审判者输送信徒亡魂。',
    hp: 30,
    stateTags: ['summon-source', 'sacred'],
    activeEffects: [
      { kind: 'inc-flag', flagName: 'boss_summon_pool_size', amount: 1, narrativeHint: '祭坛放大了召唤池' },
    ],
    destroyEffects: [
      { kind: 'clear-flag', flagName: 'boss_summon_pool_size' },
      { kind: 'apply-stress', amount: 3, heroSelector: 'all-alive', narrativeHint: '祭坛崩塌,残余压力扩散' },
    ],
    interactChoices: [
      {
        id: 'env-altar-smash',
        title: '直接摧毁祭坛',
        description: '让前排英雄冒险靠近并击碎祭坛。',
        conditions: [],
        effects: [
          { kind: 'hp-delta', amount: -8, heroSelector: 'front-rank', narrativeHint: '祭坛的诅咒反噬' },
          { kind: 'inc-flag', flagName: 'env_altar_destroyed', amount: 1 },
        ],
        riskTags: ['frontline-risk', 'stress-backlash'],
      },
      {
        id: 'env-altar-seal',
        title: '用圣物封印祭坛',
        description: '消耗一个 Boss 特殊物品,远程封印祭坛。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_altar_sealed', amount: 1 },
        ],
        riskTags: ['consume-boss-item'],
      },
    ],
  },
  'env-test-shield': {
    id: 'env-test-shield',
    bossId: 'boss-test-arbiter',
    name: '审判屏障',
    description: '环绕 Boss 的魔法屏障,降低所有伤害。',
    hp: 20,
    stateTags: ['defense', 'magic'],
    activeEffects: [
      { kind: 'set-flag', flagName: 'boss_damage_reduction', flagValue: 0.5 },
    ],
    destroyEffects: [
      { kind: 'clear-flag', flagName: 'boss_damage_reduction' },
    ],
    interactChoices: [
      {
        id: 'env-shield-break',
        title: '集中火力击碎屏障',
        description: '全员攻击核心,放弃本轮其他战术。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_shield_destroyed', amount: 1 },
        ],
        riskTags: ['all-in', 'skip-other-tactics'],
      },
    ],
  },
};

// =====================================================================
// 4. Boss 情报(8 条)
// =====================================================================

export const BOSS_INTELLIGENCE: Record<string, BossIntelligenceEntry> = {
  // 2 攻击模式
  'intel-attack-1': {
    id: 'intel-attack-1',
    bossId: 'boss-test-arbiter',
    title: '审判之锤',
    category: 'attack-pattern',
    summary: '审判者的近战重击,可能直接造成死亡之门风险。',
    revealedDetail: '审判者每 3 轮释放一次审判之锤,前排英雄若处于 Death\'s Door 状态有 50% 概率直接阵亡。',
    unlockSources: [
      { type: 'investigation-quest', sourceId: 'task-test-investigate-1' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_审判之锤', flagValue: true },
    ],
  },
  'intel-attack-2': {
    id: 'intel-attack-2',
    bossId: 'boss-test-arbiter',
    title: '亡魂波',
    category: 'attack-pattern',
    summary: '审判者召唤亡魂,造成群体压力伤害。',
    revealedDetail: '亡魂波对全员施加 5-10 压力,职业带抗压 tag 可减半。',
    unlockSources: [
      { type: 'elite-encounter', sourceId: 'elite-审判者亲卫' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_亡魂波', flagValue: true },
    ],
  },
  // 1 状态威胁
  'intel-status-1': {
    id: 'intel-status-1',
    bossId: 'boss-test-arbiter',
    title: '诅咒印记',
    category: 'status-threat',
    summary: '被审判者目光锁定的英雄承受持续压力。',
    revealedDetail: '被诅咒的英雄每轮额外 +3 压力,持续 3 轮。',
    unlockSources: [
      { type: 'investigation-quest', sourceId: 'task-test-investigate-1' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_诅咒印记', flagValue: true },
    ],
  },
  // 2 阶段机制
  'intel-phase-1': {
    id: 'intel-phase-1',
    bossId: 'boss-test-arbiter',
    title: '阶段 1:召集亡者',
    category: 'phase-mechanic',
    summary: '审判者进入第二阶段时会召唤两批亡魂。',
    revealedDetail: '进入第二阶段立即召唤 2 个亡魂,之后每 2 轮召唤 1 个,直到祭坛被摧毁。',
    unlockSources: [
      { type: 'first-phase-encounter', sourceId: 'boss-test-arbiter-phase-1' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_phase1', flagValue: true },
    ],
  },
  'intel-phase-2': {
    id: 'intel-phase-2',
    bossId: 'boss-test-arbiter',
    title: '阶段 2:终末宣判',
    category: 'phase-mechanic',
    summary: '审判者进入第三阶段时不再使用普通攻击,只释放审判。',
    revealedDetail: '第三阶段每轮 100% 释放审判,压力 ≥ 85 的英雄直接进入死亡之门。',
    unlockSources: [
      { type: 'first-boss-failure', sourceId: 'boss-test-arbiter' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_phase2', flagValue: true },
    ],
  },
  // 1 环境目标
  'intel-env-1': {
    id: 'intel-env-1',
    bossId: 'boss-test-arbiter',
    title: '审判祭坛弱点',
    category: 'environment-target',
    summary: '审判祭坛位于 Boss 房间的西北角。',
    revealedDetail: '击碎祭坛可削弱 Boss 第一阶段召唤次数,但前排英雄会承受诅咒反噬。',
    unlockSources: [
      { type: 'special-curio', sourceId: 'curio-审判者日记' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_env_altar', flagValue: true },
    ],
  },
  // 1 推荐补给
  'intel-provision-1': {
    id: 'intel-provision-1',
    bossId: 'boss-test-arbiter',
    title: '圣水储备',
    category: 'recommended-provision',
    summary: '圣水能净化诅咒印记。',
    revealedDetail: '圣水是唯一可在 Boss 战内解除诅咒印记的补给,建议至少带 2 个。',
    unlockSources: [
      { type: 'class-analysis', sourceId: 'class-cleric' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_provision', flagValue: true },
    ],
  },
  // 1 撤退风险
  'intel-retreat-1': {
    id: 'intel-retreat-1',
    bossId: 'boss-test-arbiter',
    title: '撤退窗口收窄',
    category: 'retreat-risk',
    summary: 'Boss 进入第三阶段后撤退成功率大幅下降。',
    revealedDetail: '第三阶段撤退成功率仅 35%,且诅咒削弱在撤退后失效。',
    unlockSources: [
      { type: 'first-boss-failure', sourceId: 'boss-test-arbiter' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_retreat', flagValue: true },
    ],
  },
};

// =====================================================================
// 5. 削弱效果
// =====================================================================

export const BOSS_WEAKENING_EFFECTS: Record<string, BossWeakeningEffect> = {
  'weaken-summon-altar': {
    id: 'weaken-summon-altar',
    bossId: 'boss-test-arbiter',
    sourceQuestId: 'task-test-weaken-1',
    name: '摧毁召唤祭坛',
    description: '祭坛被摧毁,Boss 第一阶段召唤次数减半。',
    phaseModifiers: [
      {
        phaseIndex: 1,
        modifiers: [
          { kind: 'set-flag', flagName: 'boss_summon_pool_size', flagValue: 0 },
        ],
      },
    ],
    encounterModifiers: [
      { kind: 'clear-flag', flagName: 'boss_summon_pool_size' },
    ],
    routeModifiers: [],
    persistence: 'until-boss-defeated',
  },
  'weaken-stress-curse': {
    id: 'weaken-stress-curse',
    bossId: 'boss-test-arbiter',
    sourceQuestId: 'task-test-weaken-2',
    name: '破除诅咒',
    description: 'Boss 诅咒印记压力值从 3 降到 1。',
    phaseModifiers: [
      {
        phaseIndex: 2,
        modifiers: [
          { kind: 'set-flag', flagName: 'boss_curse_stress', flagValue: 1 },
        ],
      },
    ],
    encounterModifiers: [],
    routeModifiers: [],
    persistence: 'until-boss-defeated',
  },
};

// =====================================================================
// 6. Boss 阶段定义(3 个)
// =====================================================================

export const BOSS_PHASES: Record<string, BossPhaseDefinition> = {
  'phase-test-0': {
    id: 'phase-test-0',
    bossId: 'boss-test-arbiter',
    phaseIndex: 0,
    name: '识别',
    description: 'Boss 展示核心威胁;玩家验证情报;环境目标出现。',
    enterConditions: [
      { kind: 'flag-exists', flagName: 'boss_encounter_active' },
    ],
    exitConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 3 },
    ],
    bossModifiers: [
      { kind: 'set-flag', flagName: 'boss_damage_reduction', flagValue: 0.3 },
    ],
    environmentTargetIds: ['env-test-shield'],
    summonRules: [],
    tacticalOptionRules: [
      {
        id: 'tactic-p0-probe',
        title: '试探性攻击',
        description: '前排试探 Boss,确认攻击模式。',
        conditions: [],
        weight: 1.0,
        category: 'attack-core',
        phaseIndex: 0,
        effects: [
          { kind: 'hp-delta', amount: 5, heroSelector: 'front-rank' },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['frontline-risk'],
      },
      {
        id: 'tactic-p0-env',
        title: '观察环境目标',
        description: '本轮只观察环境目标,不攻击 Boss。',
        conditions: [],
        weight: 0.8,
        category: 'destroy-environment',
        phaseIndex: 0,
        effects: [
          { kind: 'inc-flag', flagName: 'env_observed', amount: 1 },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['skip-boss-damage'],
      },
      {
        id: 'tactic-p0-stabilize',
        title: '稳定压力',
        description: '本轮全员专注于缓解压力,放弃输出。',
        conditions: [],
        weight: 0.5,
        category: 'stabilize-stress',
        phaseIndex: 0,
        effects: [
          { kind: 'apply-stress', amount: -4, heroSelector: 'all-alive' },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['skip-boss-damage'],
      },
    ],
    phaseEvents: [
      {
        trigger: 'enter',
        effects: [
          { kind: 'set-flag', flagName: 'boss_encounter_active', flagValue: true },
        ],
        narrativeHint: 'Boss 战开始',
      },
    ],
  },
  'phase-test-1': {
    id: 'phase-test-1',
    bossId: 'boss-test-arbiter',
    phaseIndex: 1,
    name: '机制升级',
    description: 'Boss 攻击增强;召唤物出现;未完成削弱任务的惩罚显现。',
    enterConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 3 },
    ],
    exitConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 6 },
    ],
    bossModifiers: [
      { kind: 'clear-flag', flagName: 'boss_damage_reduction' },
    ],
    environmentTargetIds: ['env-test-altar', 'env-test-shield'],
    summonRules: [
      {
        summonId: 'summon-亡魂',
        maxPerPhase: 2,
        modifiers: [
          { kind: 'inc-flag', flagName: 'boss_summon_count', amount: 1 },
        ],
        trigger: { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 4 },
      },
    ],
    tacticalOptionRules: [
      {
        id: 'tactic-p1-attack-core',
        title: '全力攻击核心',
        description: '全员集中攻击 Boss 本体。',
        conditions: [],
        weight: 1.0,
        category: 'attack-core',
        phaseIndex: 1,
        effects: [
          { kind: 'hp-delta', amount: 8, heroSelector: 'all-alive' },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['all-in'],
      },
      {
        id: 'tactic-p1-handle-summon',
        title: '清理召唤物',
        description: '本轮先清理亡魂,延迟攻击 Boss。',
        conditions: [],
        weight: 0.7,
        category: 'handle-summon',
        phaseIndex: 1,
        effects: [
          { kind: 'clear-flag', flagName: 'boss_summon_count' },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['skip-boss-damage'],
      },
      {
        id: 'tactic-p1-destroy-env',
        title: '摧毁召唤祭坛',
        description: '集中火力摧毁祭坛,削弱后续召唤。',
        conditions: [
          { kind: 'flag-exists', flagName: 'env_altar_intact' },
        ],
        weight: 0.6,
        category: 'destroy-environment',
        phaseIndex: 1,
        effects: [
          { kind: 'inc-flag', flagName: 'env_altar_destroyed', amount: 1 },
          { kind: 'clear-flag', flagName: 'env_altar_intact' },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['frontline-risk'],
      },
    ],
    phaseEvents: [
      {
        trigger: 'enter',
        effects: [
          { kind: 'set-flag', flagName: 'boss_phase_rounds', flagValue: 0 },
          { kind: 'set-flag', flagName: 'env_altar_intact', flagValue: true },
        ],
        narrativeHint: '第二阶段:Boss 开始召唤亡魂',
      },
    ],
  },
  'phase-test-2': {
    id: 'phase-test-2',
    bossId: 'boss-test-arbiter',
    phaseIndex: 2,
    name: '绝境收尾',
    description: 'Boss 释放终末宣判;撤退成本提高;选择数量收紧。',
    enterConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 6 },
    ],
    exitConditions: [],
    bossModifiers: [
      { kind: 'set-flag', flagName: 'boss_damage_reduction', flagValue: 0.5 },
    ],
    environmentTargetIds: [],
    summonRules: [],
    tacticalOptionRules: [
      {
        id: 'tactic-p2-all-in',
        title: '孤注一掷',
        description: '无视一切,全力攻击 Boss。',
        conditions: [],
        weight: 1.0,
        category: 'attack-core',
        phaseIndex: 2,
        effects: [
          { kind: 'hp-delta', amount: 12, heroSelector: 'all-alive' },
          { kind: 'apply-stress', amount: 5, heroSelector: 'all-alive' },
        ],
        riskTags: ['all-in', 'high-stress'],
      },
      {
        id: 'tactic-p2-protect',
        title: '保护关键英雄',
        description: '让前排保护压力最高的英雄。',
        conditions: [],
        weight: 0.6,
        category: 'protect-hero',
        phaseIndex: 2,
        effects: [
          { kind: 'apply-stress', amount: -3, heroSelector: 'all-alive' },
        ],
        riskTags: ['skip-boss-damage'],
      },
      {
        id: 'tactic-p2-retreat',
        title: '尝试撤退',
        description: '在第三阶段尝试撤退(成功率仅 35%)。',
        conditions: [],
        weight: 0.3,
        category: 'retreat',
        phaseIndex: 2,
        effects: [
          { kind: 'set-flag', flagName: 'boss_retreat_requested', flagValue: true },
        ],
        riskTags: ['retreat'],
      },
    ],
    phaseEvents: [
      {
        trigger: 'enter',
        effects: [
          { kind: 'set-flag', flagName: 'boss_final_phase', flagValue: true },
        ],
        narrativeHint: '第三阶段:Boss 释放终末宣判',
      },
    ],
  },
};

// =====================================================================
// 7. Boss 永久奖励
// =====================================================================

export const BOSS_PERMANENT_REWARDS: Record<string, BossPermanentReward> = {
  'reward-test-arbiter': {
    id: 'reward-test-arbiter',
    bossId: 'boss-test-arbiter',
    name: '审判者遗产',
    description: '击败审判者后,遗迹区域的侦察和抗压能力提升。',
    campaignModifiers: [
      { kind: 'set-flag', flagName: 'ruins_scouting_bonus', flagValue: 0.2 },
      { kind: 'set-flag', flagName: 'ruins_stress_resist', flagValue: 0.15 },
    ],
    unlockedTrinketIds: ['trinket-审判者封印'],
    unlockedQuestModifierIds: ['modifier-审判者余威'],
  },
};

// =====================================================================
// 8. Boss 特殊任务物品
// =====================================================================

export const BOSS_QUEST_ITEMS: Record<string, BossQuestItemDefinition> = {
  'item-test-sacred-water': {
    id: 'item-test-sacred-water',
    bossId: 'boss-test-arbiter',
    name: '圣水',
    description: '能净化审判者诅咒印记的圣水。',
    inventorySlots: 1,
    availableInFinalEncounter: true,
    tacticalChoiceIds: ['tactic-p2-purify'],
    consumeOnUse: true,
  },
  'item-test-holy-relic': {
    id: 'item-test-holy-relic',
    bossId: 'boss-test-arbiter',
    name: '审判者遗物',
    description: '在 Boss 战可一次性强制降低阶段转换条件。',
    inventorySlots: 1,
    availableInFinalEncounter: true,
    tacticalChoiceIds: ['tactic-p1-force-phase'],
    consumeOnUse: true,
  },
};

// =====================================================================
// 9. Boss 通用定义
// =====================================================================

export const BOSS_DEFINITIONS: Record<string, BossDefinition> = {
  'boss-test-arbiter': {
    id: 'boss-test-arbiter',
    name: '测试审判者',
    regionId: 'ruins',
    description: 'Phase 6A 占位 Boss,用于验证通用框架;6B 将被"失落审判者"覆盖。',
    threatTags: ['stress', 'summon', 'curse'],
    recommendedHeroTags: ['stress-resist', 'frontline'],
    recommendedProvisionIds: ['item-test-sacred-water'],
    recommendedTrinketTags: ['stress-resist', 'curse-immunity'],
    intelligenceEntryIds: Object.keys(BOSS_INTELLIGENCE),
    investigationQuestIds: ['task-test-investigate-1'],
    weakeningQuestIds: ['task-test-weaken-1', 'task-test-weaken-2'],
    finalQuestId: 'task-test-final-1',
    phaseDefinitionIds: ['phase-test-0', 'phase-test-1', 'phase-test-2'],
    environmentTargetIds: ['env-test-altar', 'env-test-shield'],
    summonPoolIds: ['summon-亡魂'],
    retreatRules: TEST_BOSS_RETREAT,
    rewardTableId: 'reward-test-arbiter',
    permanentRewardId: 'reward-test-arbiter',
  },
};

// =====================================================================
// 10. 初始化 helpers(SPEC §28)
// =====================================================================

import { createEmptyRegionThreat } from './threat.js';
import type { RegionId } from '../regions/types.js';
import {
  createEmptyBossCampaignState,
} from './types.js';
import type {
  BossCampaignState,
  RegionThreatProgress,
  CampaignThreatState,
} from './types.js';

/**
 * 初始化所有 Boss 的跨周状态(SPEC §28)
 * 给 BOSS_DEFINITIONS 中每个 Boss 创建一个 hidden 状态
 */
export function initializeBossStates(): Record<string, BossCampaignState> {
  const result: Record<string, BossCampaignState> = {};
  for (const boss of Object.values(BOSS_DEFINITIONS)) {
    result[boss.id] = createEmptyBossCampaignState(boss.id, boss.regionId);
  }
  return result;
}

/**
 * 初始化所有区域的威胁进度(SPEC §28)
 * 3 个区域 × dormant 0
 */
export function initializeRegionThreats(): Record<RegionId, RegionThreatProgress> {
  return {
    'ruins': createEmptyRegionThreat('ruins'),
    'corrupted-woods': createEmptyRegionThreat('corrupted-woods'),
    'underground-burrows': createEmptyRegionThreat('underground-burrows'),
  };
}

/**
 * 初始化战役总进度(SPEC §28)
 */
export function createEmptyCampaignThreat(): CampaignThreatState {
  return {
    defeatedBossIds: [],
    totalBossesDefeated: 0,
    campaignThreatLevel: 0,
    finalCampaignGateReady: false,
  };
}
