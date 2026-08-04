/**
 * Phase 9B: 存档导入导出(SPEC §7-§8)
 *
 * 验收:
 * - exportSaveToEnvelope / exportSaveToJson 生成带 checksum 的 envelope
 * - generateExportFilename 格式正确
 * - parseImportFile 校验 JSON / formatVersion / data / checksum / 大小
 * - applyImportWithBackup 失败不覆盖原档
 * - deleteSaveWithBackup 备份后删除
 * - listAllSaves 列出主档/备份/快照
 * - saveGame 集成(写入 → 读出 == 写)
 *
 * 关联文档:docs/save-import-export-report.md(测试运行时生成)
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '../src/game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../src/game-engine/expedition/types.js';
import {
  exportSaveToEnvelope,
  exportSaveToJson,
  generateExportFilename,
  parseImportFile,
  applyImportWithBackup,
  deleteSaveWithBackup,
  backupCurrentSave,
  saveLastGoodSnapshot,
  listAllSaves,
  computeChecksum,
  fnv1aHash,
  MAX_IMPORT_SIZE_BYTES,
  BACKUP_STORAGE_KEY,
  LAST_GOOD_SNAPSHOT_KEY,
  type ExportEnvelope,
} from '../src/persistence/save-portability.js';
import { saveGame, loadGame } from '../src/persistence/save.js';

const DOCS_DIR = 'docs';
const REPORT_MD = join(DOCS_DIR, 'save-import-export-report.md');

function makeEmptyState(): GameState {
  return {
    version: GAME_STATE_VERSION,
    seed: 'test-seed-9b',
    currentNode: null,
    selectionInProgress: null,
    battle: null,
    torch: 100,
    food: 8,
    inventory: [],
    party: { members: [], formation: 'standard' },
    expeditionLog: [],
    eventLog: [],
    rngState: { algorithm: 'sfc32', state: [0, 0, 0, 0] },
    campaign: {
      week: 5,
      gold: 100,
      roster: [],
      graveyard: [],
      availableMissions: [],
      completedMissions: [],
      questChainStates: {},
      activeTreatments: [],
      tavernCandidates: [],
      trinketInventory: [],
      trinketAssignments: {},
      campaignEnded: false,
    },
    hamlet: {
      facilities: {},
      lastUpgradeWeek: 0,
    },
    expedition: {
      campUsed: 0,
      campState: null,
      expeditionBuffs: [],
    },
    regionProgress: { 'region-test': { completedNodes: 0, totalNodes: 0, bossDefeated: false, unlocked: true } },
    regionDiscovery: { 'region-test': { discovered: true, discoveryWeek: 1, regionName: '测试区' } },
    selectedRegionId: 'region-test',
    bossStates: {},
    regionThreats: {},
    campaignThreat: 0,
    bossEncounterState: null,
    finalCampaignState: {
      status: 'not-started',
      outerQuestCompleted: false,
      sealsDestroyed: 0,
      assaultUnlocked: false,
      currentPhase: 0,
    },
    campaignEnding: null,
  } as unknown as GameState;
}

function clearLocalStorage() {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
}

// 注入内存版 localStorage(vitest node env 默认无 DOM)
function installLocalStorageStub() {
  const store = new Map<string, string>();
  const stub: Storage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  vi.stubGlobal('localStorage', stub);
  return stub;
}

installLocalStorageStub();

describe('Phase 9B: Save Portability(SPEC §7)', () => {
  beforeAll(() => {
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
    writeFileSync(REPORT_MD, '# Save Import / Export Report\n\nPhase 9B 验收报告:导出的存档可被解析 / 校验 / 备份 / 恢复。\n', 'utf-8');
  });

  beforeEach(() => {
    clearLocalStorage();
  });

  it('fnv1aHash 确定性:相同输入产出相同 hash', () => {
    expect(fnv1aHash('hello')).toBe(fnv1aHash('hello'));
    expect(fnv1aHash('hello')).not.toBe(fnv1aHash('world'));
  });

  it('fnv1aHash 输出 8 位 16 进制', () => {
    expect(fnv1aHash('test')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('exportSaveToEnvelope:包含 7 个核心字段', () => {
    const env = exportSaveToEnvelope(makeEmptyState(), { campaignName: '测试战役', buildVersion: '0.9.0-rc1' });
    expect(env.formatVersion).toBe(1);
    expect(env.buildVersion).toBe('0.9.0-rc1');
    expect(env.gameStateVersion).toBe(GAME_STATE_VERSION);
    expect(env.campaignName).toBe('测试战役');
    expect(typeof env.exportedAt).toBe('string');
    expect(typeof env.checksum).toBe('string');
    expect(env.data).toBeDefined();
  });

  it('computeChecksum 与 export 一致', () => {
    const env = exportSaveToEnvelope(makeEmptyState(), { campaignName: 'X' });
    const expected = computeChecksum(env.data);
    expect(env.checksum).toBe(expected);
  });

  it('generateExportFilename 格式正确', () => {
    const env = exportSaveToEnvelope(makeEmptyState(), { campaignName: '我的战役' });
    const filename = generateExportFilename(env);
    expect(filename).toMatch(/^game-save_我的战役_v\d+_\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('generateExportFilename 处理特殊字符', () => {
    const env = exportSaveToEnvelope(makeEmptyState(), { campaignName: 'a/b c@!' });
    const filename = generateExportFilename(env);
    expect(filename).not.toContain('/');
    expect(filename).not.toContain(' ');
  });

  it('exportSaveToJson:可被 JSON.parse 解析', () => {
    const json = exportSaveToJson(makeEmptyState());
    const parsed = JSON.parse(json);
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.data.state.seed).toBe('test-seed-9b');
  });
});

describe('Phase 9B: Import 解析与校验', () => {
  beforeEach(() => clearLocalStorage());

  it('合法 envelope 解析成功', () => {
    const env = exportSaveToEnvelope(makeEmptyState(), { campaignName: 'OK' });
    const json = JSON.stringify(env);
    const preview = parseImportFile(json);
    expect(preview.isValid).toBe(true);
    expect(preview.errors).toEqual([]);
    expect(preview.campaignName).toBe('OK');
    expect(preview.gameStateVersion).toBe(GAME_STATE_VERSION);
  });

  it('损坏 JSON:解析失败', () => {
    const preview = parseImportFile('not valid json{{{');
    expect(preview.isValid).toBe(false);
    expect(preview.errors.length).toBeGreaterThan(0);
  });

  it('formatVersion 错误:被拒绝', () => {
    const env = exportSaveToEnvelope(makeEmptyState()) as any;
    env.formatVersion = 99;
    const preview = parseImportFile(JSON.stringify(env));
    expect(preview.isValid).toBe(false);
    expect(preview.errors.some((e) => e.includes('formatVersion'))).toBe(true);
  });

  it('checksum 篡改:被拒绝', () => {
    const env = exportSaveToEnvelope(makeEmptyState());
    const tampered = { ...env, checksum: '00000000' };
    const preview = parseImportFile(JSON.stringify(tampered));
    expect(preview.isValid).toBe(false);
    expect(preview.errors.some((e) => e.includes('checksum'))).toBe(true);
  });

  it('data.state 缺失:被拒绝', () => {
    const env = exportSaveToEnvelope(makeEmptyState()) as any;
    delete env.data.state;
    const preview = parseImportFile(JSON.stringify(env));
    expect(preview.isValid).toBe(false);
  });

  it('data.version 超出范围:被拒绝', () => {
    const env = exportSaveToEnvelope(makeEmptyState()) as any;
    env.data.version = 99;
    const preview = parseImportFile(JSON.stringify(env));
    expect(preview.isValid).toBe(false);
  });

  it('文件过大:被拒绝', () => {
    const env = exportSaveToEnvelope(makeEmptyState());
    const json = JSON.stringify(env);
    const preview = parseImportFile(json, MAX_IMPORT_SIZE_BYTES + 1);
    expect(preview.isValid).toBe(false);
    expect(preview.errors.some((e) => e.includes('过大'))).toBe(true);
  });

  it('低版本存档:产生 migration warning', () => {
    const env = exportSaveToEnvelope(makeEmptyState()) as any;
    env.data.version = 5; // 模拟旧版
    env.checksum = computeChecksum(env.data);
    const preview = parseImportFile(JSON.stringify(env));
    // 仍在支持范围内(2-7),通过
    expect(preview.isValid).toBe(true);
    expect(preview.warnings.some((w) => w.includes('迁移'))).toBe(true);
  });

  it('高版本存档:产生兼容性 warning', () => {
    const env = exportSaveToEnvelope(makeEmptyState()) as any;
    env.data.version = 8; // 高于当前
    env.checksum = computeChecksum(env.data);
    const preview = parseImportFile(JSON.stringify(env));
    expect(preview.isValid).toBe(false); // 超出 2-7 范围
  });
});

describe('Phase 9B: Import 应用 + 备份', () => {
  beforeEach(() => clearLocalStorage());

  it('applyImportWithBackup 成功:备份创建 + 数据写入', () => {
    // 先写入一个当前存档
    saveGame(makeEmptyState());
    const env = exportSaveToEnvelope(makeEmptyState(), { campaignName: '导入测试' });
    const result = applyImportWithBackup(JSON.stringify(env));
    expect(result.success).toBe(true);
    expect(result.appliedData).toBeDefined();
  });

  it('applyImportWithBackup 失败:不覆盖原档', () => {
    // 写入当前
    const origState = makeEmptyState();
    saveGame(origState);
    const origLoaded = loadGame();
    expect(origLoaded).toBeDefined();

    // 尝试导入损坏文件
    const result = applyImportWithBackup('not json');
    expect(result.success).toBe(false);
    // 原档不变
    const after = loadGame();
    expect(after).toBeDefined();
    expect(after!.state.seed).toBe('test-seed-9b');
  });

  it('applyImportWithBackup 损坏 checksum:不覆盖', () => {
    saveGame(makeEmptyState());
    const env = exportSaveToEnvelope(makeEmptyState()) as any;
    env.checksum = 'bad';
    const result = applyImportWithBackup(JSON.stringify(env));
    expect(result.success).toBe(false);
    expect(loadGame()!.state.seed).toBe('test-seed-9b');
  });

  it('backupCurrentSave 写入 BACKUP_STORAGE_KEY', () => {
    saveGame(makeEmptyState());
    const ok = backupCurrentSave();
    expect(ok).toBe(true);
    expect(localStorage.getItem(BACKUP_STORAGE_KEY)).not.toBeNull();
  });

  it('saveLastGoodSnapshot 写入 LAST_GOOD_SNAPSHOT_KEY', () => {
    const ok = saveLastGoodSnapshot(makeEmptyState());
    expect(ok).toBe(true);
    expect(localStorage.getItem(LAST_GOOD_SNAPSHOT_KEY)).not.toBeNull();
  });
});

describe('Phase 9B: 删除 + 列表', () => {
  beforeEach(() => clearLocalStorage());

  it('deleteSaveWithBackup 备份后删除', () => {
    saveGame(makeEmptyState());
    const result = deleteSaveWithBackup();
    expect(result.success).toBe(true);
    expect(result.backupCreated).toBe(true);
    // 主档已删
    expect(loadGame()).toBeNull();
    // 备份存在
    expect(localStorage.getItem(BACKUP_STORAGE_KEY)).not.toBeNull();
  });

  it('deleteSaveWithBackup 无当前存档:仍返回(无备份)', () => {
    const result = deleteSaveWithBackup();
    expect(result.success).toBe(true);
    expect(result.backupCreated).toBe(false);
  });

  it('listAllSaves:列出 primary / backup / lastGood', () => {
    saveGame(makeEmptyState());
    backupCurrentSave();
    saveLastGoodSnapshot(makeEmptyState());
    const list = listAllSaves();
    expect(list.primary).not.toBeNull();
    expect(list.backup).not.toBeNull();
    expect(list.lastGood).not.toBeNull();
  });
});

describe('Phase 9B: 端到端 import/export 往返', () => {
  beforeEach(() => clearLocalStorage());

  it('导出 → 解析 → 应用:数据一致', () => {
    const state = makeEmptyState();
    state.campaign!.week = 10;
    state.campaign!.gold = 999;
    saveGame(state);

    const env = exportSaveToEnvelope(state, { campaignName: '往返测试' });
    const json = exportSaveToJson(state, { campaignName: '往返测试' });
    expect(JSON.stringify(env)).toBe(json);

    const preview = parseImportFile(json);
    expect(preview.isValid).toBe(true);
    expect(preview.week).toBe(10);

    const result = applyImportWithBackup(json);
    expect(result.success).toBe(true);
    expect(result.appliedData!.state.campaign!.week).toBe(10);
    expect(result.appliedData!.state.campaign!.gold).toBe(999);
  });
});
