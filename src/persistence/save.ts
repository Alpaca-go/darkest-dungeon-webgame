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

const STORAGE_KEY = 'dd-web-expedition-save-v5';
const STORAGE_KEY_V4 = 'dd-web-expedition-save-v4';
const STORAGE_KEY_V3 = 'dd-web-expedition-save-v3';
const STORAGE_KEY_V2 = 'dd-web-expedition-save-v2';
const SETTINGS_KEY = 'dd-web-settings-v5';

export interface SaveData {
  version: 5 | 4;
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
      version: 5,
      state,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // 写完 v5 后清掉旧 v4
    try { localStorage.removeItem(STORAGE_KEY_V4); } catch { /* ignore */ }
  } catch (e) {
    console.warn('[save] failed to save game', e);
  }
}

export function loadGame(): SaveData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    // 优先读 v5
    const v5Raw = localStorage.getItem(STORAGE_KEY);
    if (v5Raw) {
      const data = JSON.parse(v5Raw) as SaveData;
      if (data.version !== 5) return null;
      if (data.state.version !== GAME_STATE_VERSION) return null;
      return data;
    }
    // 没有 v5 尝试 v4 迁移
    const v4Raw = localStorage.getItem(STORAGE_KEY_V4);
    if (v4Raw) {
      const v4 = JSON.parse(v4Raw) as { version: 4; state: GameState; savedAt: string };
      if (v4.version !== 4) return null;
      const migrated = migrateV4ToV5(v4);
      if (migrated) {
        saveGame(migrated.state);
        return migrated;
      }
    }
    // 没有 v4 尝试 v3 迁移(链式 v3 → v4 → v5)
    const v3Raw = localStorage.getItem(STORAGE_KEY_V3);
    if (v3Raw) {
      const v3 = JSON.parse(v3Raw) as { version: 3; state: GameState; savedAt: string };
      if (v3.version !== 3) return null;
      const v4Migrated = migrateV3ToV4(v3);
      if (v4Migrated) {
        const v5Migrated = migrateV4ToV5(v4Migrated);
        if (v5Migrated) {
          saveGame(v5Migrated.state);
          return v5Migrated;
        }
      }
    }
    // 没有 v3 尝试 v2 迁移(链式 v2 → v3 → v4 → v5)
    const v2Raw = localStorage.getItem(STORAGE_KEY_V2);
    if (v2Raw) {
      const v2 = JSON.parse(v2Raw) as { version: 2; state: GameState; savedAt: string };
      if (v2.version !== 2) return null;
      const intermediate = v2.state as unknown as GameState;
      const v2ToV4: { state: GameState; savedAt: string } = {
        state: {
          ...intermediate,
          version: 4 as typeof GAME_STATE_VERSION,
          campaign: intermediate.campaign ?? null,
          hamlet: intermediate.hamlet ?? null,
          expedition: {
            ...intermediate.expedition,
            campState: null,
            expeditionBuffs: [],
            campUsed: false,
          },
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
      const v4Migrated = migrateV3ToV4(v2ToV4);
      if (v4Migrated) {
        const v5Migrated = migrateV4ToV5(v4Migrated);
        if (v5Migrated) {
          saveGame(v5Migrated.state);
          return v5Migrated;
        }
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
    version: 4 as typeof GAME_STATE_VERSION,
    party: newParty,
    expedition: newExpedition,
    campaign: newCampaign,
  };
  return { version: 4 as const, state: newState, savedAt: v3.savedAt };
}

/**
 * V4 → V5 迁移(Phase 5):
 * - 补 campaign.regionProgress (3 区域 default progress)
 * - 补 campaign.regionDiscovery (3 区域 default discovery)
 * - 补 hamlet.selectedRegionId
 * - 升级 state.version 3 → 4
 */
function migrateV4ToV5(v4: { state: GameState; savedAt: string }): SaveData | null {
  const s = v4.state;
  // 升级 GameState.version 3 → 5
  const newState: GameState = {
    ...s,
    version: 5 as typeof GAME_STATE_VERSION,
    campaign: s.campaign
      ? {
          ...s.campaign,
          regionProgress: s.campaign.regionProgress ?? {
            ruins: {
              regionId: 'ruins',
              level: 0,
              experience: 0,
              completedQuestCount: 0,
              failedQuestCount: 0,
              retreatCount: 0,
              unlockedQuestTypeIds: [],
              discoveredContentIds: [],
              unlockedEliteEncounterIds: [],
              unlockedRareLootIds: [],
              bossQuestReady: false,
            },
            'corrupted-woods': {
              regionId: 'corrupted-woods',
              level: 0, experience: 0,
              completedQuestCount: 0, failedQuestCount: 0, retreatCount: 0,
              unlockedQuestTypeIds: [], discoveredContentIds: [],
              unlockedEliteEncounterIds: [], unlockedRareLootIds: [],
              bossQuestReady: false,
            },
            'underground-burrows': {
              regionId: 'underground-burrows',
              level: 0, experience: 0,
              completedQuestCount: 0, failedQuestCount: 0, retreatCount: 0,
              unlockedQuestTypeIds: [], discoveredContentIds: [],
              unlockedEliteEncounterIds: [], unlockedRareLootIds: [],
              bossQuestReady: false,
            },
          },
          regionDiscovery: s.campaign.regionDiscovery ?? {
            ruins: { discoveredEnemyIds: [], discoveredCurioIds: [], discoveredTrapIds: [], discoveredDiseaseIds: [], discoveredTrinketIds: [] },
            'corrupted-woods': { discoveredEnemyIds: [], discoveredCurioIds: [], discoveredTrapIds: [], discoveredDiseaseIds: [], discoveredTrinketIds: [] },
            'underground-burrows': { discoveredEnemyIds: [], discoveredCurioIds: [], discoveredTrapIds: [], discoveredDiseaseIds: [], discoveredTrinketIds: [] },
          },
        }
      : s.campaign,
    hamlet: s.hamlet
      ? { ...s.hamlet, selectedRegionId: s.hamlet.selectedRegionId ?? null }
      : s.hamlet,
  };
  return { version: 5, state: newState, savedAt: v4.savedAt };
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
