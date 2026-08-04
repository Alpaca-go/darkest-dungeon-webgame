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
    name: '黑暗核心',
    description: '家族血脉之源,被祖先唤醒的最终黑暗在核心等待。穿越外层、摧毁核心封印、最终讨伐。无光王座的心脏——那里是先祖之罪的起源与终结。',
    unlockConditionIds: [
      'campaign.finalCampaignGateReady',
      'campaign.defeatedBossIds.length===3',
    ],
    questChainIds: [
      'quest-darkest-core-gate-1', // 开启入口
      'quest-darkest-core-outer-1', // 穿越外层
      'quest-darkest-core-seal-stress-1',
      'quest-darkest-core-seal-disease-1',
      'quest-darkest-core-seal-hunger-1',
      'quest-darkest-core-final-1', // 最终讨伐
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
    name: '开启无光之门',
    description: '将三个区域 Boss 留下的遗物放置于圣物祭坛,使用它们的遗产之力打开无光之门。消耗 6 张肖像 + 6 个纹章 + 一周时间。',
    prerequisiteIds: [],
  },
  'quest-darkest-core-outer-1': {
    id: 'quest-darkest-core-outer-1',
    stage: 'outer-expedition',
    name: '穿越外层',
    description: '12-15 节点的最终区域外层远征。混合三个区域机制(压力/疾病/流血),并加入 4 个最终区域新敌人、2 个精英。必须经过 1 次露营和 1 次撤退判断。',
    prerequisiteIds: ['quest-darkest-core-gate-1'],
  },
  'quest-darkest-core-seal-stress-1': {
    id: 'quest-darkest-core-seal-stress-1',
    stage: 'seal-destruction',
    name: '摧毁压力/诅咒封印',
    description: '祖先诅咒的核心印记。携带抗压圣物进入封印,削弱最终 Boss 阶段 1 的压力光环。完成后获得「诅咒瓦解者」最终任务物品并解锁阶段 1 情报。',
    prerequisiteIds: ['quest-darkest-core-outer-1'],
    destroysSealId: 'seal-darkest-stress-curse',
    grantsFinalQuestItemId: 'item-final-curse-breaker',
    revealsIntelligenceId: 'intel-final-phase-1',
  },
  'quest-darkest-core-seal-disease-1': {
    id: 'quest-darkest-core-seal-disease-1',
    stage: 'seal-destruction',
    name: '摧毁疾病/腐蚀封印',
    description: '腐败之源。携带抗病圣物进入封印,削弱最终 Boss 阶段 2 的疾病光环。完成后获得「净化者之眼」并解锁阶段 2 情报。',
    prerequisiteIds: ['quest-darkest-core-outer-1'],
    destroysSealId: 'seal-darkest-disease-corrupt',
    grantsFinalQuestItemId: 'item-final-purifier-eye',
    revealsIntelligenceId: 'intel-final-phase-2',
  },
  'quest-darkest-core-seal-hunger-1': {
    id: 'quest-darkest-core-seal-hunger-1',
    stage: 'seal-destruction',
    name: '摧毁饥饿/流血封印',
    description: '血肉诅咒。携带战斗绷带/储粮进入封印,削弱最终 Boss 阶段 3 的流血光环。完成后获得「饥饿者的安息」并解锁阶段 3 情报。',
    prerequisiteIds: ['quest-darkest-core-outer-1'],
    destroysSealId: 'seal-darkest-hunger-bleed',
    grantsFinalQuestItemId: 'item-final-hunger-rest',
    revealsIntelligenceId: 'intel-final-phase-3',
  },
  'quest-darkest-core-final-1': {
    id: 'quest-darkest-core-final-1',
    stage: 'final-assault',
    name: '最终讨伐',
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
    name: '先祖诅咒之印',
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
    name: '腐败之源',
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
    name: '血肉诅咒',
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
    name: '诅咒瓦解者',
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
    name: '净化者之眼',
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
    name: '饥饿者的安息',
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
    name: '老兵之誓',
    description: '由 3 个区域 Boss 永久奖励合成的无敌之誓(需要解锁 Phase 6 所有奖励才能获得)。在最终 Boss 阶段 4 可使用,保护一名英雄免受一次致死打击(Death\'s Door 不计入死亡)。消耗后该英雄将不可避免进入 Death\'s Door。',
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
    name: '回顾一路牺牲',
    description: '阅读墓园记录,祭奠在 Phase 1-6 中牺牲的英雄。降低全队压力 10,触发一名死亡英雄的纪念事件(根据死亡数量产生不同结果)。',
    conditions: [],
    effects: [
      { kind: 'apply-stress', amount: -10, heroSelector: 'all-alive', narrativeHint: '回顾一路牺牲' },
    ],
    requiresHeroTarget: false,
  },
  'camp-final-inventory': {
    id: 'camp-final-inventory',
    name: '整理最终任务物品',
    description: '检查所有最终任务物品,提高最终 Boss 阶段 1 稳定性(+10% 撤退成功率基础值,本露营一次性)。',
    conditions: [],
    effects: [
      { kind: 'set-flag', flagName: 'final_camp_inventory_done', flagValue: true, narrativeHint: '整理最终任务物品' },
    ],
    requiresHeroTarget: false,
  },
  'camp-final-provisions': {
    id: 'camp-final-provisions',
    name: '分配最后补给',
    description: '消耗大量食物(火把 +50,食物 +12)。最终 Boss 阶段 4 英雄 HP 上限 +10%。',
    conditions: [],
    effects: [
      { kind: 'set-flag', flagName: 'final_camp_provisions_done', flagValue: true, narrativeHint: '消耗最后补给' },
    ],
    requiresHeroTarget: false,
  },
  'camp-final-oath': {
    id: 'camp-final-oath',
    name: '立下誓言',
    description: '解锁高风险高收益最终选择(阶段 4 提供额外攻击选项)。失败时全队压力 +10。',
    conditions: [],
    effects: [
      { kind: 'set-flag', flagName: 'final_camp_oath_taken', flagValue: true, narrativeHint: '立下誓言' },
    ],
    requiresHeroTarget: false,
  },
  'camp-final-memorial': {
    id: 'camp-final-memorial',
    name: '纪念旧友',
    description: '根据墓园死亡英雄数量产生不同结果。0 死亡:无效果;1-2 死亡:全队压力 -5;3+ 死亡:可能触发「悲痛」负面怪癖,但老兵压力 -8。',
    conditions: [],
    effects: [
      { kind: 'set-flag', flagName: 'final_camp_memorial_done', flagValue: true, narrativeHint: '纪念旧友' },
    ],
    requiresHeroTarget: false,
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
