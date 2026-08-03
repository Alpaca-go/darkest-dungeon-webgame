/**
 * 存档(Phase 1 v2.0)
 *
 * 持久化:
 * - 完整 GameState(v2)
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
 *
 * 不会保存 UI 状态(由 UI Store 重新初始化)
 */

import type { GameState } from '../game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../game-engine/expedition/types.js';

const STORAGE_KEY = 'dd-web-expedition-save-v2';
const SETTINGS_KEY = 'dd-web-settings-v2';

export interface SaveData {
  version: 2;
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
      version: 2,
      state,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[save] failed to save game', e);
  }
}

export function loadGame(): SaveData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 2) return null;
    if (data.state.version !== GAME_STATE_VERSION) return null;
    return data;
  } catch (e) {
    console.warn('[save] failed to load game', e);
    return null;
  }
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
