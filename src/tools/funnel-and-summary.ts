/**
 * Phase 10C: 漏斗状态 + 匿名战役摘要(SPEC §8, §15)
 *
 * 漏斗状态(CampaignFunnelState):
 * - 追踪战役进度节点(SPEC §15.1)
 * - 默认本地保存,玩家主动导出匿名摘要
 *
 * 匿名战役摘要(AnonymousCampaignSummary):
 * - 不含个人识别信息(SPEC §8 隐私)
 * - 包含完成节点 / 周数 / 死亡 / 撤退 / Boss / 最终区域 / 结局 / 职业使用 / 恢复使用
 * - 玩家主动导出,不自动上传
 *
 * 11 漏斗节点(SPEC §15):
 * campaignStarted / firstExpeditionCompleted / secondWeekReached /
 * firstMediumQuestCompleted / firstBossDefeated / allRegionalBossesDefeated /
 * finalRegionReached / campaignCompleted / secondCampaignStarted
 */

import type { GameState } from '../game-engine/expedition/types.js';

export interface CampaignFunnelState {
  campaignStarted: boolean;
  firstExpeditionCompleted: boolean;
  secondWeekReached: boolean;
  firstMediumQuestCompleted: boolean;
  firstBossDefeated: boolean;
  allRegionalBossesDefeated: boolean;
  finalRegionReached: boolean;
  campaignCompleted: boolean;
  secondCampaignStarted: boolean;

  // 内部元数据
  lastUpdated: string;
  buildVersion: string;
}

const DEFAULT_FUNNEL: CampaignFunnelState = {
  campaignStarted: false,
  firstExpeditionCompleted: false,
  secondWeekReached: false,
  firstMediumQuestCompleted: false,
  firstBossDefeated: false,
  allRegionalBossesDefeated: false,
  finalRegionReached: false,
  campaignCompleted: false,
  secondCampaignStarted: false,
  lastUpdated: '',
  buildVersion: '',
};

export const FUNNEL_STORAGE_KEY = 'dd-web-funnel-state-v1';

/**
 * 创建初始漏斗
 */
export function createFunnelState(buildVersion: string): CampaignFunnelState {
  return {
    ...DEFAULT_FUNNEL,
    lastUpdated: new Date().toISOString(),
    buildVersion,
  };
}

/**
 * 从 GameState 推断漏斗状态(可重复调用)
 */
export function deriveFunnelFromState(
  funnel: CampaignFunnelState,
  state: GameState
): CampaignFunnelState {
  const next: CampaignFunnelState = { ...funnel };

  // 战役开始:week >= 1
  if ((state.campaign?.week ?? 0) >= 1) {
    next.campaignStarted = true;
  }

  // 第二周到达
  if ((state.campaign?.week ?? 0) >= 2) {
    next.secondWeekReached = true;
  }

  // 第一次远征完成:expeditionLog 至少 1 个 completed
  if (state.expeditionLog?.some((e: any) => e.type === 'completed')) {
    next.firstExpeditionCompleted = true;
  }

  // 第一次中型任务完成
  if (state.campaign?.completedMissions?.some((m: any) =>
    m.difficulty === 'medium' || m.difficulty === 'large' || m.difficulty === 'boss'
  )) {
    next.firstMediumQuestCompleted = true;
  }

  // 第一个 Boss 击败
  if ((state.campaign?.defeatedBossIds?.length ?? 0) >= 1) {
    next.firstBossDefeated = true;
  }

  // 三个 Boss 全部击败
  if ((state.campaign?.defeatedBossIds?.length ?? 0) >= 3) {
    next.allRegionalBossesDefeated = true;
  }

  // 进入最终区域
  if (state.finalCampaignState?.status && state.finalCampaignState.status !== 'not-started') {
    next.finalRegionReached = true;
  }

  // 战役完成
  if (state.campaignEnding != null) {
    next.campaignCompleted = true;
  }

  next.lastUpdated = new Date().toISOString();
  return next;
}

/**
 * 持久化漏斗状态到 localStorage
 */
export function saveFunnelState(funnel: CampaignFunnelState): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(funnel));
    return true;
  } catch {
    return false;
  }
}

/**
 * 从 localStorage 加载漏斗状态
 */
export function loadFunnelState(): CampaignFunnelState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FUNNEL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CampaignFunnelState;
  } catch {
    return null;
  }
}

/**
 * 重置漏斗(玩家主动开始第二局)
 */
export function resetFunnelState(buildVersion: string): CampaignFunnelState {
  // 不重置 secondCampaignStarted(由调用方标记)
  const fresh = createFunnelState(buildVersion);
  fresh.secondCampaignStarted = true; // 标记
  return fresh;
}

// =====================================================================
// Anonymous Campaign Summary(SPEC §8)
// =====================================================================

export interface AnonymousCampaignSummary {
  summaryVersion: 1;
  buildVersion: string;
  generatedAt: string;

  totalWeeks: number;
  totalPlaySessions: number;
  endingType?: string;

  firstExpeditionCompleted: boolean;
  secondWeekReached: boolean;
  firstMediumQuestCompleted: boolean;
  firstBossDefeated: boolean;
  allRegionalBossesDefeated: boolean;
  finalRegionReached: boolean;
  campaignCompleted: boolean;

  totalHeroDeaths: number;
  totalRetreats: number;
  bossFailureCount: number;
  finalAssaultFailureCount: number;

  mostUsedClassId?: string;
  leastUsedClassId?: string;
  hardestRegionId?: string;

  saveRecoveryUsed: boolean;
  migrationFailureDetected: boolean;
  saveCorruptionDetected: boolean;
}

const PII_FIELDS = [
  'playerName', 'email', 'phone', 'ip', 'macAddress', 'deviceId',
  'gps', 'latitude', 'longitude', 'address',
];

/**
 * 校验不包含 PII(个人信息)
 */
export function validateSummaryPrivacy(summary: any): { isClean: boolean; leakedFields: string[] } {
  const leaked: string[] = [];
  const json = JSON.stringify(summary);
  for (const field of PII_FIELDS) {
    if (json.toLowerCase().includes(field.toLowerCase())) {
      leaked.push(field);
    }
  }
  return { isClean: leaked.length === 0, leakedFields: leaked };
}

/**
 * 从 GameState + 漏斗 + 统计 生成匿名摘要
 */
export function buildAnonymousSummary(
  state: GameState,
  funnel: CampaignFunnelState,
  stats: {
    totalPlaySessions: number;
    bossFailureCount: number;
    finalAssaultFailureCount: number;
    mostUsedClassId?: string;
    leastUsedClassId?: string;
    hardestRegionId?: string;
    saveRecoveryUsed: boolean;
    migrationFailureDetected: boolean;
    saveCorruptionDetected: boolean;
  },
  buildVersion: string
): AnonymousCampaignSummary {
  return {
    summaryVersion: 1,
    buildVersion,
    generatedAt: new Date().toISOString(),
    totalWeeks: state.campaign?.week ?? 0,
    totalPlaySessions: stats.totalPlaySessions,
    endingType: state.campaignEnding?.type,

    firstExpeditionCompleted: funnel.firstExpeditionCompleted,
    secondWeekReached: funnel.secondWeekReached,
    firstMediumQuestCompleted: funnel.firstMediumQuestCompleted,
    firstBossDefeated: funnel.firstBossDefeated,
    allRegionalBossesDefeated: funnel.allRegionalBossesDefeated,
    finalRegionReached: funnel.finalRegionReached,
    campaignCompleted: funnel.campaignCompleted,

    totalHeroDeaths: state.campaign?.graveyard?.length ?? 0,
    totalRetreats: (state.eventLog || []).filter((e: any) => e.type === 'RETREAT').length,
    bossFailureCount: stats.bossFailureCount,
    finalAssaultFailureCount: stats.finalAssaultFailureCount,

    mostUsedClassId: stats.mostUsedClassId,
    leastUsedClassId: stats.leastUsedClassId,
    hardestRegionId: stats.hardestRegionId,

    saveRecoveryUsed: stats.saveRecoveryUsed,
    migrationFailureDetected: stats.migrationFailureDetected,
    saveCorruptionDetected: stats.saveCorruptionDetected,
  };
}

/**
 * 导出摘要为 JSON
 */
export function exportSummaryAsJson(summary: AnonymousCampaignSummary): string {
  return JSON.stringify(summary, null, 2);
}

/**
 * 生成摘要文件名
 */
export function generateSummaryFilename(buildVersion: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `anonymous-summary_${date}_${buildVersion}.json`;
}

/**
 * 漏斗进度计算(0-1)
 */
export function calculateFunnelProgress(funnel: CampaignFunnelState): number {
  const milestones = [
    funnel.campaignStarted,
    funnel.firstExpeditionCompleted,
    funnel.secondWeekReached,
    funnel.firstMediumQuestCompleted,
    funnel.firstBossDefeated,
    funnel.allRegionalBossesDefeated,
    funnel.finalRegionReached,
    funnel.campaignCompleted,
  ];
  return milestones.filter(Boolean).length / milestones.length;
}

/**
 * 流失点分析(SPEC §16)
 */
export interface DropoffAnalysis {
  dropoffPoints: Array<{
    milestone: string;
    reached: boolean;
    description: string;
  }>;
  maxDropoffMilestone: string | null;
}

export function analyzeDropoff(funnel: CampaignFunnelState): DropoffAnalysis {
  const milestones = [
    { name: 'campaignStarted', reached: funnel.campaignStarted, description: '战役开始' },
    { name: 'firstExpeditionCompleted', reached: funnel.firstExpeditionCompleted, description: '完成第一次远征' },
    { name: 'secondWeekReached', reached: funnel.secondWeekReached, description: '进入第二周' },
    { name: 'firstMediumQuestCompleted', reached: funnel.firstMediumQuestCompleted, description: '完成第一次中型任务' },
    { name: 'firstBossDefeated', reached: funnel.firstBossDefeated, description: '击败第一个 Boss' },
    { name: 'allRegionalBossesDefeated', reached: funnel.allRegionalBossesDefeated, description: '击败三个 Boss' },
    { name: 'finalRegionReached', reached: funnel.finalRegionReached, description: '进入最终区域' },
    { name: 'campaignCompleted', reached: funnel.campaignCompleted, description: '完成战役' },
  ];

  // 找到第一个未达成的里程碑 = 最大流失点
  let maxDropoff: string | null = null;
  for (const m of milestones) {
    if (!m.reached) {
      maxDropoff = m.name;
      break;
    }
  }

  return {
    dropoffPoints: milestones.map((m) => ({
      milestone: m.name,
      reached: m.reached,
      description: m.description,
    })),
    maxDropoffMilestone: maxDropoff,
  };
}
