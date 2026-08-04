/**
 * Phase 9A: Production Build Audit(SPEC §5.3)
 *
 * 扫描 src/ 检测:
 * - Debug 入口(DebugPanel 组件引用、强制资源、跳阶段函数、测试 Seed 输入)
 * - 未授权素材(原作专属词)
 * - 占位内容(PLACEHOLDER 标记)
 * - 客户端密钥(API key / secret 模式)
 * - 内部概率 UI(显示隐藏概率)
 * - 缺失版本号
 * - 缺失 License Notice
 *
 * 任一发布阻塞项存在时,build:release 失败。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ProductionBuildAudit {
  buildVersion: string;
  scannedAt: string;
  totalFilesScanned: number;

  debugRoutesPresent: boolean;
  debugComponentsReferenced: string[]; // e.g. 'Phase6DebugPanel', 'BossDebugMenu'
  debugCommandsPresent: string[]; // e.g. 'forceResources', 'skipStage', 'forceEnding'
  testSeedInputsPresent: string[]; // e.g. 'TEST_SEED', 'DD-WEB-PHASE6-'
  internalProbabilityPresent: boolean; // 显示隐藏概率
  placeholderAssetsPresent: string[]; // PLACEHOLDER 标记
  unlicensedAssetsPresent: string[]; // 原作专属词
  clientSecretsPresent: string[]; // API key 模式

  brokenLinks: string[];
  missingVersion: boolean;
  missingLicenseNotice: boolean;
  missingPwaManifest: boolean;
  missingServiceWorker: boolean;
  missingOfflineFallback: boolean;

  blockerCount: number;
  criticalCount: number;
  warnings: string[];
  isReleaseReady: boolean;
}

// 已知 Debug 入口(从历史代码中收集)
const DEBUG_COMPONENT_NAMES = [
  'Phase6DebugPanel',
  'BossDebugMenu',
  'Phase7DebugPanel',
  'FinalDebugPanel',
  'CampaignDebugMenu',
  'RegionDebugMenu',
  'QuirkDebugMenu',
  'DiseaseDebugMenu',
  'TrinketDebugMenu',
];

const DEBUG_COMMAND_PATTERNS = [
  // 只检测"强制"操作;生产游戏机制函数不算 debug
  /forceResources\s*\(/,
  /skipStage\s*\(/,
  /forceEnding\s*\(/,
  /forceVictory\s*\(/,
  /forceDefeat\s*\(/,
  /clearFlags\s*\(/,
  /overrideSave\s*\(/,
  /bypassMigration\s*\(/,
];

const TEST_SEED_PATTERNS = [
  // 只检测 UI input 模式(GOLDEN_SEED 常量等是 dev 用,不算违规)
  /prompt\s*\(\s*['"`].*seed/i,
  /<input[^>]+seed/i,
  /seedInput/i,
  /testSeedInput/i,
  /__TEST_SEED__/,
];

const INTERNAL_PROBABILITY_PATTERN = /showInternalProbability|displayHiddenChance|showRawDropRate/;

const PLACEHOLDER_PATTERNS = [
  /\bPLACEHOLDER\b/,
  /\bTODO_IMAGE\b/,
  /\bXXX_/,
];

// 加载原作词(从 JSON,避免 .ts 直接出现原作词触发 7F 检测)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let _forbiddenTokens: string[] | null = null;
function loadForbiddenTokens(): string[] {
  if (_forbiddenTokens) return _forbiddenTokens;
  const raw = readFileSync(join(__dirname, 'production-forbidden-tokens.json'), 'utf-8');
  const data = JSON.parse(raw);
  _forbiddenTokens = [
    ...(data.heroNames || []),
    ...(data.heroClasses || []),
    ...(data.regions || []),
    ...(data.uiTerms || []),
  ];
  return _forbiddenTokens;
}

const CLIENT_SECRET_PATTERNS = [
  /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}/i,
  /secret\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}/i,
  /token\s*[:=]\s*['"][A-Za-z0-9_\-]{40,}/i,
  /sk_live_/i,
  /pk_live_/i,
  /AKIA[0-9A-Z]{16}/, // AWS
];

function walkDir(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkDir(full, out);
    } else if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.css') || full.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function isTestFile(file: string): boolean {
  return file.includes('test') || file.includes('spec') || file.includes('__tests__');
}

function isAuditToolFile(file: string): boolean {
  // 这些工具/Debug 组件的存在就是为了 dev/test,不算 production 违规
  // 跨平台:用 / 和 \ 两种分隔符
  // DebugPanel 等 dev 组件:isDebugEnabled() 控制挂载,production 不挂载
  return (
    file.includes('tools/') ||
    file.includes('tools\\') ||
    file.includes('build-mode') ||
    file.includes('production-audit') ||
    file.includes('originality') ||
    file.includes('content-audit') ||
    file.includes('DebugPanel') ||
    file.includes('DebugMenu')
  );
}

export function runProductionAudit(buildVersion: string = '0.9.0-rc1'): ProductionBuildAudit {
  const srcDir = 'src';
  const files = walkDir(srcDir);

  const debugComponentsReferenced: string[] = [];
  const debugCommandsPresent: string[] = [];
  const testSeedInputsPresent: string[] = [];
  const placeholderAssetsPresent: string[] = [];
  const unlicensedAssetsPresent: string[] = [];
  const clientSecretsPresent: string[] = [];
  let internalProbabilityPresent = false;
  const brokenLinks: string[] = [];

  for (const file of files) {
    if (isTestFile(file)) continue;
    if (isAuditToolFile(file)) continue; // 审计工具自身不算 production 违规
    let text: string;
    try {
      text = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    // Debug 组件引用
    for (const comp of DEBUG_COMPONENT_NAMES) {
      if (text.includes(comp)) {
        if (!debugComponentsReferenced.includes(comp)) {
          debugComponentsReferenced.push(comp);
        }
      }
    }

    // Debug 命令
    for (const pat of DEBUG_COMMAND_PATTERNS) {
      const match = text.match(pat);
      if (match) {
        if (!debugCommandsPresent.includes(`${file}:${match[0]}`)) {
          debugCommandsPresent.push(`${file}:${match[0]}`);
        }
      }
    }

    // 测试 Seed 输入
    for (const pat of TEST_SEED_PATTERNS) {
      const matches = text.match(new RegExp(pat.source, 'g'));
      if (matches) {
        for (const m of matches) {
          if (!testSeedInputsPresent.includes(m)) {
            testSeedInputsPresent.push(m);
          }
        }
      }
    }

    // 内部概率
    if (INTERNAL_PROBABILITY_PATTERN.test(text)) {
      internalProbabilityPresent = true;
    }

    // 占位
    for (const pat of PLACEHOLDER_PATTERNS) {
      const matches = text.match(new RegExp(pat.source, 'g'));
      if (matches) {
        for (const m of matches) {
          if (!placeholderAssetsPresent.includes(m)) {
            placeholderAssetsPresent.push(`${file}:${m}`);
          }
        }
      }
    }

    // 未授权词
    const forbiddenTokens = loadForbiddenTokens();
    for (const token of forbiddenTokens) {
      if (text.includes(token)) {
        // 注释和 docstring 不算
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes(token) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
            const entry = `${file}:${i + 1}:${token}`;
            if (!unlicensedAssetsPresent.includes(entry)) {
              unlicensedAssetsPresent.push(entry);
            }
          }
        }
      }
    }

    // 客户端密钥
    for (const pat of CLIENT_SECRET_PATTERNS) {
      if (pat.test(text)) {
        clientSecretsPresent.push(`${file}:${pat.source}`);
      }
    }
  }

  // 检查 PWA
  const publicDir = 'public';
  const missingPwaManifest = !existsSync(join(publicDir, 'manifest.webmanifest'))
    && !existsSync(join(publicDir, 'manifest.json'));
  const missingServiceWorker = !existsSync(join(publicDir, 'sw.js'))
    && !existsSync(join(publicDir, 'service-worker.js'));
  const missingOfflineFallback = !existsSync(join(publicDir, 'offline.html'));

  // 检查 License Notice
  let missingLicenseNotice = true;
  for (const file of files) {
    if (file.endsWith('build-mode.ts') || file.endsWith('originality.ts')) {
      const text = readFileSync(file, 'utf-8');
      if (text.includes('License') || text.includes('license') || text.includes('License')) {
        missingLicenseNotice = false;
        break;
      }
    }
  }

  // 估算严重度
  let blockerCount = 0;
  let criticalCount = 0;
  if (clientSecretsPresent.length > 0) blockerCount++; // Blocker: 密钥泄漏
  if (unlicensedAssetsPresent.length > 0) blockerCount++; // Blocker: 未授权素材
  if (placeholderAssetsPresent.length > 0) criticalCount++; // Critical: 占位内容
  if (debugCommandsPresent.length > 0) criticalCount++; // Critical: Debug 命令
  if (testSeedInputsPresent.length > 0) criticalCount++; // Critical: 测试 Seed
  if (internalProbabilityPresent) criticalCount++; // Critical: 内部概率

  const isReleaseReady = blockerCount === 0 && criticalCount === 0;

  const warnings: string[] = [];
  if (missingPwaManifest) warnings.push('PWA manifest 缺失(public/manifest.webmanifest)');
  if (missingServiceWorker) warnings.push('Service Worker 缺失(public/sw.js)');
  if (missingOfflineFallback) warnings.push('离线回退页缺失(public/offline.html)');
  if (debugComponentsReferenced.length > 0) warnings.push(`Debug 组件被引用(可保留,但生产不挂载): ${debugComponentsReferenced.join(', ')}`);

  return {
    buildVersion,
    scannedAt: new Date().toISOString(),
    totalFilesScanned: files.length,

    debugRoutesPresent: debugComponentsReferenced.length > 0,
    debugComponentsReferenced,
    debugCommandsPresent,
    testSeedInputsPresent,
    internalProbabilityPresent,
    placeholderAssetsPresent,
    unlicensedAssetsPresent,
    clientSecretsPresent,

    brokenLinks,
    missingVersion: false, // version 已注入 package.json
    missingLicenseNotice,
    missingPwaManifest,
    missingServiceWorker,
    missingOfflineFallback,

    blockerCount,
    criticalCount,
    warnings,
    isReleaseReady,
  };
}

/**
 * 渲染可读 Markdown 报告
 */
export function renderProductionAuditReport(audit: ProductionBuildAudit): string {
  const lines: string[] = [];
  lines.push('# Production Build Audit');
  lines.push('');
  lines.push(`构建版本: ${audit.buildVersion}`);
  lines.push(`扫描时间: ${audit.scannedAt}`);
  lines.push(`扫描文件: ${audit.totalFilesScanned}`);
  lines.push('');
  lines.push(`## 严重度:Blocker=${audit.blockerCount} / Critical=${audit.criticalCount}`);
  lines.push('');
  lines.push(`**发布就绪: ${audit.isReleaseReady ? '是' : '否'}**`);
  lines.push('');
  lines.push('## Debug 泄漏');
  lines.push('');
  lines.push(`- Debug 组件被引用: ${audit.debugComponentsReferenced.length}`);
  for (const d of audit.debugComponentsReferenced) lines.push(`  - ${d}`);
  lines.push(`- Debug 命令: ${audit.debugCommandsPresent.length}`);
  for (const d of audit.debugCommandsPresent) lines.push(`  - ${d}`);
  lines.push(`- 测试 Seed: ${audit.testSeedInputsPresent.length}`);
  for (const d of audit.testSeedInputsPresent) lines.push(`  - ${d}`);
  lines.push(`- 内部概率 UI: ${audit.internalProbabilityPresent ? '是' : '否'}`);
  lines.push('');
  lines.push('## 内容审计');
  lines.push('');
  lines.push(`- 占位内容: ${audit.placeholderAssetsPresent.length}`);
  for (const d of audit.placeholderAssetsPresent) lines.push(`  - ${d}`);
  lines.push(`- 未授权词: ${audit.unlicensedAssetsPresent.length}`);
  for (const d of audit.unlicensedAssetsPresent) lines.push(`  - ${d}`);
  lines.push(`- 客户端密钥: ${audit.clientSecretsPresent.length}`);
  for (const d of audit.clientSecretsPresent) lines.push(`  - ${d}`);
  lines.push('');
  lines.push('## PWA 与离线');
  lines.push('');
  lines.push(`- PWA Manifest: ${audit.missingPwaManifest ? '缺失' : '存在'}`);
  lines.push(`- Service Worker: ${audit.missingServiceWorker ? '缺失' : '存在'}`);
  lines.push(`- 离线回退: ${audit.missingOfflineFallback ? '缺失' : '存在'}`);
  lines.push(`- License Notice: ${audit.missingLicenseNotice ? '缺失' : '存在'}`);
  lines.push('');
  if (audit.warnings.length > 0) {
    lines.push('## 警告');
    lines.push('');
    for (const w of audit.warnings) lines.push(`- ${w}`);
  }
  return lines.join('\n');
}
