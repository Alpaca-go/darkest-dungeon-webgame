/**
 * Phase 7A: 最终区域注册表(SPEC §3 §5 §6 §8 §9)
 *
 * 一个最终区域:`darkest-core`(黑暗核心)
 * 4 任务链任务 + 3 核心封印 + 4 最终任务物品 + 1 最终 Boss + 4 露营活动
 *
 * 全部数据驱动(SPEC §42),UI 只能通过 registry 读取。
 */

import type {
  FinalRegionDefinition,
  FinalSealDefinition,
  FinalQuestItemDefinition,
  FinalCampActivity,
  FinalQuestStage,
  FinalRegionRetreatRules,
} from './types.js';

// =====================================================================
// 撤退规则(SPEC §13)
// =====================================================================

const DARKEST_CORE_RETREAT: FinalRegionRetreatRules = {
  baseSuccessRate: 0.40, // 比 3 个区域 Boss 都低(0.55~0.65)
  phaseModifiers: {
    0: 0,
    1: -0.20,
    2: -0.35,
    3: -0.45, // 阶段 4(抉择)几乎无望
  },
  stressPenalty: 15,
  threatIncrease: 25, // 最终区域威胁
};

// =====================================================================
// 最终区域定义(SPEC §3)
// =====================================================================

export const FINAL_REGIONS: Record<string, FinalRegionDefinition> = {
  'darkest-core': {
    id: 'darkest-core',
    name: 'The Darkest Dungeon',
    description: '家族血脉之源,被祖先唤醒的最终黑暗在核心等待。Traverse the Foothills、摧毁核心封印、Final Assault。无光王座的心脏——那里是先祖之罪的起源与终结。',
    unlockConditionIds: [
      'campaign.finalCampaignGateReady',
      'campaign.defeatedBossIds.length===3',
    ],
    questChainIds: [
      'quest-darkest-core-gate-1', // 开启入口
      'quest-darkest-core-outer-1', // Traverse the Foothills
      'quest-darkest-core-seal-stress-1',
      'quest-darkest-core-seal-disease-1',
      'quest-darkest-core-seal-hunger-1',
      'quest-darkest-core-final-1', // Final Assault
    ],
    routeGeneratorId: 'route-darkest-core-generator',
    encounterPoolIds: ['pool-darkest-core-normal-1', 'pool-darkest-core-normal-2'],
    eliteEncounterPoolIds: ['pool-darkest-core-elite-1', 'pool-darkest-core-elite-2'],
    curioPoolIds: ['curio-darkest-memorial', 'curio-darkest-banner', 'curio-darkest-shrine', 'curio-darkest-memory'],
    trapPoolIds: ['trap-darkest-fault', 'trap-darkest-rift', 'trap-darkest-seal'],
    finalBossId: 'boss-darkest-core',
    regionModifiers: [
      { kind: 'set-flag', flagName: 'final_region_active', flagValue: true },
    ],
    retreatRules: DARKEST_CORE_RETREAT,
  },
};

// =====================================================================
// 最终任务链 4 阶段(SPEC §5)
// =====================================================================

export interface FinalQuestChainNode {
  id: string;
  stage: FinalQuestStage;
  name: string;
  description: string;
  /** 关联的最终任务物品 id(可选) */
  grantsFinalQuestItemId?: string;
  /** 关联的封印 id(可选) */
  destroysSealId?: string;
  /** 关联系 Boss id(可选) */
  bossId?: string;
  /** 前置任务 id(必须完成才能解锁) */
  prerequisiteIds: string[];
  /** 任务给予的情报 id(可选) */
  revealsIntelligenceId?: string;
}

export const FINAL_QUEST_CHAIN: Record<string, FinalQuestChainNode> = {
  'quest-darkest-core-gate-1': {
    id: 'quest-darkest-core-gate-1',
    stage: 'gate-opening',
    name: 'Open the Portal',
    description: '将三个区域 Boss 留下的遗物放置于圣物祭坛,使用它们的遗产之力打开无光之门。消耗 6 张肖像 + 6 个纹章 + 一周时间。',
    prerequisiteIds: [],
  },
  'quest-darkest-core-outer-1': {
    id: 'quest-darkest-core-outer-1',
    stage: 'outer-expedition',
    name: 'Traverse the Foothills',
    description: '12-15 节点的最终区域外层远征。混合三个区域机制(压力/疾病/流血),并加入 4 个最终区域新敌人、2 个精英。必须经过 1 次露营和 1 次撤退判断。',
    prerequisiteIds: ['quest-darkest-core-gate-1'],
  },
  'quest-darkest-core-seal-stress-1': {
    id: 'quest-darkest-core-seal-stress-1',
    stage: 'seal-destruction',
    name: 'Destroy the Stress/Curse Seals',
    description: '祖先诅咒的核心印记。携带抗压圣物进入封印,削弱最终 Boss 阶段 1 的压力光环。完成后获得「Cursebreaker」最终任务物品并解锁阶段 1 情报。',
    prerequisiteIds: ['quest-darkest-core-outer-1'],
    destroysSealId: 'seal-darkest-stress-curse',
    grantsFinalQuestItemId: 'item-final-curse-breaker',
    revealsIntelligenceId: 'intel-final-phase-1',
  },
  'quest-darkest-core-seal-disease-1': {
    id: 'quest-darkest-core-seal-disease-1',
    stage: 'seal-destruction',
    name: 'Destroy the Disease/Corruption Seals',
    description: `The Source of Corruption。携带抗病圣物进入封印,削弱最终 Boss 阶段 2 的疾病光环。完成后获得「Purifier's Eye」并解锁阶段 2 情报。`,
    prerequisiteIds: ['quest-darkest-core-outer-1'],
    destroysSealId: 'seal-darkest-disease-corrupt',
    grantsFinalQuestItemId: 'item-final-purifier-eye',
    revealsIntelligenceId: 'intel-final-phase-2',
  },
  'quest-darkest-core-seal-hunger-1': {
    id: 'quest-darkest-core-seal-hunger-1',
    stage: 'seal-destruction',
    name: 'Destroy the Hunger/Bleed Seals',
    description: `Blood Moon Curse。携带战斗绷带/储粮进入封印,削弱最终 Boss 阶段 3 的流血光环。完成后获得「Hunger's Rest」并解锁阶段 3 情报。`,
    prerequisiteIds: ['quest-darkest-core-outer-1'],
    destroysSealId: 'seal-darkest-hunger-bleed',
    grantsFinalQuestItemId: 'item-final-hunger-rest',
    revealsIntelligenceId: 'intel-final-phase-3',
  },
  'quest-darkest-core-final-1': {
    id: 'quest-darkest-core-final-1',
    stage: 'final-assault',
    name: 'Final Assault',
    description: '4 阶段最终 Boss(黑暗本相)战:阶段 1 试探与回忆 / 阶段 2 多区域机制融合 / 阶段 3 英雄个体考验 / 阶段 4 最终抉择。所有最终任务物品必须在最终队伍确认时选择携带,无法在中途补充。',
    prerequisiteIds: [
      'quest-darkest-core-seal-stress-1',
      'quest-darkest-core-seal-disease-1',
      'quest-darkest-core-seal-hunger-1',
    ],
    bossId: 'boss-darkest-core',
  },
};

// =====================================================================
// 核心封印(SPEC §5.3)
// =====================================================================

export const FINAL_SEALS: Record<string, FinalSealDefinition> = {
  'seal-darkest-stress-curse': {
    id: 'seal-darkest-stress-curse',
    theme: 'stress-curse',
    name: `Ancestor's Signet`,
    description: '被祖先降罪的血脉印记,缠绕在最终 Boss 第一阶段。摧毁后削弱 Boss 阶段 1 的压力光环 -50%。',
    weakensFinalPhaseIndexes: [0],
    grantsFinalQuestItemId: 'item-final-curse-breaker',
    revealsIntelligenceId: 'intel-final-phase-1',
    sourceStage: 'seal-destruction',
    sourceQuestId: 'quest-darkest-core-seal-stress-1',
  },
  'seal-darkest-disease-corrupt': {
    id: 'seal-darkest-disease-corrupt',
    theme: 'disease-corrupt',
    name: 'The Source of Corruption',
    description: '三个区域疾病的聚合点,腐蚀一切进入的生物。摧毁后削弱 Boss 阶段 2 疾病光环 -50%。',
    weakensFinalPhaseIndexes: [1],
    grantsFinalQuestItemId: 'item-final-purifier-eye',
    revealsIntelligenceId: 'intel-final-phase-2',
    sourceStage: 'seal-destruction',
    sourceQuestId: 'quest-darkest-core-seal-disease-1',
  },
  'seal-darkest-hunger-bleed': {
    id: 'seal-darkest-hunger-bleed',
    theme: 'hunger-bleed',
    name: 'Blood Moon Curse',
    description: '吞噬一切的饥饿。摧毁后削弱 Boss 阶段 3 流血光环 -50%。',
    weakensFinalPhaseIndexes: [2],
    grantsFinalQuestItemId: 'item-final-hunger-rest',
    revealsIntelligenceId: 'intel-final-phase-3',
    sourceStage: 'seal-destruction',
    sourceQuestId: 'quest-darkest-core-seal-hunger-1',
  },
};

// =====================================================================
// 最终任务物品(SPEC §9)
// =====================================================================

export const FINAL_QUEST_ITEMS: Record<string, FinalQuestItemDefinition> = {
  'item-final-curse-breaker': {
    id: 'item-final-curse-breaker',
    name: 'Cursebreaker',
    description: '由三个区域 Boss 遗物锻造的银质圣物。在最终 Boss 阶段 1 可使用,清除全队所有压力 + 移除诅咒标记。建议必带(压力光环 -50% 后仍可能溢出)。',
    sourceQuestId: 'quest-darkest-core-seal-stress-1',
    inventorySlots: 2,
    usableInPhaseIds: ['phase-final-0', 'phase-final-1'],
    tacticalChoiceIds: ['tactic-final-p1-purify-curse'],
    consumeOnUse: true,
    lossConsequences: [
      { kind: 'apply-stress', amount: 15, heroSelector: 'all-alive', narrativeHint: '诅咒之印未削弱,全队压力 +15' },
    ],
  },
  'item-final-purifier-eye': {
    id: 'item-final-purifier-eye',
    name: `Purifier's Eye`,
    description: '由林地母巢之眼改造的净化圣物。在最终 Boss 阶段 2 可使用,本轮全员免疫疾病感染 + 解除腐蚀。注意:对已经在场的疾病无效(只防新增)。',
    sourceQuestId: 'quest-darkest-core-seal-disease-1',
    inventorySlots: 2,
    usableInPhaseIds: ['phase-final-1', 'phase-final-2'],
    tacticalChoiceIds: ['tactic-final-p2-purify-disease'],
    consumeOnUse: true,
    lossConsequences: [
      { kind: 'apply-stress', amount: 12, heroSelector: 'all-alive', narrativeHint: '腐败光环生效,全队压力 +12' },
    ],
  },
  'item-final-hunger-rest': {
    id: 'item-final-hunger-rest',
    name: `Hunger's Rest`,
    description: '由兽穴吞噬者之牙改造的安息圣物。在最终 Boss 阶段 3 可使用,清除全队流血 + 饥饿;前排 HP 恢复 +20%。阶段 4 撤退成功率 +15%(类似 6D 战斗绷带)。',
    sourceQuestId: 'quest-darkest-core-seal-hunger-1',
    inventorySlots: 2,
    usableInPhaseIds: ['phase-final-2', 'phase-final-3'],
    tacticalChoiceIds: ['tactic-final-p3-relief', 'tactic-final-p4-retreat'],
    consumeOnUse: true,
    lossConsequences: [
      { kind: 'apply-stress', amount: 10, heroSelector: 'all-alive', narrativeHint: '流血光环生效,前排每轮 -3 HP' },
    ],
  },
  'item-final-veteran-oath': {
    id: 'item-final-veteran-oath',
    name: `Veteran's Oath`,
    description: `由 3 个区域 Boss 永久奖励合成的无敌之誓(需要解锁 Phase 6 所有奖励才能获得)。在最终 Boss 阶段 4 可使用,保护一名英雄免受一次致死打击(Death's Door 不计入死亡)。消耗后该英雄将不可避免进入 Death's Door。`,
    sourceQuestId: 'quest-darkest-core-final-1',
    inventorySlots: 3,
    usableInPhaseIds: ['phase-final-3'],
    tacticalChoiceIds: ['tactic-final-p4-sacrifice-protect'],
    consumeOnUse: true,
    lossConsequences: [
      { kind: 'apply-stress', amount: 5, heroSelector: 'all-alive', narrativeHint: '无护盾保护,致命伤害真实生效' },
    ],
  },
};

// =====================================================================
// 最终露营活动(SPEC §10)
// =====================================================================

export const FINAL_CAMP_ACTIVITIES: Record<string, FinalCampActivity> = {
  'camp-final-remember': {
    id: 'camp-final-remember',
    name: 'Remember the Fallen',
    description: '阅读墓园记录,祭奠在 Phase 1-6 中牺牲的英雄。降低全队压力 10,触发一名死亡英雄的纪念事件(根据死亡数量产生不同结果)。',
    conditions: [],
    effects: [
      { kind: 'apply-stress', amount: -10, heroSelector: 'all-alive', narrativeHint: 'Remember the Fallen' },
    ],
    requiresHeroTarget: false,
  },
  'camp-final-inventory': {
    id: 'camp-final-inventory',
    name: 'Sort the Trinkets',
    description: '检查所有最终任务物品,提高最终 Boss 阶段 1 稳定性(+10% 撤退成功率基础值,本露营一次性)。',
    conditions: [],
    effects: [
      { kind: 'set-flag', flagName: 'final_camp_inventory_done', flagValue: true, narrativeHint: 'Sort the Trinkets' },
    ],
    requiresHeroTarget: false,
  },
  'camp-final-provisions': {
    id: 'camp-final-provisions',
    name: 'Distribute Provisions',
    description: '消耗大量食物(火把 +50,食物 +12)。最终 Boss 阶段 4 英雄 HP 上限 +10%。',
    conditions: [],
    effects: [
      { kind: 'set-flag', flagName: 'final_camp_provisions_done', flagValue: true, narrativeHint: '消耗最后补给' },
    ],
    requiresHeroTarget: false,
  },
  'camp-final-oath': {
    id: 'camp-final-oath',
    name: 'Swear the Oath',
    description: '解锁高风险高收益最终选择(阶段 4 提供额外攻击选项)。失败时全队压力 +10。',
    conditions: [],
    effects: [
      { kind: 'set-flag', flagName: 'final_camp_oath_taken', flagValue: true, narrativeHint: 'Swear the Oath' },
    ],
    requiresHeroTarget: false,
  },
  'camp-final-memorial': {
    id: 'camp-final-memorial',
    name: 'Memorize the Lost',
    description: '根据墓园死亡英雄数量产生不同结果。0 死亡:无效果;1-2 死亡:全队压力 -5;3+ 死亡:可能触发「悲痛」负面怪癖,但老兵压力 -8。',
    conditions: [],
    effects: [
      { kind: 'set-flag', flagName: 'final_camp_memorial_done', flagValue: true, narrativeHint: 'Memorize the Lost' },
    ],
    requiresHeroTarget: false,
  },
};

// =====================================================================
// 最终区域敌人(SPEC §8)
// =====================================================================

export interface FinalRegionEnemy {
  id: string;
  name: string;
  tier: 'normal' | 'elite';
  description: string;
  /** 主要威胁标签 */
  threatTags: string[];
  /** 核心机制 */
  mechanics: string;
}

// 4 普通敌人(SPEC §8)
export const FINAL_ENEMIES: Record<string, FinalRegionEnemy> = {
  'enemy-memory-devourer': {
    id: 'enemy-memory-devourer',
    name: 'Memory Eater',
    tier: 'normal',
    description: '吞噬英雄记忆的扭曲存在,使玩家失去英雄历史信息,封锁与英雄经验相关的选择。',
    threatTags: ['memory-loss', 'stress', 'history-block'],
    mechanics: '本场战斗禁用依赖英雄历史/老兵状态的选项(英雄个体考验限制)',
  },
  'enemy-lightless-apostle': {
    id: 'enemy-lightless-apostle',
    name: 'Apostle of the Lightless',
    tier: 'normal',
    description: '祖先的盲目仆从,削弱火把并强化未知风险。',
    threatTags: ['torch-down', 'mystery', 'darkness'],
    mechanics: '火把每轮 -5,未知风险 +20%(陷阱概率翻倍)',
  },
  'enemy-corrupt-warden': {
    id: 'enemy-corrupt-warden',
    name: 'Corrupted Gatekeeper',
    tier: 'normal',
    description: '混合流血、腐蚀与防御的重甲守卫,污染过的铠甲仍会流出黑色脓液。',
    threatTags: ['bleed', 'corrupt', 'defense'],
    mechanics: '对前排造成 8 HP + 3 轮流血,后排 +2 腐蚀',
  },
  'enemy-disorder-shadow': {
    id: 'enemy-disorder-shadow',
    name: 'Shadow of Disorder',
    tier: 'normal',
    description: '打乱站位并干扰主要执行者,折射的空间让英雄无法保持阵型。',
    threatTags: ['position-break', 'formation-disrupt'],
    mechanics: '前排后排位置每轮随机互换 1 次,主要执行者(高伤英雄)被锁定 1 轮',
  },
  // 2 精英敌人(SPEC §8)
  'enemy-abyss-magistrate': {
    id: 'enemy-abyss-magistrate',
    name: 'Abyssal Magistrate',
    tier: 'elite',
    description: '高压力、召唤和环境强化的精英,会以环境亡灵仪式反制玩家。',
    threatTags: ['stress', 'summon', 'environment'],
    mechanics: '对全员 +10 压力;每 2 轮召唤 1 个Shadow of Disorder;强化环境目标 HP 30%',
  },
  'enemy-final-hunter': {
    id: 'enemy-final-hunter',
    name: 'End-Times Hunter',
    tier: 'elite',
    description: '集中攻击 Death\'s Door 英雄,无差别斩杀濒死者,不会放过任何倒下的灵魂。',
    threatTags: ['deaths-door-target', 'execute'],
    mechanics: '优先攻击 HP < 25% 英雄,造成 15 HP + 1 轮流血;若目标已在 Death\'s Door,直接结算 Deathblow(50% 概率)',
  },
};

// =====================================================================
// 最终区域奇物(SPEC §8)
// =====================================================================

export interface FinalRegionCurio {
  id: string;
  name: string;
  description: string;
  /** 可选选项(每个奇物 2-3 个) */
  options: { id: string; title: string; description: string; riskTags: string[] }[];
}

// 4 奇物(SPEC §8)
export const FINAL_CURIOS: Record<string, FinalRegionCurio> = {
  'curio-darkest-memorial': {
    id: 'curio-darkest-memorial',
    name: '英雄纪念碑',
    description: '刻满 Phase 1-6 牺牲英雄名字的石碑。交互可触发回忆事件,获得祝福或承受悲伤。',
    options: [
      {
        id: 'memorial-read',
        title: '阅读名字,缅怀牺牲',
        description: '降低全队压力 5;若墓园英雄 ≥ 3,额外 +1 正面怪癖持续 1 周',
        riskTags: ['stress-down', 'positive-quirk'],
      },
      {
        id: 'memorial-pray',
        title: '在碑前祈祷',
        description: '获得「先祖保佑」buff:下一场战斗全员 +5% 命中率;若墓园英雄 = 0,无效果',
        riskTags: ['combat-buff'],
      },
      {
        id: 'memorial-skip',
        title: '不打扰他们',
        description: '无效果,但保护墓地不被打扰',
        riskTags: ['safe'],
      },
    ],
  },
  'curio-darkest-banner': {
    id: 'curio-darkest-banner',
    name: '破碎战旗',
    description: '三个区域 Boss 战斗留下的破碎战旗残骸。',
    options: [
      {
        id: 'banner-mend',
        title: '缝补战旗',
        description: '消耗绷带 1,获得 +1 抗压(下 3 场战斗压力 -20%)',
        riskTags: ['consume-item', 'stress-resist'],
      },
      {
        id: 'banner-burn',
        title: '焚烧战旗',
        description: '压力 +3,但火光照亮前方路线,清除当前节点所有陷阱',
        riskTags: ['stress-up', 'reveal-traps'],
      },
      {
        id: 'banner-take',
        title: '收下战旗',
        description: '作为Final Assault纪念物,不消耗也不生效',
        riskTags: ['safe'],
      },
    ],
  },
  'curio-darkest-shrine': {
    id: 'curio-darkest-shrine',
    name: '无光圣龛',
    description: '献给先祖之罪的祭坛,无光但散发微弱的祖先祝福。',
    options: [
      {
        id: 'shrine-bless',
        title: '接受祝福',
        description: '下一场战斗 +10% 暴击;但若队伍有折磨怪癖,压力 +5',
        riskTags: ['crit-buff', 'risk-stress'],
      },
      {
        id: 'shrine-destroy',
        title: '摧毁圣龛',
        description: '压力 -3;摧毁后此节点不再触发圣龛(一次性)',
        riskTags: ['stress-down', 'permanent-removal'],
      },
      {
        id: 'shrine-ignore',
        title: '绕过圣龛',
        description: '不打扰先祖',
        riskTags: ['safe'],
      },
    ],
  },
  'curio-darkest-memory': {
    id: 'curio-darkest-memory',
    name: '封存记忆',
    description: '玻璃瓶中保存着一段被封存的英雄记忆,可能是力量也可能是诅咒。',
    options: [
      {
        id: 'memory-open',
        title: '打开封存',
        description: '随机获得 +1 正面怪癖(50%) 或 +1 负面怪癖(50%)',
        riskTags: ['gamble-quirk'],
      },
      {
        id: 'memory-save',
        title: '封存带走',
        description: '可在最终露营时使用,稳定一次英雄个体考验失败',
        riskTags: ['save-for-late'],
      },
      {
        id: 'memory-leave',
        title: '原样放回',
        description: '无效果',
        riskTags: ['safe'],
      },
    ],
  },
};

// =====================================================================
// 最终区域陷阱(SPEC §8)
// =====================================================================

export interface FinalRegionTrap {
  id: string;
  name: string;
  description: string;
  /** 触发伤害 */
  damage: number;
  /** 触发状态 */
  statusEffect: { kind: string; amount: number; target: 'front-rank' | 'all-alive' };
  /** 检测难度 0-100(技能检查阈值) */
  detectDifficulty: number;
  /** 解除难度 */
  disarmDifficulty: number;
}

// 3 陷阱(SPEC §8)
export const FINAL_TRAPS: Record<string, FinalRegionTrap> = {
  'trap-darkest-fault': {
    id: 'trap-darkest-fault',
    name: '记忆断层',
    description: '时空裂隙,英雄会短暂失去方向感并损失 HP。',
    damage: 8,
    statusEffect: { kind: 'apply-stress', amount: 8, target: 'all-alive' },
    detectDifficulty: 60,
    disarmDifficulty: 50,
  },
  'trap-darkest-rift': {
    id: 'trap-darkest-rift',
    name: '无光裂隙',
    description: '完全无光的深渊裂缝,前排直接掉血并压力。',
    damage: 12,
    statusEffect: { kind: 'apply-stress', amount: 6, target: 'all-alive' },
    detectDifficulty: 70,
    disarmDifficulty: 65,
  },
  'trap-darkest-seal': {
    id: 'trap-darkest-seal',
    name: '逆转封印',
    description: '激活后会倒转 1 个已被摧毁的封印效果(本场战斗)。',
    damage: 4,
    statusEffect: { kind: 'revert-seal', amount: 1, target: 'all-alive' },
    detectDifficulty: 80,
    disarmDifficulty: 75,
  },
};

// =====================================================================
// 最终区域路线(SPEC §7)
// =====================================================================

export interface FinalRegionRouteNode {
  id: string;
  index: number;
  type: 'start' | 'encounter' | 'elite' | 'curio' | 'camp' | 'fork' | 'objective' | 'trap';
  name: string;
  description: string;
  /** 分叉选项 */
  forkOptions?: { id: string; label: string; nextNodeId: string; riskTags: string[] }[];
  /** 关联内容 id(敌人/奇物/陷阱/Boss) */
  contentIds?: string[];
}

export interface FinalRegionRoute {
  id: string;
  regionId: string;
  /** 总节点数(16-20) */
  totalNodes: number;
  /** 关键节点配置 */
  nodes: FinalRegionRouteNode[];
  /** 露营节点索引(至少 1) */
  campNodeIndices: number[];
  /** 重大背包取舍节点 */
  tradeoffNodeIndices: number[];
  /** 不可逆选择节点 */
  irreversibleNodeIndices: number[];
  /** 撤退判断节点 */
  retreatDecisionNodeIndices: number[];
  /** 最终 Boss 准备节点 */
  bossPrepNodeIndex: number;
}

// Final Assault路线(16-20 节点,SPEC §7)
export const FINAL_ROUTE: FinalRegionRoute = {
  id: 'route-darkest-core-final',
  regionId: 'darkest-core',
  totalNodes: 20,
  nodes: [
    { id: 'fn-0', index: 0, type: 'start', name: '无光之门入口', description: '通往黑暗核心的入口,先祖的阴影在前方等待。' },
    { id: 'fn-1', index: 1, type: 'encounter', name: 'Shadow of Disorder伏击', description: '第一波敌人,Shadow of Disorder的先头部队。', contentIds: ['enemy-disorder-shadow'] },
    { id: 'fn-2', index: 2, type: 'curio', name: '英雄纪念碑', description: '碑上刻有第一个牺牲英雄的名字。', contentIds: ['curio-darkest-memorial'] },
    { id: 'fn-3', index: 3, type: 'fork', name: '三岔路', description: '通向三个区域机制的路径分流。',
      forkOptions: [
        { id: 'fork-stress', label: '压力之路(诅咒封印方向)', nextNodeId: 'fn-4-stress', riskTags: ['stress-heavy'] },
        { id: 'fork-disease', label: '腐蚀之路(疾病封印方向)', nextNodeId: 'fn-4-disease', riskTags: ['disease-risk'] },
        { id: 'fork-hunger', label: '饥饿之路(流血封印方向)', nextNodeId: 'fn-4-hunger', riskTags: ['hunger-bleed'] },
      ] },
    { id: 'fn-4-stress', index: 4, type: 'elite', name: 'Apostle of the Lightless首领', description: '精英敌人,削弱火把并强化未知。', contentIds: ['enemy-lightless-apostle'] },
    { id: 'fn-4-disease', index: 4, type: 'elite', name: 'Corrupted Gatekeeper', description: '精英敌人,混合流血与腐蚀。', contentIds: ['enemy-corrupt-warden'] },
    { id: 'fn-4-hunger', index: 4, type: 'elite', name: 'Memory Eater', description: '精英敌人,封锁英雄历史选项。', contentIds: ['enemy-memory-devourer'] },
    { id: 'fn-5', index: 5, type: 'encounter', name: 'Abyssal Magistrate', description: '第一次遇见精英执政官,会召Shadow of Disorder。', contentIds: ['enemy-abyss-magistrate'] },
    { id: 'fn-6', index: 6, type: 'curio', name: '破碎战旗', description: 'Boss 战留下的战旗。', contentIds: ['curio-darkest-banner'] },
    { id: 'fn-7', index: 7, type: 'trap', name: '无光裂隙', description: '高伤害陷阱,需要技能检查解除。', contentIds: ['trap-darkest-rift'] },
    { id: 'fn-8', index: 8, type: 'camp', name: '最终露营前哨', description: '外层穿越的中途露营,SPEC §10 5 个活动全部可用。' },
    { id: 'fn-9', index: 9, type: 'encounter', name: 'Apostle of the Lightless群', description: '群体敌人,火把 -50%。', contentIds: ['enemy-lightless-apostle'] },
    { id: 'fn-10', index: 10, type: 'curio', name: '无光圣龛', description: '祖先祭坛。', contentIds: ['curio-darkest-shrine'] },
    { id: 'fn-11', index: 11, type: 'encounter', name: 'End-Times Hunter', description: `精英猎手,专攻 Death's Door 英雄。`, contentIds: ['enemy-final-hunter'] },
    { id: 'fn-12', index: 12, type: 'trap', name: '记忆断层', description: '中等伤害,压力 +8。', contentIds: ['trap-darkest-fault'] },
    { id: 'fn-13', index: 13, type: 'curio', name: '封存记忆', description: '玻璃瓶记忆。', contentIds: ['curio-darkest-memory'] },
    { id: 'fn-14', index: 14, type: 'fork', name: '撤退判断', description: '最后一次撤退窗口(若继续则不可逆)。' },
    { id: 'fn-15', index: 15, type: 'trap', name: '逆转封印', description: '高难度陷阱,可能倒转 1 封印。', contentIds: ['trap-darkest-seal'] },
    { id: 'fn-16', index: 16, type: 'encounter', name: 'Abyssal Magistrate x2', description: '最后精英,两个执政官。', contentIds: ['enemy-abyss-magistrate'] },
    { id: 'fn-17', index: 17, type: 'objective', name: 'Boss 准备节点', description: 'Final Assault前准备:队伍确认 + 补给确认 + 风险提示。' },
    // 最终 Boss 在 fn-17 之后,作为 route 的最后一个节点
  ],
  campNodeIndices: [8],
  tradeoffNodeIndices: [6, 10, 13], // 3 次重大背包取舍
  irreversibleNodeIndices: [3, 14, 19], // 3 个不可逆选择
  retreatDecisionNodeIndices: [14], // 最后撤退窗口
  bossPrepNodeIndex: 19,
};

// =====================================================================
// 英雄个体考验(SPEC §12)
// =====================================================================

import type { HeroTrialDefinition } from './types.js';

export const HERO_TRIALS: Record<string, HeroTrialDefinition> = {
  'trial-veteran-sacrifice': {
    id: 'trial-veteran-sacrifice',
    name: '老兵的牺牲',
    description: '让老兵(墓园 ≥ 2 死亡 / 经历 ≥ 3 Boss 战)承担核心任务,承受本场全部压力。',
    eligibleHeroConditions: [
      { kind: 'flag-gte', flagName: 'hero_veteran_count', value: 1 },
    ],
    generatedChoiceRules: [
      {
        id: 'trial-veteran-accept',
        title: '接受核心任务',
        description: '老兵承担核心位置,本场 +20 压力但全队其他人 -50% 压力',
        successEffects: [
          { kind: 'apply-stress', amount: 20, heroSelector: 'specific' },
          { kind: 'apply-stress', amount: -10, heroSelector: 'all-alive' },
        ],
        failureEffects: [
          { kind: 'apply-stress', amount: 35, heroSelector: 'specific' },
        ],
        riskTags: ['high-stress', 'protect-others'],
      },
    ],
    successEffects: [
      { kind: 'apply-stress', amount: 20, heroSelector: 'specific' },
    ],
    failureEffects: [
      { kind: 'apply-stress', amount: 35, heroSelector: 'specific' },
    ],
  },
  'trial-newcomer-guard': {
    id: 'trial-newcomer-guard',
    name: '新人守护',
    description: '老兵保护新人,本场新人不会受到单次 > 15 HP 的伤害。',
    eligibleHeroConditions: [
      { kind: 'flag-gte', flagName: 'hero_party_count', value: 2 },
    ],
    generatedChoiceRules: [
      {
        id: 'trial-newcomer-guard-accept',
        title: '老兵承担保护',
        description: '老兵分担新人伤害;老兵 -10% 最大 HP,新人安全',
        successEffects: [
          { kind: 'set-flag', flagName: 'hero_guard_active', flagValue: 1 },
        ],
        failureEffects: [
          { kind: 'apply-stress', amount: 10, heroSelector: 'all-alive' },
        ],
        riskTags: ['protect-newcomer'],
      },
    ],
    successEffects: [
      { kind: 'set-flag', flagName: 'hero_guard_active', flagValue: 1 },
    ],
    failureEffects: [
      { kind: 'apply-stress', amount: 10, heroSelector: 'all-alive' },
    ],
  },
  'trial-trinket-sacrifice': {
    id: 'trial-trinket-sacrifice',
    name: '饰品献祭',
    description: '消耗 1 个已装备饰品,换取本阶段全队 +20% 命中率。',
    eligibleHeroConditions: [
      { kind: 'flag-gte', flagName: 'hero_equipped_trinket_count', value: 1 },
    ],
    generatedChoiceRules: [
      {
        id: 'trial-trinket-sacrifice-accept',
        title: '献祭饰品',
        description: '失去 1 饰品,但本阶段全队 +20% 命中',
        successEffects: [
          { kind: 'set-flag', flagName: 'phase_accuracy_bonus', flagValue: 20 },
        ],
        failureEffects: [
          { kind: 'set-flag', flagName: 'phase_accuracy_penalty', flagValue: 10 },
        ],
        riskTags: ['lose-trinket', 'accuracy-buff'],
      },
    ],
    successEffects: [
      { kind: 'set-flag', flagName: 'phase_accuracy_bonus', flagValue: 20 },
    ],
    failureEffects: [
      { kind: 'set-flag', flagName: 'phase_accuracy_penalty', flagValue: 10 },
    ],
  },
  'trial-quirk-sacrifice': {
    id: 'trial-quirk-sacrifice',
    name: '怪癖献祭',
    description: '让有负面怪癖的英雄承担关键任务,失败时负面怪癖消失但压力 +20。',
    eligibleHeroConditions: [
      { kind: 'flag-gte', flagName: 'hero_negative_quirk_count', value: 1 },
    ],
    generatedChoiceRules: [
      {
        id: 'trial-quirk-accept',
        title: '怪癖英雄承担',
        description: '成功:负面怪癖移除 + 获得 1 正面怪癖;失败:压力 +20',
        successEffects: [
          { kind: 'set-flag', flagName: 'quirk_cleansed', flagValue: 1 },
        ],
        failureEffects: [
          { kind: 'apply-stress', amount: 20, heroSelector: 'specific' },
        ],
        riskTags: ['quirk-sacrifice', 'high-pressure'],
      },
    ],
    successEffects: [
      { kind: 'set-flag', flagName: 'quirk_cleansed', flagValue: 1 },
    ],
    failureEffects: [
      { kind: 'apply-stress', amount: 20, heroSelector: 'specific' },
    ],
  },
};

// =====================================================================
// 初始化 helpers(SPEC §28)
// =====================================================================

/**
 * 创建空 FinalCampaignState(locked)
 */
import { createEmptyFinalCampaignState } from './types.js';

export { createEmptyFinalCampaignState };

/**
 * 初始化最终战役状态(挂到 CampaignState)
 */
export function initializeFinalCampaign(): import('./types.js').FinalCampaignState {
  return createEmptyFinalCampaignState();
}
