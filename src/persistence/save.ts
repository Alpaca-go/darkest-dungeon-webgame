/**
 * 存档(Phase 4 P4.5)
 *
 * 持久化:
 * - 完整 GameState(v4,含 Phase 4 怪癖/疾病/饰品/成长/露营)
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
 * - Phase 4: 怪癖 / 疾病 / 饰品 / 露营状态 / 持续 Buff
 *
 * 版本迁移:
 * - v2 → v3: 补 campaign/hamlet 字段
 * - v3 → v4: 补 hero.lockedPositiveQuirkIds/diseaseIds/equippedTrinketInstanceIds,
 *            补 campaign.trinketInventory, 补 expedition.campState/expeditionBuffs/campUsed
 *
 * 不会保存 UI 状态(由 UI Store 重新初始化)
 */

import type { GameState } from '../game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../game-engine/expedition/types.js';

const STORAGE_KEY = 'dd-web-expedition-save-v4';
const STORAGE_KEY_V3 = 'dd-web-expedition-save-v3';
const STORAGE_KEY_V2 = 'dd-web-expedition-save-v2';
const SETTINGS_KEY = 'dd-web-settings-v4';

export interface SaveData {
  version: 4;
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
      version: 4,
      state,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // 写完 v4 后清掉旧 v3(避免下次再迁移)
    try { localStorage.removeItem(STORAGE_KEY_V3); } catch { /* ignore */ }
  } catch (e) {
    console.warn('[save] failed to save game', e);
  }
}

export function loadGame(): SaveData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    // 优先读 v4
    const v4Raw = localStorage.getItem(STORAGE_KEY);
    if (v4Raw) {
      const data = JSON.parse(v4Raw) as SaveData;
      if (data.version !== 4) return null;
      if (data.state.version !== GAME_STATE_VERSION) return null;
      return data;
    }
    // 没有 v4 尝试 v3 迁移
    const v3Raw = localStorage.getItem(STORAGE_KEY_V3);
    if (v3Raw) {
      const v3 = JSON.parse(v3Raw) as { version: 3; state: GameState; savedAt: string };
      if (v3.version !== 3) return null;
      const migrated = migrateV3ToV4(v3);
      if (migrated) {
        saveGame(migrated.state);
        return migrated;
      }
    }
    // 没有 v3 尝试 v2 迁移
    const v2Raw = localStorage.getItem(STORAGE_KEY_V2);
    if (v2Raw) {
      const v2 = JSON.parse(v2Raw) as { version: 2; state: GameState; savedAt: string };
      if (v2.version !== 2) return null;
      // v2 → v4: 链式迁移(v2 → v4 直接,补全部 v3+v4 字段)
      const intermediate = v2.state as unknown as GameState;
      const v2Migrated: { state: GameState; savedAt: string } = {
        state: {
          ...intermediate,
          version: 4 as typeof GAME_STATE_VERSION,
          campaign: intermediate.campaign ?? null,
          hamlet: intermediate.hamlet ?? null,
          // v3 字段(给 migrateV3ToV4 补)
          expedition: {
            ...intermediate.expedition,
            campState: null,
            expeditionBuffs: [],
            campUsed: false,
          },
          // hero P4 字段
          party: Object.fromEntries(
            Object.entries(intermediate.party).map(([id, hero]) => [
              id,
              {
                ...hero,
                lockedPositiveQuirkIds: hero.lockedPositiveQuirkIds ?? [],
                diseaseIds: hero.diseaseIds ?? [],
                equippedTrinketInstanceIds: hero.equippedTrinketInstanceIds ?? [null, null],
              },
            ]),
          ) as typeof intermediate.party,
        } as GameState,
        savedAt: v2.savedAt,
      };
      const v4Migrated = migrateV3ToV4(v2Migrated);
      if (v4Migrated) {
        saveGame(v4Migrated.state);
        return v4Migrated;
      }
    }
    return null;
  } catch (e) {
    console.warn('[save] failed to load game', e);
    return null;
  }
}

/**
 * V3 → V4 迁移(Phase 4):
 * - 补 hero.lockedPositiveQuirkIds / diseaseIds / equippedTrinketInstanceIds
 * - 补 campaign.trinketInventory
 * - 补 expedition.campState / expeditionBuffs / campUsed
 */
function migrateV3ToV4(v3: { state: GameState; savedAt: string }): SaveData | null {
  const s = v3.state;
  // Hero 字段补全
  const newParty: typeof s.party = {};
  for (const [id, hero] of Object.entries(s.party)) {
    newParty[id] = {
      ...hero,
      lockedPositiveQuirkIds: hero.lockedPositiveQuirkIds ?? [],
      diseaseIds: hero.diseaseIds ?? [],
      equippedTrinketInstanceIds: hero.equippedTrinketInstanceIds ?? [null, null],
    };
  }
  // Expedition 字段补全
  const newExpedition = {
    ...s.expedition,
    campState: s.expedition.campState ?? null,
    expeditionBuffs: s.expedition.expeditionBuffs ?? [],
    campUsed: s.expedition.campUsed ?? false,
  };
  // Campaign 字段补全
  const newCampaign = s.campaign
    ? {
        ...s.campaign,
        trinketInventory: s.campaign.trinketInventory ?? { ownedInstanceIds: [], equippedByHero: {} },
      }
    : s.campaign;
  const newState: GameState = {
    ...s,
    version: 4,
    party: newParty,
    expedition: newExpedition,
    campaign: newCampaign,
  };
  return { version: 4, state: newState, savedAt: v3.savedAt };
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
      gameVersion: '0.4.0-phase4',
      contentVersion: 'phase4',
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
