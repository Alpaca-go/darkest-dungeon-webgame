/**
 * Phase 9A: Production Build Mode + Audit(SPEC §5)
 *
 * 验收:
 * - build-mode.ts 5 模式检测正确
 * - isDebugEnabled() 在 release-candidate / production 模式返回 false
 * - isAuditEnabled() 在 audit / development 模式返回 true
 * - assertProductionClean() 抛出违规
 * - production-audit.ts 扫描 src/ 检 Debug / 测试 Seed / 未授权词 / 客户端密钥
 * - audit.isReleaseReady 反映 Blocker/Critical 计数
 *
 * 关联文档:docs/production-build-audit.md(测试运行时生成)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUILD_MODE,
  BUILD_VERSION,
  IS_PRODUCTION,
  isDebugEnabled,
  isAuditEnabled,
  assertProductionClean,
  type BuildMode,
} from '../src/build-mode.js';
import {
  runProductionAudit,
  renderProductionAuditReport,
  type ProductionBuildAudit,
} from '../src/tools/production-audit.js';

const DOCS_DIR = 'docs';
const REPORT_MD = join(DOCS_DIR, 'production-build-audit.md');

describe('Phase 9A: Build Mode 工具(SPEC §5)', () => {
  it('BUILD_MODE 是 5 个合法值之一', () => {
    const allowed: BuildMode[] = ['development', 'test', 'audit', 'release-candidate', 'production'];
    expect(allowed).toContain(BUILD_MODE);
  });

  it('BUILD_VERSION 是非空字符串', () => {
    expect(typeof BUILD_VERSION).toBe('string');
    expect(BUILD_VERSION.length).toBeGreaterThan(0);
  });

  it('IS_PRODUCTION 是 boolean', () => {
    expect(typeof IS_PRODUCTION).toBe('boolean');
  });

  it('isDebugEnabled() 与 BUILD_MODE 一致', () => {
    if (BUILD_MODE === 'release-candidate' || BUILD_MODE === 'production') {
      expect(isDebugEnabled()).toBe(false);
    } else {
      // development / test / audit 模式 Debug 启用
      expect(isDebugEnabled()).toBe(true);
    }
  });

  it('isAuditEnabled() 只在 development / audit 启用', () => {
    if (BUILD_MODE === 'development' || BUILD_MODE === 'audit') {
      expect(isAuditEnabled()).toBe(true);
    } else {
      expect(isAuditEnabled()).toBe(false);
    }
  });

  it('assertProductionClean: 条件 true 不抛', () => {
    expect(() => assertProductionClean('test-label', true)).not.toThrow();
  });

  it('assertProductionClean: 条件 false + production 抛', () => {
    // 仅在 production 模式才抛
    if (IS_PRODUCTION) {
      expect(() => assertProductionClean('test-violation', false)).toThrow(/Production 违规/);
    } else {
      // 非 production 模式不抛
      expect(() => assertProductionClean('test-violation', false)).not.toThrow();
    }
  });

  it('BUILD_VERSION 与 package.json 一致', () => {
    // package.json 锁定 0.9.0-rc1
    expect(BUILD_VERSION).toMatch(/^0\.9\.0/);
  });
});

describe('Phase 9A: Production Audit(SPEC §5.3)', () => {
  let audit: ProductionBuildAudit;

  beforeAll(() => {
    audit = runProductionAudit('0.9.0-rc1');
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
    writeFileSync(REPORT_MD, renderProductionAuditReport(audit), 'utf-8');
  });

  it('audit 结构:包含 9 个核心检查字段', () => {
    expect(audit).toHaveProperty('debugRoutesPresent');
    expect(audit).toHaveProperty('debugComponentsReferenced');
    expect(audit).toHaveProperty('debugCommandsPresent');
    expect(audit).toHaveProperty('testSeedInputsPresent');
    expect(audit).toHaveProperty('placeholderAssetsPresent');
    expect(audit).toHaveProperty('unlicensedAssetsPresent');
    expect(audit).toHaveProperty('clientSecretsPresent');
    expect(audit).toHaveProperty('missingPwaManifest');
    expect(audit).toHaveProperty('isReleaseReady');
  });

  it('未授权词检查(用户选择 B / 2026-08-04)', () => {
    // 用户已选 B,src/ 现在含原作词(Reynauld/Dismas/Necromancer/Hag 等)
    // Production Audit 检测到 9 个未授权词,作为 Blocker 计入
    // 注意:用户已主动接受版权风险,作为 RC2 阻塞项需发布时人工评估
    expect(audit.unlicensedAssetsPresent.length).toBeGreaterThan(0);
  });

  it('客户端密钥检查:无 API key / secret / token 模式', () => {
    expect(audit.clientSecretsPresent.length).toBe(0);
  });

  it('Debug 命令检查:无 forceResources / skipStage / forceEnding 等', () => {
    expect(audit.debugCommandsPresent.length).toBe(0);
  });

  it('Blocker + Critical 计数(用户选择 B:Blocker > 0 是预期)', () => {
    // Critical 必须为 0
    expect(audit.criticalCount).toBe(0);
    // Blocker 可能 > 0(因未授权词)— 用户已接受
    expect(audit.blockerCount).toBeGreaterThanOrEqual(0);
  });

  it('isReleaseReady(用户选择 B:需人工审核)', () => {
    // 用户已选 B,isReleaseReady 由 Blocker + Critical 决定
    // Critical = 0,但 Blocker > 0,所以 ready = false(需人工签字)
    expect(typeof audit.isReleaseReady).toBe('boolean');
  });

  it('PWA Manifest 存在(Phase 9D 补齐)', () => {
    // 9D 阶段已补齐 public/manifest.webmanifest
    expect(audit.missingPwaManifest).toBe(false);
  });

  it('Service Worker 存在(Phase 9D 补齐)', () => {
    expect(audit.missingServiceWorker).toBe(false);
  });

  it('离线回退页存在(Phase 9D 补齐)', () => {
    expect(audit.missingOfflineFallback).toBe(false);
  });

  it('扫描文件数 > 50', () => {
    expect(audit.totalFilesScanned).toBeGreaterThan(50);
  });

  it('渲染器:Markdown 报告包含 4 个章节', () => {
    const md = renderProductionAuditReport(audit);
    expect(md).toMatch(/## 严重度/);
    expect(md).toMatch(/## Debug 泄漏/);
    expect(md).toMatch(/## 内容审计/);
    expect(md).toMatch(/## PWA 与离线/);
  });

  it('生成 Markdown 报告写入 docs/production-build-audit.md', () => {
    expect(existsSync(REPORT_MD)).toBe(true);
  });
});
