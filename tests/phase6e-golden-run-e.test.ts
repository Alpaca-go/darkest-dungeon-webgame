/**
 * Phase 6E Golden Run E 测试(SPEC §38)
 *
 * Seed: DD-WEB-PHASE6-CAMPAIGN-001
 *
 * 流程(三 Boss 全部击败,验证战役总进度):
 *  - 击败The Necromancer(boss-test-arbiter,region: ruins)
 *  - 击败The Hag(boss-spore-matriarch,region: corrupted-woods)
 *  - 击败The Swine Prince(boss-burrows-devourer,region: underground-burrows)
 *  - 验证:
 *    - defeatedBossIds.length = 3
 *    - totalBossesDefeated = 3
 *    - finalCampaignGateReady = true
 *  - 验证:每个 Boss 只计数一次(状态已 defeated 不可再次击败)
 *  - 验证:三个区域都处于 boss-defeated 状态
 *  - 验证:最终战役接口在 3 Boss 全部击败后开启
 *  - 验证:同 seed 可复现
 *
 * 验收:
 *  - 每个 Boss 只计数一次
 *  - 最终接口只在三个 Boss 击败后开启
 *  - Phase 6 不进入最终地牢
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Mulberry32 } from '../src/game-engine/rng/mulberry32.js';
import { dispatchGameCommand } from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import type { GameState } from '../src/game-engine/expedition/types.js';
import type { CampaignState } from '../src/game-engine/campaign/types.js';
import { BOSS_DEFINITIONS } from '../src/game-engine/boss/registry.js';

const SEED = 'DD-WEB-PHASE6-CAMPAIGN-001';
const ARBITER_BOSS_ID = 'boss-test-arbiter';
const SPORE_BOSS_ID = 'boss-spore-matriarch';
const BURROWS_BOSS_ID = 'boss-burrows-devourer';

const ALL_BOSS_IDS = [ARBITER_BOSS_ID, SPORE_BOSS_ID, BURROWS_BOSS_ID];

function freshGameState(seed: string = SEED, week: number = 1): GameState {
  const campaign: CampaignState = {
    id: 'campaign-1',
    seed,
    week,
    gold: 100,
    heirlooms: { portraits: 0, crests: 0 },
    rosterCapacity: 4,
    rosterHeroIds: [],
    deadHeroIds: [],
    completedQuestIds: [],
    availableQuestIds: [],
    availableRecruitIds: [],
    facilityStates: {},
    status: 'active',
  };
  return {
    version: 7,
    mode: 'hamlet-overview',
    seed,
    expedition: {
      id: 'exp-1',
      routeId: 'route-1',
      seed,
      startedAt: '2026-01-01T00:00:00.000Z',
      currentNodeId: 'node-1',
      visitedNodeIds: ['node-1'],
      depth: 1,
      timeElapsed: 0,
      torch: 100,
      keyChoices: [],
      keyEvents: [],
      firedEventIds: [],
      eventCooldowns: {},
      scoutLevel: 0,
      route: {
        id: 'route-1',
        regionId: 'ruins',
        seed,
        startNodeId: 'node-1',
        objectiveNodeId: 'node-1',
        exitNodeIds: ['node-1'],
        nodes: {
          'node-1': { id: 'node-1', type: 'objective', sceneId: 's1', title: 'T', description: 'T', baseScoutLevel: 0, weight: 1 },
        },
        edges: [],
        forks: [],
      },
      flags: {},
      stats: {
        deepestNodeReached: 0, nodesVisited: 0, encounterCount: 0, trapCount: 0, hungerCount: 0,
        torchUsed: 0, foodUsed: 0, lowestTorch: 0, lootGained: [], itemsDiscarded: [], heroLowestHp: [],
      },
      objectiveCompleted: false,
      failed: false,
    } as any,
    party: {},
    encounter: null,
    pendingDecision: null,
    lastResolution: null,
    campaign,
    hamlet: null,
    inventory: { stacks: [], capacity: 16 } as any,
    torch: { value: 100, max: 100, level: 'radiant' },
    eventLog: [],
    rng: { algorithm: 'mulberry32', state: new Mulberry32(seed).state.state },
    lastTransactionId: null,
    activeOverlay: null,
    deathRecords: [],
  };
}

function bossState(state: GameState, bossId: string): any {
  return state.campaign!.bossStates![bossId];
}

function bossEvents(state: GameState, type: string): number {
  return state.eventLog.filter((e) => e.type === type).length;
}

/**
 * 通过 DEBUG_FORCE_BOSS_DEFEAT 直接让一个 Boss 进入 defeated 状态
 * (不模拟完整准备/启动/战斗流程;只验证战役进度)
 */
function fastDefeatBoss(state: GameState, bossId: string): GameState {
  // 先把 boss 设为 active 状态,smResolveDefeat 才允许执行
  state = dispatchGameCommand(state, {
    type: 'DEBUG_SET_BOSS_STATUS',
    bossId,
    status: 'active',
    commandId: newCommandId('test'),
  });
  return dispatchGameCommand(state, {
    type: 'DEBUG_FORCE_BOSS_DEFEAT',
    bossId,
    commandId: newCommandId('test'),
  });
}

// =====================================================================
// 三 Boss 全部击败
// =====================================================================

describe('Phase 6E Golden Run E: 三 Boss 全部击败(SPEC §38)', () => {
  let state: GameState;

  beforeEach(() => {
    state = freshGameState();
  });

  it('Step 1: 击败The Necromancer → totalBossesDefeated = 1', () => {
    state = fastDefeatBoss(state, ARBITER_BOSS_ID);
    expect(bossState(state, ARBITER_BOSS_ID).status).toBe('defeated');
    const ct = state.campaign!.campaignThreat!;
    expect(ct.totalBossesDefeated).toBe(1);
    expect(ct.defeatedBossIds).toEqual([ARBITER_BOSS_ID]);
    expect(ct.finalCampaignGateReady).toBe(false);
  });

  it('Step 2: 击败The Necromancer + The Hag → totalBossesDefeated = 2', () => {
    state = fastDefeatBoss(state, ARBITER_BOSS_ID);
    state = fastDefeatBoss(state, SPORE_BOSS_ID);
    const ct = state.campaign!.campaignThreat!;
    expect(ct.totalBossesDefeated).toBe(2);
    expect(ct.defeatedBossIds).toContain(ARBITER_BOSS_ID);
    expect(ct.defeatedBossIds).toContain(SPORE_BOSS_ID);
    expect(ct.finalCampaignGateReady).toBe(false);
  });

  it('Step 3: 三 Boss 全部击败 → totalBossesDefeated = 3 + finalCampaignGateReady = true', () => {
    for (const bossId of ALL_BOSS_IDS) {
      state = fastDefeatBoss(state, bossId);
    }
    const ct = state.campaign!.campaignThreat!;
    expect(ct.totalBossesDefeated).toBe(3);
    expect(ct.defeatedBossIds.length).toBe(3);
    for (const id of ALL_BOSS_IDS) {
      expect(ct.defeatedBossIds).toContain(id);
    }
    expect(ct.finalCampaignGateReady).toBe(true);
    // 验证事件
    expect(bossEvents(state, 'FINAL_CAMPAIGN_GATE_MARKED_READY')).toBe(1);
  });

  it('Step 4: 每个 Boss 只计数一次(已 defeated 不可再次击败)', () => {
    state = fastDefeatBoss(state, ARBITER_BOSS_ID);
    expect(bossState(state, ARBITER_BOSS_ID).status).toBe('defeated');
    // 再次 RESOLVE_BOSS_DEFEAT 同一个 boss 应该失败
    expect(() => {
      dispatchGameCommand(state, {
        type: 'RESOLVE_BOSS_DEFEAT',
        bossId: ARBITER_BOSS_ID,
        commandId: newCommandId('test'),
      });
    }).toThrow();
    // totalBossesDefeated 仍为 1
    expect(state.campaign!.campaignThreat!.totalBossesDefeated).toBe(1);
  });

  it('Step 5: 三 Boss 击败后,三个区域都处于 boss-defeated 状态', () => {
    for (const bossId of ALL_BOSS_IDS) {
      state = dispatchGameCommand(state, {
        type: 'DEBUG_SET_REGION_THREAT',
        regionId: BOSS_DEFINITIONS[bossId].regionId,
        value: 80,
        commandId: newCommandId('test'),
      });
      state = fastDefeatBoss(state, bossId);
    }
    expect(state.campaign!.regionThreats!['ruins'].state).toBe('boss-defeated');
    expect(state.campaign!.regionThreats!['weald'].state).toBe('boss-defeated');
    expect(state.campaign!.regionThreats!['warrens'].state).toBe('boss-defeated');
  });

  it('Step 6: 顺序不影响结果(任何顺序击败 3 Boss 都能开 finalCampaignGateReady)', () => {
    const orderings = [
      [BURROWS_BOSS_ID, ARBITER_BOSS_ID, SPORE_BOSS_ID],
      [SPORE_BOSS_ID, BURROWS_BOSS_ID, ARBITER_BOSS_ID],
      [SPORE_BOSS_ID, ARBITER_BOSS_ID, BURROWS_BOSS_ID],
    ];
    for (const order of orderings) {
      let s = freshGameState();
      for (const id of order) {
        s = fastDefeatBoss(s, id);
      }
      expect(s.campaign!.campaignThreat!.finalCampaignGateReady).toBe(true);
      expect(s.campaign!.campaignThreat!.totalBossesDefeated).toBe(3);
    }
  });
});

// =====================================================================
// 刷新恢复
// =====================================================================

describe('Phase 6E Golden Run E: 刷新恢复(SPEC §27)', () => {
  it('同 seed 跑两次 → defeatedBossIds 一致 + finalCampaignGateReady 一致', () => {
    const run = (): { ids: string[]; ready: boolean; total: number } => {
      let s = freshGameState();
      for (const id of ALL_BOSS_IDS) {
        s = fastDefeatBoss(s, id);
      }
      const ct = s.campaign!.campaignThreat!;
      return {
        ids: [...ct.defeatedBossIds].sort(),
        ready: ct.finalCampaignGateReady,
        total: ct.totalBossesDefeated,
      };
    };
    const r1 = run();
    const r2 = run();
    expect(r1).toEqual(r2);
  });
});

// =====================================================================
// 不变量校验
// =====================================================================

describe('Phase 6E Golden Run E: 不变量(SPEC §27)', () => {
  it('3 个 Boss 全部存在于 BOSS_DEFINITIONS', () => {
    for (const id of ALL_BOSS_IDS) {
      expect(BOSS_DEFINITIONS[id]).toBeDefined();
    }
  });

  it('3 个 Boss 分布在 3 个不同区域', () => {
    const regions = ALL_BOSS_IDS.map((id) => BOSS_DEFINITIONS[id].regionId);
    expect(new Set(regions).size).toBe(3);
  });

  it('每个 Boss 都有 permanentRewardId', () => {
    for (const id of ALL_BOSS_IDS) {
      expect(BOSS_DEFINITIONS[id].permanentRewardId).toBeDefined();
    }
  });

  it('区域威胁不得低于 0 或高于 100(SPEC §27)', () => {
    let s = freshGameState();
    // 把 burrows 设为 100
    s = dispatchGameCommand(s, {
      type: 'DEBUG_SET_REGION_THREAT',
      regionId: 'warrens',
      value: 100,
      commandId: newCommandId('test'),
    });
    expect(s.campaign!.regionThreats!['warrens'].threatValue).toBe(100);
    // 击败后下降到 40(clamp 100 - 60 = 40)
    s = fastDefeatBoss(s, BURROWS_BOSS_ID);
    expect(s.campaign!.regionThreats!['warrens'].threatValue).toBe(40);
    expect(s.campaign!.regionThreats!['warrens'].threatValue).toBeGreaterThanOrEqual(0);
    expect(s.campaign!.regionThreats!['warrens'].threatValue).toBeLessThanOrEqual(100);
  });
});
