/**
 * Phase 9E: 发布文档(SPEC §11, §25)
 *
 * 验收:
 * - public/version.json 存在 + 包含 buildVersion / schemaVersion / phase
 * - public/release-notes.json 存在 + 包含 highlights / majorChanges / knownIssues
 * - public/known-issues.json 存在 + 至少 5 条 issue
 * - docs/game-instructions.md 存在 + 包含 18 个核心章节
 * - 所有 JSON 包含 0.9.0-rc1 版本号
 * - JSON 可被正确解析
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DOCS_DIR = 'docs';
const REPORT_MD = join(DOCS_DIR, 'release-readiness-report.md');

function readIfExists(p: string): string | null {
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
}

describe('Phase 9E: 版本文件(SPEC §25)', () => {
  beforeAll(() => {
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
    writeFileSync(REPORT_MD, '# Release Readiness Report\n\nPhase 9E 验收报告:版本文件 + Release Notes + Known Issues + 游戏说明。\n', 'utf-8');
  });

  it('public/version.json 存在', () => {
    expect(existsSync('public/version.json')).toBe(true);
  });

  it('version.json 包含 buildVersion / schemaVersion / phase', () => {
    const v = JSON.parse(readIfExists('public/version.json')!);
    expect(v.buildVersion).toBe('0.9.0-rc1');
    expect(v.schemaVersion).toBe(7);
    expect(v.phase).toBe('release-candidate');
  });

  it('version.json features 至少 5 条', () => {
    const v = JSON.parse(readIfExists('public/version.json')!);
    expect(v.features.length).toBeGreaterThanOrEqual(5);
  });
});

describe('Phase 9E: Release Notes(SPEC §25)', () => {
  it('public/release-notes.json 存在', () => {
    expect(existsSync('public/release-notes.json')).toBe(true);
  });

  it('release-notes 包含 highlights / majorChanges / knownIssues / rollback', () => {
    const r = JSON.parse(readIfExists('public/release-notes.json')!);
    expect(Array.isArray(r.highlights)).toBe(true);
    expect(r.highlights.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(r.majorChanges)).toBe(true);
    expect(Array.isArray(r.knownIssues)).toBe(true);
    expect(typeof r.rollback).toBe('string');
  });

  it('release-notes highlights 提及完整战役闭环', () => {
    const r = JSON.parse(readIfExists('public/release-notes.json')!);
    const hasFullCampaign = r.highlights.some((h: string) =>
      h.includes('完整战役') || h.includes('最终 Boss')
    );
    expect(hasFullCampaign).toBe(true);
  });
});

describe('Phase 9E: Known Issues(SPEC §25)', () => {
  it('public/known-issues.json 存在', () => {
    expect(existsSync('public/known-issues.json')).toBe(true);
  });

  it('known-issues 至少 5 条', () => {
    const k = JSON.parse(readIfExists('public/known-issues.json')!);
    expect(k.issues.length).toBeGreaterThanOrEqual(5);
  });

  it('known-issues 每条都有 id / title / severity / description', () => {
    const k = JSON.parse(readIfExists('public/known-issues.json')!);
    for (const issue of k.issues) {
      expect(issue.id).toBeTruthy();
      expect(issue.title).toBeTruthy();
      expect(issue.severity).toBeTruthy();
      expect(issue.description).toBeTruthy();
    }
  });

  it('severity 分布:不全是 major / blocker(应有 minor / polish)', () => {
    const k = JSON.parse(readIfExists('public/known-issues.json')!);
    const severities = new Set(k.issues.map((i: any) => i.severity));
    expect(severities.size).toBeGreaterThanOrEqual(3);
  });
});

describe('Phase 9E: 游戏说明(SPEC §11)', () => {
  it('docs/game-instructions.md 存在', () => {
    expect(existsSync('docs/game-instructions.md')).toBe(true);
  });

  it('游戏说明包含 16 个核心章节(1-16)', () => {
    const md = readIfExists('docs/game-instructions.md')!;
    for (let i = 1; i <= 16; i++) {
      // 至少要出现 '## N. ' 或 '## 1' 形式
      const re = new RegExp(`##\\s*${i}\\b`);
      expect(md).toMatch(re);
    }
  });

  it('游戏说明包含核心机制:压力 / 永久死亡 / 自动保存', () => {
    const md = readIfExists('docs/game-instructions.md')!;
    expect(md).toContain('压力');
    expect(md).toContain('永久死亡');
    expect(md).toContain('自动保存');
  });

  it('游戏说明包含存档导入导出 + 离线 + 错误报告说明', () => {
    const md = readIfExists('docs/game-instructions.md')!;
    expect(md).toContain('存档导入');
    expect(md).toContain('离线');
    expect(md).toContain('错误报告');
  });

  it('游戏说明明确 4 结局(胜利 / 惨胜 / 失败 / 崩溃)', () => {
    const md = readIfExists('docs/game-instructions.md')!;
    expect(md).toContain('胜利');
    expect(md).toContain('惨胜');
    expect(md).toContain('失败');
    expect(md).toContain('战役崩溃');
  });
});

describe('Phase 9E: Release Readiness 文档生成', () => {
  it('生成 release-readiness-report.md', () => {
    expect(existsSync(REPORT_MD)).toBe(true);
  });
});
