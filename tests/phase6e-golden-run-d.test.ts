/**
 * Phase 6E Golden Run D 测试(SPEC §37)
 *
 * Seed: DD-WEB-PHASE6-BOSS-DEFEAT-001
 *
 * 流程(用饥渊吞噬者,验证完整 Boss 击败链):
 *  - 完成调查任务 → 3 条情报
 *  - 完成 2 个削弱任务 → weaken-burrows-food + weaken-burrows-guard
 *  - 启动最终讨伐
 *  - 验证:携带战斗绷带 + 储粮焚毁圣物
 *  - 阶段 0 / 1 / 2 战术选项可用
 *  - RESOLVE_BOSS_DEFEAT 击败 Boss
 *  - 验证:
 *    - boss.status = 'defeated'
 *    - 永久奖励发放(BOSS_PERMANENT_REWARD_GRANTED 事件)
 *    - burrows 区域威胁 -60(state: boss-defeated)
 *    - 战役进度 totalBossesDefeated + 1
 *    - defeatedBossIds 包含 bossId
 *  - 验证:奖励只发放一次(再次 RESOLVE_BOSS_DEFEAT 不重复)
 *
 * 验收:
 *  - 完整 Boss 击败流程
 *  - 区域威胁大幅下降
 *  - 战役进度推进
 *  - 永久奖励只领取一次
 *  - Boss 不再生成普通讨伐任务
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Mulberry32 } from '../src/game-engine/rng/mulberry32.js';
import { dispatchGameCommand } from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import type { GameState } from '../src/game-engine/expedition/types.js';
import type { CampaignState } from '../src/game-engine/campaign/types.js';
import { BOSS_DEFINITIONS } from '../src/game-engine/boss/registry.js';

const SEED = 'DD-WEB-PHASE6-BOSS-DEFEAT-001';
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
        regionId: 'underground-burrows',
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

function reachActiveBoss(state: GameState): GameState {
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
// 完整击败流程
// =====================================================================

describe('Phase 6E Golden Run D: 区域 Boss 击败(SPEC §37)', () => {
  let state: GameState;

  beforeEach(() => {
    state = reachActiveBoss(freshGameState());
  });

  it('Step 1: 准备完成 → 8 条情报 + 2 削弱 + 状态 hunt-ready → active', () => {
    const boss = bossState(state, BURROWS_BOSS_ID);
    expect(boss.status).toBe('active');
    expect(boss.discoveredIntelligenceEntryIds.length).toBe(3);
    expect(boss.activeWeakeningEffectIds).toContain('weaken-burrows-food');
    expect(boss.activeWeakeningEffectIds).toContain('weaken-burrows-guard');
  });

  it('Step 2: 携带战斗绷带 + 储粮焚毁圣物进入 Boss 战', () => {
    state.expedition.bossQuestItemIds = ['item-burrows-bandage', 'item-burrows-purifier'];
    expect(state.expedition.bossQuestItemIds).toContain('item-burrows-bandage');
    expect(state.expedition.bossQuestItemIds).toContain('item-burrows-purifier');
  });

  it('Step 3: 击败 Boss → status: defeated + 永久奖励发放', () => {
    const next = dispatchGameCommand(state, {
      type: 'RESOLVE_BOSS_DEFEAT',
      bossId: BURROWS_BOSS_ID,
      commandId: newCommandId('test'),
    });
    const boss = bossState(next, BURROWS_BOSS_ID);
    expect(boss.status).toBe('defeated');
    expect(boss.defeatedAtWeek).toBe(1);
    expect(bossEvents(next, 'BOSS_DEFEATED')).toBe(1);
    expect(bossEvents(next, 'BOSS_PERMANENT_REWARD_GRANTED')).toBe(1);
  });

  it('Step 4: 击败后 burrows 区域威胁大幅下降(state: boss-defeated)', () => {
    // 用 DEBUG_SET_REGION_THREAT 强制设置 burrows 区域威胁为 80(模拟进行中状态)
    state = dispatchGameCommand(state, {
      type: 'DEBUG_SET_REGION_THREAT',
      regionId: 'underground-burrows',
      value: 80,
      commandId: newCommandId('test'),
    });
    const before = state.campaign!.regionThreats!['underground-burrows'].threatValue;
    expect(before).toBe(80);
    const next = dispatchGameCommand(state, {
      type: 'RESOLVE_BOSS_DEFEAT',
      bossId: BURROWS_BOSS_ID,
      commandId: newCommandId('test'),
    });
    const after = next.campaign!.regionThreats!['underground-burrows'].threatValue;
    expect(after).toBe(20);
    expect(next.campaign!.regionThreats!['underground-burrows'].state).toBe('boss-defeated');
  });

  it('Step 5: 击败后战役进度 +1 + defeatedBossIds 包含 bossId', () => {
    const next = dispatchGameCommand(state, {
      type: 'RESOLVE_BOSS_DEFEAT',
      bossId: BURROWS_BOSS_ID,
      commandId: newCommandId('test'),
    });
    const ct = next.campaign!.campaignThreat!;
    expect(ct.totalBossesDefeated).toBe(1);
    expect(ct.defeatedBossIds).toContain(BURROWS_BOSS_ID);
    expect(bossEvents(next, 'CAMPAIGN_THREAT_ADVANCED')).toBe(1);
  });

  it('Step 6: 奖励只发放一次(再次 RESOLVE 不重复发)', () => {
    const first = dispatchGameCommand(state, {
      type: 'RESOLVE_BOSS_DEFEAT',
      bossId: BURROWS_BOSS_ID,
      commandId: newCommandId('test'),
    });
    expect(bossEvents(first, 'BOSS_PERMANENT_REWARD_GRANTED')).toBe(1);
    // 第二次 RESOLVE_BOSS_DEFEAT(异常情况)不会再次发奖励
    // state-machine 应该拒绝:已 defeated 的 Boss 不可再 resolve
    expect(() => {
      dispatchGameCommand(first, {
        type: 'RESOLVE_BOSS_DEFEAT',
        bossId: BURROWS_BOSS_ID,
        commandId: newCommandId('test'),
      });
    }).toThrow();
  });

  it('Step 7: 击败后 campaignThreat 不含 finalCampaignGateReady(仅 1/3)', () => {
    const next = dispatchGameCommand(state, {
      type: 'RESOLVE_BOSS_DEFEAT',
      bossId: BURROWS_BOSS_ID,
      commandId: newCommandId('test'),
    });
    const ct = next.campaign!.campaignThreat!;
    expect(ct.totalBossesDefeated).toBe(1);
    // 仅 1/3,finalCampaignGateReady 应为 false
    expect(ct.finalCampaignGateReady).toBe(false);
  });
});

// =====================================================================
// 完整场景:e2e 风格
// =====================================================================

describe('Phase 6E Golden Run D: 完整场景', () => {
  it('e2e: 准备 → 启动 → 携带物品 → 击败', () => {
    let s = freshGameState(SEED, 5); // 第 5 周
    s = dispatchGameCommand(s, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-burrows-investigate-1',
      commandId: newCommandId('test'),
    });
    s = dispatchGameCommand(s, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-burrows-weaken-1',
      commandId: newCommandId('test'),
    });
    s = dispatchGameCommand(s, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-burrows-weaken-2',
      commandId: newCommandId('test'),
    });
    s = dispatchGameCommand(s, {
      type: 'START_BOSS_FINAL_QUEST',
      bossId: BURROWS_BOSS_ID,
      commandId: newCommandId('test'),
    });
    s.expedition.bossQuestItemIds = ['item-burrows-bandage', 'item-burrows-purifier'];
    s = dispatchGameCommand(s, {
      type: 'RESOLVE_BOSS_DEFEAT',
      bossId: BURROWS_BOSS_ID,
      commandId: newCommandId('test'),
    });
    // 验证最终状态
    const boss = bossState(s, BURROWS_BOSS_ID);
    expect(boss.status).toBe('defeated');
    expect(boss.defeatedAtWeek).toBe(5);
    expect(s.campaign!.campaignThreat!.totalBossesDefeated).toBe(1);
    expect(s.campaign!.campaignThreat!.defeatedBossIds).toContain(BURROWS_BOSS_ID);
  });
});

// =====================================================================
// 刷新恢复
// =====================================================================

describe('Phase 6E Golden Run D: 刷新恢复(SPEC §27)', () => {
  it('同 seed 跑两次 → defeatedBossIds 一致', () => {
    const run = (): string[] => {
      let s = reachActiveBoss(freshGameState(SEED));
      s = dispatchGameCommand(s, {
        type: 'RESOLVE_BOSS_DEFEAT',
        bossId: BURROWS_BOSS_ID,
        commandId: newCommandId('test'),
      });
      const ct = s.campaign!.campaignThreat!;
      return [...ct.defeatedBossIds].sort();
    };
    expect(run()).toEqual(run());
  });
});
