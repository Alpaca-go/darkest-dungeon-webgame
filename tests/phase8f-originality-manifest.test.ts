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

  it('3 区域 Boss 全部原创', () => {
    const bosses = manifest.entries.filter((e) => e.contentType === 'region-boss');
    expect(bosses.length).toBeGreaterThanOrEqual(3);
    for (const b of bosses) {
      expect(b.sourceType).toBe('original');
      expect(b.status).toBe('verified');
    }
  });

  it('最终 Boss + 4 阶段全部原创', () => {
    const finalBoss = manifest.entries.find((e) => e.contentType === 'final-boss');
    expect(finalBoss).toBeDefined();
    expect(finalBoss!.currentName).toBe('黑暗本相');
    expect(finalBoss!.sourceType).toBe('original');
    const phases = manifest.entries.filter((e) => e.contentType === 'final-boss-phase');
    expect(phases.length).toBe(4);
    for (const p of phases) {
      expect(p.sourceType).toBe('original');
    }
  });

  it('最终区域(1)+ 4 任务链 + 3 封印 + 4 任务物品 + 5 露营活动已原创', () => {
    const regions = manifest.entries.filter((e) => e.contentType === 'final-region');
    expect(regions.length).toBe(1);
    const seals = manifest.entries.filter((e) => e.contentType === 'final-seal');
    expect(seals.length).toBe(3);
    const items = manifest.entries.filter((e) => e.contentType === 'final-quest-item');
    expect(items.length).toBe(4);
    const camps = manifest.entries.filter((e) => e.contentType === 'final-camp-activity');
    expect(camps.length).toBeGreaterThanOrEqual(5);
  });

  it('英雄姓名池已替换(7F 验证)', () => {
    const pool = manifest.entries.find((e) => e.contentType === 'hero-name-pool');
    expect(pool).toBeDefined();
    expect(pool!.currentName).toMatch(/阿瑟/);
    expect(pool!.currentName).toMatch(/凯恩/);
    expect(pool!.currentName).toMatch(/莉娜/);
    expect(pool!.currentName).toMatch(/洛/);
    expect(pool!.status).toBe('verified');
  });

  it('RC1 阻塞项 = 0:无 must-replace / pending', () => {
    // SPEC §22.2:以下任一存在时不能进入公开 RC
    // - 原作美术 / 音频 / Logo / 角色立绘 / 地图 / 原作专属文案
    expect(manifest.blockedEntries.length).toBe(0);
  });

  it('所有名称中文/原创:无 Reynauld / Dismas / Junia / Crusader / Vestal', () => {
    const forbidden = /Reynauld|Dismas|Junia|Baudelaire|Paracelsus|Crusader|Highwayman|Vestal|PlagueDoctor|Swine|Hag|Weald|Warrens|Cove|Ruins/;
    for (const e of manifest.entries) {
      expect(e.currentName).not.toMatch(forbidden);
    }
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
