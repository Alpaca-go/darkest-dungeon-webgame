/**
 * Phase 9G: Beta Issue 管理(SPEC §16-§18)
 *
 * 验收:
 * - createBetaIssue:包含 16 个核心字段
 * - updateIssueStatus:状态变更 + updatedAt
 * - escalateSeverity:升级到下一级
 * - triageIssues:按严重度排序 + 5 维度统计
 * - renderTriageReport:Markdown 报告含全部信息
 * - getDefaultBetaIssues:至少 3 条示例
 * - 自动生成 docs/beta-issues.json + docs/beta-triage-report.md
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createBetaIssue,
  updateIssueStatus,
  escalateSeverity,
  triageIssues,
  renderTriageReport,
  writeBetaIssuesJson,
  getDefaultBetaIssues,
  defaultReleaseTarget,
  type BetaIssue,
  type IssueSeverity,
} from '../src/tools/beta-issues.js';

const DOCS_DIR = 'docs';
const ISSUES_JSON = join(DOCS_DIR, 'beta-issues.json');
const TRIAGE_MD = join(DOCS_DIR, 'beta-triage-report.md');

describe('Phase 9G: Beta Issue 数据结构(SPEC §16)', () => {
  it('createBetaIssue 包含 16 个核心字段', () => {
    const issue = createBetaIssue({
      id: 'BI-TEST',
      title: 'Test',
      buildVersion: '0.9.0-rc1',
      category: 'rules',
    });
    expect(issue.id).toBe('BI-TEST');
    expect(issue.title).toBe('Test');
    expect(issue.buildVersion).toBe('0.9.0-rc1');
    expect(issue.category).toBe('rules');
    expect(issue.severity).toBe('minor');
    expect(issue.status).toBe('reported');
    expect(issue.releaseTarget).toBe('post-1.0');
    expect(Array.isArray(issue.sourceTesterIds)).toBe(true);
    expect(Array.isArray(issue.reproductionSteps)).toBe(true);
    expect(typeof issue.description).toBe('string');
    expect(typeof issue.expectedResult).toBe('string');
    expect(typeof issue.actualResult).toBe('string');
    expect(typeof issue.createdAt).toBe('string');
    expect(typeof issue.updatedAt).toBe('string');
  });
});

describe('Phase 9G: 状态变更 + 严重度升级', () => {
  it('updateIssueStatus:状态变更 + updatedAt 更新', () => {
    const issue = createBetaIssue({
      id: 'BI-X',
      title: 'X',
      buildVersion: '0.9.0-rc1',
      category: 'rules',
    });
    const updated = updateIssueStatus(issue, 'triaged', '修复方案');
    expect(updated.status).toBe('triaged');
    expect(updated.proposedFix).toBe('修复方案');
  });

  it('escalateSeverity:minor → major', () => {
    const issue = createBetaIssue({
      id: 'BI-Y',
      title: 'Y',
      buildVersion: '0.9.0-rc1',
      category: 'rules',
      severity: 'minor',
    });
    const escalated = escalateSeverity(issue);
    expect(SEVERITY_RANK[escalated.severity]).toBeGreaterThan(SEVERITY_RANK[issue.severity]);
  });

  it('escalateSeverity:blocker 已顶级,保持', () => {
    const issue = createBetaIssue({
      id: 'BI-Z',
      title: 'Z',
      buildVersion: '0.9.0-rc1',
      category: 'rules',
      severity: 'blocker',
    });
    const escalated = escalateSeverity(issue);
    expect(escalated.severity).toBe('blocker');
  });
});

describe('Phase 9G: Triage 报告', () => {
  let issues: BetaIssue[];

  beforeAll(() => {
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
    issues = getDefaultBetaIssues();
    const db = triageIssues(issues);
    writeBetaIssuesJson(db, ISSUES_JSON);
    writeFileSync(TRIAGE_MD, renderTriageReport(db), 'utf-8');
  });

  it('triageIssues 5 维度统计', () => {
    const db = triageIssues(issues);
    expect(db.bySeverity).toHaveProperty('blocker');
    expect(db.bySeverity).toHaveProperty('critical');
    expect(db.bySeverity).toHaveProperty('major');
    expect(db.bySeverity).toHaveProperty('minor');
    expect(db.bySeverity).toHaveProperty('polish');
    expect(db.byStatus).toHaveProperty('reported');
    expect(db.byStatus).toHaveProperty('fixed');
    expect(db.byReleaseTarget).toHaveProperty('rc2');
    expect(db.byReleaseTarget).toHaveProperty('1.0');
    expect(db.byReleaseTarget).toHaveProperty('post-1.0');
  });

  it('triageIssues 按严重度降序排序', () => {
    const db = triageIssues(issues);
    const ranks = db.issues.map((i) => SEVERITY_RANK[i.severity]);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i - 1]).toBeGreaterThanOrEqual(ranks[i]);
    }
  });

  it('renderTriageReport:包含严重度分布 + 状态 + Release Target', () => {
    const db = triageIssues(issues);
    const md = renderTriageReport(db);
    expect(md).toContain('## 严重度分布');
    expect(md).toContain('## 状态分布');
    expect(md).toContain('## 发布目标分布');
    expect(md).toContain('Blocker:');
  });

  it('getDefaultBetaIssues:至少 3 条示例', () => {
    const list = getDefaultBetaIssues();
    expect(list.length).toBeGreaterThanOrEqual(3);
  });

  it('默认 release target:blocker/critical → rc2', () => {
    expect(defaultReleaseTarget('blocker')).toBe('rc2');
    expect(defaultReleaseTarget('critical')).toBe('rc2');
  });

  it('默认 release target:major → 1.0', () => {
    expect(defaultReleaseTarget('major')).toBe('1.0');
  });

  it('默认 release target:minor/polish → post-1.0', () => {
    expect(defaultReleaseTarget('minor')).toBe('post-1.0');
    expect(defaultReleaseTarget('polish')).toBe('post-1.0');
  });

  it('生成 docs/beta-issues.json + docs/beta-triage-report.md', () => {
    expect(existsSync(ISSUES_JSON)).toBe(true);
    expect(existsSync(TRIAGE_MD)).toBe(true);
  });

  it('beta-issues.json 是有效 JSON', () => {
    const json = readFileSync(ISSUES_JSON, 'utf-8');
    const parsed = JSON.parse(json);
    expect(parsed.totalIssues).toBeGreaterThan(0);
    expect(Array.isArray(parsed.issues)).toBe(true);
  });
});

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  blocker: 5, critical: 4, major: 3, minor: 2, polish: 1,
};
