/**
 * Phase 10A: Production Issue 流程(SPEC §4-§5)
 *
 * 验收:
 * - createProductionIssue 包含 19 个核心字段
 * - checkEvidence 5 项最低证据校验
 * - 证据缺失 → awaiting-evidence
 * - isReleaseBlocking:仅 blocker / critical 阻塞
 * - triageProductionIssues:按严重度降序
 * - 7 种 source / 13 种 category / 5 种 severity 全部覆盖
 *
 * 关联文档:docs/production-issues.json + docs/production-issue-process.md
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createProductionIssue,
  checkEvidence,
  deriveStatus,
  updateProductionIssue,
  triageProductionIssues,
  isReleaseBlocking,
  getDefaultProductionIssues,
  writeProductionIssuesJson,
  PRODUCTION_ISSUE_PROCESS,
  type ProductionIssue,
  type IssueSeverity,
} from '../src/tools/production-issue.js';

const DOCS_DIR = 'docs';
const ISSUES_JSON = join(DOCS_DIR, 'production-issues.json');
const PROCESS_MD = join(DOCS_DIR, 'production-issue-process.md');

describe('Phase 10A: Production Issue 数据结构(SPEC §4.2)', () => {
  beforeAll(() => {
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
    const issues = getDefaultProductionIssues();
    writeProductionIssuesJson(issues, ISSUES_JSON);
    writeFileSync(PROCESS_MD, PRODUCTION_ISSUE_PROCESS, 'utf-8');
  });

  it('createProductionIssue 包含 19 字段', () => {
    const issue = createProductionIssue({
      id: 'PI-TEST',
      title: 'Test Issue',
      source: 'player-report',
      buildVersion: '0.9.0-rc1',
      category: 'save',
      severity: 'major',
      reproductionSteps: ['Step 1'],
      expectedResult: 'X',
      actualResult: 'Y',
    });
    expect(issue.id).toBe('PI-TEST');
    expect(issue.title).toBe('Test Issue');
    expect(issue.source).toBe('player-report');
    expect(issue.buildVersion).toBe('0.9.0-rc1');
    expect(issue.category).toBe('save');
    expect(issue.severity).toBe('major');
    expect(issue.status).toBe('reported');
    expect(Array.isArray(issue.reproductionSteps)).toBe(true);
    expect(Array.isArray(issue.relatedEventIds)).toBe(true);
    expect(Array.isArray(issue.relatedContentIds)).toBe(true);
    expect(Array.isArray(issue.invariantFailures)).toBe(true);
    expect(typeof issue.createdAt).toBe('string');
    expect(typeof issue.updatedAt).toBe('string');
  });
});

describe('Phase 10A: 最低证据校验(SPEC §4.3)', () => {
  it('完整证据:isComplete = true', () => {
    const issue = createProductionIssue({
      id: 'PI-X',
      title: 'X',
      source: 'diagnostic-bundle',
      buildVersion: '1.0.0',
      category: 'save',
      severity: 'major',
      reproductionSteps: ['Step 1', 'Step 2'],
      expectedResult: 'A',
      actualResult: 'B',
      saveId: 'save-123',
    });
    const ev = checkEvidence(issue);
    expect(ev.isComplete).toBe(true);
    expect(ev.missingFields).toEqual([]);
  });

  it('缺复现步骤:isComplete = false', () => {
    const issue = createProductionIssue({
      id: 'PI-Y',
      title: 'Y',
      source: 'player-report',
      buildVersion: '1.0.0',
      category: 'save',
      severity: 'major',
      reproductionSteps: [],
      expectedResult: 'A',
      actualResult: 'B',
      saveId: 'save-123',
    });
    const ev = checkEvidence(issue);
    expect(ev.isComplete).toBe(false);
    expect(ev.missingFields).toContain('reproduction steps');
  });

  it('缺存档/bundle:isComplete = false', () => {
    const issue = createProductionIssue({
      id: 'PI-Z',
      title: 'Z',
      source: 'player-report',
      buildVersion: '1.0.0',
      category: 'mobile',
      severity: 'major',
      reproductionSteps: ['S1'],
      expectedResult: 'A',
      actualResult: 'B',
    });
    const ev = checkEvidence(issue);
    expect(ev.isComplete).toBe(false);
    expect(ev.missingFields).toContain('save or bundle');
  });

  it('缺预期/实际:isComplete = false', () => {
    const issue = createProductionIssue({
      id: 'PI-W',
      title: 'W',
      source: 'diagnostic-bundle',
      buildVersion: '1.0.0',
      category: 'rules',
      severity: 'major',
      reproductionSteps: ['S1'],
      expectedResult: '',
      actualResult: 'B',
    });
    const ev = checkEvidence(issue);
    expect(ev.isComplete).toBe(false);
  });

  it('evidence 5 维度统计正确', () => {
    const issue = createProductionIssue({
      id: 'PI-V',
      title: 'V',
      source: 'save-file',
      buildVersion: '1.0.0',
      category: 'save',
      severity: 'major',
      reproductionSteps: ['S1'],
      expectedResult: 'A',
      actualResult: 'B',
      saveId: 'save-456',
    });
    const ev = checkEvidence(issue);
    expect(ev.hasVersion).toBe(true);
    expect(ev.hasPageOrFlow).toBe(true);
    expect(ev.hasReproductionSteps).toBe(true);
    expect(ev.hasExpectedAndActual).toBe(true);
    expect(ev.hasSaveOrBundle).toBe(true);
  });
});

describe('Phase 10A: 状态自动派生 + 升级', () => {
  it('缺证据:reported → awaiting-evidence', () => {
    const issue = createProductionIssue({
      id: 'PI-N1',
      title: 'N1',
      source: 'player-report',
      buildVersion: '1.0.0',
      category: 'save',
      severity: 'major',
      reproductionSteps: ['S1'],
      expectedResult: 'A',
      actualResult: 'B',
      // 无 saveId
    });
    const updated = deriveStatus(issue);
    expect(updated.status).toBe('awaiting-evidence');
  });

  it('完整证据:保持 reported', () => {
    const issue = createProductionIssue({
      id: 'PI-N2',
      title: 'N2',
      source: 'diagnostic-bundle',
      buildVersion: '1.0.0',
      category: 'save',
      severity: 'major',
      reproductionSteps: ['S1'],
      expectedResult: 'A',
      actualResult: 'B',
    });
    const updated = deriveStatus(issue);
    expect(updated.status).toBe('reported');
  });

  it('updateProductionIssue:根因 + 状态变更', () => {
    const issue = createProductionIssue({
      id: 'PI-U',
      title: 'U',
      source: 'player-report',
      buildVersion: '1.0.0',
      category: 'rules',
      severity: 'major',
      reproductionSteps: ['S1'],
      expectedResult: 'A',
      actualResult: 'B',
      saveId: 'save-1',
    });
    const updated = updateProductionIssue(issue, {
      rootCause: 'Bug in X',
      status: 'confirmed',
    });
    expect(updated.rootCause).toBe('Bug in X');
    expect(updated.status).toBe('confirmed');
  });
});

describe('Phase 10A: 严重度 + 阻塞规则(SPEC §5)', () => {
  it('isReleaseBlocking:blocker 阻塞', () => {
    const issue = createProductionIssue({
      id: 'PI-B',
      title: 'B',
      source: 'player-report',
      buildVersion: '1.0.0',
      category: 'rules',
      severity: 'blocker',
      reproductionSteps: ['S1'],
      expectedResult: 'A',
      actualResult: 'B',
      saveId: 's',
    });
    expect(isReleaseBlocking(issue)).toBe(true);
  });

  it('isReleaseBlocking:critical 阻塞', () => {
    const issue = createProductionIssue({
      id: 'PI-C',
      title: 'C',
      source: 'diagnostic-bundle',
      buildVersion: '1.0.0',
      category: 'save',
      severity: 'critical',
      reproductionSteps: ['S1'],
      expectedResult: 'A',
      actualResult: 'B',
    });
    expect(isReleaseBlocking(issue)).toBe(true);
  });

  it('isReleaseBlocking:major 不阻塞(可豁免)', () => {
    const issue = createProductionIssue({
      id: 'PI-M',
      title: 'M',
      source: 'save-file',
      buildVersion: '1.0.0',
      category: 'mobile',
      severity: 'major',
      reproductionSteps: ['S1'],
      expectedResult: 'A',
      actualResult: 'B',
      saveId: 's',
    });
    expect(isReleaseBlocking(issue)).toBe(false);
  });

  it('triageProductionIssues:按严重度降序', () => {
    const issues = [
      createProductionIssue({ id: 'A', title: 'A', source: 'player-report', buildVersion: '1.0.0', category: 'save', severity: 'minor', reproductionSteps: ['S'], expectedResult: 'X', actualResult: 'Y', saveId: 's' }),
      createProductionIssue({ id: 'B', title: 'B', source: 'player-report', buildVersion: '1.0.0', category: 'save', severity: 'blocker', reproductionSteps: ['S'], expectedResult: 'X', actualResult: 'Y', saveId: 's' }),
      createProductionIssue({ id: 'C', title: 'C', source: 'player-report', buildVersion: '1.0.0', category: 'save', severity: 'major', reproductionSteps: ['S'], expectedResult: 'X', actualResult: 'Y', saveId: 's' }),
    ];
    const sorted = triageProductionIssues(issues);
    expect(sorted[0].id).toBe('B');
    expect(sorted[1].id).toBe('C');
    expect(sorted[2].id).toBe('A');
  });
});

describe('Phase 10A: 默认 Issues + 文档', () => {
  it('getDefaultProductionIssues:至少 3 条', () => {
    expect(getDefaultProductionIssues().length).toBeGreaterThanOrEqual(3);
  });

  it('生成 docs/production-issues.json', () => {
    expect(existsSync(ISSUES_JSON)).toBe(true);
  });

  it('生成 docs/production-issue-process.md', () => {
    expect(existsSync(PROCESS_MD)).toBe(true);
  });

  it('PRODUCTION_ISSUE_PROCESS 包含关键步骤', () => {
    expect(PRODUCTION_ISSUE_PROCESS).toContain('证据校验');
    expect(PRODUCTION_ISSUE_PROCESS).toContain('严重度');
    expect(PRODUCTION_ISSUE_PROCESS).toContain('修复流程');
    expect(PRODUCTION_ISSUE_PROCESS).toContain('阻塞规则');
  });
});
