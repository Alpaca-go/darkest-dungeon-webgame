/**
 * Phase 9C: 错误报告导出(Diagnostic Bundle,SPEC §9)
 *
 * 玩家遇到错误时主动导出诊断包,发送给开发团队复现。
 *
 * 包含:
 * - 构建版本 / Schema 版本
 * - User Agent / Viewport / Online 状态
 * - 存档元数据(不包含完整 GameState,只 metadata)
 * - 最近事件 ID(不含内容,避免存档文本 XSS)
 * - 最近错误日志(脱敏)
 * - Invariant 失败列表
 * - 可选:完整 GameState(玩家主动勾选)
 *
 * 不包含:
 * - 浏览器账号信息
 * - 个人姓名 / 邮箱 / 位置
 * - 无关浏览历史
 * - 第三方网站数据
 *
 * 导出前玩家主动确认。
 */

import type { GameState } from '../game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../game-engine/expedition/types.js';
import { BUILD_VERSION, IS_PRODUCTION } from '../build-mode.js';
import { loadGame } from '../persistence/save.js';
import { fnv1aHash } from '../persistence/save-portability.js';

export interface SerializedError {
  timestamp: string;
  level: 'warn' | 'error' | 'fatal';
  message: string;
  stack?: string;
  source?: string;
}

export interface SaveMetadata {
  exists: boolean;
  schemaVersion?: number;
  buildVersion?: string;
  week?: number;
  heroCount?: number;
  deadHeroCount?: number;
  gold?: number;
  defeatedBossCount?: number;
  finalCampaignStatus?: string;
  hasEnding?: boolean;
  savedAt?: string;
  sizeBytes?: number;
}

export interface DiagnosticBundle {
  // 元数据
  formatVersion: 1;
  generatedAt: string;
  buildVersion: string;
  schemaVersion: number;
  isProduction: boolean;

  // 环境
  userAgent: string;
  viewport: { width: number; height: number };
  language: string;
  online: boolean;
  pwaInstalled: boolean;

  // 存档
  saveMetadata: SaveMetadata;
  hasOptionalSaveSnapshot: boolean;

  // 最近事件(只 ID,不含内容,避免 XSS)
  recentEventIds: string[];

  // 错误
  recentErrorLogs: SerializedError[];

  // 不变量失败
  invariantFailures: string[];

  // 校验
  bundleChecksum: string;
}

export interface ExportOptions {
  includeSaveSnapshot?: boolean;
  recentEvents?: any[]; // DomainEvent[] 类型,只取 id
  recentErrors?: SerializedError[];
  invariantFailures?: string[];
}

// 敏感信息黑名单:在 error message 中要脱敏
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[PHONE]' },
  { pattern: /sk_live_[A-Za-z0-9]+/g, replacement: '[API_KEY]' },
  { pattern: /pk_live_[A-Za-z0-9]+/g, replacement: '[PUBLIC_KEY]' },
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[AWS_KEY]' },
  { pattern: /\b(?:password|secret|token)\s*[:=]\s*\S+/gi, replacement: '[REDACTED]' },
];

/**
 * 脱敏错误消息
 */
function sanitizeString(input: string): string {
  let result = input;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function sanitizeError(err: SerializedError): SerializedError {
  return {
    timestamp: err.timestamp,
    level: err.level,
    message: sanitizeString(err.message),
    stack: err.stack ? sanitizeString(err.stack.slice(0, 2000)) : undefined,
    source: err.source ? sanitizeString(err.source) : undefined,
  };
}

/**
 * 安全截断字符串
 */
function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...[truncated]' : str;
}

function getViewport(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return {
    width: window.innerWidth || 0,
    height: window.innerHeight || 0,
  };
}

function getOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

function getLanguage(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  return navigator.language || 'unknown';
}

function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-ignore
  return !!(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone);
}

function getSaveMetadata(): SaveMetadata {
  const meta: SaveMetadata = { exists: false };
  const data = loadGame();
  if (!data) return meta;
  meta.exists = true;
  meta.schemaVersion = data.version;
  meta.buildVersion = BUILD_VERSION;
  meta.savedAt = data.savedAt;
  const state = data.state;
  if (state.campaign) {
    meta.week = state.campaign.week;
    meta.gold = state.campaign.gold;
    meta.heroCount = state.campaign.roster?.length;
    meta.deadHeroCount = state.campaign.graveyard?.length;
  }
  if (state.campaign) {
    meta.defeatedBossCount = state.campaign.defeatedBossIds?.length;
  }
  if (state.finalCampaignState) {
    meta.finalCampaignStatus = state.finalCampaignState.status;
  }
  meta.hasEnding = !!state.campaignEnding;
  // 估算大小
  try {
    meta.sizeBytes = JSON.stringify(data).length;
  } catch {
    meta.sizeBytes = 0;
  }
  return meta;
}

/**
 * 提取事件 ID(只 ID,不含内容,避免存档文本 XSS)
 */
function extractEventIds(events: any[], max: number = 50): string[] {
  if (!Array.isArray(events)) return [];
  return events
    .slice(-max)
    .map((e) => (typeof e === 'object' && e !== null && 'id' in e ? String(e.id) : null))
    .filter((id): id is string => id !== null);
}

/**
 * 构建 Diagnostic Bundle
 */
export function buildDiagnosticBundle(options: ExportOptions = {}): DiagnosticBundle {
  const saveMetadata = getSaveMetadata();

  const recentErrors = (options.recentErrors || []).map(sanitizeError);
  const recentEventIds = extractEventIds(options.recentEvents || []);
  const invariantFailures = (options.invariantFailures || []).map(sanitizeString);

  // bundle 本身的 checksum
  const checksumInput = JSON.stringify({
    buildVersion: BUILD_VERSION,
    schemaVersion: GAME_STATE_VERSION,
    saveMetadata,
    recentEventIds,
    recentErrors,
    invariantFailures,
  });
  const bundleChecksum = fnv1aHash(checksumInput);

  return {
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    buildVersion: BUILD_VERSION,
    schemaVersion: GAME_STATE_VERSION,
    isProduction: IS_PRODUCTION,

    userAgent: truncate(typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown', 500),
    viewport: getViewport(),
    language: getLanguage(),
    online: getOnlineStatus(),
    pwaInstalled: isPwaInstalled(),

    saveMetadata,
    hasOptionalSaveSnapshot: !!options.includeSaveSnapshot,

    recentEventIds,
    recentErrorLogs: recentErrors,
    invariantFailures,
    bundleChecksum,
  };
}

/**
 * 序列化为 JSON
 */
export function exportDiagnosticBundleAsJson(options: ExportOptions = {}): string {
  return JSON.stringify(buildDiagnosticBundle(options), null, 2);
}

/**
 * 生成文件名
 */
export function generateDiagnosticFilename(): string {
  const date = new Date().toISOString().split('T')[0];
  return `diagnostic-bundle_${date}_${BUILD_VERSION}.json`;
}

/**
 * 隐私说明:在导出前显示
 */
export const DIAGNOSTIC_PRIVACY_NOTICE = `
诊断包内容(导出前请确认):
- 构建版本与 Schema 版本
- User Agent / 视口尺寸 / 语言 / 离线状态
- 存档元数据(周数 / 英雄数 / 金币 / Boss 进度,不包含完整存档)
- 最近事件 ID 列表(不含内容)
- 最近错误日志(已脱敏邮箱/电话/密钥)
- Invariant 失败列表

不包含:
- 浏览器账号信息
- 个人姓名 / 邮箱 / 位置
- 无关浏览历史
- 第三方网站数据

确认导出?
`.trim();
