/**
 * Phase 9G: Beta Issue 管理(SPEC §16-§18)
 *
 * 数据结构 + 反馈分级 + Triage 报告
 *
 * 严重度(SPEC §17):
 * - blocker:无法继续主线 / 存档损坏 / 结局无法提交
 * - critical:奖励复制 / 资源无限 / 结局重复 / Debug 泄漏 / 未授权素材
 * - major:重要规则错误 / 任务无法完成 / 移动端核心按钮无法操作
 * - minor:局部反馈不足 / 低频显示错误
 * - polish:动画 / 排版 / 文案
 *
 * 状态:
 * - reported / triaged / confirmed / fixing / fixed / verified / deferred / wont-fix
 *
 * Release Target:
 * - rc2:必须在 RC2 修复
 * - 1.0:可推迟到 1.0
 * - post-1.0:1.0 之后
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type IssueSeverity = 'blocker' | 'critical' | 'major' | 'minor' | 'polish';
export type IssueStatus =
  | 'reported'
  | 'triaged'
  | 'confirmed'
  | 'fixing'
  | 'fixed'
  | 'verified'
  | 'deferred'
  | 'wont-fix';
export type IssueCategory =
  | 'rules'
  | 'content'
  | 'economy'
  | 'ui'
  | 'save'
  | 'performance'
  | 'accessibility'
  | 'originality'
  | 'pwa'
  | 'mobile'
  | 'comprehension'
  | 'test';
export type ReleaseTarget = 'rc2' | '1.0' | 'post-1.0';

export interface BetaIssue {
  id: string;
  title: string;
  description: string;
  sourceTesterIds: string[];
  playerSaveIds: string[];
  buildVersion: string;
  category: IssueCategory;
  reproductionSteps: string[];
  expectedResult: string;
  actualResult: string;
  rootCause?: string;
  proposedFix?: string;
  severity: IssueSeverity;
  status: IssueStatus;
  regressionTestId?: string;
  releaseTarget?: ReleaseTarget;
  createdAt: string;
  updatedAt: string;
}

export interface BetaIssueDatabase {
  generatedAt: string;
  buildVersion: string;
  totalIssues: number;
  bySeverity: Record<IssueSeverity, number>;
  byStatus: Record<IssueStatus, number>;
  byCategory: Partial<Record<IssueCategory, number>>;
  byReleaseTarget: Record<ReleaseTarget, number>;
  issues: BetaIssue[];
}

// 严重度优先级(blocker > critical > major > minor > polish)
const SEVERITY_RANK: Record<IssueSeverity, number> = {
  blocker: 5,
  critical: 4,
  major: 3,
  minor: 2,
  polish: 1,
};

/**
 * 创建 Beta Issue
 */
export function createBetaIssue(input: Partial<BetaIssue> & { id: string; title: string; buildVersion: string; category: IssueCategory }): BetaIssue {
  const now = new Date().toISOString();
  return {
    id: input.id,
    title: input.title,
    description: input.description ?? '',
    sourceTesterIds: input.sourceTesterIds ?? [],
    playerSaveIds: input.playerSaveIds ?? [],
    buildVersion: input.buildVersion,
    category: input.category,
    reproductionSteps: input.reproductionSteps ?? [],
    expectedResult: input.expectedResult ?? '',
    actualResult: input.actualResult ?? '',
    rootCause: input.rootCause,
    proposedFix: input.proposedFix,
    severity: input.severity ?? 'minor',
    status: input.status ?? 'reported',
    regressionTestId: input.regressionTestId,
    releaseTarget: input.releaseTarget ?? 'post-1.0',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 更新 Issue 状态
 */
export function updateIssueStatus(issue: BetaIssue, newStatus: IssueStatus, fix?: string): BetaIssue {
  return {
    ...issue,
    status: newStatus,
    proposedFix: fix ?? issue.proposedFix,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 升级严重度(基于复现次数 + Tester 共识)
 */
export function escalateSeverity(issue: BetaIssue): BetaIssue {
  const ranks = Object.entries(SEVERITY_RANK) as Array<[IssueSeverity, number]>;
  ranks.sort((a, b) => b[1] - a[1]);
  for (const [sev, rank] of ranks) {
    if (rank > SEVERITY_RANK[issue.severity]) {
      return { ...issue, severity: sev, updatedAt: new Date().toISOString() };
    }
  }
  return issue;
}

/**
 * Triage:按严重度排序 + 分组
 */
export function triageIssues(issues: BetaIssue[]): BetaIssueDatabase {
  const bySeverity: Record<IssueSeverity, number> = {
    blocker: 0, critical: 0, major: 0, minor: 0, polish: 0,
  };
  const byStatus: Record<IssueStatus, number> = {
    reported: 0, triaged: 0, confirmed: 0, fixing: 0,
    fixed: 0, verified: 0, deferred: 0, 'wont-fix': 0,
  };
  const byCategory: Partial<Record<IssueCategory, number>> = {};
  const byReleaseTarget: Record<ReleaseTarget, number> = {
    'rc2': 0, '1.0': 0, 'post-1.0': 0,
  };

  for (const issue of issues) {
    bySeverity[issue.severity]++;
    byStatus[issue.status]++;
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    if (issue.releaseTarget) {
      byReleaseTarget[issue.releaseTarget]++;
    }
  }

  // 按严重度降序排序
  const sorted = [...issues].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  return {
    generatedAt: new Date().toISOString(),
    buildVersion: issues[0]?.buildVersion ?? '0.9.0-rc1',
    totalIssues: issues.length,
    bySeverity,
    byStatus,
    byCategory,
    byReleaseTarget,
    issues: sorted,
  };
}

/**
 * 决定 release target:基于严重度
 */
export function defaultReleaseTarget(severity: IssueSeverity): ReleaseTarget {
  if (severity === 'blocker' || severity === 'critical') return 'rc2';
  if (severity === 'major') return '1.0';
  return 'post-1.0';
}

/**
 * 渲染 Triage Markdown 报告
 */
export function renderTriageReport(db: BetaIssueDatabase): string {
  const lines: string[] = [];
  lines.push('# Beta Triage Report');
  lines.push('');
  lines.push(`构建版本: ${db.buildVersion}`);
  lines.push(`生成时间: ${db.generatedAt}`);
  lines.push(`总 Issue: ${db.totalIssues}`);
  lines.push('');
  lines.push('## 严重度分布');
  lines.push('');
  lines.push(`- Blocker: ${db.bySeverity.blocker}`);
  lines.push(`- Critical: ${db.bySeverity.critical}`);
  lines.push(`- Major: ${db.bySeverity.major}`);
  lines.push(`- Minor: ${db.bySeverity.minor}`);
  lines.push(`- Polish: ${db.bySeverity.polish}`);
  lines.push('');
  lines.push('## 状态分布');
  lines.push('');
  for (const [s, n] of Object.entries(db.byStatus)) {
    lines.push(`- ${s}: ${n}`);
  }
  lines.push('');
  lines.push('## 发布目标分布');
  lines.push('');
  lines.push(`- RC2: ${db.byReleaseTarget.rc2}`);
  lines.push(`- 1.0: ${db.byReleaseTarget['1.0']}`);
  lines.push(`- post-1.0: ${db.byReleaseTarget['post-1.0']}`);
  lines.push('');
  lines.push('## Issues(按严重度排序)');
  lines.push('');
  for (const issue of db.issues) {
    lines.push(`### ${issue.id} [${issue.severity}] ${issue.title}`);
    lines.push('');
    lines.push(`- 状态: ${issue.status}`);
    lines.push(`- 类别: ${issue.category}`);
    lines.push(`- Release Target: ${issue.releaseTarget ?? '未指定'}`);
    if (issue.sourceTesterIds.length > 0) {
      lines.push(`- 来源测试者: ${issue.sourceTesterIds.join(', ')}`);
    }
    lines.push(`- 描述: ${issue.description}`);
    if (issue.reproductionSteps.length > 0) {
      lines.push(`- 复现步骤:`);
      for (const step of issue.reproductionSteps) lines.push(`  - ${step}`);
    }
    lines.push(`- 预期: ${issue.expectedResult}`);
    lines.push(`- 实际: ${issue.actualResult}`);
    if (issue.rootCause) lines.push(`- 根因: ${issue.rootCause}`);
    if (issue.proposedFix) lines.push(`- 修复方案: ${issue.proposedFix}`);
    if (issue.regressionTestId) lines.push(`- 回归测试: ${issue.regressionTestId}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * 写 Beta Issues JSON 到指定路径
 */
export function writeBetaIssuesJson(db: BetaIssueDatabase, path: string = join('docs', 'beta-issues.json')): void {
  const dir = path.substring(0, path.lastIndexOf('\\') + 1) || path.substring(0, path.lastIndexOf('/') + 1);
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(db, null, 2), 'utf-8');
}

/**
 * 默认 Beta Issues(Phase 9 范围示例,基于 known-issues.json)
 */
export function getDefaultBetaIssues(): BetaIssue[] {
  return [
    createBetaIssue({
      id: 'BI-001',
      title: 'Phase 6 Debug Panel 未挂载生产 UI',
      description: '开发模式可访问 Debug Panel,生产构建不挂载。',
      buildVersion: '0.9.0-rc1',
      category: 'ui',
      reproductionSteps: [
        'npm run dev',
        '打开主页',
        '检查 Debug 入口',
      ],
      expectedResult: '生产构建无 Debug 入口',
      actualResult: '开发模式可访问,生产不挂载,符合 SPEC §5.2',
      rootCause: 'isDebugEnabled() 在 production 返回 false',
      proposedFix: '保留当前行为,无需修复',
      severity: 'polish',
      status: 'verified',
      releaseTarget: 'post-1.0',
    }),
    createBetaIssue({
      id: 'BI-002',
      title: '持久化层 UI 未完整实现',
      description: 'Save Portability 工具函数已就绪,但 UI 按钮未挂载',
      buildVersion: '0.9.0-rc1',
      category: 'ui',
      reproductionSteps: [
        '新建战役',
        '查找"导出存档"按钮',
      ],
      expectedResult: '主入口有"导入/导出"按钮',
      actualResult: '工具函数可用,UI 未挂载',
      rootCause: 'Phase 9 范围专注工具,UI 集成在 1.0.1',
      proposedFix: '1.0.1 补 Save/Load UI',
      severity: 'minor',
      status: 'deferred',
      releaseTarget: 'post-1.0',
    }),
    createBetaIssue({
      id: 'BI-003',
      title: 'PWA 启动图标 PNG 缺失',
      description: 'manifest 引用 icon-192.png / icon-512.png,目前只有 SVG',
      buildVersion: '0.9.0-rc1',
      category: 'pwa',
      reproductionSteps: [
        'PWA 安装',
        '查看启动画面',
      ],
      expectedResult: 'PNG 图标显示',
      actualResult: '降级到 SVG',
      rootCause: '需要 ImageMagick/sharp 生成',
      proposedFix: 'v1.0.1 生成 PNG',
      severity: 'minor',
      status: 'deferred',
      releaseTarget: 'post-1.0',
    }),
  ];
}
