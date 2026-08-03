/**
 * 存档(Phase 3)
 *
 * 持久化:
 * - 完整 GameState(v3,带 campaign/hamlet 字段)
 * - 当前 Seed
 * - UI 设置
 *
 * 刷新后必须恢复:
 * - 当前节点 / 当前选择
 * - 火把 / 食物 / 背包
 * - 英雄状态与站位
 * - 遭遇轮次 / 触发决策
 * - RNG 状态
 * - 事件日志
 * - Phase 3:周数 / 金币 / 名册 / 任务 / 招募候选
 *
 * 版本迁移:
 * - v2 (Phase 1/2):无 campaign/hamlet 字段 → 升级到 v3 时补空
 *
 * 不会保存 UI 状态(由 UI Store 重新初始化)
 */

import type { GameState } from '../game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../game-engine/expedition/types.js';

const STORAGE_KEY = 'dd-web-expedition-save-v3';
const STORAGE_KEY_V2 = 'dd-web-expedition-save-v2';
const SETTINGS_KEY = 'dd-web-settings-v3';

export interface SaveData {
  version: 3;
  state: GameState;
  savedAt: string;
}

export interface PersistedSettings {
  reducedMotion: boolean;
  playbackSpeed: number;
  debugOpen: boolean;
}

export function saveGame(state: GameState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const data: SaveData = {
      version: 3,
      state,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // 写完 v3 后清掉旧 v2(避免下次再迁移)
    try { localStorage.removeItem(STORAGE_KEY_V2); } catch { /* ignore */ }
  } catch (e) {
    console.warn('[save] failed to save game', e);
  }
}

export function loadGame(): SaveData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    // 优先读 v3
    const v3Raw = localStorage.getItem(STORAGE_KEY);
    if (v3Raw) {
      const data = JSON.parse(v3Raw) as SaveData;
      if (data.version !== 3) return null;
      if (data.state.version !== GAME_STATE_VERSION) return null;
      return data;
    }
    // 没有 v3 尝试 v2 迁移
    const v2Raw = localStorage.getItem(STORAGE_KEY_V2);
    if (v2Raw) {
      const v2 = JSON.parse(v2Raw) as { version: 2; state: GameState; savedAt: string };
      if (v2.version !== 2) return null;
      const migrated = migrateV2ToV3(v2);
      if (migrated) {
        // 升级后立即写 v3
        saveGame(migrated.state);
        return migrated;
      }
    }
    return null;
  } catch (e) {
    console.warn('[save] failed to load game', e);
    return null;
  }
}

/**
 * V2 → V3 迁移:给老存档补 campaign/hamlet 字段
 * V2 存档没有这些字段,但 hero 的 stress/affliction 仍要保留。
 * 远征过程中不能直接变 hamlet-overview(老存档可能仍在 expedition mode),
 * 也不应在迁移时推进周数 — 留给玩家自己操作。
 */
function migrateV2ToV3(v2: { state: GameState; savedAt: string }): SaveData | null {
  const s = v2.state;
  // 必填字段填默认值(campaign/hamlet 留空,等玩家触发第一次 START_EXPEDITION 才会创建)
  const newState: GameState = {
    ...s,
    version: 3,
    campaign: s.campaign ?? null,
    hamlet: s.hamlet ?? null,
  };
  return { version: 3, state: newState, savedAt: v2.savedAt };
}

export function clearGame(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function saveSettings(settings: PersistedSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[save] failed to save settings', e);
  }
}

export function loadSettings(): PersistedSettings | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSettings;
  } catch {
    return null;
  }
}

export function exportDebugPackage(state: GameState, error?: Error): string {
  return JSON.stringify(
    {
      gameVersion: '0.2.0-phase1-v2',
      contentVersion: 'phase1-v2',
      seed: state.seed,
      state,
      commands: [],
      events: state.eventLog,
      rng: state.rng,
      error: error
        ? { message: error.message, stack: error.stack }
        : undefined,
    },
    null,
    2,
  );
}
