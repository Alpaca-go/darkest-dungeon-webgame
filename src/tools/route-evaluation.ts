/**
 * Phase 10D/E/F: 实战平衡 + Patch 流程 + 1.1 路线评估
 *
 * 10D: ProductionBalanceChange — 实战平衡调整记录(SPEC §19.3)
 * 10E: Patch Release Process — 补丁发布 CI 流程(SPEC §22)
 * 10F: VersionRouteEvaluation — 1.1 路线评估矩阵(SPEC §24)
 *
 * 1.1 路线(SPEC §23):
 * - A content:2 新职业 + 1 新区域 + 1 Boss + 配套
 * - B replayability:难度 / 随机修正 / 挑战 Seed / 区域变体
 * - C productization:账号 / 云存档 / 多设备同步
 *
 * 1.1 决策门槛(SPEC §25):
 * - v1.0.0 已上线
 * - 至少一个 Hotfix 周期
 * - Blocker = 0
 * - Critical = 0
 * - 存档可迁移
 * - PWA 更新安全
 * - 第二轮测试完成
 * - 流失节点确认
 * - 重玩意愿收集
 * - 三条路线有评分
 * - 选 1 条主路线
 *
 * 评分 8 维度(SPEC §24,1-10):
 * - playerDemandScore / retentionImpactScore / reuseExistingSystemsScore
 * - developmentCostScore / maintenanceCostScore / technicalRiskScore
 * - legalRiskScore / evidenceConfidenceScore
 *
 * 证据优先级(SPEC §24):
 * 玩家明确行为证据 > 多名玩家一致反馈 > 单个玩家建议 > 开发者偏好
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// =====================================================================
// 10D: Production Balance Change
// =====================================================================

export type BalanceChangeStatus = 'proposed' | 'reviewing' | 'approved' | 'rejected' | 'applied';

export interface ProductionBalanceChange {
  id: string;
  buildVersionFrom: string;
  buildVersionTo: string;
  targetMetric: string;
  evidenceIssueIds: string[];
  previousValue: unknown;
  newValue: unknown;
  expectedEffect: string;
  regressionRisk: string[];
  status: BalanceChangeStatus;
  createdAt: string;
  updatedAt: string;
}

export function createBalanceChange(input: {
  id: string;
  buildVersionFrom: string;
  buildVersionTo: string;
  targetMetric: string;
  evidenceIssueIds: string[];
  previousValue: unknown;
  newValue: unknown;
  expectedEffect: string;
  regressionRisk: string[];
}): ProductionBalanceChange {
  const now = new Date().toISOString();
  return {
    ...input,
    status: 'proposed',
    createdAt: now,
    updatedAt: now,
  };
}

export function applyBalanceChange(
  change: ProductionBalanceChange,
  newStatus: BalanceChangeStatus
): ProductionBalanceChange {
  return { ...change, status: newStatus, updatedAt: new Date().toISOString() };
}

// =====================================================================
// 10E: Patch Release Process
// =====================================================================

/**
 * 12 步 Patch 流程(SPEC §22)
 */
export const PATCH_RELEASE_PIPELINE = [
  'Install(依赖锁定 + node_modules)',
  'Lint(ESLint 静态检查)',
  'Typecheck(TypeScript 编译)',
  'Unit Test(vitest run)',
  'Integration Test(phase10b 1.0.0→1.0.1)',
  'E2E Test(部署后 Smoke Test)',
  'Campaign Regression(8B 6 + 9F 6 + 10F 6)',
  'Save Migration Audit(save-migration.test.ts)',
  'PWA Update Test(sw.js 升级 + 缓存回退)',
  'Production Audit(0 Blocker / 0 Critical)',
  'Build Patch(build:hotfix / build:stability)',
  'Smoke Test(首页 / 继续 / 导入导出 / 离线)',
] as const;

export const PATCH_REGRESSION_SCENARIOS = [
  '原问题存档',
  '相邻状态存档',
  '新档',
  '旧档迁移',
  'PWA 更新',
  'Production Smoke Test',
] as const;

export const POST_DEPLOY_VERIFICATION = [
  '版本号',
  'Service Worker',
  '首页加载',
  '继续战役',
  '自动保存',
  '导出',
  '导入',
  '离线',
  '更新提示',
  '问题修复路径',
] as const;

// =====================================================================
// 10F: 1.1 路线评估
// =====================================================================

export type RouteId = 'content' | 'replayability' | 'productization';

export interface VersionRouteEvaluation {
  routeId: RouteId;
  routeName: string;
  routeDescription: string;

  // 8 维度评分(1-10)
  playerDemandScore: number;
  retentionImpactScore: number;
  reuseExistingSystemsScore: number;
  developmentCostScore: number; // 越高越贵
  maintenanceCostScore: number; // 越高越贵
  technicalRiskScore: number; // 越高越险
  legalRiskScore: number; // 越高越险
  evidenceConfidenceScore: number;

  // 证据
  supportingIssueIds: string[];
  supportingTestRunIds: string[];
  decisionNotes: string[];

  evaluatedAt: string;
  evaluatedBy: string;
}

export interface Version111Decision {
  buildVersion: string;
  decidedAt: string;
  decidedBy: string;
  selectedRoute: RouteId;
  rationale: string;
  routesEvaluated: VersionRouteEvaluation[];
  rejectedRoutes: Array<{
    routeId: RouteId;
    reason: string;
  }>;
  evidenceRequired: string[];
  nextSteps: string[];
}

/**
 * 评估单条路线
 */
export function evaluateRoute(input: {
  routeId: RouteId;
  routeName: string;
  routeDescription: string;
  playerDemandScore: number;
  retentionImpactScore: number;
  reuseExistingSystemsScore: number;
  developmentCostScore: number;
  maintenanceCostScore: number;
  technicalRiskScore: number;
  legalRiskScore: number;
  evidenceConfidenceScore: number;
  supportingIssueIds?: string[];
  supportingTestRunIds?: string[];
  decisionNotes?: string[];
  evaluatedBy?: string;
}): VersionRouteEvaluation {
  return {
    ...input,
    supportingIssueIds: input.supportingIssueIds || [],
    supportingTestRunIds: input.supportingTestRunIds || [],
    decisionNotes: input.decisionNotes || [],
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: input.evaluatedBy || 'system',
  };
}

/**
 * 计算综合得分(0-100,越高越推荐)
 *
 * 公式:
 * 收益(player demand + retention + reuse + evidence) - 成本(cost + maintenance) - 风险(tech + legal)
 * 归一化到 0-100
 */
export function calculateRouteScore(route: VersionRouteEvaluation): number {
  const benefits = route.playerDemandScore + route.retentionImpactScore
    + route.reuseExistingSystemsScore + route.evidenceConfidenceScore;
  const costs = route.developmentCostScore + route.maintenanceCostScore;
  const risks = route.technicalRiskScore + route.legalRiskScore;
  // 4 维收益 - 4 维成本/风险
  // max = 40,min = 0
  const raw = benefits - costs - risks;
  // 归一化:假设 raw 在 -40 到 40,归一化到 0-100
  const normalized = Math.max(0, Math.min(100, ((raw + 40) / 80) * 100));
  return Math.round(normalized);
}

/**
 * 选择最佳路线(基于综合得分)
 */
export function selectBestRoute(routes: VersionRouteEvaluation[]): VersionRouteEvaluation {
  const scored = routes.map((r) => ({ route: r, score: calculateRouteScore(r) }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].route;
}

/**
 * 生成 1.1 决策报告
 */
export function createVersion111Decision(input: {
  buildVersion: string;
  decidedBy: string;
  selectedRoute: RouteId;
  rationale: string;
  routesEvaluated: VersionRouteEvaluation[];
  evidenceRequired?: string[];
  nextSteps?: string[];
}): Version111Decision {
  const selected = input.routesEvaluated.find((r) => r.routeId === input.selectedRoute);
  if (!selected) {
    throw new Error(`Selected route ${input.selectedRoute} not in evaluated routes`);
  }
  return {
    buildVersion: input.buildVersion,
    decidedAt: new Date().toISOString(),
    decidedBy: input.decidedBy,
    selectedRoute: input.selectedRoute,
    rationale: input.rationale,
    routesEvaluated: input.routesEvaluated,
    rejectedRoutes: input.routesEvaluated
      .filter((r) => r.routeId !== input.selectedRoute)
      .map((r) => ({
        routeId: r.routeId,
        reason: r.decisionNotes.join('; ') || '未被选为主路线',
      })),
    evidenceRequired: input.evidenceRequired || [],
    nextSteps: input.nextSteps || [],
  };
}

/**
 * 渲染决策报告 Markdown
 */
export function renderDecisionReport(decision: Version111Decision): string {
  const lines: string[] = [];
  lines.push('# 1.1 路线决策报告');
  lines.push('');
  lines.push(`构建版本: ${decision.buildVersion}`);
  lines.push(`决策时间: ${decision.decidedAt}`);
  lines.push(`决策者: ${decision.decidedBy}`);
  lines.push(`选定路线: **${decision.selectedRoute}**`);
  lines.push('');
  lines.push('## 决策理由');
  lines.push('');
  lines.push(decision.rationale);
  lines.push('');
  lines.push('## 三条路线评分');
  lines.push('');
  lines.push('| 路线 | 玩家需求 | 留存影响 | 复用既有 | 开发成本 | 维护成本 | 技术风险 | 法律风险 | 证据置信 | **综合得分** |');
  lines.push('|------|----------|----------|----------|----------|----------|----------|----------|----------|--------------|');
  for (const r of decision.routesEvaluated) {
    const score = calculateRouteScore(r);
    lines.push(`| ${r.routeId} | ${r.playerDemandScore} | ${r.retentionImpactScore} | ${r.reuseExistingSystemsScore} | ${r.developmentCostScore} | ${r.maintenanceCostScore} | ${r.technicalRiskScore} | ${r.legalRiskScore} | ${r.evidenceConfidenceScore} | **${score}** |`);
  }
  lines.push('');
  lines.push('## 选定路线详情');
  const selected = decision.routesEvaluated.find((r) => r.routeId === decision.selectedRoute)!;
  lines.push('');
  lines.push(`**${selected.routeName}** — ${selected.routeDescription}`);
  lines.push('');
  if (selected.decisionNotes.length > 0) {
    lines.push('### 决策笔记');
    lines.push('');
    for (const note of selected.decisionNotes) lines.push(`- ${note}`);
    lines.push('');
  }
  lines.push('## 拒绝路线');
  lines.push('');
  for (const r of decision.rejectedRoutes) {
    lines.push(`### ${r.routeId}`);
    lines.push('');
    lines.push(r.reason);
    lines.push('');
  }
  if (decision.evidenceRequired.length > 0) {
    lines.push('## 所需证据');
    lines.push('');
    for (const e of decision.evidenceRequired) lines.push(`- ${e}`);
    lines.push('');
  }
  if (decision.nextSteps.length > 0) {
    lines.push('## 下一步');
    lines.push('');
    for (const s of decision.nextSteps) lines.push(`- ${s}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * 写决策报告到 docs
 */
export function writeDecisionReport(
  decision: Version111Decision,
  path: string = join('docs', 'version-1.1-decision.md')
): void {
  const dir = path.substring(0, path.lastIndexOf('\\') + 1) || path.substring(0, path.lastIndexOf('/') + 1);
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, renderDecisionReport(decision), 'utf-8');
}
