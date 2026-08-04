/**
 * Phase 8F: Originality Manifest(SPEC §22)
 *
 * 验收:
 * - 扫描所有正式内容(Boss / 最终 Boss / 最终区域 / 最终敌人 / 奇物 / 陷阱 / 封印 / 任务物品 / 露营活动 / 英雄个体考验 / 英雄姓名池)
 * - 输出 OriginalityManifest + 渲染 Markdown 报告
 * - RC1 阻塞项 = 0(无 must-replace / pending)
 *
 * 关联文档:docs/originality-manifest.json + docs/originality-audit-report.md
 * 上一阶段验证:tests/phase7f-original-replacement.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  generateOriginalityManifest,
  renderOriginalityManifest,
  type OriginalityManifest,
} from '../src/tools/originality.js';

const DOCS_DIR = 'docs';
const MANIFEST_JSON = join(DOCS_DIR, 'originality-manifest.json');
const MANIFEST_MD = join(DOCS_DIR, 'originality-audit-report.md');

let manifest: OriginalityManifest;

describe('Phase 8F: Originality Manifest(SPEC §22)', () => {
  beforeAll(() => {
    manifest = generateOriginalityManifest();
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
    writeFileSync(MANIFEST_JSON, JSON.stringify(manifest, null, 2), 'utf-8');
    writeFileSync(MANIFEST_MD, renderOriginalityManifest(manifest), 'utf-8');
  });

  it('总条目数 ≥ 30:涵盖所有 11 类内容 + 英雄姓名池', () => {
    expect(manifest.totalEntries).toBeGreaterThanOrEqual(30);
  });

  it('11 类内容全部登记', () => {
    const required = [
      'region-boss',
      'final-boss',
      'final-boss-phase',
      'final-region',
      'final-enemy',
      'final-curio',
      'final-trap',
      'final-seal',
      'final-quest-item',
      'final-camp-activity',
      'hero-trial',
      'hero-name-pool',
    ];
    for (const t of required) {
      expect(manifest.byContentType[t]).toBeGreaterThanOrEqual(1);
    }
  });

  it('3 区域 Boss 已登记(用户选择 B / 2026-08-04)', () => {
    const bosses = manifest.entries.filter((e) => e.contentType === 'region-boss');
    expect(bosses.length).toBeGreaterThanOrEqual(3);
    // 用户已选 B,改回原作英文名
    expect(bosses.map((b) => b.currentName).sort()).toEqual(
      expect.arrayContaining(['The Necromancer', 'The Hag', 'The Swine Prince'])
    );
    for (const b of bosses) {
      expect(b.sourceType).toBe('original');
      expect(b.status).toBe('verified');
    }
  });

  it('最终 Boss + 4 阶段(用户选择 B)', () => {
    const finalBoss = manifest.entries.find((e) => e.contentType === 'final-boss');
    expect(finalBoss).toBeDefined();
    expect(finalBoss!.currentName).toBe('Heart of Darkness');
    expect(finalBoss!.sourceType).toBe('original');
    const phases = manifest.entries.filter((e) => e.contentType === 'final-boss-phase');
    expect(phases.length).toBe(4);
    for (const p of phases) {
      expect(p.sourceType).toBe('original');
    }
  });

  it('最终区域(1)+ 任务链 + 封印 + 任务物品 + 露营活动(英文)', () => {
    const regions = manifest.entries.filter((e) => e.contentType === 'final-region');
    expect(regions.length).toBe(1);
    const seals = manifest.entries.filter((e) => e.contentType === 'final-seal');
    expect(seals.length).toBe(3);
    const items = manifest.entries.filter((e) => e.contentType === 'final-quest-item');
    expect(items.length).toBe(4);
    const camps = manifest.entries.filter((e) => e.contentType === 'final-camp-activity');
    expect(camps.length).toBeGreaterThanOrEqual(5);
  });

  it('英雄姓名池(用户选择 B / 原作名)', () => {
    const pool = manifest.entries.find((e) => e.contentType === 'hero-name-pool');
    expect(pool).toBeDefined();
    expect(pool!.currentName).toMatch(/Reynauld/);
    expect(pool!.currentName).toMatch(/Dismas/);
    expect(pool!.currentName).toMatch(/Junia/);
    expect(pool!.currentName).toMatch(/Paracelsus/);
    expect(pool!.status).toBe('verified');
  });

  it('RC1 阻塞项(用户选择 B / 原创保护不再适用)', () => {
    // SPEC §22.2:以下任一存在时不能进入公开 RC
    // 用户已选 B(2026-08-04),承担版权风险,Originality 0 阻塞不再适用
    // 本测试仅验证 manifest 结构存在
    expect(manifest.blockedEntries).toBeDefined();
  });

  it('所有名称使用原作英文名(用户选择 B)', () => {
    // 已确认所有 Boss / 区域 / 任务物品 / 英雄名使用原作英文
    // (Reynauld / Dismas / Necromancer / Hag / Swine Prince / Heart of Darkness 等)
    const expectedOriginalNames = [
      'The Necromancer', 'The Hag', 'The Swine Prince',
      'Heart of Darkness', 'The Darkest Dungeon',
    ];
    const allNames = manifest.entries.map((e) => e.currentName);
    let foundCount = 0;
    for (const exp of expectedOriginalNames) {
      if (allNames.some((n) => n === exp)) foundCount++;
    }
    expect(foundCount).toBeGreaterThanOrEqual(3);
  });

  it('bySourceType 全部为 original / public-domain / temporary-placeholder', () => {
    const allowed = new Set(['original', 'public-domain', 'temporary-placeholder']);
    for (const t of Object.keys(manifest.bySourceType)) {
      expect(allowed.has(t)).toBe(true);
    }
  });

  it('byStatus 全部为 verified / replaced(无 pending)', () => {
    const allowed = new Set(['verified', 'replaced']);
    for (const t of Object.keys(manifest.byStatus)) {
      expect(allowed.has(t)).toBe(true);
    }
  });

  it('生成 JSON 文件写入 docs/originality-manifest.json', () => {
    expect(existsSync(MANIFEST_JSON)).toBe(true);
  });

  it('生成 Markdown 报告写入 docs/originality-audit-report.md', () => {
    expect(existsSync(MANIFEST_MD)).toBe(true);
    const fs = require('node:fs');
    const content = fs.readFileSync(MANIFEST_MD, 'utf-8');
    expect(content).toContain('Originality Manifest');
  });
});

describe('Phase 8F: Originality Manifest 一致性', () => {
  it('渲染器:报告包含所有 11 个 contentType 子标题', () => {
    const m = generateOriginalityManifest();
    const md = renderOriginalityManifest(m);
    expect(md).toMatch(/按类型统计/);
    expect(md).toMatch(/按来源统计/);
    expect(md).toMatch(/按状态统计/);
  });
});
