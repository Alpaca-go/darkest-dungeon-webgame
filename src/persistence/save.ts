/**
 * 存档(Phase 4 P4.5 + Phase 6 + Phase 7)
 *
 * 持久化:
 * - 完整 GameState(v7,含 Phase 7 最终战役字段)
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
 * - Phase 5: 区域进度 / 区域发现
 * - Phase 6: Boss 状态 / 区域威胁 / 战役总进度
 * - Phase 7: 最终战役状态 / 结局
 *
 * 版本迁移:
 * - v2 → v3: 补 campaign/hamlet 字段
 * - v3 → v4: 补 hero.lockedPositiveQuirkIds/diseaseIds/equippedTrinketInstanceIds,
 *            补 campaign.trinketInventory, 补 expedition.campState/expeditionBuffs/campUsed
 * - v4 → v5: 补 regionProgress / regionDiscovery / selectedRegionId
 * - v5 → v6: 补 bossStates / regionThreats / campaignThreat / bossEncounterState
 * - v6 → v7: 补 finalCampaignState / campaignEnding
 *
 * 不会保存 UI 状态(由 UI Store 重新初始化)
 */

import type { GameState } from '../game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../game-engine/expedition/types.js';
import { createEmptyFinalCampaignState } from '../game-engine/final/index.js';

const STORAGE_KEY = 'dd-web-expedition-save-v7';
const STORAGE_KEY_V6 = 'dd-web-expedition-save-v6';
const STORAGE_KEY_V5 = 'dd-web-expedition-save-v5';
const STORAGE_KEY_V4 = 'dd-web-expedition-save-v4';
const STORAGE_KEY_V3 = 'dd-web-expedition-save-v3';
const STORAGE_KEY_V2 = 'dd-web-expedition-save-v2';
const SETTINGS_KEY = 'dd-web-settings-v6';

export interface SaveData {
  version: 7 | 6 | 5 | 4;
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
      version: 7,
      state,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // 写完 v7 后清掉旧 v6 / v5
    try { localStorage.removeItem(STORAGE_KEY_V6); } catch { /* ignore */ }
    try { localStorage.removeItem(STORAGE_KEY_V5); } catch { /* ignore */ }
  } catch (e) {
    console.warn('[save] failed to save game', e);
  }
}

export function loadGame(): SaveData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    // 优先读 v7
    const v7Raw = localStorage.getItem(STORAGE_KEY);
    if (v7Raw) {
      const data = JSON.parse(v7Raw) as SaveData;
      if (data.version !== 7) return null;
      if (data.state.version !== GAME_STATE_VERSION) return null;
      return data;
    }
    // 没有 v7 尝试 v6 迁移
    const v6Raw = localStorage.getItem(STORAGE_KEY_V6);
    if (v6Raw) {
      const v6 = JSON.parse(v6Raw) as { version: 6; state: GameState; savedAt: string };
      if (v6.version !== 6) return null;
      const migrated = migrateV6ToV7(v6);
      if (migrated) {
        saveGame(migrated.state);
        return migrated;
      }
    }
    // 没有 v6 尝试 v5 迁移(链式 v5 → v6 → v7)
    const v5Raw = localStorage.getItem(STORAGE_KEY_V5);
    if (v5Raw) {
      const v5 = JSON.parse(v5Raw) as { version: 5; state: GameState; savedAt: string };
      if (v5.version !== 5) return null;
      const v6Migrated = migrateV5ToV6(v5);
      if (v6Migrated) {
        const v7Migrated = migrateV6ToV7(v6Migrated);
        if (v7Migrated) {
          saveGame(v7Migrated.state);
          return v7Migrated;
        }
      }
    }
    // 没有 v5 尝试 v4 迁移(链式 v4 → v5 → v6 → v7)
    const v4Raw = localStorage.getItem(STORAGE_KEY_V4);
    if (v4Raw) {
      const v4 = JSON.parse(v4Raw) as { version: 4; state: GameState; savedAt: string };
      if (v4.version !== 4) return null;
      const v5Migrated = migrateV4ToV5(v4);
      if (v5Migrated) {
        const v6Migrated = migrateV5ToV6(v5Migrated);
        if (v6Migrated) {
          const v7Migrated = migrateV6ToV7(v6Migrated);
          if (v7Migrated) {
            saveGame(v7Migrated.state);
            return v7Migrated;
          }
        }
      }
    }
    // 没有 v4 尝试 v3 迁移(链式 v3 → v4 → v5 → v6 → v7)
    const v3Raw = localStorage.getItem(STORAGE_KEY_V3);
    if (v3Raw) {
      const v3 = JSON.parse(v3Raw) as { version: 3; state: GameState; savedAt: string };
      if (v3.version !== 3) return null;
      const v4Migrated = migrateV3ToV4(v3);
      if (v4Migrated) {
        const v5Migrated = migrateV4ToV5(v4Migrated);
        if (v5Migrated) {
          const v6Migrated = migrateV5ToV6(v5Migrated);
          if (v6Migrated) {
            const v7Migrated = migrateV6ToV7(v6Migrated);
            if (v7Migrated) {
              saveGame(v7Migrated.state);
              return v7Migrated;
            }
          }
        }
      }
    }
    // 没有 v3 尝试 v2 迁移(链式 v2 → v3 → v4 → v5 → v6 → v7)
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
          const v6Migrated = migrateV5ToV6(v5Migrated);
          if (v6Migrated) {
            const v7Migrated = migrateV6ToV7(v6Migrated);
            if (v7Migrated) {
              saveGame(v7Migrated.state);
              return v7Migrated;
            }
          }
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
            'weald': {
              regionId: 'weald',
              level: 0, experience: 0,
              completedQuestCount: 0, failedQuestCount: 0, retreatCount: 0,
              unlockedQuestTypeIds: [], discoveredContentIds: [],
              unlockedEliteEncounterIds: [], unlockedRareLootIds: [],
              bossQuestReady: false,
            },
            'warrens': {
              regionId: 'warrens',
              level: 0, experience: 0,
              completedQuestCount: 0, failedQuestCount: 0, retreatCount: 0,
              unlockedQuestTypeIds: [], discoveredContentIds: [],
              unlockedEliteEncounterIds: [], unlockedRareLootIds: [],
              bossQuestReady: false,
            },
          },
          regionDiscovery: s.campaign.regionDiscovery ?? {
            ruins: { discoveredEnemyIds: [], discoveredCurioIds: [], discoveredTrapIds: [], discoveredDiseaseIds: [], discoveredTrinketIds: [] },
            'weald': { discoveredEnemyIds: [], discoveredCurioIds: [], discoveredTrapIds: [], discoveredDiseaseIds: [], discoveredTrinketIds: [] },
            'warrens': { discoveredEnemyIds: [], discoveredCurioIds: [], discoveredTrapIds: [], discoveredDiseaseIds: [], discoveredTrinketIds: [] },
          },
        }
      : s.campaign,
    hamlet: s.hamlet
      ? { ...s.hamlet, selectedRegionId: s.hamlet.selectedRegionId ?? null }
      : s.hamlet,
  };
  return { version: 5, state: newState, savedAt: v4.savedAt };
}

/**
 * V5 → V6 迁移(Phase 6):
 *  - 升级 state.version 5 → 6
 *  - 补 campaign.bossStates(懒初始化;但为了"加载即可用",这里直接初始化)
 *  - 补 campaign.regionThreats(同上)
 *  - 补 campaign.campaignThreat(同上)
 *  - 补 expedition.bossEncounterState / bossQuestItemIds / activeBossWeakeningEffectIds
 *  - 把已有 bossQuestReady 迁移为 BossCampaignState.status(SPEC §28)
 */
function migrateV5ToV6(v5: { state: GameState; savedAt: string }): SaveData | null {
  const s = v5.state;
  // 构造 v6 campaign
  const campaign = s.campaign
    ? {
        ...s.campaign,
        bossStates: s.campaign.bossStates ?? (() => {
          // 懒初始化:根据 regionProgress.bossQuestReady 推断 status
          const result: Record<string, import('../game-engine/boss/types.js').BossCampaignState> = {};
          const bossIds = Object.keys(s.campaign!.regionProgress ?? {});
          for (const regionId of bossIds) {
            const progress = s.campaign!.regionProgress![regionId];
            const bossId = `boss-test-arbiter`; // 6A 只有一个测试 boss
            // 6B 阶段都是测试 boss,真实 3 boss 在 6C/6D
            const ready = progress?.bossQuestReady === true;
            const status: import('../game-engine/boss/types.js').BossStatus = ready
              ? 'rumored'
              : 'hidden';
            // 只对测试 boss 区域(ruins)初始化
            if (regionId === 'ruins') {
              result[bossId] = {
                bossId,
                regionId: 'ruins' as any,
                status,
                intelligenceProgress: 0,
                discoveredIntelligenceEntryIds: [],
                completedInvestigationQuestIds: [],
                completedWeakeningQuestIds: [],
                activeWeakeningEffectIds: [],
                failedAttemptCount: 0,
                retreatCount: 0,
                unlockedAtWeek: ready ? s.campaign!.week : null,
                defeatedAtWeek: null,
              };
            }
          }
          return result;
        })(),
        regionThreats: s.campaign.regionThreats ?? (() => {
          const result: Record<string, import('../game-engine/boss/types.js').RegionThreatProgress> = {};
          for (const regionId of ['ruins', 'weald', 'warrens']) {
            result[regionId] = {
              regionId: regionId as any,
              state: 'dormant',
              threatValue: 0,
              weeklyGrowth: 0,
              activeThreatModifierIds: [],
            };
          }
          return result;
        })(),
        campaignThreat: s.campaign.campaignThreat ?? {
          defeatedBossIds: [],
          totalBossesDefeated: 0,
          campaignThreatLevel: 0,
          finalCampaignGateReady: false,
        },
      }
    : s.campaign;
  // 构造 v6 expedition
  const expedition = {
    ...s.expedition,
    bossEncounterState: s.expedition.bossEncounterState ?? null,
    bossQuestItemIds: s.expedition.bossQuestItemIds ?? [],
    activeBossWeakeningEffectIds: s.expedition.activeBossWeakeningEffectIds ?? [],
  };
  const newState: GameState = {
    ...s,
    version: 6 as typeof GAME_STATE_VERSION,
    campaign,
    expedition,
  };
  return { version: 6, state: newState, savedAt: v5.savedAt };
}

/**
 * V6 → V7 迁移(Phase 7):
 *  - 升级 state.version 6 → 7
 *  - 补 campaign.finalCampaignState
 *    - 如果 finalCampaignGateReady === true,status = 'gate-ready'
 *    - 否则 status = 'locked'
 *  - 补 campaign.campaignEnding = null
 *  - 所有既有 Boss / 死亡 / 墓园 / 英雄和区域记录必须保持不变(SPEC §20)
 */
function migrateV6ToV7(v6: { state: GameState; savedAt: string }): SaveData | null {
  const s = v6.state;
  const isGateReady = s.campaign?.campaignThreat?.finalCampaignGateReady === true;
  const finalCampaignState = createEmptyFinalCampaignState();
  if (isGateReady) {
    finalCampaignState.status = 'gate-ready';
  }
  const campaign = s.campaign
    ? {
        ...s.campaign,
        finalCampaignState,
        campaignEnding: null,
      }
    : s.campaign;
  const newState: GameState = {
    ...s,
    version: 7 as typeof GAME_STATE_VERSION,
    campaign,
  };
  return { version: 7, state: newState, savedAt: v6.savedAt };
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
