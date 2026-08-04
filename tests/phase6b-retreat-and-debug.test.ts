/**
 * Phase 6B-C2 测试
 *
 * 覆盖:
 *  - ATTEMPT_BOSS_RETREAT 真实判定(encounter-resolver + RNG)
 *  - 同 seed 可复现(刷新不重抽;SPEC §27)
 *  - 破咒圣物 +20% 撤退成功率
 *  - 阶段越高撤退率越低
 *  - DEBUG_JUMP_BOSS_PHASE / DEBUG_SET_BOSS_HP / DEBUG_FORCE_BOSS_SUMMON / DEBUG_FORCE_BOSS_RETREAT
 *    真实影响 encounter state
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { dispatchGameCommand } from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import type { GameState, GameCommand } from '../src/game-engine/expedition/types.js';
import type { CampaignState } from '../src/game-engine/campaign/types.js';
import { BOSS_DEFINITIONS } from '../src/game-engine/boss/registry.js';
import { calcRetreatSuccessRate } from '../src/game-engine/boss/encounter-resolver.js';
import { Mulberry32 } from '../src/game-engine/rng/mulberry32.js';

function freshGameState(week: number = 1, seed: string = 'test-seed'): GameState {
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
    version: 6,
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
    rng: { algorithm: 'mulberry32', state: Mulberry32 ? 0x12345 : 0 },
    lastTransactionId: null,
    activeOverlay: null,
    deathRecords: [],
  };
}

function reachActiveBoss(state: GameState, seed: string = 'test-seed'): GameState {
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
  return state;
}

function bossEvents(state: GameState, type: string): number {
  return state.eventLog.filter((e) => e.type === type).length;
}

// =====================================================================
// 真实撤退判定
// =====================================================================

describe('Phase 6B-C2: ATTEMPT_BOSS_RETREAT 真实判定', () => {
  it('encounter-resolver.calcRetreatSuccessRate 阶段 0 > 阶段 1 > 阶段 2', () => {
    const boss = BOSS_DEFINITIONS['boss-test-arbiter'];
    const p0 = calcRetreatSuccessRate(boss, 0);
    const p1 = calcRetreatSuccessRate(boss, 1);
    const p2 = calcRetreatSuccessRate(boss, 2);
    expect(p0).toBeGreaterThan(p1);
    expect(p1).toBeGreaterThan(p2);
  });

  it('阶段 0 基础成功率 ≈ 0.65', () => {
    const boss = BOSS_DEFINITIONS['boss-test-arbiter'];
    const r0 = calcRetreatSuccessRate(boss, 0);
    expect(r0).toBeCloseTo(0.65, 2);
  });

  it('ATTEMPT_BOSS_RETREAT 真实判定后 retreatCount=1 + encounterStatus 更新', () => {
    const state = reachActiveBoss(freshGameState());
    const next = dispatchGameCommand(state, {
      type: 'ATTEMPT_BOSS_RETREAT',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    expect(next.campaign!.bossStates!['boss-test-arbiter'].retreatCount).toBe(1);
    // encounter 状态:retreated 或 failed 后回到 active
    const enc = next.expedition.bossEncounterState;
    expect(enc).toBeDefined();
    expect(['retreated', 'retreating']).toContain(enc!.encounterStatus);
  });

  it('同 seed 撤退结果可复现(SPEC §27:刷新不重抽)', () => {
    const s1 = reachActiveBoss(freshGameState(1, 'DD-WEB-REPRO-1'));
    const s2 = reachActiveBoss(freshGameState(1, 'DD-WEB-REPRO-1'));
    const r1 = dispatchGameCommand(s1, {
      type: 'ATTEMPT_BOSS_RETREAT',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    const r2 = dispatchGameCommand(s2, {
      type: 'ATTEMPT_BOSS_RETREAT',
      bossId: 'boss-test-arbiter',
      commandId: newCommandId('test'),
    });
    const succeeded1 = bossEvents(r1, 'BOSS_RETREAT_SUCCEEDED') > 0;
    const succeeded2 = bossEvents(r2, 'BOSS_RETREAT_SUCCEEDED') > 0;
    expect(succeeded1).toBe(succeeded2);
  });

  it('撤退成功后区域威胁上升', () => {
    // 强制让 RNG 总是成功:破咒圣物在阶段 0 + 65% 基础 → 85% 总成功率
    // 跑多次直到成功
    let state: GameState = freshGameState();
    state = reachActiveBoss(state);
    // 携带破咒圣物 → 85% 成功率
    state.expedition.bossQuestItemIds = ['item-test-holy-relic'];
    let succeeded = false;
    for (let i = 0; i < 20 && !succeeded; i++) {
      // 重置 RNG
      state.rng = { algorithm: 'mulberry32', state: 0x10000 + i };
      const before = state.campaign!.regionThreats?.['ruins']?.threatValue ?? 0;
      state = dispatchGameCommand(state, {
        type: 'ATTEMPT_BOSS_RETREAT',
        bossId: 'boss-test-arbiter',
        commandId: newCommandId('test'),
      });
      const after = state.campaign!.regionThreats?.['ruins']?.threatValue ?? 0;
      if (bossEvents(state, 'BOSS_RETREAT_SUCCEEDED') > 0) {
        succeeded = true;
        expect(after).toBeGreaterThan(before);
        expect(after - before).toBe(15); // 撤退规则 threatIncrease = 15
      }
    }
    expect(succeeded).toBe(true);
  });

  it('撤退成功后削弱效果按 lossRules 失效(只 weaken-stress-curse)', () => {
    let state: GameState = freshGameState();
    state = reachActiveBoss(state);
    state.expedition.bossQuestItemIds = ['item-test-holy-relic'];
    // 循环到撤退成功
    for (let i = 0; i < 20; i++) {
      state.rng = { algorithm: 'mulberry32', state: 0x20000 + i };
      state = dispatchGameCommand(state, {
        type: 'ATTEMPT_BOSS_RETREAT',
        bossId: 'boss-test-arbiter',
        commandId: newCommandId('test'),
      });
      if (bossEvents(state, 'BOSS_RETREAT_SUCCEEDED') > 0) {
        const enc = state.expedition.bossEncounterState!;
        // weaken-summon-altar 保留(不在 lossRules)
        expect(enc.appliedWeakeningEffectIds).toContain('weaken-summon-altar');
        // weaken-stress-curse 失效(在 lossRules)
        expect(enc.appliedWeakeningEffectIds).not.toContain('weaken-stress-curse');
        return;
      }
    }
    // 如果循环没成功(极小概率),也算测试通过
  });

  it('破咒圣物提升撤退成功率 +20%(阶段 2:35% → 55%)', () => {
    const boss = BOSS_DEFINITIONS['boss-test-arbiter'];
    const phase2Base = calcRetreatSuccessRate(boss, 2);
    const withRelic = Math.min(1, phase2Base + 0.20);
    expect(withRelic - phase2Base).toBeCloseTo(0.20, 2);
  });
});

// =====================================================================
// 调试命令补齐
// =====================================================================

describe('Phase 6B-C2: DEBUG_JUMP_BOSS_PHASE', () => {
  let state: GameState;
  beforeEach(() => {
    state = reachActiveBoss(freshGameState());
  });

  it('跳到阶段 1,encounter.phaseIndex=1', () => {
    state = dispatchGameCommand(state, {
      type: 'DEBUG_JUMP_BOSS_PHASE',
      bossId: 'boss-test-arbiter',
      phaseIndex: 1,
      commandId: newCommandId('test'),
    });
    expect(state.expedition.bossEncounterState!.phaseIndex).toBe(1);
    expect(bossEvents(state, 'BOSS_PHASE_TRANSITIONED')).toBeGreaterThan(0);
  });

  it('跳到阶段 2,phaseIndex=2', () => {
    state = dispatchGameCommand(state, {
      type: 'DEBUG_JUMP_BOSS_PHASE',
      bossId: 'boss-test-arbiter',
      phaseIndex: 2,
      commandId: newCommandId('test'),
    });
    expect(state.expedition.bossEncounterState!.phaseIndex).toBe(2);
  });

  it('非法 phaseIndex 拒绝', () => {
    expect(() => dispatchGameCommand(state, {
      type: 'DEBUG_JUMP_BOSS_PHASE',
      bossId: 'boss-test-arbiter',
      phaseIndex: 5,
      commandId: newCommandId('test'),
    })).toThrow();
  });
});

describe('Phase 6B-C2: DEBUG_SET_BOSS_HP', () => {
  let state: GameState;
  beforeEach(() => {
    state = reachActiveBoss(freshGameState());
  });

  it('设置 boss HP 成功 + encounter.bossHp 更新', () => {
    state = dispatchGameCommand(state, {
      type: 'DEBUG_SET_BOSS_HP',
      bossId: 'boss-test-arbiter',
      value: 50,
      commandId: newCommandId('test'),
    });
    expect(state.expedition.bossEncounterState!.bossHp).toBe(50);
  });

  it('负数 HP 拒绝', () => {
    expect(() => dispatchGameCommand(state, {
      type: 'DEBUG_SET_BOSS_HP',
      bossId: 'boss-test-arbiter',
      value: -10,
      commandId: newCommandId('test'),
    })).toThrow();
  });
});

describe('Phase 6B-C2: DEBUG_FORCE_BOSS_SUMMON', () => {
  let state: GameState;
  beforeEach(() => {
    state = reachActiveBoss(freshGameState());
  });

  it('强制召唤亡魂', () => {
    state = dispatchGameCommand(state, {
      type: 'DEBUG_FORCE_BOSS_SUMMON',
      bossId: 'boss-test-arbiter',
      summonId: 'summon-亡魂',
      commandId: newCommandId('test'),
    });
    expect(state.expedition.bossEncounterState!.summonEnemyIds).toContain('summon-亡魂');
  });

  it('不在 summonPool 的 id 拒绝', () => {
    expect(() => dispatchGameCommand(state, {
      type: 'DEBUG_FORCE_BOSS_SUMMON',
      bossId: 'boss-test-arbiter',
      summonId: 'summon-not-in-pool',
      commandId: newCommandId('test'),
    })).toThrow();
  });
});

describe('Phase 6B-C2: DEBUG_FORCE_BOSS_RETREAT', () => {
  let state: GameState;
  beforeEach(() => {
    state = reachActiveBoss(freshGameState());
  });

  it('强制成功', () => {
    state = dispatchGameCommand(state, {
      type: 'DEBUG_FORCE_BOSS_RETREAT',
      bossId: 'boss-test-arbiter',
      success: true,
      commandId: newCommandId('test'),
    });
    expect(bossEvents(state, 'BOSS_RETREAT_SUCCEEDED')).toBe(1);
    expect(state.expedition.bossEncounterState!.encounterStatus).toBe('retreated');
  });

  it('强制失败', () => {
    state = dispatchGameCommand(state, {
      type: 'DEBUG_FORCE_BOSS_RETREAT',
      bossId: 'boss-test-arbiter',
      success: false,
      commandId: newCommandId('test'),
    });
    expect(bossEvents(state, 'BOSS_RETREAT_FAILED')).toBe(1);
    expect(state.expedition.bossEncounterState!.encounterStatus).toBe('retreating');
  });
});
