/**
 * Phase 7A: 最终区域与最终战役类型(SPEC §3-§15)
 *
 * 最终区域 ≠ 第四个普通区域:
 *  - 只在三个区域 Boss 击败后解锁(§1.1)
 *  - 独立任务链(4 步:开启入口 / 外层 / 封印 / 最终讨伐)
 *  - 混合前三个区域机制
 *  - 直接推进结局
 *
 * 数据驱动,所有内容来自 registry,不允许 UI 中硬编码。
 */

import type { RuleCondition, RuleEffect } from '../expedition/types.js';
import type { BossId } from '../boss/types.js';

// =====================================================================
// 最终任务链阶段(SPEC §5)
// =====================================================================

/**
 * 最终任务链四步结构(SPEC §5)
 *  - gate-opening    开启入口
 *  - outer-expedition 穿越外层
 *  - seal-destruction 核心封印
 *  - final-assault    最终讨伐
 */
export type FinalQuestStage =
  | 'gate-opening'
  | 'outer-expedition'
  | 'seal-destruction'
  | 'final-assault';

// =====================================================================
// 最终战役状态(SPEC §4)
// =====================================================================

/**
 * 最终战役状态(SPEC §4)
 * 挂在 CampaignState.finalCampaignState。
 */
export type FinalCampaignStatus =
  | 'locked' // 三 Boss 未击败
  | 'gate-ready' // 三 Boss 击败,可开入口
  | 'gate-open' // 入口已开,准备外层
  | 'outer-complete' // 外层完成
  | 'seals-active' // 进入封印阶段
  | 'final-assault-ready' // 全部封印摧毁,准备最终讨伐
  | 'final-assault-active' // 最终讨伐进行中
  | 'victory' // 胜利结局
  | 'failed'; // 失败但可继续

/**
 * 最终战役跨周持久化状态
 */
export interface FinalCampaignState {
  status: FinalCampaignStatus;

  /** 已完成阶段 id 列表(只增不改) */
  completedQuestStageIds: FinalQuestStage[];
  /** 已摧毁的封印 id 列表(去重保证,SPEC §19) */
  destroyedSealIds: string[];
  /** 已收集的最终任务物品 id 列表(去重保证) */
  collectedFinalQuestItemIds: string[];

  /** 最终区域威胁 0-100(SPEC §6 一致语义) */
  finalRegionThreat: number;
  /** 最终 Boss 挑战次数 */
  finalBossAttemptCount: number;
  /** 最终 Boss 是否击败(SPEC §19:不得重复) */
  finalBossDefeated: boolean;

  /** 入口开启周 */
  gateOpenedAtWeek: number | null;
  /** 外层完成周 */
  outerCompletedAtWeek: number | null;
  /** 最终讨伐启动周 */
  finalAssaultStartedAtWeek: number | null;
}

// =====================================================================
// 最终区域定义(SPEC §3)
// =====================================================================

/**
 * 最终区域撤退规则(SPEC §13 + §15.1 类似 Boss)
 */
export interface FinalRegionRetreatRules {
  /** 基础撤退成功率 0-1 */
  baseSuccessRate: number;
  /** 阶段修正:phaseIndex → 成功率增减 */
  phaseModifiers: Record<number, number>;
  /** 撤退后压力惩罚 */
  stressPenalty: number;
  /** 撤退后最终区域威胁增量 */
  threatIncrease: number;
}

/**
 * 最终区域定义(SPEC §3)
 * 数据驱动,原创名称:黑暗核心 / 深渊圣所 / 终末回廊 / 失落之门 / 无光王座
 */
export interface FinalRegionDefinition {
  id: string;
  name: string;
  description: string;

  /** 解锁条件 id(实际校验由 dispatcher 读取 campaign.campaignThreat) */
  unlockConditionIds: string[];
  /** 任务链 id 列表(指向 FINAL_QUEST_CHAIN) */
  questChainIds: string[];
  /** 路线生成器 id */
  routeGeneratorId: string;
  /** 遭遇池 / 精英池 / 奇物池 / 陷阱池 id */
  encounterPoolIds: string[];
  eliteEncounterPoolIds: string[];
  curioPoolIds: string[];
  trapPoolIds: string[];

  /** 最终 Boss id(指向 BOSS_DEFINITIONS) */
  finalBossId: BossId;
  /** 区域 modifier */
  regionModifiers: RuleEffect[];
  /** 撤退规则 */
  retreatRules: FinalRegionRetreatRules;
}

// =====================================================================
// 最终任务物品(SPEC §9)
// =====================================================================

/**
 * 最终任务物品(SPEC §9)
 * 可用于:
 *  - 关闭一次阶段机制
 *  - 保护英雄免受一次致死打击
 *  - 清除环境目标
 *  - 解锁安全推进
 *  - 降低全队压力
 *  - 改变最终结局条件
 */
export interface FinalQuestItemDefinition {
  id: string;
  name: string;
  description: string;
  /** 来源任务 id(哪条任务链任务给予) */
  sourceQuestId: string;

  /** 占用背包槽数 */
  inventorySlots: number;
  /** 哪些阶段可用 */
  usableInPhaseIds: string[];
  /** 解锁的战术选项 id */
  tacticalChoiceIds: string[];
  /** 使用后是否消耗 */
  consumeOnUse: boolean;
  /** 物品损失时的后果(SPEC §19:不可逆) */
  lossConsequences: RuleEffect[];
}

// =====================================================================
// 核心封印(SPEC §5.3)
// =====================================================================

/**
 * 核心封印(SPEC §5.3)
 * 建议 3 个:
 *  - 压力/诅咒封印
 *  - 疾病/腐蚀封印
 *  - 饥饿/流血封印
 */
export type FinalSealTheme = 'stress-curse' | 'disease-corrupt' | 'hunger-bleed';

export interface FinalSealDefinition {
  id: string;
  theme: FinalSealTheme;
  name: string;
  description: string;
  /** 摧毁此封印后给最终 Boss 哪个 phase 的 modifier */
  weakensFinalPhaseIndexes: number[];
  /** 摧毁后获得的最终任务物品 id */
  grantsFinalQuestItemId: string;
  /** 摧毁后解锁的情报 id */
  revealsIntelligenceId: string;
  /** 任务链阶段 */
  sourceStage: FinalQuestStage;
  /** 任务 id(指向 registry) */
  sourceQuestId: string;
}

// =====================================================================
// 英雄个体考验(SPEC §12)
// =====================================================================

/**
 * 英雄个体考验(SPEC §12)
 * 第三阶段触发,读取英雄怪癖/疾病/饰品/历史,生成个体化选择。
 */
export interface HeroTrialDefinition {
  id: string;
  name: string;
  description: string;
  /** 适用英雄条件(全部满足才生成) */
  eligibleHeroConditions: RuleCondition[];
  /** 生成的战术选项 */
  generatedChoiceRules: {
    id: string;
    title: string;
    description: string;
    successEffects: RuleEffect[];
    failureEffects: RuleEffect[];
    riskTags: string[];
  }[];
  /** 成功效果(用作 default) */
  successEffects: RuleEffect[];
  /** 失败效果 */
  failureEffects: RuleEffect[];
}

// =====================================================================
// 最终露营活动(SPEC §10)
// =====================================================================

export interface FinalCampActivity {
  id: string;
  name: string;
  description: string;
  /** 可触发条件 */
  conditions: RuleCondition[];
  /** 应用效果 */
  effects: RuleEffect[];
  /** 是否需要指定英雄(阅读墓园等) */
  requiresHeroTarget: boolean;
}

// =====================================================================
// 最终结局(SPEC §14)
// =====================================================================

/**
 * 最终结局类型(SPEC §14)
 *  - victory           胜利
 *  - pyrrhic-victory   惨胜
 *  - failed-assault    失败但继续
 *  - campaign-collapse 战役崩溃(无可用英雄)
 */
export type CampaignEndingType =
  | 'victory'
  | 'pyrrhic-victory'
  | 'failed-assault'
  | 'campaign-collapse';

/**
 * 最终结局(SPEC §14)
 * 一次性提交,不可重复(SPEC §19)
 */
export interface CampaignEnding {
  id: string;
  type: CampaignEndingType;
  /** 解锁周 */
  unlockedAtWeek: number;
  /** 存活英雄 id */
  survivingHeroIds: string[];
  /** 死亡英雄 id */
  deadHeroIds: string[];
  /** 战役总结快照 */
  summaryData: CampaignSummaryData;
}

// =====================================================================
// 完整战役总结(SPEC §15)
// =====================================================================

/**
 * 完整战役总结(SPEC §15)
 * 必须基于 Domain Event(SPEC §18 规则管线),Debug 事件不进入正式统计。
 */
export interface CampaignSummaryData {
  totalWeeks: number;
  totalExpeditions: number;
  successfulQuests: number;
  failedQuests: number;
  retreats: number;
  totalHeroesRecruited: number;
  totalHeroDeaths: number;
  graveyardHeroIds: string[];
  totalDeathsDoorEntries: number;
  totalDeathblowResists: number;
  defeatedBossIds: BossId[];
  finalBossDefeated: boolean;
  mostUsedHeroId?: string;
  mostUsedPartyHeroIds: string[];
  mostImpactfulQuirkId?: string;
  mostImpactfulTrinketId?: string;
  mostDangerousDiseaseId?: string;
  keyTurningPointEventIds: string[];
  finalEndingType: CampaignEndingType;
  /** 最终区域名 */
  finalRegionName: string;
  /** 摧毁的封印数 */
  destroyedSealCount: number;
}

// =====================================================================
// 工厂函数
// =====================================================================

/**
 * 创建空 FinalCampaignState(locked)
 */
export function createEmptyFinalCampaignState(): FinalCampaignState {
  return {
    status: 'locked',
    completedQuestStageIds: [],
    destroyedSealIds: [],
    collectedFinalQuestItemIds: [],
    finalRegionThreat: 0,
    finalBossAttemptCount: 0,
    finalBossDefeated: false,
    gateOpenedAtWeek: null,
    outerCompletedAtWeek: null,
    finalAssaultStartedAtWeek: null,
  };
}

// =====================================================================
// 类型守卫
// =====================================================================

/**
 * 是否可以解锁最终战役(SPEC §4 条件:3 Boss 全部击败 + finalCampaignGateReady)
 */
export function canUnlockFinalCampaign(args: {
  defeatedBossIds: string[];
  finalCampaignGateReady: boolean;
}): boolean {
  return (
    args.defeatedBossIds.length >= 3 && args.finalCampaignGateReady
  );
}

/**
 * 从 FinalCampaignState 派生 status(SPEC §4 推进)
 */
export function nextFinalCampaignStatus(
  current: FinalCampaignStatus,
  event: 'open-gate' | 'complete-outer' | 'destroy-seal' | 'start-assault' | 'win' | 'fail',
): FinalCampaignStatus {
  switch (event) {
    case 'open-gate':
      return current === 'gate-ready' ? 'gate-open' : current;
    case 'complete-outer':
      return current === 'gate-open' ? 'outer-complete' : current;
    case 'destroy-seal':
      // 任何在 outer-complete 之后可进入 seals-active
      return current === 'outer-complete' || current === 'seals-active'
        ? 'seals-active'
        : current;
    case 'start-assault':
      return current === 'seals-active' ? 'final-assault-active' : current;
    case 'win':
      return current === 'final-assault-active' ? 'victory' : current;
    case 'fail':
      // 失败后保持 failed 但不删除数据
      return 'failed';
    default:
      return current;
  }
}
