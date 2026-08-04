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
  // ============================================================
  // 6C:孢疫母巢(spore-matriarch)— corrupted-woods
  // ============================================================
  'task-spore-investigate-1': {
    id: 'task-spore-investigate-1',
    bossId: 'boss-spore-matriarch',
    type: 'investigation',
    name: '调查腐败林地菌床',
    description: '深入林地深处,顺着孢子气味的浓重方向找到被菌丝覆盖的古代祭坛;在腐烂的树皮上刻下"母巢"二字,确认孢疫母巢确实在地下菌床中沉睡。',
    grantsIds: ['intel-spore-attack-1', 'intel-spore-status-1', 'intel-spore-phase-1'],
  },
  'task-spore-weaken-1': {
    id: 'task-spore-weaken-1',
    bossId: 'boss-spore-matriarch',
    type: 'weakening',
    name: '净化外层菌床',
    description: '在林地浅层找到母巢外延的三块腐殖菌床,用火油逐块焚烧,断绝母巢向外扩张孢子的养分。菌床烧尽后,母巢第二阶段的孢子召唤会大幅减半。',
    grantsIds: ['weaken-spore-mycelium'],
  },
  'task-spore-weaken-2': {
    id: 'task-spore-weaken-2',
    bossId: 'boss-spore-matriarch',
    type: 'weakening',
    name: '取得抗孢子药剂',
    description: '在林地药剂师的高塔中找到一瓶由 7 种抗病草药调制的银瓶,瓶口封蜡上刻有"母巢之日"的日期;携带它进入 Boss 战可获得 3 轮完全免疫孢子疾病攻击。',
    grantsIds: ['weaken-spore-immunity'],
  },
  'task-spore-final-1': {
    id: 'task-spore-final-1',
    bossId: 'boss-spore-matriarch',
    type: 'final',
    name: '孢疫母巢讨伐',
    description: '沿菌丝小径下到地下母巢,在"母巢之心"前最后确认队伍抗病与压力状态,再进入三阶段孢子感染式 Boss 遭遇。',
    grantsIds: [],
  },
  // ============================================================
  // 6D:饥渊吞噬者(burrows-devourer)— underground-burrows
  // ============================================================
  'task-burrows-investigate-1': {
    id: 'task-burrows-investigate-1',
    bossId: 'boss-burrows-devourer',
    type: 'investigation',
    name: '调查地下储粮坑',
    description: '沿兽穴的啃食痕迹下到地下深处,找到堆满旅行者残骸的储粮坑;在骨架上刻下"饥渊"二字,确认吞噬者正在坑中等待下一批猎物。',
    grantsIds: ['intel-burrows-attack-1', 'intel-burrows-status-1', 'intel-burrows-phase-1'],
  },
  'task-burrows-weaken-1': {
    id: 'task-burrows-weaken-1',
    bossId: 'boss-burrows-devourer',
    type: 'weakening',
    name: '焚毁储粮巢穴',
    description: '在兽穴中层找到饥渊的备用储粮穴,泼洒火油并点燃;储粮穴烧尽后,饥渊第一阶段无法再掠夺队伍食物,且每轮食物消耗 -2。',
    grantsIds: ['weaken-burrows-food'],
  },
  'task-burrows-weaken-2': {
    id: 'task-burrows-weaken-2',
    bossId: 'boss-burrows-devourer',
    type: 'weakening',
    name: '杀死精英护卫',
    description: '在兽穴入口处找到两只精英护卫"巨角地精",在 Boss 战前击杀;杀死后饥渊第二阶段无法再召唤精英护卫,玩家可直接跳过对护卫的处理。',
    grantsIds: ['weaken-burrows-guard'],
  },
  'task-burrows-final-1': {
    id: 'task-burrows-final-1',
    bossId: 'boss-burrows-devourer',
    type: 'final',
    name: '饥渊吞噬者讨伐',
    description: '沿血迹走完 8-12 个节点的 Boss 专属路线,在最后准备节点确认队伍食物与流血状态,再进入三阶段饥饿式 Boss 遭遇。',
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

/**
 * 6C 孢疫母巢撤退规则(per dev §20.2)
 * 基础 60% 比审判者低(疾病压更不容易撤);
 * 阶段 1 召唤感染体,阶段 2 母巢暴走更难撤。
 */
const SPORE_BOSS_RETREAT: BossRetreatRules = {
  baseSuccessRate: 0.60,
  phaseModifiers: {
    0: 0,
    1: -0.20,
    2: -0.40,
  },
  stressPenalty: 5,
  threatIncrease: 18, // 孢子扩散 → 威胁涨得更多
  weakeningEffectLossRules: ['weaken-spore-immunity'], // 撤退后抗孢子药剂失效
};

/**
 * 6D 饥渊吞噬者撤退规则(per dev §20.3)
 * 基础 55%(三 Boss 最低;地下逃亡难度最高);
 * 阶段 2 -45%(仅 10%,几乎无法撤)。
 */
const BURROWS_BOSS_RETREAT: BossRetreatRules = {
  baseSuccessRate: 0.55,
  phaseModifiers: {
    0: 0,
    1: -0.25,
    2: -0.45,
  },
  stressPenalty: 10, // 流血后退役会更痛
  threatIncrease: 20, // 食物掠夺 + 流血 → 威胁涨得最多
  weakeningEffectLossRules: ['weaken-burrows-food'], // 撤退后储粮削弱失效
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
  // ============================================================
  // 6C 孢疫母巢环境目标
  // ============================================================
  'env-spore-mycelium-bed': {
    id: 'env-spore-mycelium-bed',
    bossId: 'boss-spore-matriarch',
    name: '外层菌床',
    description: '母巢向外延伸的腐殖菌床,白色菌丝深入地下 3 米,持续把周围树木的养分抽向母巢。菌床点燃后,母巢第二阶段的孢子扩散范围减半。',
    hp: 30,
    stateTags: ['summon-source', 'infection', 'woods-only'],
    activeEffects: [
      { kind: 'inc-flag', flagName: 'boss_infection_pool_size', amount: 1, narrativeHint: '菌床向母巢输送感染孢子' },
    ],
    destroyEffects: [
      { kind: 'clear-flag', flagName: 'boss_infection_pool_size' },
      { kind: 'apply-stress', amount: 2, heroSelector: 'all-alive', narrativeHint: '菌床燃尽,残余孢子扩散' },
    ],
    interactChoices: [
      {
        id: 'env-mycelium-burn',
        title: '用火油焚烧菌床',
        description: '让前排英雄泼洒火油并点燃菌床;火势会反噬前排,但彻底断绝母巢养分。',
        conditions: [],
        effects: [
          { kind: 'hp-delta', amount: -10, heroSelector: 'front-rank', narrativeHint: '火势反噬前排' },
          { kind: 'inc-flag', flagName: 'env_mycelium_burned', amount: 1 },
        ],
        riskTags: ['frontline-risk', 'fire-damage'],
      },
      {
        id: 'env-mycelium-seal',
        title: '用抗孢子药剂封菌床',
        description: '消耗"抗孢子药剂",直接封死菌床活性,无需前线冒险。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_mycelium_sealed', amount: 1 },
        ],
        riskTags: ['consume-boss-item'],
      },
      {
        id: 'env-mycelium-skip',
        title: '暂不处理菌床',
        description: '跳过本轮环境交互,继续攻击母巢或处理其他目标。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_mycelium_skipped', amount: 1 },
        ],
        riskTags: ['miss-environment-window'],
      },
    ],
  },
  'env-spore-spore-sac': {
    id: 'env-spore-spore-sac',
    bossId: 'boss-spore-matriarch',
    name: '巨型孢子囊',
    description: '母巢之心附近悬挂的半透明孢子囊,直径近 1 米;囊内含有数百亿活性孢子。一旦破裂,会对全员造成 10 压力 + 5 HP 损失,但母巢会失去"孢子爆裂"技能。',
    hp: 20,
    stateTags: ['burst-attack', 'woods-only'],
    activeEffects: [
      { kind: 'set-flag', flagName: 'boss_spore_burst_active', flagValue: true },
    ],
    destroyEffects: [
      { kind: 'clear-flag', flagName: 'boss_spore_burst_active' },
      { kind: 'hp-delta', amount: -5, heroSelector: 'all-alive', narrativeHint: '孢子囊破裂,孢子云扩散' },
      { kind: 'apply-stress', amount: 10, heroSelector: 'all-alive', narrativeHint: '孢子云造成群体压力' },
    ],
    interactChoices: [
      {
        id: 'env-sac-burst',
        title: '主动戳破孢子囊',
        description: '让前排英雄冒险靠近并用武器刺破孢子囊;全员受到 5 HP + 10 压力,但母巢失去孢子爆裂。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_sac_burst', amount: 1 },
        ],
        riskTags: ['party-damage', 'stress-burst'],
      },
      {
        id: 'env-sac-ignore',
        title: '绕开孢子囊',
        description: '忽略孢子囊继续攻击母巢;孢子爆裂将在每轮自动触发,直到母巢 HP 降至 50% 以下。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_sac_ignored', amount: 1 },
        ],
        riskTags: ['recurring-damage'],
      },
    ],
  },
  // ============================================================
  // 6D 饥渊吞噬者环境目标
  // ============================================================
  'env-burrows-food-pit': {
    id: 'env-burrows-food-pit',
    bossId: 'boss-burrows-devourer',
    name: '储粮坑',
    description: '饥渊的备用食物储藏地,堆满旅行者残骸与干货;饥渊每 2 轮从中掠夺 1 份食物,直到储粮坑被焚毁。坑中藏着 7 天的口粮,足以让一支队伍饿死。',
    hp: 30,
    stateTags: ['food-source', 'loot-rich', 'burrows-only'],
    activeEffects: [
      { kind: 'inc-flag', flagName: 'boss_food_raided', amount: 1, narrativeHint: '饥渊从储粮坑中掠夺食物' },
    ],
    destroyEffects: [
      { kind: 'clear-flag', flagName: 'boss_food_raided' },
      { kind: 'apply-stress', amount: 4, heroSelector: 'all-alive', narrativeHint: '储粮坑崩塌,残骸飞舞' },
    ],
    interactChoices: [
      {
        id: 'env-pit-burn',
        title: '用火油焚烧储粮坑',
        description: '让前排英雄泼洒火油并点燃储粮坑;火势会反噬前排,但彻底断绝饥渊的食物来源。',
        conditions: [],
        effects: [
          { kind: 'hp-delta', amount: -10, heroSelector: 'front-rank', narrativeHint: '火势反噬前排' },
          { kind: 'inc-flag', flagName: 'env_pit_burned', amount: 1 },
        ],
        riskTags: ['frontline-risk', 'fire-damage'],
      },
      {
        id: 'env-pit-seal',
        title: '用圣物封锁储粮坑',
        description: '消耗"储粮焚毁圣物",直接封死储粮坑活性,无需前线冒险。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_pit_sealed', amount: 1 },
        ],
        riskTags: ['consume-boss-item'],
      },
      {
        id: 'env-pit-skip',
        title: '暂不处理储粮坑',
        description: '跳过本轮环境交互,继续攻击饥渊;但饥渊会继续从坑中掠夺食物。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_pit_skipped', amount: 1 },
        ],
        riskTags: ['miss-environment-window', 'food-loss'],
      },
    ],
  },
  'env-burrows-corpse-pile': {
    id: 'env-burrows-corpse-pile',
    bossId: 'boss-burrows-devourer',
    name: '尸体堆',
    description: '兽穴深处由数百具旅行者遗骸堆成的小山,饥渊从其中召出精英护卫"巨角地精";堆中存在一只未腐的护身符,可能与削弱任务相关。',
    hp: 20,
    stateTags: ['summon-source', 'horror', 'burrows-only'],
    activeEffects: [
      { kind: 'set-flag', flagName: 'boss_guard_summon_active', flagValue: true },
    ],
    destroyEffects: [
      { kind: 'clear-flag', flagName: 'boss_guard_summon_active' },
      { kind: 'hp-delta', amount: -3, heroSelector: 'all-alive', narrativeHint: '尸体堆崩塌,骨头乱飞' },
    ],
    interactChoices: [
      {
        id: 'env-corpse-clean',
        title: '清理尸体堆',
        description: '让前排英雄清理尸体堆,本轮全员受到 3 HP 但饥渊失去精英护卫召唤。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_corpse_cleared', amount: 1 },
        ],
        riskTags: ['party-damage', 'horror'],
      },
      {
        id: 'env-corpse-search',
        title: '搜索尸体堆找护身符',
        description: '在尸体堆中搜索,可能找到有用的护身符;但搜寻过程会触发护卫警告,饥渊将立即召唤精英护卫。',
        conditions: [],
        effects: [
          { kind: 'set-flag', flagName: 'boss_guard_immediate_summon', flagValue: true },
        ],
        riskTags: ['immediate-summon', 'horror'],
      },
      {
        id: 'env-corpse-ignore',
        title: '绕开尸体堆',
        description: '忽略尸体堆继续攻击饥渊;每轮饥渊有 50% 概率从中召出精英护卫。',
        conditions: [],
        effects: [
          { kind: 'inc-flag', flagName: 'env_corpse_ignored', amount: 1 },
        ],
        riskTags: ['recurring-summon'],
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
  // ============================================================
  // 6C 孢疫母巢情报(8 条)
  // ============================================================
  'intel-spore-attack-1': {
    id: 'intel-spore-attack-1',
    bossId: 'boss-spore-matriarch',
    title: '孢子爆裂',
    category: 'attack-pattern',
    summary: '母巢周期性释放孢子云,对全员造成群体压力 + 疾病。',
    revealedDetail: '母巢每 2 轮释放一次孢子爆裂,对全员施加 8 压力 + 1 疾病抗性下降;携带"抗孢子药剂"或完成削弱任务"取得抗孢子药剂"可在本轮完全免疫。',
    unlockSources: [
      { type: 'investigation-quest', sourceId: 'task-spore-investigate-1' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_孢子爆裂', flagValue: true },
    ],
  },
  'intel-spore-attack-2': {
    id: 'intel-spore-attack-2',
    bossId: 'boss-spore-matriarch',
    title: '菌丝缠绕',
    category: 'attack-pattern',
    summary: '母巢伸出菌丝缠绕前排,降低其站位并持续扣血。',
    revealedDetail: '菌丝缠绕每 3 轮使用一次,锁定前排最低 HP 英雄,造成 4 HP 损失并将其从原站位拉至下一排;带"抗病"或"高 HP"tag 的职业可提前防御,损失减半。',
    unlockSources: [
      { type: 'elite-encounter', sourceId: 'elite-腐化林妖' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_菌丝缠绕', flagValue: true },
    ],
  },
  'intel-spore-status-1': {
    id: 'intel-spore-status-1',
    bossId: 'boss-spore-matriarch',
    title: '孢子感染',
    category: 'status-threat',
    summary: '被母巢孢子感染的英雄每轮压力 +2,且可能传染队友。',
    revealedDetail: '感染状态持续 4 轮,每轮 +2 压力且有 30% 概率传染相邻英雄;携带"抗孢子药剂"或完成削弱"取得抗孢子药剂"可完全免疫感染。',
    unlockSources: [
      { type: 'investigation-quest', sourceId: 'task-spore-investigate-1' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_孢子感染', flagValue: true },
    ],
  },
  'intel-spore-phase-1': {
    id: 'intel-spore-phase-1',
    bossId: 'boss-spore-matriarch',
    title: '阶段 1:污染扩散',
    category: 'phase-mechanic',
    summary: '母巢进入第二阶段会扩散菌床并召唤感染体。',
    revealedDetail: '进入第二阶段立即从外层菌床召出 2 个感染体,之后每 2 轮召唤 1 个,直到菌床被焚烧;若菌床已焚烧,第二阶段跳过召唤,直接进入孢子云蔓延阶段。',
    unlockSources: [
      { type: 'first-phase-encounter', sourceId: 'boss-spore-matriarch-phase-1' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_phase1', flagValue: true },
    ],
  },
  'intel-spore-phase-2': {
    id: 'intel-spore-phase-2',
    bossId: 'boss-spore-matriarch',
    title: '阶段 2:母巢暴走',
    category: 'phase-mechanic',
    summary: '母巢进入第三阶段会暴走释放全部孢子。',
    revealedDetail: '第三阶段每轮 100% 释放"孢子终爆":对全员施加 15 压力 + 30% 概率立刻进入死亡之门(若已感染则 +20%);持续 3 轮,玩家必须在前 2 轮打出决定性伤害。',
    unlockSources: [
      { type: 'first-boss-failure', sourceId: 'boss-spore-matriarch' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_phase2', flagValue: true },
    ],
  },
  'intel-spore-env-1': {
    id: 'intel-spore-env-1',
    bossId: 'boss-spore-matriarch',
    title: '菌床结构弱点',
    category: 'environment-target',
    summary: '外层菌床有 3 处易燃点,用火油能彻底烧断。',
    revealedDetail: '菌床底部连接母巢的菌丝有 3 处暴露在地表的根结,泼洒火油并点燃可彻底烧断;但火势会反噬前排英雄 10 HP。若携带"抗孢子药剂",可直接封死菌床,无需前线冒险。',
    unlockSources: [
      { type: 'special-curio', sourceId: 'curio-林地药剂师笔记' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_env_mycelium', flagValue: true },
    ],
  },
  'intel-spore-provision-1': {
    id: 'intel-spore-provision-1',
    bossId: 'boss-spore-matriarch',
    title: '抗孢子药剂',
    category: 'recommended-provision',
    summary: '抗孢子药剂能完全免疫母巢的孢子疾病攻击。',
    revealedDetail: '抗孢子药剂是唯一可在 Boss 战内主动解除"孢子感染"并免疫后续孢子爆裂的补给,每瓶持续 3 轮完全免疫;未带药剂时只能依赖"抗病 tag"或硬扛每轮 +2 压力 + 30% 传染。',
    unlockSources: [
      { type: 'class-analysis', sourceId: 'class-plague-doctor' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_provision', flagValue: true },
    ],
  },
  'intel-spore-retreat-1': {
    id: 'intel-spore-retreat-1',
    bossId: 'boss-spore-matriarch',
    title: '孢子窒息撤退',
    category: 'retreat-risk',
    summary: 'Boss 进入第三阶段后撤退失败率显著上升。',
    revealedDetail: '阶段 0 撤退成功率 60%(默认),阶段 1 降至 40%,阶段 2 仅 20%(孢子窒息);撤退成功后,削弱任务"取得抗孢子药剂"的效果会失效(直到下次挑战前不再生效),但"净化外层菌床"永久保留。',
    unlockSources: [
      { type: 'first-boss-failure', sourceId: 'boss-spore-matriarch' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_retreat', flagValue: true },
    ],
  },
  // ============================================================
  // 6D 饥渊吞噬者情报(8 条)
  // ============================================================
  'intel-burrows-attack-1': {
    id: 'intel-burrows-attack-1',
    bossId: 'boss-burrows-devourer',
    title: '撕裂獠牙',
    category: 'attack-pattern',
    summary: '饥渊用獠牙撕裂前排,造成 HP 损失 + 流血。',
    revealedDetail: '饥渊每 2 轮释放一次"撕裂獠牙",对前排最低 HP 英雄造成 5 HP 损失 + 3 轮流血(每轮 2 HP);携带战斗绷带可在流血触发时立即止血,或由"抗流血"tag 职业将流血持续时间减半。',
    unlockSources: [
      { type: 'investigation-quest', sourceId: 'task-burrows-investigate-1' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_撕裂獠牙', flagValue: true },
    ],
  },
  'intel-burrows-attack-2': {
    id: 'intel-burrows-attack-2',
    bossId: 'boss-burrows-devourer',
    title: '吞噬吞噬',
    category: 'attack-pattern',
    summary: '饥渊直接吞噬前排英雄的部分食物,造成饥饿状态。',
    revealedDetail: '饥渊每 3 轮发动"吞噬吞噬",对前排 2 名英雄各 -2 食物,持续 2 轮饥饿(每轮额外 -1 HP);带"饱腹"或"干粮"tag 的职业可提前防御,损失减半。',
    unlockSources: [
      { type: 'elite-encounter', sourceId: 'elite-巨角地精' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_吞噬吞噬', flagValue: true },
    ],
  },
  'intel-burrows-status-1': {
    id: 'intel-burrows-status-1',
    bossId: 'boss-burrows-devourer',
    title: '饥饿狂潮',
    category: 'status-threat',
    summary: '食物 < 50% 时饥渊进入狂潮状态,所有攻击加强。',
    revealedDetail: '当队伍食物 < 50% 时,饥渊进入"饥饿狂潮"状态:每轮额外 +1 HP 损失到全员,流血持续时间 +1 轮;携带"储粮焚毁圣物"或完成削弱"焚毁储粮巢穴"可压制狂潮,不再触发。',
    unlockSources: [
      { type: 'investigation-quest', sourceId: 'task-burrows-investigate-1' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_饥饿狂潮', flagValue: true },
    ],
  },
  'intel-burrows-phase-1': {
    id: 'intel-burrows-phase-1',
    bossId: 'boss-burrows-devourer',
    title: '阶段 1:饥饿狂潮',
    category: 'phase-mechanic',
    summary: '饥渊进入第二阶段会从尸体堆召出精英护卫。',
    revealedDetail: '进入第二阶段立即从尸体堆召出 1 个精英护卫"巨角地精",之后每 3 轮召唤 1 个,直到尸体堆被清理;若已完成削弱任务"杀死精英护卫",第二阶段跳过召唤,直接进入吞噬阶段。',
    unlockSources: [
      { type: 'first-phase-encounter', sourceId: 'boss-burrows-devourer-phase-1' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_phase1', flagValue: true },
    ],
  },
  'intel-burrows-phase-2': {
    id: 'intel-burrows-phase-2',
    bossId: 'boss-burrows-devourer',
    title: '阶段 2:吞噬一切',
    category: 'phase-mechanic',
    summary: '饥渊进入第三阶段吞噬剩余储粮坑,所有英雄持续流血。',
    revealedDetail: '第三阶段每轮 100% 释放"吞噬一切":对全员施加 6 HP 损失 + 5 轮流血;HP < 25% 的英雄直接进入死亡之门。该阶段只持续 3 轮,玩家必须在前 2 轮内打出决定性伤害。',
    unlockSources: [
      { type: 'first-boss-failure', sourceId: 'boss-burrows-devourer' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_phase2', flagValue: true },
    ],
  },
  'intel-burrows-env-1': {
    id: 'intel-burrows-env-1',
    bossId: 'boss-burrows-devourer',
    title: '储粮坑结构弱点',
    category: 'environment-target',
    summary: '储粮坑有 3 处木质支撑柱,泼洒火油并点燃能彻底烧断。',
    revealedDetail: '储粮坑底部连接地面的木质支撑柱有 3 处暴露点,泼洒火油并点燃可彻底烧断;但火势会反噬前排英雄 10 HP。若携带"储粮焚毁圣物",可直接封死储粮坑,无需前线冒险。',
    unlockSources: [
      { type: 'special-curio', sourceId: 'curio-地精守护者笔记' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_env_food_pit', flagValue: true },
    ],
  },
  'intel-burrows-provision-1': {
    id: 'intel-burrows-provision-1',
    bossId: 'boss-burrows-devourer',
    title: '战斗绷带储备',
    category: 'recommended-provision',
    summary: '战斗绷带能立即止血,建议至少带 4 卷。',
    revealedDetail: '战斗绷带是唯一可在 Boss 战内主动解除"流血"状态的补给,使用后立即清除被锁定英雄身上的所有流血;未带绷带时只能依赖"抗流血"职业或硬扛 3 轮每轮 2 HP 流血。',
    unlockSources: [
      { type: 'class-analysis', sourceId: 'class-arbalest' },
    ],
    gameplayEffects: [
      { kind: 'set-flag', flagName: 'intel_known_provision', flagValue: true },
    ],
  },
  'intel-burrows-retreat-1': {
    id: 'intel-burrows-retreat-1',
    bossId: 'boss-burrows-devourer',
    title: '吞噬窗口收窄',
    category: 'retreat-risk',
    summary: 'Boss 进入第三阶段后撤退几乎无望。',
    revealedDetail: '阶段 0 撤退成功率 55%(默认),阶段 1 降至 30%,阶段 2 仅 10%(几近无望);撤退成功后,削弱任务"焚毁储粮巢穴"的效果会失效(直到下次挑战前不再生效),但"杀死精英护卫"永久保留。',
    unlockSources: [
      { type: 'first-boss-failure', sourceId: 'boss-burrows-devourer' },
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
  // ============================================================
  // 6C 孢疫母巢削弱效果
  // ============================================================
  'weaken-spore-mycelium': {
    id: 'weaken-spore-mycelium',
    bossId: 'boss-spore-matriarch',
    sourceQuestId: 'task-spore-weaken-1',
    name: '净化外层菌床',
    description: '外层菌床被焚毁,母巢第二阶段感染召唤池缩小到 1;玩家可少处理 1-2 个感染体,把战术资源集中在处理孢子囊或攻击母巢。',
    phaseModifiers: [
      {
        phaseIndex: 1,
        modifiers: [
          { kind: 'set-flag', flagName: 'boss_infection_pool_size', flagValue: 1 },
        ],
      },
    ],
    encounterModifiers: [
      { kind: 'clear-flag', flagName: 'boss_infection_pool_size' },
    ],
    routeModifiers: [],
    persistence: 'until-boss-defeated',
  },
  'weaken-spore-immunity': {
    id: 'weaken-spore-immunity',
    bossId: 'boss-spore-matriarch',
    sourceQuestId: 'task-spore-weaken-2',
    name: '抗孢子免疫',
    description: '携带抗孢子药剂进入 Boss 战,前 3 轮所有英雄完全免疫孢子爆裂和感染(压力减半);未带药剂时只能依赖"抗病 tag"职业。注意:撤退成功后此削弱会失效,需重新准备。',
    phaseModifiers: [
      {
        phaseIndex: 2,
        modifiers: [
          { kind: 'set-flag', flagName: 'boss_spore_immunity', flagValue: 3 },
        ],
      },
    ],
    encounterModifiers: [],
    routeModifiers: [],
    persistence: 'until-boss-defeated',
  },
  // ============================================================
  // 6D 饥渊吞噬者削弱效果
  // ============================================================
  'weaken-burrows-food': {
    id: 'weaken-burrows-food',
    bossId: 'boss-burrows-devourer',
    sourceQuestId: 'task-burrows-weaken-1',
    name: '焚毁储粮巢穴',
    description: '兽穴的储粮坑和尸体堆被先遣队纵火焚毁,吞噬者第二阶段"饥饿狂潮"召唤精英护卫时只能召出 1 只(默认 2 只),且精英护卫攻击力 -25%。注意:撤退成功后此削弱会失效,需重新准备。',
    phaseModifiers: [
      {
        phaseIndex: 1,
        modifiers: [
          { kind: 'set-flag', flagName: 'boss_food_destroyed', flagValue: true },
          { kind: 'set-flag', flagName: 'boss_guard_count', flagValue: 1 },
          { kind: 'set-flag', flagName: 'boss_guard_attack_reduction', flagValue: 0.25 },
        ],
      },
    ],
    encounterModifiers: [
      { kind: 'clear-flag', flagName: 'boss_food_destroyed' },
      { kind: 'clear-flag', flagName: 'boss_guard_count' },
      { kind: 'clear-flag', flagName: 'boss_guard_attack_reduction' },
    ],
    routeModifiers: [],
    persistence: 'until-boss-defeated',
  },
  'weaken-burrows-guard': {
    id: 'weaken-burrows-guard',
    bossId: 'boss-burrows-devourer',
    sourceQuestId: 'task-burrows-weaken-2',
    name: '杀死精英护卫',
    description: '派遣暗杀小队从背后刺杀吞噬者的精英护卫;Boss 战不再自动召唤精英护卫,且前排受到的"撕裂獠牙"伤害 -5 HP。注意:撤退成功后此削弱会失效,需重新准备。',
    phaseModifiers: [
      {
        phaseIndex: 1,
        modifiers: [
          { kind: 'set-flag', flagName: 'boss_no_guard_summon', flagValue: true },
          { kind: 'set-flag', flagName: 'boss_tusk_damage_reduction', flagValue: 5 },
        ],
      },
      {
        phaseIndex: 2,
        modifiers: [
          { kind: 'set-flag', flagName: 'boss_no_guard_summon', flagValue: true },
          { kind: 'set-flag', flagName: 'boss_tusk_damage_reduction', flagValue: 5 },
        ],
      },
    ],
    encounterModifiers: [
      { kind: 'clear-flag', flagName: 'boss_no_guard_summon' },
      { kind: 'clear-flag', flagName: 'boss_tusk_damage_reduction' },
    ],
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
  // ============================================================
  // 6C 孢疫母巢阶段定义(3 个)
  // ============================================================
  'phase-spore-0': {
    id: 'phase-spore-0',
    bossId: 'boss-spore-matriarch',
    phaseIndex: 0,
    name: '孢子繁殖',
    description: '母巢之心开始搏动,从外层菌床向四周释放出稀薄的孢子云;环境目标孢子囊显现,玩家可在本阶段先观察情报,或选择用火油焚烧菌床(需前排冒险)。',
    enterConditions: [
      { kind: 'flag-exists', flagName: 'boss_encounter_active' },
    ],
    exitConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 3 },
    ],
    bossModifiers: [
      { kind: 'set-flag', flagName: 'boss_disease_aura', flagValue: 0.3 },
    ],
    environmentTargetIds: ['env-spore-spore-sac'],
    summonRules: [],
    tacticalOptionRules: [
      {
        id: 'tactic-spore-p0-probe',
        title: '试探性攻击',
        description: '前排试探母巢,确认"孢子爆裂"的节奏;适合情报尚不完整、需要数据收集的首次挑战。',
        conditions: [],
        weight: 1.0,
        category: 'attack-core',
        phaseIndex: 0,
        effects: [
          { kind: 'hp-delta', amount: 5, heroSelector: 'front-rank' },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['frontline-risk', 'disease-aura'],
      },
      {
        id: 'tactic-spore-p0-env',
        title: '戳破孢子囊',
        description: '派前排冒险戳破孢子囊,本轮全员受到 5 HP + 10 压力,但母巢失去孢子爆裂技能。',
        conditions: [],
        weight: 0.7,
        category: 'destroy-environment',
        phaseIndex: 0,
        effects: [
          { kind: 'inc-flag', flagName: 'env_sac_burst', amount: 1 },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['party-damage', 'stress-burst'],
      },
      {
        id: 'tactic-spore-p0-stabilize',
        title: '稳定压力',
        description: '全员在母巢前停留,集中缓解压力,放弃本轮输出;适合压力 ≥ 60 或疾病 ≥ 2 的队伍。',
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
        narrativeHint: 'Boss 战开始:母巢之心开始搏动',
      },
    ],
  },
  'phase-spore-1': {
    id: 'phase-spore-1',
    bossId: 'boss-spore-matriarch',
    phaseIndex: 1,
    name: '污染扩散',
    description: '母巢从外层菌床召出感染体,孢子云蔓延速度加倍;若未完成"净化外层菌床"削弱,本阶段会持续刷新感染体,玩家必须在"清感染/攻核心/烧菌床"之间取舍。',
    enterConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 3 },
    ],
    exitConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 6 },
    ],
    bossModifiers: [
      { kind: 'clear-flag', flagName: 'boss_disease_aura' },
    ],
    environmentTargetIds: ['env-spore-mycelium-bed', 'env-spore-spore-sac'],
    summonRules: [
      {
        summonId: 'summon-感染体',
        maxPerPhase: 2,
        modifiers: [
          { kind: 'inc-flag', flagName: 'boss_infection_count', amount: 1 },
        ],
        trigger: { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 4 },
      },
    ],
    tacticalOptionRules: [
      {
        id: 'tactic-spore-p1-attack-core',
        title: '全力攻击核心',
        description: '全员集中攻击母巢本体,放弃本轮处理感染体或菌床;适合菌床已被削弱任务焚毁的情况。',
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
        id: 'tactic-spore-p1-handle-summon',
        title: '清理感染体',
        description: '本轮先集中清理刚召出的感染体,延迟攻击母巢;但让母巢有 1 轮时间继续召唤更多感染体。',
        conditions: [],
        weight: 0.7,
        category: 'handle-summon',
        phaseIndex: 1,
        effects: [
          { kind: 'clear-flag', flagName: 'boss_infection_count' },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['skip-boss-damage'],
      },
      {
        id: 'tactic-spore-p1-destroy-env',
        title: '焚烧外层菌床',
        description: '派前排冒险泼洒火油并点燃菌床;火势反噬前排 -10 HP,但彻底断绝母巢后续召唤。',
        conditions: [
          { kind: 'flag-exists', flagName: 'env_mycelium_intact' },
        ],
        weight: 0.6,
        category: 'destroy-environment',
        phaseIndex: 1,
        effects: [
          { kind: 'inc-flag', flagName: 'env_mycelium_burned', amount: 1 },
          { kind: 'clear-flag', flagName: 'env_mycelium_intact' },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['frontline-risk', 'fire-damage'],
      },
    ],
    phaseEvents: [
      {
        trigger: 'enter',
        effects: [
          { kind: 'set-flag', flagName: 'boss_phase_rounds', flagValue: 0 },
          { kind: 'set-flag', flagName: 'env_mycelium_intact', flagValue: true },
        ],
        narrativeHint: '第二阶段:感染体从菌床涌出,母巢扩散孢子云',
      },
    ],
  },
  'phase-spore-2': {
    id: 'phase-spore-2',
    bossId: 'boss-spore-matriarch',
    phaseIndex: 2,
    name: '母巢暴走',
    description: '母巢之心彻底激活,孢子云爆裂;每轮释放"孢子终爆":对全员施加 15 压力 + 30% 死亡之门。玩家必须在前 2 轮打出足够伤害,否则全员都可能进入死亡之门。',
    enterConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 6 },
    ],
    exitConditions: [],
    bossModifiers: [
      { kind: 'set-flag', flagName: 'boss_spore_burst_active', flagValue: true },
    ],
    environmentTargetIds: [],
    summonRules: [],
    tacticalOptionRules: [
      {
        id: 'tactic-spore-p2-all-in',
        title: '孤注一掷',
        description: '无视一切,全力攻击母巢之心;本轮全员压力 +5,但能在第 2 轮结束前打出决定性伤害。',
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
        id: 'tactic-spore-p2-protect',
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
        id: 'tactic-spore-p2-retreat',
        title: '尝试撤退',
        description: '在母巢暴走下撤退,基础成功率仅 20%(孢子窒息);若携带"抗孢子药剂"且未使用,撤退成功率 +20%。撤退后抗孢子削弱失效,但菌床削弱保留。',
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
        narrativeHint: '第三阶段:母巢之心暴走,孢子终爆开始',
      },
    ],
  },
  // ============================================================
  // 6D 饥渊吞噬者阶段定义(3 个)
  // ============================================================
  'phase-burrows-0': {
    id: 'phase-burrows-0',
    bossId: 'boss-burrows-devourer',
    phaseIndex: 0,
    name: '潜伏捕食',
    description: '吞噬者潜伏在兽穴深处,只在英雄接近时发动"撕裂獠牙"突袭;环境目标储粮坑和尸体堆显现,玩家可在本阶段先观察情报,或选择用火油纵火烧毁储粮(需前排冒险)。',
    enterConditions: [
      { kind: 'flag-exists', flagName: 'boss_encounter_active' },
    ],
    exitConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 3 },
    ],
    bossModifiers: [
      { kind: 'set-flag', flagName: 'boss_ambush_stance', flagValue: true },
    ],
    environmentTargetIds: ['env-burrows-food-pit', 'env-burrows-corpse-pile'],
    summonRules: [],
    tacticalOptionRules: [
      {
        id: 'tactic-burrows-p0-probe',
        title: '试探性攻击',
        description: '前排试探吞噬者,确认"撕裂獠牙"的节奏;适合情报尚不完整、需要数据收集的首次挑战。',
        conditions: [],
        weight: 1.0,
        category: 'attack-core',
        phaseIndex: 0,
        effects: [
          { kind: 'hp-delta', amount: 5, heroSelector: 'front-rank' },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['frontline-risk', 'ambush'],
      },
      {
        id: 'tactic-burrows-p0-env',
        title: '焚毁储粮坑',
        description: '派前排冒险用火油纵火储粮坑,本轮全员受到 5 HP + 8 压力,但储粮削弱生效(阶段 1 精英护卫只召 1 只 + 攻击 -25%)。',
        conditions: [],
        weight: 0.7,
        category: 'destroy-environment',
        phaseIndex: 0,
        effects: [
          { kind: 'inc-flag', flagName: 'env_food_pit_burned', amount: 1 },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['party-damage', 'stress-burst'],
      },
      {
        id: 'tactic-burrows-p0-bandage',
        title: '使用战斗绷带',
        description: '后排在掩体后紧急包扎前排伤口,本轮全员 -3 HP + -5 压力;适合前排血线低于 30% 时。消耗 1 个"战斗绷带"任务物品。',
        conditions: [],
        weight: 0.5,
        category: 'stabilize-stress',
        phaseIndex: 0,
        effects: [
          { kind: 'apply-stress', amount: -5, heroSelector: 'all-alive' },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['consume-item'],
      },
    ],
    phaseEvents: [
      {
        trigger: 'enter',
        effects: [
          { kind: 'set-flag', flagName: 'boss_encounter_active', flagValue: true },
        ],
        narrativeHint: 'Boss 战开始:饥渊吞噬者潜伏于兽穴深处',
      },
    ],
  },
  'phase-burrows-1': {
    id: 'phase-burrows-1',
    bossId: 'boss-burrows-devourer',
    phaseIndex: 1,
    name: '饥饿狂潮',
    description: '吞噬者从储粮坑中召唤精英护卫(默认 2 只,被削弱后只召 1 只),玩家必须先清理护卫才能近身攻击吞噬者本体;精英护卫对前排造成"撕裂獠牙"额外 +5 HP 伤害。',
    enterConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 3 },
    ],
    exitConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 6 },
    ],
    bossModifiers: [
      { kind: 'set-flag', flagName: 'boss_hunger_frenzy', flagValue: true },
    ],
    environmentTargetIds: [],
    summonRules: [
      {
        summonId: 'summon-精英护卫',
        maxPerPhase: 2,
        modifiers: [
          { kind: 'set-flag', flagName: 'boss_guard_count', flagValue: 2 },
        ],
        trigger: { kind: 'flag-exists', flagName: 'boss_summon_phase' },
      },
    ],
    tacticalOptionRules: [
      {
        id: 'tactic-burrows-p1-focus-guard',
        title: '集中击杀护卫',
        description: '全员集火一只精英护卫,2 轮内必杀;若携带"战斗绷带"则可边打边回血,适合压力中等的稳健队。',
        conditions: [],
        weight: 1.0,
        category: 'handle-summon',
        phaseIndex: 1,
        effects: [
          { kind: 'inc-flag', flagName: 'boss_guard_killed', amount: 1 },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['guard-tank', 'skip-boss-damage'],
      },
      {
        id: 'tactic-burrows-p1-purifier',
        title: '使用储粮焚毁圣物',
        description: '本轮一次性封印储粮坑召唤源,本阶段不再自动召唤护卫;消耗 1 个"储粮焚毁圣物"任务物品。',
        conditions: [],
        weight: 0.6,
        category: 'destroy-environment',
        phaseIndex: 1,
        effects: [
          { kind: 'set-flag', flagName: 'boss_food_destroyed', flagValue: true },
          { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        ],
        riskTags: ['consume-item'],
      },
      {
        id: 'tactic-burrows-p1-all-in',
        title: '硬吃护卫直取本体',
        description: '无视护卫,全员直取吞噬者本体;本轮全员压力 +6,护卫会在回合末反击,前排再 -8 HP。',
        conditions: [],
        weight: 0.4,
        category: 'attack-core',
        phaseIndex: 1,
        effects: [
          { kind: 'hp-delta', amount: 8, heroSelector: 'front-rank' },
          { kind: 'apply-stress', amount: 6, heroSelector: 'all-alive' },
        ],
        riskTags: ['frontline-risk', 'all-in'],
      },
    ],
    phaseEvents: [
      {
        trigger: 'enter',
        effects: [
          { kind: 'set-flag', flagName: 'boss_summon_phase', flagValue: true },
        ],
        narrativeHint: '第二阶段:饥饿狂潮,精英护卫被召唤',
      },
    ],
  },
  'phase-burrows-2': {
    id: 'phase-burrows-2',
    bossId: 'boss-burrows-devourer',
    phaseIndex: 2,
    name: '吞噬一切',
    description: '吞噬者进入吞噬姿态,对前排施加持续流血(每轮 4 HP);每轮释放"吞咽"技能:后排 -10 HP + 8 压力。玩家必须在前 2 轮打出足够伤害,否则全员都会陷入持续流血。',
    enterConditions: [
      { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 6 },
    ],
    exitConditions: [],
    bossModifiers: [
      { kind: 'set-flag', flagName: 'boss_devour_active', flagValue: true },
      { kind: 'set-flag', flagName: 'boss_bleed_active', flagValue: 4 },
    ],
    environmentTargetIds: [],
    summonRules: [],
    tacticalOptionRules: [
      {
        id: 'tactic-burrows-p2-all-in',
        title: '孤注一掷',
        description: '无视一切,全力攻击吞噬者本体;本轮全员压力 +6,但能在第 2 轮结束前打出决定性伤害。',
        conditions: [],
        weight: 1.0,
        category: 'attack-core',
        phaseIndex: 2,
        effects: [
          { kind: 'hp-delta', amount: 15, heroSelector: 'all-alive' },
          { kind: 'apply-stress', amount: 6, heroSelector: 'all-alive' },
        ],
        riskTags: ['all-in', 'high-stress'],
      },
      {
        id: 'tactic-burrows-p2-protect',
        title: '保护后排',
        description: '让前排护住后排,本轮后排 -0 HP,前排 -5 HP;适合队伍已经过半濒死、需要稳定下来的情况。',
        conditions: [],
        weight: 0.6,
        category: 'protect-hero',
        phaseIndex: 2,
        effects: [
          { kind: 'hp-delta', amount: -5, heroSelector: 'front-rank' },
        ],
        riskTags: ['frontline-tank', 'skip-boss-damage'],
      },
      {
        id: 'tactic-burrows-p2-retreat',
        title: '尝试撤退',
        description: '在吞噬者暴走下撤退,基础成功率仅 10%(持续流血 + 饥饿压迫);若携带"战斗绷带"且未使用,撤退成功率 +15%。撤退后所有 burrows 削弱失效。',
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
        narrativeHint: '第三阶段:吞噬者开始吞噬一切,持续流血 + 吞咽技能激活',
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
  // ============================================================
  // 6C 孢疫母巢永久奖励
  // ============================================================
  'reward-spore-matriarch': {
    id: 'reward-spore-matriarch',
    bossId: 'boss-spore-matriarch',
    name: '母巢之心',
    description: '击败孢疫母巢后,玩家获得"母巢之眼"饰品,林地区域抗病 +25%、疾病感染率 -20%;并解锁"菌丝共生"任务修正词(后续任务每场抗病 tag +1)。遗产不会被重复领取(SPEC §27)。',
    campaignModifiers: [
      { kind: 'set-flag', flagName: 'woods_disease_resist', flagValue: 0.25 },
      { kind: 'set-flag', flagName: 'woods_infection_reduction', flagValue: 0.20 },
    ],
    unlockedTrinketIds: ['trinket-母巢之眼'],
    unlockedQuestModifierIds: ['modifier-菌丝共生'],
  },
  // ============================================================
  // 6D 饥渊吞噬者永久奖励
  // ============================================================
  'reward-burrows-devourer': {
    id: 'reward-burrows-devourer',
    bossId: 'boss-burrows-devourer',
    name: '饥饿者的记忆',
    description: '击败饥渊吞噬者后,玩家获得"吞噬者之牙"饰品,兽穴区域食物消耗 -25%、前排警戒 +15%;并解锁"饥饿本能"任务修正词(后续任务每场 +2 食物获得)。遗产不会被重复领取(SPEC §27)。',
    campaignModifiers: [
      { kind: 'set-flag', flagName: 'burrows_food_consumption', flagValue: -0.25 },
      { kind: 'set-flag', flagName: 'burrows_scouting_bonus', flagValue: 0.15 },
    ],
    unlockedTrinketIds: ['trinket-吞噬者之牙'],
    unlockedQuestModifierIds: ['modifier-饥饿本能'],
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
  // ============================================================
  // 6C 孢疫母巢特殊任务物品
  // ============================================================
  'item-spore-antidote': {
    id: 'item-spore-antidote',
    bossId: 'boss-spore-matriarch',
    name: '抗孢子药剂',
    description: '由林地药剂师高塔中 7 种抗病草药调制的银瓶药剂,瓶口封蜡刻有"母巢之日";在 Boss 战可使用,本轮 + 后续 2 轮全员完全免疫孢子爆裂 + 感染。建议至少带 2 瓶应对阶段 1 + 阶段 2。',
    inventorySlots: 1,
    availableInFinalEncounter: true,
    tacticalChoiceIds: ['tactic-spore-p2-purify'],
    consumeOnUse: true,
  },
  'item-spore-purifier': {
    id: 'item-spore-purifier',
    bossId: 'boss-spore-matriarch',
    name: '菌床净化圣物',
    description: '从林地深处的隐士处获得的木化石,刻有"净化外层"的符文;在 Boss 战可一次性封锁外层菌床活性(无需前线冒险),或本轮破坏孢子囊;撤退成功后此物仍保留。',
    inventorySlots: 1,
    availableInFinalEncounter: true,
    tacticalChoiceIds: ['tactic-spore-p1-seal'],
    consumeOnUse: true,
  },
  // ============================================================
  // 6D 饥渊吞噬者特殊任务物品
  // ============================================================
  'item-burrows-bandage': {
    id: 'item-burrows-bandage',
    bossId: 'boss-burrows-devourer',
    name: '战斗绷带',
    description: '由地下城医师用兽穴药草浸泡的棉布绷带,染有吞噬者唾液的暗红;在 Boss 战可使用,本轮 -5 压力 + 3 HP;若用于撤退判定则 +15% 成功率。建议至少带 2 绷带应对阶段 1 + 阶段 2。',
    inventorySlots: 1,
    availableInFinalEncounter: true,
    tacticalChoiceIds: ['tactic-burrows-p0-bandage', 'tactic-burrows-p2-retreat'],
    consumeOnUse: true,
  },
  'item-burrows-purifier': {
    id: 'item-burrows-purifier',
    bossId: 'boss-burrows-devourer',
    name: '储粮焚毁圣物',
    description: '从兽穴深处猎人处获得的石罐,内含燃烧缓慢的炼金油;在 Boss 战可一次性封印储粮坑召唤源(无需前线冒险),本阶段不再自动召唤精英护卫;撤退成功后此物仍保留。',
    inventorySlots: 1,
    availableInFinalEncounter: true,
    tacticalChoiceIds: ['tactic-burrows-p1-purifier'],
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
    intelligenceEntryIds: [
      'intel-attack-1', 'intel-attack-2', 'intel-status-1',
      'intel-phase-1', 'intel-phase-2',
      'intel-env-1', 'intel-provision-1', 'intel-retreat-1',
    ],
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
  // ============================================================
  // 6C 孢疫母巢
  // ============================================================
  'boss-spore-matriarch': {
    id: 'boss-spore-matriarch',
    name: '孢疫母巢',
    regionId: 'corrupted-woods',
    description: '生长在腐败林地深处的巨型真菌集合体,直径 30 米,内部有节奏地搏动;它以孢子和菌丝为武器,腐蚀一切进入林地的生物。核心威胁:疾病 + 腐蚀 + 孢子扩散 + 感染召唤;玩家通过情报 + 削弱任务 + 抗病组队,改变 Boss 战的多个关键节点。',
    threatTags: ['disease', 'corruption', 'spore', 'infection'],
    recommendedHeroTags: ['disease-resist', 'plague-doctor', 'anti-corruption'],
    recommendedProvisionIds: ['item-spore-antidote', 'item-spore-purifier'],
    recommendedTrinketTags: ['disease-resist', 'anti-spore'],
    intelligenceEntryIds: [
      'intel-spore-attack-1', 'intel-spore-attack-2', 'intel-spore-status-1',
      'intel-spore-phase-1', 'intel-spore-phase-2',
      'intel-spore-env-1', 'intel-spore-provision-1', 'intel-spore-retreat-1',
    ],
    investigationQuestIds: ['task-spore-investigate-1'],
    weakeningQuestIds: ['task-spore-weaken-1', 'task-spore-weaken-2'],
    finalQuestId: 'task-spore-final-1',
    phaseDefinitionIds: ['phase-spore-0', 'phase-spore-1', 'phase-spore-2'],
    environmentTargetIds: ['env-spore-mycelium-bed', 'env-spore-spore-sac'],
    summonPoolIds: ['summon-感染体'],
    retreatRules: SPORE_BOSS_RETREAT,
    rewardTableId: 'reward-spore-matriarch',
    permanentRewardId: 'reward-spore-matriarch',
  },
  // ============================================================
  // 6D 饥渊吞噬者
  // ============================================================
  'boss-burrows-devourer': {
    id: 'boss-burrows-devourer',
    name: '饥渊吞噬者',
    regionId: 'underground-burrows',
    description: '潜伏在地下兽穴深处的巨型掠食者,体长 6 米,长有 4 排撕裂獠牙;它以兽穴储粮为生,会召唤精英护卫围猎入侵者。核心威胁:撕裂獠牙 + 食物掠夺 + 流血 + 近距离压迫 + 阵型打乱;玩家通过情报 + 削弱任务 + 食物管理,改变 Boss 战的多个关键节点。',
    threatTags: ['bleed', 'food-drain', 'frontline-pressure', 'summon-guard', 'formation-break'],
    recommendedHeroTags: ['frontline-tank', 'anti-bleed', 'high-damage', 'food-efficient'],
    recommendedProvisionIds: ['item-burrows-bandage', 'item-burrows-purifier'],
    recommendedTrinketTags: ['anti-bleed', 'food-efficient', 'frontline-resist'],
    intelligenceEntryIds: [
      'intel-burrows-attack-1', 'intel-burrows-attack-2', 'intel-burrows-status-1',
      'intel-burrows-phase-1', 'intel-burrows-phase-2',
      'intel-burrows-env-1', 'intel-burrows-provision-1', 'intel-burrows-retreat-1',
    ],
    investigationQuestIds: ['task-burrows-investigate-1'],
    weakeningQuestIds: ['task-burrows-weaken-1', 'task-burrows-weaken-2'],
    finalQuestId: 'task-burrows-final-1',
    phaseDefinitionIds: ['phase-burrows-0', 'phase-burrows-1', 'phase-burrows-2'],
    environmentTargetIds: ['env-burrows-food-pit', 'env-burrows-corpse-pile'],
    summonPoolIds: ['summon-精英护卫'],
    retreatRules: BURROWS_BOSS_RETREAT,
    rewardTableId: 'reward-burrows-devourer',
    permanentRewardId: 'reward-burrows-devourer',
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
