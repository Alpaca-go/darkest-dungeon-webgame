/**
 * Boss 注册表(Phase 6B)
 *
 * 6A 阶段只交付 1 个测试 Boss `boss-test-arbiter` 用于验证框架。
 * 6B 把测试 Boss 内容升级为"失落审判者"完整设计(遗迹 Boss,per dev §20.1)。
 * 6C/6D 将分别新增"孢疫母巢"和"饥渊吞噬者"。
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
    description: '深入遗迹,在北侧偏殿找到通往审判厅的隐藏甬道;翻阅落满灰尘的审判名册,确认"失落审判者"确实在守卫着它。',
    grantsIds: ['intel-attack-1', 'intel-status-1', 'intel-phase-1'],
  },
  // ---- 削弱任务 ----
  'task-test-weaken-1': {
    id: 'task-test-weaken-1',
    bossId: 'boss-test-arbiter',
    type: 'weakening',
    name: '摧毁召唤祭坛',
    description: '在遗迹西侧坍塌的神殿中找到两座审判祭坛,凿碎其上的铭文石板。祭坛摧毁后,Boss 第一阶段将无法再召唤亡魂。',
    grantsIds: ['weaken-summon-altar'],
  },
  'task-test-weaken-2': {
    id: 'task-test-weaken-2',
    bossId: 'boss-test-arbiter',
    type: 'weakening',
    name: '找到破咒圣物',
    description: '在废墟下方的隐修室中找到一只封存完好的银质圣骨匣,内含曾被审判者本人降罪之人的遗骨。携带它进入 Boss 战可削弱诅咒压力。',
    grantsIds: ['weaken-stress-curse'],
  },
  // ---- 最终讨伐 ----
  'task-test-final-1': {
    id: 'task-test-final-1',
    bossId: 'boss-test-arbiter',
    type: 'final',
    name: '失落审判者讨伐',
    description: '进入审判厅,经历 8-12 个节点的 Boss 专属路线,在最后准备节点确认队伍状态,再进入三阶段选择式 Boss 遭遇。',
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
    description: '高耸的玄武岩祭坛,顶端嵌着审判者本人被降罪前的徽记。它持续向审判厅输送生前信徒的亡魂,让 Boss 战第一阶段永远有源源不断的召唤物。',
    hp: 30,
    stateTags: ['summon-source', 'sacred', 'ruins-only'],
    activeEffects: [
      { kind: 'inc-flag', flagName: 'boss_summon_pool_size', amount: 1, narrativeHint: '祭坛向审判厅输送亡魂' },
    ],
    destroyEffects: [
      { kind: 'clear-flag', flagName: 'boss_summon_pool_size' },
      { kind: 'apply-stress', amount: 3, heroSelector: 'all-alive', narrativeHint: '祭坛崩塌,残余压力扩散' },
    ],
    interactChoices: [
      {
        id: 'env-altar-smash',
        title: '直接摧毁祭坛',
        description: '让前排英雄冒险靠近并凿碎祭坛上的铭文石板。',
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
        description: '消耗一只"破咒圣物"或"圣水",远程封印祭坛,避免前线冒险。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_altar_sealed', amount: 1 },
        ],
        riskTags: ['consume-boss-item'],
      },
      {
        id: 'env-altar-skip',
        title: '暂不处理祭坛',
        description: '跳过本轮环境交互,继续攻击 Boss 本体或处理其他目标。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_altar_skipped', amount: 1 },
        ],
        riskTags: ['miss-environment-window'],
      },
    ],
  },
  'env-test-shield': {
    id: 'env-test-shield',
    bossId: 'boss-test-arbiter',
    name: '审判屏障',
    description: '审判者四周浮动的金色符文屏障,只有当玩家完成"调查任务"或"摧毁祭坛"后才会显现。屏障存在时,Boss 阶段 0 受到的伤害减半。',
    hp: 20,
    stateTags: ['defense', 'magic', 'ruins-only'],
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
        description: '全员集火屏障,放弃本轮攻击 Boss 本体或其他战术。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_shield_destroyed', amount: 1 },
        ],
        riskTags: ['all-in', 'skip-other-tactics'],
      },
      {
        id: 'env-shield-pierce',
        title: '用破咒圣物穿透屏障',
        description: '消耗一只"破咒圣物",直接穿透屏障,本轮可同时攻击 Boss。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_shield_pierced', amount: 1 },
        ],
        riskTags: ['consume-boss-item'],
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
    revealedDetail: '审判者每 3 轮释放一次审判之锤,前排英雄若处于 Death\'s Door 状态有 50% 概率直接阵亡;带"抗压"tag 的职业可在被锁定的回合主动格挡,将阵亡概率降至 10%。',
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
    summary: '审判者从祭坛召唤信徒亡魂,造成群体压力伤害。',
    revealedDetail: '亡魂波对全员施加 5-10 压力,职业带"抗压"tag 可减半;若完成削弱任务"摧毁召唤祭坛",亡魂波直接被封印,不再产生。',
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
    revealedDetail: '被诅咒的英雄每轮额外 +3 压力,持续 3 轮;进入阶段 2 后升级为每轮 +5。携带"圣水"或完成削弱任务"找到破咒圣物"可完全免疫诅咒印记(每轮压力上限压回 0)。',
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
    revealedDetail: '进入第二阶段立即召唤 2 个亡魂,之后每 2 轮召唤 1 个,直到祭坛被摧毁;若已摧毁祭坛,第二阶段跳过召唤,直接进入战位重排。',
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
    revealedDetail: '第三阶段每轮 100% 释放"终末宣判":压力 ≥ 85 的英雄直接进入死亡之门;压力 ≥ 100 的英雄在宣判后立即阵亡(无法抵抗)。该阶段只持续 3 轮,玩家必须在前 2 轮内打出足够伤害。',
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
    summary: '审判祭坛位于 Boss 房间的西北角,带有两处结构性弱点。',
    revealedDetail: '祭坛底座的两块铭文石板是承重点,凿碎后整个祭坛会在 2 轮内自然崩塌;若携带"破咒圣物",可绕过石板直接封印祭坛,避免前线冒险。',
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
    summary: '圣水能净化诅咒印记,建议至少带 2 个。',
    revealedDetail: '圣水是唯一可在 Boss 战内主动解除诅咒印记的补给,使用后立即清除被锁定英雄身上的所有诅咒状态;未带圣水时只能依赖"破咒圣物"(任务奖励)或硬扛每轮 +5 压力。',
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
    revealedDetail: '阶段 0 撤退成功率 65%(默认),阶段 1 降至 50%,阶段 2 仅 35%;撤退成功后,削弱任务"找到破咒圣物"的效果会失效(直到下次挑战前不再生效),但"摧毁召唤祭坛"永久保留。',
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
    description: '祭坛被摧毁,Boss 第二阶段不再召唤亡魂;玩家可直接跳过对亡魂的处理,把战术资源集中在攻击核心或环境目标上。',
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
    description: 'Boss 诅咒印记压力值从每轮 5 降到 1;被锁定的英雄不再快速冲破死亡之门门槛。注意:撤退成功后此削弱会失效,需重新准备。',
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
    name: '审判',
    description: '失落审判者从审判席上站起,身前浮现出"审判之锤"的轮廓;环境目标审判屏障显现,玩家可在本阶段先观察情报,或用破咒圣物穿透屏障。',
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
        description: '前排试探审判者,确认"审判之锤"的节奏;适合情报尚不完整、需要数据收集的首次挑战。',
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
        title: '击碎审判屏障',
        description: '集中火力击碎审判屏障,让后续阶段 1 的攻击直接命中 Boss 本体(否则 -50% 伤害减免)。',
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
        description: '全员在审判厅前停留,集中缓解压力,放弃本轮输出;适合压力 ≥ 60 的队伍。',
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
        narrativeHint: 'Boss 战开始:审判者缓缓站起',
      },
    ],
  },
  'phase-test-1': {
    id: 'phase-test-1',
    bossId: 'boss-test-arbiter',
    phaseIndex: 1,
    name: '召集亡者',
    description: '审判者击碎审判屏障,从西北角的召唤祭坛中召出亡魂;若未完成"摧毁召唤祭坛"削弱,本阶段会持续刷新亡魂,玩家必须在"清亡魂/攻核心/毁祭坛"之间取舍。',
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
        description: '全员集中攻击审判者本体,放弃本轮处理亡魂或祭坛;适合祭坛已被削弱任务摧毁的情况。',
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
        title: '清理亡魂',
        description: '本轮先集中清理刚召出的亡魂,延迟攻击 Boss;但让审判者有 1 轮时间继续召唤更多亡魂。',
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
        description: '派前排冒险靠近西北角,凿碎祭坛底座的两块铭文石板;摧毁后本阶段后续不再召唤亡魂。',
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
        narrativeHint: '第二阶段:亡者受召,从审判厅四壁涌入',
      },
    ],
  },
  'phase-test-2': {
    id: 'phase-test-2',
    bossId: 'boss-test-arbiter',
    phaseIndex: 2,
    name: '终末宣判',
    description: '审判者放下武器,缓缓升空;每轮以"终末宣判"对全员进行最后审判——压力 ≥ 85 的英雄直接进入死亡之门,压力 ≥ 100 直接阵亡。玩家必须在前 2 轮内打出足够伤害,否则第 3 轮就只剩残队。',
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
        description: '无视一切,全力攻击审判者;本轮全员压力 +5(可能让部分英雄冲破死亡之门),但能在第 2 轮结束前打出决定性伤害。',
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
        description: '让前排护住压力最高的英雄,本轮全员压力 -3;适合队伍已经过半数濒死、需要稳定下来的情况。',
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
        description: '在终末宣判下撤退,基础成功率仅 35%;若携带"破咒圣物"且未使用,撤退成功率 +20%。撤退后破咒削弱失效,但摧毁祭坛削弱保留。',
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
        narrativeHint: '第三阶段:终末宣判,审判者升空',
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
    description: '击败失落审判者后,玩家获得"审判者封印"饰品,遗迹区域侦察 +20%、抗压 +15%;并解锁"审判者余威"任务修正词(后续任务每场 +3 压力上限 -5%)。遗产不会被重复领取(SPEC §27)。',
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
    description: '用审判厅地下圣泉的水装满的小银瓶;在 Boss 战可使用,立即清除被锁定英雄身上的"诅咒印记"状态。建议至少带 2 瓶应对阶段 2 的持续施压。',
    inventorySlots: 1,
    availableInFinalEncounter: true,
    tacticalChoiceIds: ['tactic-p2-purify'],
    consumeOnUse: true,
  },
  'item-test-holy-relic': {
    id: 'item-test-holy-relic',
    bossId: 'boss-test-arbiter',
    name: '破咒圣物',
    description: '从隐修室获得的银质圣骨匣,内含被审判者降罪之人的遗骨;在 Boss 战可一次性穿透审判屏障,或封锁召唤祭坛(无需前线冒险);撤退成功后此物仍保留。',
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
    name: '失落审判者',
    regionId: 'ruins',
    description: '百年前因错判而被降罪,封入遗迹深处审判厅的审判者;他以亡魂为兵、以诅咒为刃,凡踏入审判厅者必须接受他的"终末宣判"。核心威胁:高压力 + 宗教诅咒 + 召唤信徒;玩家通过情报 + 削弱任务 + 针对性组队,改变 Boss 战的多个关键节点。',
    threatTags: ['stress', 'summon', 'curse'],
    recommendedHeroTags: ['stress-resist', 'frontline', 'curse-immunity'],
    recommendedProvisionIds: ['item-test-sacred-water', 'item-test-holy-relic'],
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
