/**
 * Phase 10A: Production Issue 流程(SPEC §4-§5)
 *
 * 与 Phase 9G BetaIssue 分离:
 * - BetaIssue:Phase 9 RC 期间,人工/模拟报告
 * - ProductionIssue:Phase 10 1.0 上线后,真实玩家报告 + Diagnostic Bundle
 *
 * 严重等级(SPEC §5):
 * - blocker:游戏无法启动 / 主线永久无法继续 / 存档被清空 / 最终结局无法提交 / PWA 大范围存档丢失
 * - critical:永久死亡回滚 / 奖励复制 / 无限金币 / Boss 状态错误 / 结局重复 / 导入覆盖 / SW 循环 / Debug 泄漏 / 授权问题
 * - major:重要规则错误 / 任务无法完成 / 高损耗软锁 / 移动端核心按钮无法用 / 严重理解问题 / 长期卡顿
 * - minor:局部反馈不足 / 低频显示错误
 * - polish:动画 / 排版 / 文案 / 视觉
 *
 * 状态:
 * - reported / awaiting-evidence / confirmed / fixing / fixed / verified / deferred / wont-fix
 *
 * 最低证据(SPEC §4.3):
 * - 版本 + 页面/流程 + 复现步骤 + 预期/实际 + 存档或 Diagnostic Bundle
 * - 缺证据 → awaiting-evidence
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type IssueSeverity = 'blocker' | 'critical' | 'major' | 'minor' | 'polish';
export type IssueStatus =
  | 'reported'
  | 'awaiting-evidence'
  | 'confirmed'
  | 'fixing'
  | 'fixed'
  | 'verified'
  | 'deferred'
  | 'wont-fix';

export type IssueSource =
  | 'player-report'
  | 'diagnostic-bundle'
  | 'save-file'
  | 'developer-reproduction'
  | 'migration-test'
  | 'production-smoke-test'
  | 'pwa-update-test';

export type IssueCategory =
  | 'save'
  | 'rules'
  | 'soft-lock'
  | 'reward-duplication'
  | 'migration'
  | 'balance'
  | 'comprehension'
  | 'mobile'
  | 'performance'
  | 'pwa'
  | 'deployment'
  | 'originality'
  | 'security';

export interface ProductionIssue {
  id: string;
  title: string;

  source: IssueSource;
  buildVersion: string;
  schemaVersion?: number;
  serviceWorkerVersion?: string;
  saveId?: string;
  seed?: string;
  campaignWeek?: number;

  category: IssueCategory;
  severity: IssueSeverity;

  reproductionSteps: string[];
  expectedResult: string;
  actualResult: string;

  relatedEventIds: string[];
  relatedContentIds: string[];
  invariantFailures: string[];

  rootCause?: string;
  proposedFix?: string;
  fixVersion?: string;
  regressionTestId?: string;

  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceCheck {
  hasVersion: boolean;
  hasPageOrFlow: boolean;
  hasReproductionSteps: boolean;
  hasExpectedAndActual: boolean;
  hasSaveOrBundle: boolean;
  isComplete: boolean;
  missingFields: string[];
}

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  blocker: 5, critical: 4, major: 3, minor: 2, polish: 1,
};

/**
 * 创建 Production Issue
 */
export function createProductionIssue(input: {
  id: string;
  title: string;
  source: IssueSource;
  buildVersion: string;
  category: IssueCategory;
  severity: IssueSeverity;
  reproductionSteps: string[];
  expectedResult: string;
  actualResult: string;
  saveId?: string;
  schemaVersion?: number;
  relatedEventIds?: string[];
  relatedContentIds?: string[];
  invariantFailures?: string[];
  serviceWorkerVersion?: string;
  seed?: string;
  campaignWeek?: number;
  rootCause?: string;
  proposedFix?: string;
}): ProductionIssue {
  const now = new Date().toISOString();
  return {
    id: input.id,
    title: input.title,
    source: input.source,
    buildVersion: input.buildVersion,
    schemaVersion: input.schemaVersion,
    serviceWorkerVersion: input.serviceWorkerVersion,
    saveId: input.saveId,
    seed: input.seed,
    campaignWeek: input.campaignWeek,
    category: input.category,
    severity: input.severity,
    reproductionSteps: input.reproductionSteps,
    expectedResult: input.expectedResult,
    actualResult: input.actualResult,
    relatedEventIds: input.relatedEventIds || [],
    relatedContentIds: input.relatedContentIds || [],
    invariantFailures: input.invariantFailures || [],
    rootCause: input.rootCause,
    proposedFix: input.proposedFix,
    status: 'reported',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 校验最低证据(SPEC §4.3)
 */
export function checkEvidence(issue: ProductionIssue): EvidenceCheck {
  const missing: string[] = [];
  if (!issue.buildVersion) missing.push('version');
  const hasPageOrFlow = !!issue.title && issue.reproductionSteps.length > 0;
  if (!hasPageOrFlow) missing.push('page/flow');
  if (issue.reproductionSteps.length === 0) missing.push('reproduction steps');
  if (!issue.expectedResult) missing.push('expected');
  if (!issue.actualResult) missing.push('actual');
  const hasSaveOrBundle = !!(issue.saveId || issue.relatedEventIds.length > 0
    || issue.invariantFailures.length > 0 || issue.source === 'diagnostic-bundle'
    || issue.source === 'save-file');
  if (!hasSaveOrBundle) missing.push('save or bundle');

  return {
    hasVersion: !!issue.buildVersion,
    hasPageOrFlow,
    hasReproductionSteps: issue.reproductionSteps.length > 0,
    hasExpectedAndActual: !!issue.expectedResult && !!issue.actualResult,
    hasSaveOrBundle,
    isComplete: missing.length === 0,
    missingFields: missing,
  };
}

/**
 * 自动根据证据完整性设置状态
 */
export function deriveStatus(issue: ProductionIssue): ProductionIssue {
  const ev = checkEvidence(issue);
  if (!ev.isComplete && issue.status === 'reported') {
    return { ...issue, status: 'awaiting-evidence', updatedAt: new Date().toISOString() };
  }
  return issue;
}

/**
 * 更新 Issue
 */
export function updateProductionIssue(
  issue: ProductionIssue,
  changes: Partial<ProductionIssue>
): ProductionIssue {
  return { ...issue, ...changes, updatedAt: new Date().toISOString() };
}

/**
 * Triage:按严重度排序
 */
export function triageProductionIssues(issues: ProductionIssue[]): ProductionIssue[] {
  return [...issues].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

/**
 * 阻塞 RC 发布:仅 blocker / critical 阻塞
 */
export function isReleaseBlocking(issue: ProductionIssue): boolean {
  return issue.severity === 'blocker' || issue.severity === 'critical';
}

/**
 * 默认 Production Issues(Phase 10 起点)
 *
 * 来自 Phase 9 known-issues.json + 9 范围外项(范围外未真实发生,但流程就位)
 */
export function getDefaultProductionIssues(): ProductionIssue[] {
  return [
    createProductionIssue({
      id: 'PI-001',
      title: 'Phase 6 Debug Panel 未挂载生产 UI',
      source: 'developer-reproduction',
      buildVersion: '0.9.0-rc1',
      category: 'deployment',
      severity: 'polish',
      reproductionSteps: [
        'npm run dev',
        '检查 Debug 入口',
      ],
      expectedResult: '生产构建无 Debug 入口',
      actualResult: '生产构建无 Debug 入口,符合 SPEC §5.2',
      rootCause: 'isDebugEnabled() 在 production 返回 false',
      proposedFix: '保留当前行为,无需修复',
    }),
    createProductionIssue({
      id: 'PI-002',
      title: '持久化层 UI 未完整实现',
      source: 'developer-reproduction',
      buildVersion: '0.9.0-rc1',
      category: 'mobile',
      severity: 'minor',
      reproductionSteps: [
        '主入口',
        '查找"导入/导出"按钮',
      ],
      expectedResult: '主入口有"导入/导出"按钮',
      actualResult: '工具函数可用,UI 未挂载',
      rootCause: 'Phase 9 范围专注工具,UI 集成在 1.0.1',
      proposedFix: '1.0.1 补 Save/Load UI',
    }),
    createProductionIssue({
      id: 'PI-003',
      title: 'PWA 启动图标 PNG 缺失',
      source: 'production-smoke-test',
      buildVersion: '0.9.0-rc1',
      category: 'pwa',
      severity: 'minor',
      reproductionSteps: [
        'PWA 安装',
        '查看启动画面',
      ],
      expectedResult: 'PNG 图标显示',
      actualResult: '降级到 SVG',
      rootCause: '需要 ImageMagick/sharp 生成',
      proposedFix: 'v1.0.1 生成 PNG',
    }),
  ];
}

/**
 * 写 Production Issues JSON
 */
export function writeProductionIssuesJson(
  issues: ProductionIssue[],
  path: string = join('docs', 'production-issues.json')
): void {
  const dir = path.substring(0, path.lastIndexOf('\\') + 1) || path.substring(0, path.lastIndexOf('/') + 1);
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(issues, null, 2), 'utf-8');
}

/**
 * 渲染 Process 文档(SPEC §4.3)
 */
export const PRODUCTION_ISSUE_PROCESS = `
# Production Issue 流程

## 1. 玩家报告

玩家通过:
- 主入口 → 错误报告导出 → 附 Diagnostic Bundle
- GitHub Issue 模板(需要:版本 / 页面 / 复现 / 预期 / 实际 / 存档)
- 邮件(可选,开发构建允许)

## 2. 证据校验

每个 Production Issue 必须满足(SPEC §4.3):
- 版本(buildVersion)
- 页面或流程(title / reproductionSteps)
- 复现步骤(reproductionSteps.length >= 1)
- 预期 / 实际(expectedResult / actualResult)
- 存档或 Diagnostic Bundle(saveId / source = diagnostic-bundle / source = save-file)

## 3. 严重度

- Blocker:游戏无法启动 / 主线永久无法继续 / 存档被清空 / 结局无法提交 / PWA 大范围存档丢失
- Critical:永久死亡回滚 / 奖励复制 / 无限金币 / Boss 状态错误 / 结局重复 / 导入覆盖 / SW 循环 / Debug 泄漏 / 授权问题
- Major:重要规则错误 / 任务无法完成 / 高损耗软锁 / 移动端核心按钮无法用 / 严重理解问题
- Minor:局部反馈不足 / 低频显示错误
- Polish:动画 / 排版 / 文案 / 视觉

## 4. 修复流程

1. 复现:导入 Diagnostic Bundle + 还原问题上下文
2. 定位:最小修复
3. 回归:添加 regressionTestId
4. 验证:Production Smoke Test + 12 类标准存档迁移
5. 发布:v1.0.1 Hotfix

## 5. 阻塞规则

- Blocker 出现 → 立即停止新工作,准备回滚,发布紧急说明
- Critical 出现 → 下次 Hotfix(v1.0.1)修复
- Major 出现 → v1.0.2 Stability
- Minor / Polish → Backlog
`.trim();
