/**
 * 存档(localStorage)
 *
 * 持久化:
 * - 当前战斗快照(BattleState)
 * - 当前 Seed
 * - UI 设置
 *
 * 刷新后必须恢复:
 * - 当前回合 / 行动者 / 单位 HP / 站位 / 状态 / RNG / 战斗日志 / 胜负
 *
 * 不会保存 UI 状态(由 UI Store 重新初始化)
 */

import type { BattleState } from '../game-engine/types.js';

const STORAGE_KEY = 'dd-web-battle-save-v1';
const SETTINGS_KEY = 'dd-web-settings-v1';

export interface SaveData {
  version: 1;
  battle: BattleState;
  savedAt: string;
}

export interface PersistedSettings {
  reducedMotion: boolean;
  playbackSpeed: number;
  debugOpen: boolean;
}

export function saveBattle(battle: BattleState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const data: SaveData = {
      version: 1,
      battle,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[save] failed to save battle', e);
  }
}

export function loadBattle(): SaveData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1) return null;
    return data;
  } catch (e) {
    console.warn('[save] failed to load battle', e);
    return null;
  }
}

export function clearBattle(): void {
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

/** 导出调试包(开发文档 §20.3) */
export function exportDebugPackage(
  battle: BattleState,
  seed: string,
  error?: Error,
): string {
  return JSON.stringify(
    {
      gameVersion: '0.1.0-phase1',
      contentVersion: 'phase1',
      seed,
      state: battle,
      commands: [],
      events: battle.log,
      rng: battle.rng,
      error: error
        ? { message: error.message, stack: error.stack }
        : undefined,
    },
    null,
    2,
  );
}
