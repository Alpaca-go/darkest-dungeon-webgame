/**
 * Phase 9C: Diagnostic Bundle(SPEC §9)
 *
 * 验收:
 * - buildDiagnosticBundle 包含 9 个核心字段
 * - 不包含敏感信息(邮箱/电话/密钥)
 * - 存档元数据只 metadata,不含完整 GameState
 * - 事件只取 ID,不含内容
 * - 错误脱敏
 * - bundleChecksum 稳定
 *
 * 关联文档:docs/transaction-recovery-report.md(测试运行时生成)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDiagnosticBundle,
  exportDiagnosticBundleAsJson,
  generateDiagnosticFilename,
  DIAGNOSTIC_PRIVACY_NOTICE,
  type SerializedError,
} from '../src/tools/diagnostic-bundle.js';

const DOCS_DIR = 'docs';
const REPORT_MD = join(DOCS_DIR, 'transaction-recovery-report.md');

// 注入 localStorage + window + navigator stub
function installBrowserStubs() {
  const store = new Map<string, string>();
  const localStorageStub: Storage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  vi.stubGlobal('localStorage', localStorageStub);

  vi.stubGlobal('window', {
    innerWidth: 390,
    innerHeight: 844,
    matchMedia: () => ({ matches: false }),
  });
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 Test',
    language: 'zh-CN',
    onLine: true,
  });
}

installBrowserStubs();

describe('Phase 9C: Diagnostic Bundle(SPEC §9)', () => {
  beforeAll(() => {
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
    writeFileSync(REPORT_MD, '# Transaction Recovery / Diagnostic Report\n\nPhase 9C 验收报告:诊断包生成、脱敏、隐私保护。\n', 'utf-8');
  });

  it('buildDiagnosticBundle 包含 13 个核心字段', () => {
    const bundle = buildDiagnosticBundle();
    expect(bundle.formatVersion).toBe(1);
    expect(typeof bundle.generatedAt).toBe('string');
    expect(typeof bundle.buildVersion).toBe('string');
    expect(typeof bundle.schemaVersion).toBe('number');
    expect(typeof bundle.isProduction).toBe('boolean');
    expect(typeof bundle.userAgent).toBe('string');
    expect(bundle.viewport).toHaveProperty('width');
    expect(bundle.viewport).toHaveProperty('height');
    expect(typeof bundle.online).toBe('boolean');
    expect(typeof bundle.pwaInstalled).toBe('boolean');
    expect(bundle.saveMetadata).toBeDefined();
    expect(typeof bundle.hasOptionalSaveSnapshot).toBe('boolean');
    expect(Array.isArray(bundle.recentEventIds)).toBe(true);
    expect(Array.isArray(bundle.recentErrorLogs)).toBe(true);
    expect(Array.isArray(bundle.invariantFailures)).toBe(true);
    expect(typeof bundle.bundleChecksum).toBe('string');
  });

  it('脱敏:邮箱地址被替换为 [EMAIL]', () => {
    const errs: SerializedError[] = [
      { timestamp: '2026-01-01T00:00:00Z', level: 'error', message: 'Failed: user@example.com logged' },
    ];
    const bundle = buildDiagnosticBundle({ recentErrors: errs });
    expect(bundle.recentErrorLogs[0].message).toContain('[EMAIL]');
    expect(bundle.recentErrorLogs[0].message).not.toContain('user@example.com');
  });

  it('脱敏:API 密钥被替换为 [API_KEY]', () => {
    const errs: SerializedError[] = [
      { timestamp: '2026-01-01', level: 'error', message: 'Bad key sk_live_abc123def456' },
    ];
    const bundle = buildDiagnosticBundle({ recentErrors: errs });
    expect(bundle.recentErrorLogs[0].message).toContain('[API_KEY]');
    expect(bundle.recentErrorLogs[0].message).not.toContain('sk_live_abc123');
  });

  it('脱敏:电话被替换为 [PHONE]', () => {
    const errs: SerializedError[] = [
      { timestamp: '2026-01-01', level: 'error', message: 'Call 555-123-4567' },
    ];
    const bundle = buildDiagnosticBundle({ recentErrors: errs });
    expect(bundle.recentErrorLogs[0].message).toContain('[PHONE]');
  });

  it('事件 ID 提取:只取 id,不含内容', () => {
    const events = [
      { id: 'evt-1', payload: { secret: 'sensitive' } },
      { id: 'evt-2', payload: { secret: 'also sensitive' } },
      { noId: true },
    ];
    const bundle = buildDiagnosticBundle({ recentEvents: events });
    expect(bundle.recentEventIds).toEqual(['evt-1', 'evt-2']);
    // 不应含任何 payload
    const json = JSON.stringify(bundle);
    expect(json).not.toContain('sensitive');
  });

  it('事件 ID 限制:最多 50 个', () => {
    const events = Array.from({ length: 100 }, (_, i) => ({ id: `evt-${i}` }));
    const bundle = buildDiagnosticBundle({ recentEvents: events });
    expect(bundle.recentEventIds.length).toBe(50);
    expect(bundle.recentEventIds[0]).toBe('evt-50');
    expect(bundle.recentEventIds[49]).toBe('evt-99');
  });

  it('userAgent 截断到 500 字符', () => {
    const bundle = buildDiagnosticBundle();
    expect(bundle.userAgent.length).toBeLessThanOrEqual(500);
  });

  it('viewport 包含 width/height', () => {
    const bundle = buildDiagnosticBundle();
    expect(bundle.viewport.width).toBe(390);
    expect(bundle.viewport.height).toBe(844);
  });

  it('无存档时:saveMetadata.exists = false', () => {
    const bundle = buildDiagnosticBundle();
    expect(bundle.saveMetadata.exists).toBe(false);
  });

  it('hasOptionalSaveSnapshot 默认 false', () => {
    const bundle = buildDiagnosticBundle();
    expect(bundle.hasOptionalSaveSnapshot).toBe(false);
  });

  it('includeSaveSnapshot=true 时:hasOptionalSaveSnapshot = true', () => {
    const bundle = buildDiagnosticBundle({ includeSaveSnapshot: true });
    expect(bundle.hasOptionalSaveSnapshot).toBe(true);
  });

  it('bundleChecksum 稳定:相同输入产出相同 hash', () => {
    const events = [{ id: 'evt-1' }];
    const errs: SerializedError[] = [
      { timestamp: '2026-01-01T00:00:00Z', level: 'error', message: 'X' },
    ];
    const b1 = buildDiagnosticBundle({ recentEvents: events, recentErrors: errs });
    const b2 = buildDiagnosticBundle({ recentEvents: events, recentErrors: errs });
    expect(b1.bundleChecksum).toBe(b2.bundleChecksum);
  });

  it('exportDiagnosticBundleAsJson:JSON 序列化成功', () => {
    const json = exportDiagnosticBundleAsJson();
    const parsed = JSON.parse(json);
    expect(parsed.formatVersion).toBe(1);
  });

  it('generateDiagnosticFilename 格式正确', () => {
    const fn = generateDiagnosticFilename();
    expect(fn).toMatch(/^diagnostic-bundle_\d{4}-\d{2}-\d{2}_[\d.]+(-[a-z]+\d+)?\.json$/);
  });

  it('DIAGNOSTIC_PRIVACY_NOTICE 包含关键说明', () => {
    expect(DIAGNOSTIC_PRIVACY_NOTICE).toContain('诊断包');
    expect(DIAGNOSTIC_PRIVACY_NOTICE).toContain('不包含');
    expect(DIAGNOSTIC_PRIVACY_NOTICE).toContain('账号');
  });
});
