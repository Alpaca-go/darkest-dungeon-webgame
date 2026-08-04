/**
 * Phase 6A Boss dispatcher 集成测试
 *
 * 覆盖:
 *  - 13 个业务命令 + 关键调试命令接通
 *  - state 正确变化(懒初始化 + reducer)
 *  - 事件正确发出(REGION_THREAT_CHANGED / BOSS_DEFEATED / 等)
 *  - 幂等性、不变量
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { dispatchGameCommand } from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import type { GameState, GameCommand } from '../src/game-engine/expedition/types.js';
import type { CampaignState } from '../src/game-engine/campaign/types.js';
import type { BossCampaignState } from '../src/game-engine/boss/index.js';
import { BOSS_DEFINITIONS } from '../src/game-engine/boss/registry.js';

function freshGameState(week: number = 1): GameState {
  const campaign: CampaignState = {
    id: 'campaign-1',
    seed: 'test-seed',
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
    seed: 'test-seed',
    expedition: {
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
      route: {
        id: 'route-1',
        regionId: 'ruins',
        seed: 'test-seed',
        startNodeId: 'node-1',
        objectiveNodeId: 'node-1',
        exitNodeIds: ['node-1'],
        nodes: {
          'node-1': {
            id: 'node-1',
            type: 'objective',
            sceneId: 'scene-1',
            title: 'Test Node',
            description: 'Test',
            baseScoutLevel: 0,
            weight: 1,
          },
        },
        edges: [],
        forks: [],
      },
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
    rng: { state: 0 },
    lastTransactionId: null,
    activeOverlay: null,
    deathRecords: [],
  };
}

function boss(state: GameState, bossId: string): BossCampaignState {
  return state.campaign!.bossStates![bossId];
}

function bossEvents(state: GameState, type: string): number {
  return state.eventLog.filter((e) => e.type === type).length;
}

describe('Phase 6A: Boss 业务命令 dispatcher 集成', () => {
  let state: GameState;
  beforeEach(() => {
    state = freshGameState();
  });

  it('START_BOSS_INVESTIGATION: hidden → rumored + emit BOSS_RUMOR_DISCOVERED', () => {
    const cmd: GameCommand = {
      type: 'START_BOSS_INVESTIGATION',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    };
    state = dispatchGameCommand(state, cmd);
    expect(boss(state, 'boss-test-arbiter').status).toBe('rumored');
    expect(bossEvents(state, 'BOSS_RUMOR_DISCOVERED')).toBe(1);
  });

  it('START_BOSS_INVESTIGATION 业务幂等(不同 commandId 重复调用,状态不变)', () => {
    state = dispatchGameCommand(state, {
      type: 'START_BOSS_INVESTIGATION',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    const before = bossEvents(state, 'BOSS_RUMOR_DISCOVERED');
    // 用新 commandId 重复 dispatch(业务幂等,不产生新事件)
    state = dispatchGameCommand(state, {
      type: 'START_BOSS_INVESTIGATION',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    expect(bossEvents(state, 'BOSS_RUMOR_DISCOVERED')).toBe(before);
  });

  it('同 commandId 重复 dispatch → DuplicateCommandError', () => {
    const cmd: GameCommand = {
      type: 'START_BOSS_INVESTIGATION',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    };
    state = dispatchGameCommand(state, cmd);
    expect(() => dispatchGameCommand(state, cmd)).toThrow();
  });

  it('GRANT_BOSS_INTELLIGENCE → revealed + emit', () => {
    state = dispatchGameCommand(state, {
      type: 'START_BOSS_INVESTIGATION',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'GRANT_BOSS_INTELLIGENCE',
      bossId: 'boss-test-arbiter',
      entryId: 'intel-attack-1',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('revealed');
    expect(boss(state, 'boss-test-arbiter').discoveredIntelligenceEntryIds).toContain('intel-attack-1');
    expect(bossEvents(state, 'BOSS_INTELLIGENCE_GRANTED')).toBe(1);
  });

  it('COMPLETE_BOSS_INVESTIGATION_QUEST: hidden → revealed(通过任务 grants 情报)', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-test-investigate-1',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('revealed');
    expect(boss(state, 'boss-test-arbiter').discoveredIntelligenceEntryIds.length).toBeGreaterThanOrEqual(3);
    expect(bossEvents(state, 'BOSS_INVESTIGATION_QUEST_COMPLETED')).toBe(1);
  });

  it('COMPLETE_BOSS_WEAKENING_QUEST 链式: revealed → weakened → hunt-ready', () => {
    // 1. 准备到 revealed
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-test-investigate-1',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('revealed');
    // 2. 完成第一个削弱任务
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-1',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('weakened');
    expect(boss(state, 'boss-test-arbiter').activeWeakeningEffectIds).toContain('weaken-summon-altar');
    // 3. 完成第二个削弱任务 → hunt-ready
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-2',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('hunt-ready');
    expect(bossEvents(state, 'BOSS_HUNT_UNLOCKED')).toBeGreaterThan(0);
  });

  it('UNLOCK_BOSS_HUNT: weakened → hunt-ready', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-test-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-1',
      commandId: newCommandId('test'),
    });
    // 手动回退到 weakened 测 UNLOCK
    state.campaign!.bossStates!['boss-test-arbiter'] = {
      ...state.campaign!.bossStates!['boss-test-arbiter'],
      status: 'weakened',
    };
    state = dispatchGameCommand(state, {
      type: 'UNLOCK_BOSS_HUNT',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('hunt-ready');
  });

  it('START_BOSS_FINAL_QUEST: hunt-ready → active + emit BOSS_FINAL_QUEST_STARTED + BOSS_ENCOUNTER_STARTED', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-test-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-2',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'START_BOSS_FINAL_QUEST',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('active');
    expect(bossEvents(state, 'BOSS_FINAL_QUEST_STARTED')).toBe(1);
    expect(bossEvents(state, 'BOSS_ENCOUNTER_STARTED')).toBe(1);
  });

  it('RESOLVE_BOSS_FAILURE: active → revealed + failedAttemptCount+1', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-test-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-2',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'START_BOSS_FINAL_QUEST',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'RESOLVE_BOSS_FAILURE',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('revealed');
    expect(boss(state, 'boss-test-arbiter').failedAttemptCount).toBe(1);
    expect(bossEvents(state, 'BOSS_ENCOUNTER_FAILED')).toBe(1);
  });

  it('RESOLVE_BOSS_DEFEAT: active → defeated + 区域威胁下降 + 战役进度 +1', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-test-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-2',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'START_BOSS_FINAL_QUEST',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });

    const beforeThreat = state.campaign!.regionThreats?.['ruins']?.threatValue ?? 0;
    state = dispatchGameCommand(state, {
      type: 'RESOLVE_BOSS_DEFEAT',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('defeated');
    expect(boss(state, 'boss-test-arbiter').defeatedAtWeek).toBe(1);
    expect(bossEvents(state, 'BOSS_DEFEATED')).toBe(1);
    expect(bossEvents(state, 'BOSS_PERMANENT_REWARD_GRANTED')).toBe(1);
    expect(bossEvents(state, 'CAMPAIGN_THREAT_ADVANCED')).toBe(1);
    // 区域威胁大幅下降
    const afterThreat = state.campaign!.regionThreats?.['ruins']?.threatValue ?? 0;
    expect(afterThreat).toBeLessThanOrEqual(beforeThreat);
    // 战役总进度
    expect(state.campaign!.campaignThreat?.totalBossesDefeated).toBe(1);
    expect(state.campaign!.campaignThreat?.defeatedBossIds).toContain('boss-test-arbiter');
  });

  it('ATTEMPT_BOSS_RETREAT: 真实判定(rng) + retreatCount+1 + emit ATTEMPTED', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-test-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-2',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'START_BOSS_FINAL_QUEST',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'ATTEMPT_BOSS_RETREAT',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').retreatCount).toBe(1);
    expect(bossEvents(state, 'BOSS_RETREAT_ATTEMPTED')).toBe(1);
    // 真实判定,可能 success 或 failure
    const succeeded = bossEvents(state, 'BOSS_RETREAT_SUCCEEDED') > 0;
    const failed = bossEvents(state, 'BOSS_RETREAT_FAILED') > 0;
    expect(succeeded !== failed).toBe(true);
  });
});

describe('Phase 6A: Boss 调试命令(SPEC §39)', () => {
  let state: GameState;
  beforeEach(() => {
    state = freshGameState();
  });

  it('DEBUG_SET_BOSS_STATUS 直接设置状态', () => {
    state = dispatchGameCommand(state, {
      type: 'DEBUG_SET_BOSS_STATUS',
      bossId: 'boss-test-arbiter',
      status: 'revealed',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('revealed');
  });

  it('DEBUG_SET_REGION_THREAT 直接设置数值 + emit', () => {
    state = dispatchGameCommand(state, {
      type: 'DEBUG_SET_REGION_THREAT',
      regionId: 'ruins',
      value: 50,
      commandId: newCommandId('test'),
    });
    expect(state.campaign!.regionThreats!['ruins'].threatValue).toBe(50);
    expect(state.campaign!.regionThreats!['ruins'].state).toBe('active');
    expect(bossEvents(state, 'REGION_THREAT_CHANGED')).toBe(1);
  });

  it('DEBUG_FORCE_BOSS_DEFEAT 走完整 defeat 链', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-test-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-test-weaken-2',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'START_BOSS_FINAL_QUEST',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'DEBUG_FORCE_BOSS_DEFEAT',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('defeated');
  });

  it('DEBUG_RESET_BOSS_STATE 回到 hidden', () => {
    state = dispatchGameCommand(state, {
      type: 'DEBUG_SET_BOSS_STATUS',
      bossId: 'boss-test-arbiter',
      status: 'defeated',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'DEBUG_RESET_BOSS_STATE',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').status).toBe('hidden');
    expect(boss(state, 'boss-test-arbiter').intelligenceProgress).toBe(0);
  });

  it('DEBUG_GRANT_BOSS_INTELLIGENCE 等同 GRANT_BOSS_INTELLIGENCE', () => {
    state = dispatchGameCommand(state, {
      type: 'DEBUG_GRANT_BOSS_INTELLIGENCE',
      bossId: 'boss-test-arbiter',
      entryId: 'intel-attack-1',
      commandId: newCommandId('test'),
    });
    expect(boss(state, 'boss-test-arbiter').discoveredIntelligenceEntryIds).toContain('intel-attack-1');
  });
});

describe('Phase 6A: 懒初始化不变量', () => {
  it('dispatchGameCommand 自动初始化 bossStates/regionThreats/campaignThreat', () => {
    const state = freshGameState();
    expect(state.campaign!.bossStates).toBeUndefined();
    const next = dispatchGameCommand(state, {
      type: 'DEBUG_SET_BOSS_STATUS',
      bossId: 'boss-test-arbiter',
      status: 'hidden',
      commandId: newCommandId('test'),
    });
    expect(next.campaign!.bossStates).toBeDefined();
    expect(next.campaign!.regionThreats).toBeDefined();
    expect(next.campaign!.campaignThreat).toBeDefined();
    // 所有 BOSS_DEFINITIONS 都有初始 state(除了被 DEBUG 设置的 test boss)
    for (const id of Object.keys(BOSS_DEFINITIONS)) {
      expect(next.campaign!.bossStates![id]).toBeDefined();
    }
    // 三个区域都有初始 threat
    expect(next.campaign!.regionThreats!['ruins']).toBeDefined();
    expect(next.campaign!.regionThreats!['corrupted-woods']).toBeDefined();
    expect(next.campaign!.regionThreats!['underground-burrows']).toBeDefined();
  });
});
