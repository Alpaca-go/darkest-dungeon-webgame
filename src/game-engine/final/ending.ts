/**
 * Phase 7C: 结局系统 + 战役总结(SPEC §14-§15)
 *
 * 结局:
 *  - victory           胜利(最终 Boss 击败 + 存活英雄相对稳定)
 *  - pyrrhic-victory   惨胜(最终 Boss 击败 + 多名英雄永久死亡 / 高代价选择)
 *  - failed-assault    失败但继续(最终讨伐失败或撤退,战役可用英雄)
 *  - campaign-collapse 战役崩溃(无可用英雄 + 不可恢复,MVP 不轻易出现)
 *
 * 战役总结(SPEC §15):从 Domain Event 计算 16+ 字段
 *  - 必须在 victory / failed / pyrrhic 时生成
 *  - Debug 事件不进入正式统计(SPEC §1.4)
 */

import type {
  CampaignEnding,
  CampaignEndingType,
  CampaignSummaryData,
  FinalCampaignState,
} from './types.js';
import { FINAL_BOSS_ID } from './boss.js';

// =====================================================================
// 结局计算(SPEC §14)
// =====================================================================

export interface EndingCalcContext {
  finalCampaignState: FinalCampaignState;
  finalBossDefeated: boolean;
  /** 死亡英雄数量(本场最终讨伐中) */
  heroDeathCount: number;
  /** 累计死亡英雄数量(全程) */
  totalHeroDeathCount: number;
  /** 存活英雄数量 */
  survivingHeroCount: number;
  /** 是否有可用英雄(用于 campaign-collapse) */
  hasRecruitableHeroes: boolean;
  /** 累计资源是否足够恢复(用于 campaign-collapse) */
  hasRecoveryResources: boolean;
  /** 威胁是否可恢复(用于 campaign-collapse) */
  threatRecoverable: boolean;
}

/**
 * 从上下文计算结局类型
 */
export function calculateEndingType(ctx: EndingCalcContext): CampaignEndingType {
  if (!ctx.finalBossDefeated) {
    // Boss 未击败
    if (
      ctx.survivingHeroCount === 0 &&
      !ctx.hasRecruitableHeroes &&
      !ctx.hasRecoveryResources
    ) {
      return 'campaign-collapse';
    }
    return 'failed-assault';
  }
  // Boss 击败
  // 惨胜:多英雄死亡 或 高代价(本场死亡 ≥ 2)
  if (ctx.heroDeathCount >= 2) {
    return 'pyrrhic-victory';
  }
  return 'victory';
}

/**
 * 生成完整 CampaignEnding(SPEC §14)
 * 一次提交,不可重复(SPEC §19)
 */
export function generateCampaignEnding(
  ctx: EndingCalcContext,
  args: { week: number; survivingHeroIds: string[]; deadHeroIds: string[]; summaryData: CampaignSummaryData },
): CampaignEnding {
  const type = calculateEndingType(ctx);
  return {
    id: `ending-${args.week}-${Date.now()}`,
    type,
    unlockedAtWeek: args.week,
    survivingHeroIds: args.survivingHeroIds,
    deadHeroIds: args.deadHeroIds,
    summaryData: args.summaryData,
  };
}

// =====================================================================
// 战役总结(SPEC §15)
// =====================================================================

/**
 * Domain Event 类型(从 game-engine/expedition/domain-events.ts 抽出最小子集)
 * 用于事件计数,不依赖具体类型,避免循环 import。
 */
export interface CampaignDomainEvent {
  type: string;
  data?: Record<string, any>;
  week?: number;
  debug?: boolean;
}

/**
 * 战役总结输入(SPEC §15)
 * 必须从 GameState 中提取,不接受外部手工值
 */
export interface CampaignSummaryInput {
  events: CampaignDomainEvent[];
  finalState: FinalCampaignState;
  finalRegionName: string;
  week: number;
  graveyardHeroIds: string[];
  /** 已用过的英雄(从 party 中提取的 heroIds) */
  usedHeroIds: string[];
  /** 最常用英雄 id(已用次数最多) */
  mostUsedHeroId?: string;
  /** 最常用队伍英雄 id 列表 */
  mostUsedPartyHeroIds: string[];
  /** 最具影响力怪癖 id(从 events 推导) */
  mostImpactfulQuirkId?: string;
  /** 最具影响力饰品 id */
  mostImpactfulTrinketId?: string;
  /** 最危险疾病 id */
  mostDangerousDiseaseId?: string;
  /** 关键转折点事件 id 列表 */
  keyTurningPointEventIds: string[];
  /** 终结类型 */
  finalEndingType: CampaignEndingType;
}

/**
 * 计算战役总结(SPEC §15)
 * Debug 事件不进入正式统计(SPEC §1.4)
 */
export function calculateCampaignSummary(input: CampaignSummaryInput): CampaignSummaryData {
  // 过滤掉 debug 事件
  const realEvents = input.events.filter((e) => !e.debug);

  // 总周数
  const totalWeeks = input.week;

  // 远征次数
  const totalExpeditions = realEvents.filter((e) =>
    e.type === 'EXPEDITION_STARTED' || e.type === 'EXPEDITION_ENDED',
  ).length;

  // 成功任务
  const successfulQuests = realEvents.filter((e) => e.type === 'QUEST_SUCCESS').length;

  // 失败任务
  const failedQuests = realEvents.filter((e) => e.type === 'QUEST_FAILURE').length;

  // 撤退
  const retreats = realEvents.filter((e) =>
    e.type === 'EXPEDITION_RETREATED' || e.type === 'BOSS_RETREAT_SUCCEEDED',
  ).length;

  // 死亡英雄
  const totalHeroDeaths = input.graveyardHeroIds.length;

  // 招募
  const totalHeroesRecruited = realEvents.filter((e) => e.type === 'HERO_RECRUITED').length;

  // Death's Door / Deathblow
  const totalDeathsDoorEntries = realEvents.filter((e) => e.type === 'HERO_ENTERED_DEATHS_DOOR').length;
  const totalDeathblowResists = realEvents.filter((e) => e.type === 'HERO_DEATHBLOW_RESISTED').length;

  // 击败 Boss
  const defeatedBossIds = realEvents
    .filter((e) => e.type === 'BOSS_DEFEATED')
    .map((e) => e.data?.bossId)
    .filter((id): id is string => typeof id === 'string' && id !== FINAL_BOSS_ID);

  // 最终 Boss 是否击败
  const finalBossDefeated = input.finalState.finalBossDefeated;

  // 摧毁封印数
  const destroyedSealCount = input.finalState.destroyedSealIds.length;

  return {
    totalWeeks,
    totalExpeditions,
    successfulQuests,
    failedQuests,
    retreats,
    totalHeroesRecruited,
    totalHeroDeaths,
    graveyardHeroIds: input.graveyardHeroIds,
    totalDeathsDoorEntries,
    totalDeathblowResists,
    defeatedBossIds,
    finalBossDefeated,
    mostUsedHeroId: input.mostUsedHeroId,
    mostUsedPartyHeroIds: input.mostUsedPartyHeroIds,
    mostImpactfulQuirkId: input.mostImpactfulQuirkId,
    mostImpactfulTrinketId: input.mostImpactfulTrinketId,
    mostDangerousDiseaseId: input.mostDangerousDiseaseId,
    keyTurningPointEventIds: input.keyTurningPointEventIds,
    finalEndingType: input.finalEndingType,
    finalRegionName: input.finalRegionName,
    destroyedSealCount,
  };
}

// =====================================================================
// 关键转折点提取(SPEC §15 "战役回顾要从 Domain Event 中提取关键转折")
// =====================================================================

const TURNING_POINT_EVENT_TYPES = [
  'FIRST_BOSS_REVEALED',
  'BOSS_DEFEATED',
  'CAMPAIGN_THREAT_ADVANCED',
  'HERO_PERMANENT_DEATH',
  'HERO_RECRUITED',
  'FINAL_CAMPAIGN_GATE_MARKED_READY',
  'FinalCampaignGateOpened',
  'FinalOuterQuestStarted',
  'FinalOuterQuestCompleted',
  'FinalSealDestroyed',
  'FinalAssaultUnlocked',
  'FinalAssaultStarted',
  'FinalBossDefeated',
  'CampaignCompleted',
  'BOSS_RETREAT_SUCCEEDED',
  'BOSS_RETREAT_FAILED',
];

/**
 * 从 events 中提取关键转折点(过滤 debug 事件)
 */
export function extractTurningPointEventIds(events: CampaignDomainEvent[]): string[] {
  return events
    .filter((e) => !e.debug)
    .filter((e) => TURNING_POINT_EVENT_TYPES.includes(e.type))
    .map((e, idx) => `${e.type}#${idx}`);
}

// =====================================================================
// 英雄个体考验生成(SPEC §12 阶段 3)
// =====================================================================

import type { HeroTrialDefinition } from './types.js';

/**
 * 选择适用英雄的 trial id(从 HERO_TRIALS 池中筛出 eligible 的)
 * SPEC §12:第三阶段触发,根据英雄怪癖/疾病/饰品/历史生成个体化选择。
 *
 * 此函数返回适用于给定 heroId 的 trial id 列表(供 UI 选择生成器使用)。
 */
export function selectEligibleHeroTrials(
  heroFlags: Record<string, number>,
  trials: Record<string, HeroTrialDefinition>,
): string[] {
  const eligible: string[] = [];
  for (const [trialId, trial] of Object.entries(trials)) {
    // 简化:检查第一个 condition(flag-gte)
    const cond = trial.eligibleHeroConditions[0];
    if (!cond || cond.kind !== 'flag-gte') {
      // 无条件或不支持的条件,默认所有英雄可用
      eligible.push(trialId);
      continue;
    }
    const value = heroFlags[cond.flagName as string] ?? 0;
    if (value >= (cond.value as number)) {
      eligible.push(trialId);
    }
  }
  return eligible;
}
