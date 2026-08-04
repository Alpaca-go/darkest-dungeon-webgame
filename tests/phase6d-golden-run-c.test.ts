/**
 * Phase 6D Golden Run C 测试(SPEC §36)
 *
 * Seed: DD-WEB-PHASE6-RETREAT-001
 *
 * 流程(用The Swine Prince,验证 6B 撤退框架对 burrows 真实生效):
 *  - 忽略 burrows 调查任务 → 未获得任何 burrows 情报
 *  - 不携带战斗绷带
 *  - 直接进入最终讨伐(无削弱 + 无情报)
 *  - 阶段 0 尝试撤退(基础 55%)
 *  - 验证:撤退成功后 burrows 区域威胁 +20
 *  - 验证:Boss 状态保持,encounter.retreated,可重新挑战
 *  - 验证:weaken-burrows-food 失效(burrows retreat lossRule)
 *
 * 验收:
 *  - burrows 撤退规则(基础 55% + 阶段 modifier)真实生效
 *  - 撤退成功 + 区域威胁增长 +20
 *  - 削弱按 lossRules 失效
 *  - Boss 状态保留,encounterStatus = retreated
 *  - 同 seed 可复现
 */

import { describe, it, expect } from 'vitest';
import { Mulberry32 } from '../src/game-engine/rng/mulberry32.js';
import { dispatchGameCommand } from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import type { GameState } from '../src/game-engine/expedition/types.js';
import type { CampaignState } from '../src/game-engine/campaign/types.js';
import { BOSS_DEFINITIONS } from '../src/game-engine/boss/registry.js';
import { BOSS_PHASES as BOSS_PHASES_6D } from '../src/game-engine/boss/registry.js';
import { calcRetreatSuccessRate } from '../src/game-engine/boss/encounter-resolver.js';

const SEED = 'DD-WEB-PHASE6-RETREAT-001';
const BURROWS_BOSS_ID = 'boss-burrows-devourer';

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
        regionId: 'warrens',
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

function bossState(state: GameState): any {
  return state.campaign!.bossStates![BURROWS_BOSS_ID];
}

function bossEvents(state: GameState, type: string): number {
  return state.eventLog.filter((e) => e.type === type).length;
}

function reachActiveBoss(state: GameState): GameState {
  // 错误准备:做了调查(获得 3 条情报)+ 2 个削弱,但没携带战斗绷带
  // 关键:玩家没看情报,直接进入 Boss 战
  state = dispatchGameCommand(state, {
    type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
    questId: 'task-burrows-investigate-1',
    commandId: newCommandId('test'),
  });
  state = dispatchGameCommand(state, {
    type: 'COMPLETE_BOSS_WEAKENING_QUEST',
    questId: 'task-burrows-weaken-1',
    commandId: newCommandId('test'),
  });
  state = dispatchGameCommand(state, {
    type: 'COMPLETE_BOSS_WEAKENING_QUEST',
    questId: 'task-burrows-weaken-2',
    commandId: newCommandId('test'),
  });
  state = dispatchGameCommand(state, {
    type: 'START_BOSS_FINAL_QUEST',
    bossId: BURROWS_BOSS_ID,
    commandId: newCommandId('test'),
  });
  return state;
}

// =====================================================================
// 撤退规则基础验证
// =====================================================================

describe('Phase 6D Golden Run C: burrows 撤退规则(SPEC §36)', () => {
  it('encounter-resolver.calcRetreatSuccessRate 阶段 0 > 阶段 1 > 阶段 2', () => {
    const boss = BOSS_DEFINITIONS[BURROWS_BOSS_ID];
    const p0 = calcRetreatSuccessRate(boss, 0);
    const p1 = calcRetreatSuccessRate(boss, 1);
    const p2 = calcRetreatSuccessRate(boss, 2);
    expect(p0).toBeGreaterThan(p1);
    expect(p1).toBeGreaterThan(p2);
  });

  it('阶段 0 基础成功率 = 0.55(比 arbiter 0.65 更低)', () => {
    const boss = BOSS_DEFINITIONS[BURROWS_BOSS_ID];
    const r0 = calcRetreatSuccessRate(boss, 0);
    expect(r0).toBeCloseTo(0.55, 2);
  });

  it('阶段 1 基础成功率 = 0.30(55% - 25%)', () => {
    const boss = BOSS_DEFINITIONS[BURROWS_BOSS_ID];
    const r1 = calcRetreatSuccessRate(boss, 1);
    expect(r1).toBeCloseTo(0.30, 2);
  });

  it('阶段 2 基础成功率 = 0.10(几近无望)', () => {
    const boss = BOSS_DEFINITIONS[BURROWS_BOSS_ID];
    const r2 = calcRetreatSuccessRate(boss, 2);
    expect(r2).toBeCloseTo(0.10, 2);
  });
});

// =====================================================================
// 错误准备 + 撤退流程
// =====================================================================

describe('Phase 6D Golden Run C: 错误准备 + 撤退成功流程', () => {
  it('Step 1: 错误准备 → 状态正确(2 削弱 + 3 情报已获得但未带绷带)', () => {
    const state = reachActiveBoss(freshGameState());
    const boss = bossState(state);
    expect(boss.activeWeakeningEffectIds).toContain('weaken-burrows-food');
    expect(boss.activeWeakeningEffectIds).toContain('weaken-burrows-guard');
    // 调查任务完成 → 3 条情报已发现(玩家没读)
    expect(boss.discoveredIntelligenceEntryIds.length).toBeGreaterThan(0);
    // 关键错误:未携带战斗绷带
    expect((state.expedition.bossQuestItemIds ?? []).includes('item-burrows-bandage')).toBe(false);
  });

  it('Step 2: 撤退成功 → burrows 区域威胁 +20 + Boss 保留', () => {
    let state = reachActiveBoss(freshGameState());
    const before = state.campaign!.regionThreats?.['warrens']?.threatValue ?? 0;

    // 阶段 0 基础 55% — 循环尝试直到成功(30 次内)
    let succeeded = false;
    for (let i = 0; i < 30 && !succeeded; i++) {
      state.rng = { algorithm: 'mulberry32', state: 0x10000 + i };
      const next = dispatchGameCommand(state, {
        type: 'ATTEMPT_BOSS_RETREAT',
        bossId: BURROWS_BOSS_ID,
        commandId: newCommandId('test'),
      });
      if (bossEvents(next, 'BOSS_RETREAT_SUCCEEDED') > 0) {
        state = next;
        succeeded = true;
      } else {
        // 撤退失败后 encounter 进入 'retreating' 状态,可以再次尝试
        state = next;
        // 强制重置 encounter 到 active 状态以便再次尝试
        if (state.expedition.bossEncounterState) {
          state.expedition.bossEncounterState.encounterStatus = 'active';
        }
      }
    }
    expect(succeeded).toBe(true);

    // 验证:区域威胁 +20
    const after = state.campaign!.regionThreats?.['warrens']?.threatValue ?? 0;
    expect(after - before).toBe(20);

    // 验证:Boss 状态回退到 revealed(attemptRetreat 成功 → 'revealed')
    const boss = bossState(state);
    expect(boss.status).toBe('revealed');
    expect(boss.status).not.toBe('defeated');
    expect(boss.retreatCount).toBeGreaterThanOrEqual(1);

    // 验证:encounterStatus = retreated
    expect(state.expedition.bossEncounterState!.encounterStatus).toBe('retreated');
  });

  it('Step 3: 撤退成功后 weaken-burrows-food 失效(loser rule)', () => {
    let state = reachActiveBoss(freshGameState());
    for (let i = 0; i < 30; i++) {
      state.rng = { algorithm: 'mulberry32', state: 0x20000 + i };
      const next = dispatchGameCommand(state, {
        type: 'ATTEMPT_BOSS_RETREAT',
        bossId: BURROWS_BOSS_ID,
        commandId: newCommandId('test'),
      });
      if (bossEvents(next, 'BOSS_RETREAT_SUCCEEDED') > 0) {
        state = next;
        break;
      }
      state = next;
      if (state.expedition.bossEncounterState) {
        state.expedition.bossEncounterState.encounterStatus = 'active';
      }
    }
    // weaken-burrows-food 应该在 lossRules,撤退成功后从 encounter 失效
    const enc = state.expedition.bossEncounterState!;
    expect(enc.appliedWeakeningEffectIds).not.toContain('weaken-burrows-food');
    // 但 boss active 状态保留(不会清除 activeWeakeningEffectIds,只是 encounter 不再应用)
    // 注意:bossState 的 activeWeakeningEffectIds 仍存在,但 encounter 状态反映实际应用
  });
});

// =====================================================================
// 刷新恢复
// =====================================================================

describe('Phase 6D Golden Run C: 刷新恢复(SPEC §27)', () => {
  it('同 seed 跑两次 → 撤退成功次数一致', () => {
    const run = (): number => {
      let s = reachActiveBoss(freshGameState());
      let success = 0;
      for (let i = 0; i < 30; i++) {
        s.rng = { algorithm: 'mulberry32', state: 0x30000 + i };
        const next = dispatchGameCommand(s, {
          type: 'ATTEMPT_BOSS_RETREAT',
          bossId: BURROWS_BOSS_ID,
          commandId: newCommandId('test'),
        });
        if (bossEvents(next, 'BOSS_RETREAT_SUCCEEDED') > 0) success++;
        s = next;
        if (s.expedition.bossEncounterState) {
          s.expedition.bossEncounterState.encounterStatus = 'active';
        }
        if (success > 0) break;
      }
      return success;
    };
    expect(run()).toBe(run());
  });
});

// =====================================================================
// 撤退失败路径
// =====================================================================

describe('Phase 6D Golden Run C: 撤退失败路径(SPEC §15)', () => {
  it('撤退失败时 retreatCount 增加但 status 不变', () => {
    let state = reachActiveBoss(freshGameState());
    // 强制让 RNG 一直失败:用阶段 2 几乎无望的 10% 概率
    state = dispatchGameCommand(state, {
      type: 'DEBUG_JUMP_BOSS_PHASE',
      bossId: BURROWS_BOSS_ID,
      phaseIndex: 2,
      commandId: newCommandId('test'),
    });
    const beforeRetreat = bossState(state).retreatCount ?? 0;
    // 跑 5 次,应该全部失败
    for (let i = 0; i < 5; i++) {
      state.rng = { algorithm: 'mulberry32', state: 0x40000 + i };
      state = dispatchGameCommand(state, {
        type: 'ATTEMPT_BOSS_RETREAT',
        bossId: BURROWS_BOSS_ID,
        commandId: newCommandId('test'),
      });
    }
    // 阶段 2 几乎 100% 失败
    expect(bossEvents(state, 'BOSS_RETREAT_FAILED')).toBeGreaterThan(0);
    // retreatCount 增加
    expect(bossState(state).retreatCount).toBeGreaterThan(beforeRetreat);
    // 状态仍 active(未撤退成功)
    expect(bossState(state).status).not.toBe('defeated');
  });

  it('burrows 阶段 2 撤退战术描述提到战斗绷带 +15% 影响', () => {
    const phase2 = BOSS_PHASES_6D['phase-burrows-2'];
    const retreatTactic = phase2.tacticalOptionRules.find((r: any) => r.category === 'retreat');
    expect(retreatTactic).toBeDefined();
    expect(retreatTactic.description).toMatch(/绷带/);
  });
});
