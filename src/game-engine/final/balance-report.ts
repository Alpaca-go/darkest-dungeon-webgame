/**
 * Phase 7E: 全战役平衡报告(SPEC §27)
 *
 * 审计指标:
 *  - 金币与遗产曲线
 *  - 英雄等级曲线
 *  - 死亡率和撤退率
 *  - 疾病与怪癖频率
 *  - 饰品和职业使用率
 *  - 区域完成率
 *  - Boss 和最终 Boss 成功率
 *  - 平均战役周数
 *  - 惨胜比例
 *  - 失败恢复周期
 */

import type { CampaignSummaryData } from './types.js';
import type { CampaignDomainEvent } from './ending.js';

// =====================================================================
// 平衡报告类型
// =====================================================================

export interface BalanceReport {
  /** 平均战役周数(SPEC §27) */
  averageCampaignWeeks: number;
  /** 死亡率:总死亡 / 总招募 */
  mortalityRate: number;
  /** 撤退率:撤退次数 / 远征次数 */
  retreatRate: number;
  /** Boss 成功率:击败 Boss 数 / 遭遇 Boss 战次数 */
  bossSuccessRate: number;
  /** 最终 Boss 成功率:finalBossDefeated / 启动最终讨伐次数 */
  finalBossSuccessRate: number;
  /** 惨胜比例:pyrrhic-victory / (victory + pyrrhic-victory) */
  pyrrhicRate: number;
  /** 失败恢复周期:平均几次失败后成功 */
  avgFailuresBeforeSuccess: number;
  /** 区域完成率:已完成 Boss 区域 / 全部区域(3) */
  regionCompletionRate: number;
  /** 死亡之门抵抗率:deathblow 抵抗 / 死亡之门进入 */
  deathblowResistRate: number;
}

// =====================================================================
// 平衡计算(从 events 推导)
// =====================================================================

/**
 * 计算平衡报告(SPEC §27)
 * 输入:多个战役的 events(可多战役) + 最终 summary
 */
export function calculateBalanceReport(args: {
  summaries: CampaignSummaryData[];
  events: CampaignDomainEvent[];
}): BalanceReport {
  const { summaries, events } = args;
  // 过滤 debug
  const realEvents = events.filter((e) => !e.debug);

  // 1. 平均战役周数
  const averageCampaignWeeks = summaries.length === 0
    ? 0
    : summaries.reduce((acc, s) => acc + s.totalWeeks, 0) / summaries.length;

  // 2. 死亡率
  const totalDeaths = summaries.reduce((acc, s) => acc + s.totalHeroDeaths, 0);
  const totalRecruits = summaries.reduce((acc, s) => acc + s.totalHeroesRecruited, 0);
  const mortalityRate = totalRecruits === 0 ? 0 : totalDeaths / totalRecruits;

  // 3. 撤退率
  const totalRetreats = summaries.reduce((acc, s) => acc + s.retreats, 0);
  const totalExpeditions = summaries.reduce((acc, s) => acc + s.totalExpeditions, 0);
  const retreatRate = totalExpeditions === 0 ? 0 : totalRetreats / totalExpeditions;

  // 4. Boss 成功率:击败 Boss 事件 / 遭遇 Boss 战事件
  const bossEncounters = realEvents.filter((e) => e.type === 'BOSS_ENCOUNTER_STARTED').length;
  const bossDefeats = realEvents.filter((e) => e.type === 'BOSS_DEFEATED').length;
  const bossSuccessRate = bossEncounters === 0 ? 0 : bossDefeats / bossEncounters;

  // 5. 最终 Boss 成功率
  const finalBossAttempts = realEvents.filter((e) => e.type === 'FinalAssaultStarted').length;
  const finalBossDefeats = realEvents.filter((e) => e.type === 'FinalBossDefeated').length;
  const finalBossSuccessRate = finalBossAttempts === 0 ? 0 : finalBossDefeats / finalBossAttempts;

  // 6. 惨胜比例
  const pyrrhicCount = summaries.filter((s) => s.finalEndingType === 'pyrrhic-victory').length;
  const victoryCount = summaries.filter((s) => s.finalEndingType === 'victory').length;
  const pyrrhicRate = (victoryCount + pyrrhicCount) === 0 ? 0 : pyrrhicCount / (victoryCount + pyrrhicCount);

  // 7. 失败恢复周期:平均几次最终讨伐后成功(只对胜利/惨胜的战役)
  // 简化:每个成功战役的 attempt count 平均
  const successSummaries = summaries.filter((s) => s.finalBossDefeated);
  const avgAttempts = successSummaries.length === 0
    ? 0
    : successSummaries.reduce((acc, s) => acc + 1, 0) / successSummaries.length;
  const avgFailuresBeforeSuccess = Math.max(0, avgAttempts - 1);

  // 8. 区域完成率
  const avgBossesDefeated = summaries.length === 0
    ? 0
    : summaries.reduce((acc, s) => acc + s.defeatedBossIds.length, 0) / summaries.length;
  const regionCompletionRate = avgBossesDefeated / 3; // 3 个区域 Boss

  // 9. Deathblow 抵抗率
  const totalDdEntries = summaries.reduce((acc, s) => acc + s.totalDeathsDoorEntries, 0);
  const totalDdResists = summaries.reduce((acc, s) => acc + s.totalDeathblowResists, 0);
  const deathblowResistRate = totalDdEntries === 0 ? 0 : totalDdResists / totalDdEntries;

  return {
    averageCampaignWeeks,
    mortalityRate,
    retreatRate,
    bossSuccessRate,
    finalBossSuccessRate,
    pyrrhicRate,
    avgFailuresBeforeSuccess,
    regionCompletionRate,
    deathblowResistRate,
  };
}

// =====================================================================
// 平衡目标(SPEC §27 验收)
// =====================================================================

/**
 * SPEC §27 平衡目标(参考值)
 * - 平均战役周数:30-60
 * - 死亡率:< 50%
 * - 撤退率:10-30%
 * - Boss 成功率:60-90%
 * - 最终 Boss 成功率:30-60%
 * - 惨胜比例:< 30%
 * - 失败恢复周期:1-3
 * - 区域完成率:> 80%
 * - 死亡之门抵抗率:> 30%
 */
export const BALANCE_TARGETS = {
  averageCampaignWeeks: { min: 30, max: 60 },
  mortalityRate: { min: 0, max: 0.50 },
  retreatRate: { min: 0.10, max: 0.30 },
  bossSuccessRate: { min: 0.60, max: 0.90 },
  finalBossSuccessRate: { min: 0.30, max: 0.60 },
  pyrrhicRate: { min: 0, max: 0.30 },
  avgFailuresBeforeSuccess: { min: 1, max: 3 },
  regionCompletionRate: { min: 0.80, max: 1.0 },
  deathblowResistRate: { min: 0.30, max: 1.0 },
} as const;

/**
 * 验证平衡报告是否在 SPEC §27 目标内
 */
export function isBalanceReportHealthy(report: BalanceReport): {
  healthy: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const t = BALANCE_TARGETS;
  if (report.averageCampaignWeeks < t.averageCampaignWeeks.min || report.averageCampaignWeeks > t.averageCampaignWeeks.max) {
    violations.push(`averageCampaignWeeks ${report.averageCampaignWeeks} not in [${t.averageCampaignWeeks.min}, ${t.averageCampaignWeeks.max}]`);
  }
  if (report.mortalityRate > t.mortalityRate.max) {
    violations.push(`mortalityRate ${report.mortalityRate} > ${t.mortalityRate.max}`);
  }
  if (report.retreatRate < t.retreatRate.min || report.retreatRate > t.retreatRate.max) {
    violations.push(`retreatRate ${report.retreatRate} not in [${t.retreatRate.min}, ${t.retreatRate.max}]`);
  }
  if (report.bossSuccessRate < t.bossSuccessRate.min || report.bossSuccessRate > t.bossSuccessRate.max) {
    violations.push(`bossSuccessRate ${report.bossSuccessRate} not in [${t.bossSuccessRate.min}, ${t.bossSuccessRate.max}]`);
  }
  if (report.finalBossSuccessRate < t.finalBossSuccessRate.min || report.finalBossSuccessRate > t.finalBossSuccessRate.max) {
    violations.push(`finalBossSuccessRate ${report.finalBossSuccessRate} not in [${t.finalBossSuccessRate.min}, ${t.finalBossSuccessRate.max}]`);
  }
  if (report.pyrrhicRate > t.pyrrhicRate.max) {
    violations.push(`pyrrhicRate ${report.pyrrhicRate} > ${t.pyrrhicRate.max}`);
  }
  if (report.avgFailuresBeforeSuccess < t.avgFailuresBeforeSuccess.min || report.avgFailuresBeforeSuccess > t.avgFailuresBeforeSuccess.max) {
    violations.push(`avgFailuresBeforeSuccess ${report.avgFailuresBeforeSuccess} not in [${t.avgFailuresBeforeSuccess.min}, ${t.avgFailuresBeforeSuccess.max}]`);
  }
  if (report.regionCompletionRate < t.regionCompletionRate.min) {
    violations.push(`regionCompletionRate ${report.regionCompletionRate} < ${t.regionCompletionRate.min}`);
  }
  if (report.deathblowResistRate < t.deathblowResistRate.min) {
    violations.push(`deathblowResistRate ${report.deathblowResistRate} < ${t.deathblowResistRate.min}`);
  }
  return { healthy: violations.length === 0, violations };
}
