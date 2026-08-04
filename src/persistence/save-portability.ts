/**
 * Phase 9B: 存档导入导出工具(SPEC §7)
 *
 * 功能:
 * - exportSaveToFile: 导出当前存档为带 checksum 的 JSON
 * - parseImportFile: 解析导入文件(校验 schema + checksum)
 * - previewImport: 预览导入的战役信息
 * - applyImportWithBackup: 应用导入,自动备份原档
 *
 * 约束:
 * - 导入失败不得覆盖当前存档
 * - 导入前自动备份当前存档
 * - 文件大小限制(默认 5MB)
 * - Schema 校验(version / state 存在)
 * - Checksum 校验
 */

import type { GameState } from '../game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../game-engine/expedition/types.js';
import {
  saveGame,
  loadGame,
  type SaveData,
} from './save.js';

export const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const BACKUP_STORAGE_KEY = 'dd-web-expedition-save-backup';
export const LAST_GOOD_SNAPSHOT_KEY = 'dd-web-expedition-save-last-good';

export interface ExportEnvelope {
  formatVersion: 1;
  buildVersion: string;
  gameStateVersion: typeof GAME_STATE_VERSION;
  campaignName: string;
  exportedAt: string;
  checksum: string;
  data: SaveData;
}

export interface ImportPreview {
  isValid: boolean;
  errors: string[];
  warnings: string[];

  // 仅当 isValid 时填充
  campaignName?: string;
  gameStateVersion?: number;
  buildVersion?: string;
  exportedAt?: string;
  week?: number;
  heroCount?: number;
  deadHeroCount?: number;
  defeatedBossCount?: number;
  hasFinalCampaign?: boolean;
  hasCampaignEnding?: boolean;
  sizeBytes?: number;
}

export interface ImportResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  backupCreated: boolean;
  migratedFromVersion?: number;
  appliedData?: SaveData;
}

/**
 * 简单稳定 hash(FNV-1a 32-bit)
 * 用于存档 checksum,不需要加密强度
 */
export function fnv1aHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * 计算 envelope 的 checksum(对 data 字段 JSON 字符串 hash)
 */
export function computeChecksum(data: SaveData): string {
  return fnv1aHash(JSON.stringify(data));
}

/**
 * 导出存档为 ExportEnvelope(JSON 字符串)
 */
export function exportSaveToEnvelope(
  state: GameState,
  options: { campaignName?: string; buildVersion?: string } = {}
): ExportEnvelope {
  const data: SaveData = {
    version: GAME_STATE_VERSION as 7 | 6 | 5 | 4,
    state,
    savedAt: new Date().toISOString(),
  };
  const envelope: ExportEnvelope = {
    formatVersion: 1,
    buildVersion: options.buildVersion ?? '0.9.0-rc1',
    gameStateVersion: GAME_STATE_VERSION,
    campaignName: options.campaignName ?? '未命名战役',
    exportedAt: new Date().toISOString(),
    checksum: computeChecksum(data),
    data,
  };
  return envelope;
}

/**
 * 导出存档为 JSON 字符串
 */
export function exportSaveToJson(
  state: GameState,
  options: { campaignName?: string; buildVersion?: string } = {}
): string {
  return JSON.stringify(exportSaveToEnvelope(state, options));
}

/**
 * 生成导出文件名
 * game-save_<campaign-name>_<version>_<date>.json
 */
export function generateExportFilename(envelope: ExportEnvelope): string {
  const safeName = envelope.campaignName.replace(/[^a-zA-Z0-9-_一-龥]/g, '_');
  const date = envelope.exportedAt.split('T')[0]; // YYYY-MM-DD
  return `game-save_${safeName}_v${envelope.gameStateVersion}_${date}.json`;
}

/**
 * 解析导入文件
 *
 * 校验:
 * - JSON 解析
 * - 文件大小 ≤ 5MB
 * - formatVersion = 1
 * - data 存在 + version + state
 * - checksum 匹配
 */
export function parseImportFile(raw: string, sizeBytes: number = raw.length): ImportPreview {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (sizeBytes > MAX_IMPORT_SIZE_BYTES) {
    errors.push(`文件过大: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB > 5MB`);
  }

  let envelope: any;
  try {
    envelope = JSON.parse(raw);
  } catch (e: any) {
    errors.push(`JSON 解析失败: ${e?.message ?? 'unknown'}`);
    return { isValid: false, errors, warnings };
  }

  if (!envelope || typeof envelope !== 'object') {
    errors.push('存档格式错误:不是有效对象');
    return { isValid: false, errors, warnings };
  }

  if (envelope.formatVersion !== 1) {
    errors.push(`formatVersion 不支持: ${envelope.formatVersion}`);
  }

  if (!envelope.data || typeof envelope.data !== 'object') {
    errors.push('缺少 data 字段');
  } else {
    if (typeof envelope.data.version !== 'number') {
      errors.push('data.version 缺失或非数字');
    } else if (envelope.data.version < 2 || envelope.data.version > 7) {
      errors.push(`data.version 超出支持范围: ${envelope.data.version}`);
    }
    if (!envelope.data.state || typeof envelope.data.state !== 'object') {
      errors.push('data.state 缺失或非对象');
    }
  }

  if (typeof envelope.checksum !== 'string') {
    errors.push('checksum 缺失或非字符串');
  } else if (envelope.data) {
    const expected = computeChecksum(envelope.data);
    if (expected !== envelope.checksum) {
      errors.push(`checksum 不匹配: 期望 ${expected}, 实际 ${envelope.checksum}`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // 字段提取
  const data = envelope.data as SaveData;
  const state = data.state;
  const preview: ImportPreview = {
    isValid: true,
    errors: [],
    warnings,
    campaignName: envelope.campaignName,
    gameStateVersion: data.version,
    buildVersion: envelope.buildVersion,
    exportedAt: envelope.exportedAt,
    week: (state as any).campaign?.week,
    heroCount: (state as any).campaign?.roster?.length,
    deadHeroCount: (state as any).campaign?.graveyard?.length,
    defeatedBossCount: (state as any).campaign?.defeatedBossIds?.length,
    hasFinalCampaign: !!(state as any).finalCampaignState
      && (state as any).finalCampaignState.status !== 'not-started',
    hasCampaignEnding: !!(state as any).campaignEnding,
    sizeBytes,
  };

  // 警告:版本不匹配需要迁移
  if (data.version < GAME_STATE_VERSION) {
    warnings.push(`存档版本 v${data.version} 需迁移到 v${GAME_STATE_VERSION}`);
  } else if (data.version > GAME_STATE_VERSION) {
    warnings.push(`存档版本 v${data.version} 高于当前构建 v${GAME_STATE_VERSION},可能不兼容`);
  }

  return preview;
}

/**
 * 备份当前存档到 BACKUP_STORAGE_KEY
 */
export function backupCurrentSave(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const current = loadGame();
    if (!current) return false;
    const envelope = exportSaveToEnvelope(current.state, {
      campaignName: '备份-' + (current as any).campaignName,
    });
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/**
 * 保存最后合法快照
 */
export function saveLastGoodSnapshot(state: GameState): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const envelope = exportSaveToEnvelope(state, { campaignName: '最后合法快照' });
    localStorage.setItem(LAST_GOOD_SNAPSHOT_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/**
 * 应用导入:备份当前 → 写入新数据
 *
 * 重要:即使导入失败,原档也不会被覆盖
 */
export function applyImportWithBackup(
  raw: string,
  options: { sizeBytes?: number; skipBackup?: boolean } = {}
): ImportResult {
  const preview = parseImportFile(raw, options.sizeBytes);
  if (!preview.isValid) {
    return {
      success: false,
      errors: preview.errors,
      warnings: preview.warnings,
      backupCreated: false,
    };
  }

  let envelope: any;
  try {
    envelope = JSON.parse(raw);
  } catch (e: any) {
    return {
      success: false,
      errors: [`JSON 解析失败: ${e?.message ?? 'unknown'}`],
      warnings: [],
      backupCreated: false,
    };
  }

  // 备份
  let backupCreated = false;
  if (!options.skipBackup) {
    backupCreated = backupCurrentSave();
  }

  // 写入
  try {
    const data = envelope.data as SaveData;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dd-web-expedition-save-v7', JSON.stringify(data));
    }
    return {
      success: true,
      errors: [],
      warnings: preview.warnings,
      backupCreated,
      migratedFromVersion: data.version !== GAME_STATE_VERSION ? data.version : undefined,
      appliedData: data,
    };
  } catch (e: any) {
    return {
      success: false,
      errors: [`写入失败: ${e?.message ?? 'unknown'}`],
      warnings: preview.warnings,
      backupCreated,
    };
  }
}

/**
 * 删除存档(创建备份,然后删除主存档)
 */
export interface DeleteResult {
  success: boolean;
  backupCreated: boolean;
  errors: string[];
}

export function deleteSaveWithBackup(): DeleteResult {
  if (typeof localStorage === 'undefined') {
    return { success: false, backupCreated: false, errors: ['localStorage 不可用'] };
  }
  let backupCreated = false;
  try {
    backupCreated = backupCurrentSave();
  } catch (e: any) {
    return { success: false, backupCreated, errors: [`备份失败: ${e?.message ?? 'unknown'}`] };
  }
  try {
    localStorage.removeItem('dd-web-expedition-save-v7');
    return { success: true, backupCreated, errors: [] };
  } catch (e: any) {
    return { success: false, backupCreated, errors: [`删除失败: ${e?.message ?? 'unknown'}`] };
  }
}

/**
 * 列出所有存档
 */
export function listAllSaves(): {
  primary: SaveData | null;
  backup: ExportEnvelope | null;
  lastGood: ExportEnvelope | null;
} {
  if (typeof localStorage === 'undefined') {
    return { primary: null, backup: null, lastGood: null };
  }
  const primary = loadGame();
  let backup: ExportEnvelope | null = null;
  let lastGood: ExportEnvelope | null = null;
  try {
    const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (raw) backup = JSON.parse(raw);
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem(LAST_GOOD_SNAPSHOT_KEY);
    if (raw) lastGood = JSON.parse(raw);
  } catch { /* ignore */ }
  return { primary, backup, lastGood };
}
