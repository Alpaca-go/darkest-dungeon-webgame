/**
 * Phase 3 存档迁移测试
 *
 * 覆盖:
 *  - v3 存档正常读写
 *  - v2 存档自动迁移到 v3
 *  - 迁移保留远征状态(hero stress、HP、position)
 *  - 迁移后写 v3 并清 v2
 *  - 错误版本拒绝
 */

// Node 环境无 localStorage,用内存 mock
import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, clearGame, type SaveData } from '../src/persistence/save.js';
import type { GameState, HeroInstance } from '../src/game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../src/game-engine/expedition/types.js';

const STORAGE_KEY = 'dd-web-expedition-save-v3';
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

function freshV3State(): GameState {
  return {
    version: GAME_STATE_VERSION,
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
    },
    party: {
      'h.1': freshHero('h.1', 'Reynauld', 'crusader', 1, 25),
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

function freshV2State(): GameState {
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
    // v2 没有 campaign/hamlet 字段
  };
}

beforeEach(() => {
  memStore.clear();
});

describe('Phase 3 save: v3 读写', () => {
  it('saveGame + loadGame:正常读写 v3 存档', () => {
    const s = freshV3State();
    s.campaign = {
      id: 'camp_test', seed: 'save-test-seed', week: 5, gold: 6500,
      heirlooms: { portraits: 8, crests: 14 },
      rosterCapacity: 8, rosterHeroIds: ['h.1'], deadHeroIds: [],
      completedQuestIds: [], availableQuestIds: [], availableRecruitIds: [],
      facilityStates: {} as any,
      status: 'active',
    };
    saveGame(s);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(3);
    expect(loaded!.state.campaign?.week).toBe(5);
    expect(loaded!.state.campaign?.gold).toBe(6500);
  });

  it('loadGame 无存档 → null', () => {
    expect(loadGame()).toBeNull();
  });

  it('clearGame 清掉存档', () => {
    saveGame(freshV3State());
    clearGame();
    expect(loadGame()).toBeNull();
  });
});

describe('Phase 3 save: v2 → v3 迁移', () => {
  it('v2 存档(无 campaign/hamlet)自动迁移到 v3', () => {
    // 写 v2 存档
    const v2Save = { version: 2, state: freshV2State(), savedAt: '2024-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(v2Save));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(3);
    expect(loaded!.state.version).toBe(3);
    // 远征状态保留
    expect(loaded!.state.party['h.1']!.stress).toBe(50);
    expect(loaded!.state.party['h.1']!.hp).toBe(15);
    expect(loaded!.state.mode).toBe('node-introduction');
    // campaign/hamlet 留空
    expect(loaded!.state.campaign).toBeNull();
    expect(loaded!.state.hamlet).toBeNull();
  });

  it('迁移后自动写 v3 + 清 v2', () => {
    const v2Save = { version: 2, state: freshV2State(), savedAt: '2024-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(v2Save));
    loadGame();
    // v2 已被清
    expect(localStorage.getItem(STORAGE_KEY_V2)).toBeNull();
    // v3 已写
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('v3 优先 v2:同时有 v2/v3 → 读 v3', () => {
    const v2Save = { version: 2, state: freshV2State(), savedAt: '2024-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(v2Save));
    const v3Save: SaveData = { version: 3, state: freshV3State(), savedAt: '2025-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v3Save));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(3);
    // v3 存档的 hero (no stress) 而不是 v2 (stress 50)
    expect(loaded!.state.party['h.1']!.stress).toBe(0);
  });
});

describe('Phase 3 save: 错误版本拒绝', () => {
  it('错误 v3 版本号 → null', () => {
    const bad = { version: 999, state: freshV3State(), savedAt: '2024-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bad));
    expect(loadGame()).toBeNull();
  });

  it('state.version !== GAME_STATE_VERSION → null', () => {
    const s = freshV3State();
    s.version = 2; // state version 错
    const bad = { version: 3, state: s, savedAt: '2024-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bad));
    expect(loadGame()).toBeNull();
  });
});
