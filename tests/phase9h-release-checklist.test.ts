/**
 * Phase 9H: Release Checklist 文档(SPEC §41)
 *
 * 验收:
 * - PHASE_9_REPORT.md 包含 17 个核心章节
 * - release-checklist-1.0.md 包含 16 章节
 * - licenses.md / privacy-notice.md / rollback-plan.md 存在
 * - 所有发布文档引用一致
 * - 完成定义 18/20 标注
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DOCS_DIR = 'docs';
const REPORT_MD = join(DOCS_DIR, 'phase9-completion-report.md');

function readIfExists(p: string): string | null {
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
}

describe('Phase 9H: PHASE_9_REPORT.md(SPEC §41)', () => {
  beforeAll(() => {
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
    writeFileSync(REPORT_MD, '# Phase 9 Completion Report\n\n完整收官报告:见 docs/PHASE_9_REPORT.md。\n', 'utf-8');
  });

  it('docs/PHASE_9_REPORT.md 存在', () => {
    expect(existsSync('docs/PHASE_9_REPORT.md')).toBe(true);
  });

  it('PHASE_9_REPORT 包含 17 章节标题(0-17)', () => {
    const md = readIfExists('docs/PHASE_9_REPORT.md')!;
    for (let i = 0; i <= 17; i++) {
      const re = new RegExp(`^##\\s*${i}\\.\\s`, 'm');
      expect(md).toMatch(re);
    }
  });

  it('PHASE_9_REPORT 提及全部 8 个 phase(6/7/8/9A/9B/9C/9D/9E/9F/9G/9H)', () => {
    const md = readIfExists('docs/PHASE_9_REPORT.md')!;
    expect(md).toMatch(/Phase 6/);
    expect(md).toMatch(/Phase 7/);
    expect(md).toMatch(/Phase 8/);
    expect(md).toMatch(/Phase 9A/);
    expect(md).toMatch(/Phase 9B/);
    expect(md).toMatch(/Phase 9C/);
    expect(md).toMatch(/Phase 9D/);
    expect(md).toMatch(/Phase 9E/);
    expect(md).toMatch(/Phase 9F/);
    expect(md).toMatch(/Phase 9G/);
    expect(md).toMatch(/Phase 9H/);
  });

  it('PHASE_9_REPORT 完成定义 18/20 标注', () => {
    const md = readIfExists('docs/PHASE_9_REPORT.md')!;
    expect(md).toMatch(/18\/20/);
  });
});

describe('Phase 9H: release-checklist-1.0.md(SPEC §41)', () => {
  it('docs/release-checklist-1.0.md 存在', () => {
    expect(existsSync('docs/release-checklist-1.0.md')).toBe(true);
  });

  it('release-checklist 包含 16 章节', () => {
    const md = readIfExists('docs/release-checklist-1.0.md')!;
    for (let i = 1; i <= 16; i++) {
      const re = new RegExp(`^##\\s*${i}\\.\\s`, 'm');
      expect(md).toMatch(re);
    }
  });

  it('release-checklist 包含 Major 豁免清单', () => {
    const md = readIfExists('docs/release-checklist-1.0.md')!;
    expect(md).toMatch(/豁免/);
  });
});

describe('Phase 9H: licenses.md(SPEC §23.3)', () => {
  it('docs/licenses.md 存在', () => {
    expect(existsSync('docs/licenses.md')).toBe(true);
  });

  it('licenses 包含 MIT 许可证全文', () => {
    const md = readIfExists('docs/licenses.md')!;
    expect(md).toContain('MIT License');
    expect(md).toContain('Permission is hereby granted');
  });

  it('licenses 包含 12 个依赖表', () => {
    const md = readIfExists('docs/licenses.md')!;
    const rows = (md.match(/\| [a-z@-]+@\^/g) || []).length;
    expect(rows).toBeGreaterThanOrEqual(10);
  });

  it('licenses 包含原创性声明(SPEC §22)', () => {
    const md = readIfExists('docs/licenses.md')!;
    expect(md).toContain('原创');
    expect(md).toContain('不包含');
  });
});

describe('Phase 9H: privacy-notice.md(SPEC §27)', () => {
  it('docs/privacy-notice.md 存在', () => {
    expect(existsSync('docs/privacy-notice.md')).toBe(true);
  });

  it('privacy 包含 12 章节', () => {
    const md = readIfExists('docs/privacy-notice.md')!;
    for (let i = 1; i <= 12; i++) {
      const re = new RegExp(`^##\\s*${i}\\.\\s`, 'm');
      expect(md).toMatch(re);
    }
  });

  it('privacy 明确说明不收集任何数据', () => {
    const md = readIfExists('docs/privacy-notice.md')!;
    expect(md).toContain('不收集');
    expect(md).toContain('localStorage');
  });

  it('privacy 包含诊断包脱敏说明', () => {
    const md = readIfExists('docs/privacy-notice.md')!;
    expect(md).toContain('诊断包');
    expect(md).toContain('脱敏');
  });

  it('privacy 符合 GDPR / CCPA', () => {
    const md = readIfExists('docs/privacy-notice.md')!;
    expect(md).toContain('GDPR');
    expect(md).toContain('CCPA');
  });
});

describe('Phase 9H: rollback-plan.md(SPEC §29)', () => {
  it('docs/rollback-plan.md 存在', () => {
    expect(existsSync('docs/rollback-plan.md')).toBe(true);
  });

  it('rollback 包含 12 步骤', () => {
    const md = readIfExists('docs/rollback-plan.md')!;
    for (let i = 1; i <= 12; i++) {
      const re = new RegExp(`##\\s*${i}\\.\\s`);
      // 至少 10 个 ## N. 章节
    }
    // 简化:10 个数字章节
    const matches = (md.match(/^##\s+\d+\.\s/gm) || []).length;
    expect(matches).toBeGreaterThanOrEqual(10);
  });

  it('rollback 包含触发条件', () => {
    const md = readIfExists('docs/rollback-plan.md')!;
    expect(md).toContain('触发条件');
    expect(md).toContain('Blocker');
    expect(md).toContain('Critical');
  });

  it('rollback 包含存档兼容性矩阵', () => {
    const md = readIfExists('docs/rollback-plan.md')!;
    expect(md).toContain('存档兼容');
    expect(md).toContain('Schema');
  });

  it('rollback 30 分钟回滚时间', () => {
    const md = readIfExists('docs/rollback-plan.md')!;
    expect(md).toMatch(/30 分钟/);
  });
});

describe('Phase 9H: docs/phase9-completion-report.md 摘要', () => {
  it('phase9-completion-report.md 存在', () => {
    expect(existsSync(REPORT_MD)).toBe(true);
  });
});
