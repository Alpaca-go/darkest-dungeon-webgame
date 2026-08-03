/**
 * Phase 4 P4.5 存档迁移测试
 *
 * 覆盖:
 *  - v4 存档正常读写
 *  - v3 存档自动迁移到 v4
 *  - v2 存档链式迁移到 v4(v2 → v3 → v4)
 *  - 迁移保留远征状态(hero stress、HP、position)
 *  - 迁移后写 v4 并清旧版本
 *  - 错误版本拒绝
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, clearGame } from '../src/persistence/save.js';
import type { GameState, HeroInstance } from '../src/game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../src/game-engine/expedition/types.js';

const STORAGE_KEY_V4 = 'dd-web-expedition-save-v4';
const STORAGE_KEY_V3 = 'dd-web-expedition-save-v3';
const STORAGE_KEY_V2 = 'dd-web-expedition-save-v2';

// 内存 mock
const memStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => memStore.get(k) ?? null,
  setItem: (k: string, v: string) => { memStore.set(k, v); },
  removeItem: (k: string) => { memStore.delete(k); },
  clear: () => memStore.clear(),
  key: (i: number) => Array.from(memStore.keys())[i] ?? null,
  get length() { return memStore.size; },
};

function freshHero(id: string, name: string, archetype: HeroInstance['archetype'], rank: 1 | 2 | 3 | 4, maxHp: number): HeroInstance {
  return {
    id, name, archetype, tags: [], rank,
    hp: maxHp, maxHp, protection: 0.1, dodge: 5, speed: 5, accuracy: 0.85, crit: 0.05,
    bleedResist: 0.3, blightResist: 0.3, stunResist: 0.3, moveResist: 0.3,
    bleed: [], blight: [], stun: null, mark: null, protBuff: null,
    cooldowns: {}, isDead: false, conditions: [], skills: ['s1', 's2'],
    stress: 0, resolveState: 'stable', afflictionId: null, virtueId: null,
    atDeathsDoor: false, deathsDoorRecoveryStacks: 0, deathblowPenalty: 0, heartAttackCount: 0,
    behaviorCooldowns: {},
  };
}

function freshV4State(): GameState {
  return {
    version: 4,
    mode: 'hamlet-overview',
    seed: 'save-test-seed',
    expedition: {
      id: '', routeId: '', seed: 'save-test-seed', startedAt: new Date().toISOString(),
      currentNodeId: '', visitedNodeIds: [], depth: 0,
      timeElapsed: 0, torch: 100, keyChoices: [], keyEvents: [], firedEventIds: [],
      eventCooldowns: {}, scoutLevel: 'unknown',
      route: { id: '', regionId: '', seed: 'save-test-seed', startNodeId: '', objectiveNodeId: '', exitNodeIds: [], nodes: {}, edges: [], forks: [] },
      flags: {},
      stats: { deepestNodeReached: 0, nodesVisited: 0, encounterCount: 0, trapCount: 0, hungerCount: 0, torchUsed: 0, foodUsed: 0, lowestTorch: 100, lootGained: [], itemsDiscarded: [], heroLowestHp: [] },
      objectiveCompleted: false, failed: false,
      campState: null, expeditionBuffs: [], campUsed: false,
    },
    party: {
      'h.1': {
        ...freshHero('h.1', 'Reynauld', 'crusader', 1, 25),
        lockedPositiveQuirkIds: [],
        diseaseIds: [],
        equippedTrinketInstanceIds: [null, null],
      },
    },
    encounter: null, pendingDecision: null, lastResolution: null,
    inventory: { capacity: 16, stacks: [] },
    torch: { value: 100, level: 'radiant' },
    eventLog: [], rng: { state: 0 },
    lastTransactionId: null,
    activeOverlay: null, deathRecords: [], pendingMentalFlags: [], derivedEventDepth: 0,
    campaign: null, hamlet: null,
  };
}

/** 模拟 v3 存档: state.version = 3, 缺 campState/expeditionBuffs/campUsed, 缺 trinketInventory, hero 缺 P4 字段 */
function freshV3State(): GameState {
  return {
    version: 3,
    mode: 'node-introduction',
    seed: 'v3-save-test',
    expedition: {
      id: 'exp_v3', routeId: '', seed: 'v3-save-test', startedAt: '2024-01-01T00:00:00.000Z',
      currentNodeId: 'n_start', visitedNodeIds: ['n_start'], depth: 1,
      timeElapsed: 0, torch: 80, keyChoices: [], keyEvents: [], firedEventIds: [],
      eventCooldowns: {}, scoutLevel: 'unknown',
      route: { id: '', regionId: '', seed: 'v3-save-test', startNodeId: 'n_start', objectiveNodeId: '', exitNodeIds: [], nodes: {}, edges: [], forks: [] },
      flags: {},
      stats: { deepestNodeReached: 1, nodesVisited: 1, encounterCount: 0, trapCount: 0, hungerCount: 0, torchUsed: 0, foodUsed: 0, lowestTorch: 100, lootGained: [], itemsDiscarded: [], heroLowestHp: [] },
      objectiveCompleted: false, failed: false,
    },
    party: {
      'h.1': {
        ...freshHero('h.1', 'Reynauld', 'crusader', 1, 25),
        stress: 50,
        hp: 15,
      },
    },
    encounter: null, pendingDecision: null, lastResolution: null,
    inventory: { capacity: 16, stacks: [] },
    torch: { value: 80, level: 'bright' },
    eventLog: [],
    rng: { state: 0 },
    lastTransactionId: null,
    activeOverlay: null, deathRecords: [], pendingMentalFlags: [], derivedEventDepth: 0,
    campaign: null, hamlet: null,
  };
}

/** 模拟 v2 存档: 缺 campaign/hamlet 字段 */
function freshV2State(): any {
  return {
    version: 2,
    mode: 'node-introduction',
    seed: 'v2-save-test',
    expedition: {
      id: 'exp_v2', routeId: '', seed: 'v2-save-test', startedAt: '2024-01-01T00:00:00.000Z',
      currentNodeId: 'n_start', visitedNodeIds: ['n_start'], depth: 1,
      timeElapsed: 0, torch: 80, keyChoices: [], keyEvents: [], firedEventIds: [],
      eventCooldowns: {}, scoutLevel: 'unknown',
      route: { id: '', regionId: '', seed: 'v2-save-test', startNodeId: 'n_start', objectiveNodeId: '', exitNodeIds: [], nodes: {}, edges: [], forks: [] },
      flags: {},
      stats: { deepestNodeReached: 1, nodesVisited: 1, encounterCount: 0, trapCount: 0, hungerCount: 0, torchUsed: 0, foodUsed: 0, lowestTorch: 100, lootGained: [], itemsDiscarded: [], heroLowestHp: [] },
      objectiveCompleted: false, failed: false,
    },
    party: {
      'h.1': {
        ...freshHero('h.1', 'Reynauld', 'crusader', 1, 25),
        stress: 80,
        hp: 5,
      },
    },
    encounter: null, pendingDecision: null, lastResolution: null,
    inventory: { capacity: 16, stacks: [] },
    torch: { value: 80, level: 'bright' },
    eventLog: [],
    rng: { state: 0 },
    lastTransactionId: null,
    activeOverlay: null, deathRecords: [], pendingMentalFlags: [], derivedEventDepth: 0,
  };
}

beforeEach(() => {
  memStore.clear();
});

describe('Phase 4 P4.5 save: v4 读写', () => {
  it('saveGame + loadGame:正常读写 v4 存档', () => {
    const s = freshV4State();
    s.campaign = {
      id: 'camp_test', seed: 'save-test-seed', week: 5, gold: 6500,
      heirlooms: { portraits: 8, crests: 14 },
      rosterCapacity: 8, rosterHeroIds: ['h.1'], deadHeroIds: [],
      completedQuestIds: [], availableQuestIds: [], availableRecruitIds: [],
      facilityStates: {} as any,
      status: 'active',
      trinketInventory: { ownedInstanceIds: [], equippedByHero: {} },
    };
    saveGame(s);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(4);
    expect(loaded!.state.campaign?.week).toBe(5);
    expect(loaded!.state.campaign?.gold).toBe(6500);
    expect(loaded!.state.campaign?.trinketInventory).toBeDefined();
  });

  it('loadGame 无存档 → null', () => {
    expect(loadGame()).toBeNull();
  });

  it('clearGame 清掉存档', () => {
    saveGame(freshV4State());
    clearGame();
    expect(loadGame()).toBeNull();
  });
});

describe('Phase 4 P4.5 save: v3 → v4 迁移', () => {
  it('v3 存档自动迁移到 v4,补 Phase 4 字段', () => {
    const v3Save = { version: 3, state: freshV3State(), savedAt: '2025-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(v3Save));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(4);
    expect(loaded!.state.version).toBe(GAME_STATE_VERSION);
    // 远征状态保留
    expect(loaded!.state.party['h.1']!.stress).toBe(50);
    expect(loaded!.state.party['h.1']!.hp).toBe(15);
    expect(loaded!.state.mode).toBe('node-introduction');
    // Phase 4 字段补全
    expect(loaded!.state.party['h.1']!.lockedPositiveQuirkIds).toEqual([]);
    expect(loaded!.state.party['h.1']!.diseaseIds).toEqual([]);
    expect(loaded!.state.party['h.1']!.equippedTrinketInstanceIds).toEqual([null, null]);
    expect(loaded!.state.expedition.campState).toBeNull();
    expect(loaded!.state.expedition.expeditionBuffs).toEqual([]);
    expect(loaded!.state.expedition.campUsed).toBe(false);
  });

  it('v3 迁移后写 v4 + 清 v3', () => {
    const v3Save = { version: 3, state: freshV3State(), savedAt: '2025-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(v3Save));
    loadGame();
    expect(localStorage.getItem(STORAGE_KEY_V3)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY_V4)).not.toBeNull();
  });
});

describe('Phase 4 P4.5 save: v2 → v4 链式迁移', () => {
  it('v2 存档链式迁移 v2 → v3 → v4', () => {
    const v2Save = { version: 2, state: freshV2State(), savedAt: '2024-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(v2Save));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(4);
    // 远征状态保留
    expect(loaded!.state.party['h.1']!.stress).toBe(80);
    expect(loaded!.state.party['h.1']!.hp).toBe(5);
    // campaign/hamlet 留空
    expect(loaded!.state.campaign).toBeNull();
    expect(loaded!.state.hamlet).toBeNull();
    // Phase 4 字段补全
    expect(loaded!.state.party['h.1']!.lockedPositiveQuirkIds).toEqual([]);
    expect(loaded!.state.expedition.campUsed).toBe(false);
  });
});

describe('Phase 4 P4.5 save: 错误版本拒绝', () => {
  it('错误版本号 → null', () => {
    const bad = { version: 999, state: freshV4State(), savedAt: '2024-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY_V4, JSON.stringify(bad));
    expect(loadGame()).toBeNull();
  });

  it('state.version !== GAME_STATE_VERSION → null', () => {
    const s = freshV4State();
    s.version = 2;
    const bad = { version: 4, state: s, savedAt: '2024-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY_V4, JSON.stringify(bad));
    expect(loadGame()).toBeNull();
  });
});
