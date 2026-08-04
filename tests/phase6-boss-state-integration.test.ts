/**
 * Phase 6A 状态集成测试
 *
 * 覆盖:
 *  - CampaignState 新增 bossStates / regionThreats / campaignThreat 字段
 *  - ExpeditionState 新增 bossEncounterState / bossQuestItemIds / activeBossWeakeningEffectIds 字段
 *  - 初始化 helpers(initializeBossStates / initializeRegionThreats / createEmptyCampaignThreat)
 */

import { describe, it, expect } from 'vitest';

import {
  initializeBossStates,
  initializeRegionThreats,
  createEmptyCampaignThreat,
  BOSS_DEFINITIONS,
} from '../src/game-engine/boss/index.js';

import type {
  CampaignState,
  HamletState,
} from '../src/game-engine/campaign/types.js';
import type { ExpeditionState } from '../src/game-engine/expedition/types.js';

function freshCampaignState(): CampaignState {
  return {
    id: 'campaign-1',
    seed: 'test-seed',
    week: 1,
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
}

function freshExpeditionState(): ExpeditionState {
  return {
    id: 'exp-1',
    routeId: 'route-1',
    seed: 'test-seed',
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
    route: { id: 'route-1', name: 'Test', nodeIds: ['node-1'], forkPoints: [] },
    flags: {},
    stats: {
      deepestNodeReached: 0,
      nodesVisited: 0,
      encounterCount: 0,
      trapCount: 0,
      hungerCount: 0,
      torchUsed: 0,
      foodUsed: 0,
      lowestTorch: 0,
      lootGained: [],
      itemsDiscarded: [],
      heroLowestHp: [],
    },
    objectiveCompleted: false,
    failed: false,
  };
}

describe('Phase 6A: 初始化 helpers(SPEC §28)', () => {
  it('initializeBossStates 给所有 BOSS_DEFINITIONS 创建 hidden 状态', () => {
    const states = initializeBossStates();
    const defIds = Object.keys(BOSS_DEFINITIONS);
    expect(Object.keys(states).sort()).toEqual(defIds.sort());
    for (const id of defIds) {
      expect(states[id].bossId).toBe(id);
      expect(states[id].status).toBe('hidden');
      expect(states[id].intelligenceProgress).toBe(0);
      expect(states[id].discoveredIntelligenceEntryIds).toEqual([]);
      expect(states[id].completedInvestigationQuestIds).toEqual([]);
      expect(states[id].completedWeakeningQuestIds).toEqual([]);
      expect(states[id].activeWeakeningEffectIds).toEqual([]);
      expect(states[id].failedAttemptCount).toBe(0);
      expect(states[id].retreatCount).toBe(0);
      expect(states[id].unlockedAtWeek).toBeNull();
      expect(states[id].defeatedAtWeek).toBeNull();
    }
  });

  it('initializeRegionThreats 三个区域 × dormant 0', () => {
    const threats = initializeRegionThreats();
    expect(Object.keys(threats).sort()).toEqual([
      'ruins', 'warrens', 'weald',
    ]);
    for (const regionId of Object.keys(threats)) {
      const t = threats[regionId];
      expect(t.regionId).toBe(regionId);
      expect(t.threatValue).toBe(0);
      expect(t.state).toBe('dormant');
      expect(t.weeklyGrowth).toBe(0);
      expect(t.activeThreatModifierIds).toEqual([]);
    }
  });

  it('createEmptyCampaignThreat 全部 0/false/[]', () => {
    const t = createEmptyCampaignThreat();
    expect(t.defeatedBossIds).toEqual([]);
    expect(t.totalBossesDefeated).toBe(0);
    expect(t.campaignThreatLevel).toBe(0);
    expect(t.finalCampaignGateReady).toBe(false);
  });
});

describe('Phase 6A: CampaignState 字段扩展(SPEC §23.1)', () => {
  it('新字段是可选的,旧状态可继续工作', () => {
    const state = freshCampaignState();
    // 没设置新字段
    expect(state.bossStates).toBeUndefined();
    expect(state.regionThreats).toBeUndefined();
    expect(state.campaignThreat).toBeUndefined();
  });

  it('可以挂 bossStates / regionThreats / campaignThreat', () => {
    const state: CampaignState = {
      ...freshCampaignState(),
      bossStates: initializeBossStates(),
      regionThreats: initializeRegionThreats(),
      campaignThreat: createEmptyCampaignThreat(),
    };
    expect(state.bossStates).toBeDefined();
    expect(state.regionThreats).toBeDefined();
    expect(state.campaignThreat).toBeDefined();
    expect(Object.keys(state.bossStates!).length).toBeGreaterThan(0);
  });
});

describe('Phase 6A: ExpeditionState 字段扩展(SPEC §23.2)', () => {
  it('新字段是可选的', () => {
    const state = freshExpeditionState();
    expect(state.bossEncounterState).toBeUndefined();
    expect(state.bossQuestItemIds).toBeUndefined();
    expect(state.activeBossWeakeningEffectIds).toBeUndefined();
  });

  it('可以挂 bossEncounterState / bossQuestItemIds / activeBossWeakeningEffectIds', () => {
    const state: ExpeditionState = {
      ...freshExpeditionState(),
      bossEncounterState: null,
      bossQuestItemIds: ['item-test-sacred-water'],
      activeBossWeakeningEffectIds: ['weaken-summon-altar'],
    };
    expect(state.bossEncounterState).toBeNull();
    expect(state.bossQuestItemIds).toEqual(['item-test-sacred-water']);
    expect(state.activeBossWeakeningEffectIds).toEqual(['weaken-summon-altar']);
  });
});
