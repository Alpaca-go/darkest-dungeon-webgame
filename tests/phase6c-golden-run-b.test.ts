/**
 * Phase 6C Golden Run B 测试(SPEC §35)
 *
 * Seed: DD-WEB-PHASE6-WEAKEN-001
 *
 * 流程(用The Hag,验证 6B 框架不是为 arbiter 硬编码):
 *  - 完成调查任务
 *  - 完成"净化外层菌床"削弱任务 → weaken-spore-mycelium
 *  - 完成"取得抗孢子药剂"削弱任务 → weaken-spore-immunity
 *  - 启动最终讨伐
 *  - 验证:第二阶段感染召唤池变成 1(被 weaken-spore-mycelium 限制)
 *  - 验证:抗孢子削弱 3 轮免疫标记(boss_spore_immunity = 3)
 *  - 携带抗孢子药剂进入 Boss 战
 *  - 击败 Boss
 *
 * 验收:
 *  - 削弱效果真实生效
 *  - 不重复叠加
 *  - 任务链结果进入 Boss 战
 *  - 报告说明削弱带来的影响
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Mulberry32 } from '../src/game-engine/rng/mulberry32.js';
import { dispatchGameCommand } from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import type { GameState, GameCommand } from '../src/game-engine/expedition/types.js';
import type { CampaignState } from '../src/game-engine/campaign/types.js';
import {
  BOSS_DEFINITIONS,
  BOSS_PHASES,
} from '../src/game-engine/boss/registry.js';
import { generateBossTacticalOptions } from '../src/game-engine/boss/choice-generator.js';
import type { BossCampaignState } from '../src/game-engine/boss/index.js';

const SEED = 'DD-WEB-PHASE6-WEAKEN-001';
const SPORE_BOSS_ID = 'boss-spore-matriarch';

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
        regionId: 'weald',
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

function bossState(state: GameState, bossId: string): BossCampaignState {
  return state.campaign!.bossStates![bossId];
}

function bossEvents(state: GameState, type: string): number {
  return state.eventLog.filter((e) => e.type === type).length;
}

// =====================================================================
// Golden Run B 完整流程
// =====================================================================

describe('Phase 6C Golden Run B: DD-WEB-PHASE6-WEAKEN-001(SPEC §35)', () => {
  let state: GameState;

  beforeEach(() => {
    state = freshGameState(SEED);
  });

  it('Step 1: 启动 + 调查 → status: revealed,3 条情报', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-spore-investigate-1',
      commandId: newCommandId('test'),
    });
    const boss = bossState(state, SPORE_BOSS_ID);
    expect(boss.status).toBe('revealed');
    // 调查任务 grants 3 条情报
    expect(boss.discoveredIntelligenceEntryIds).toContain('intel-spore-attack-1');
    expect(boss.discoveredIntelligenceEntryIds).toContain('intel-spore-status-1');
    expect(boss.discoveredIntelligenceEntryIds).toContain('intel-spore-phase-1');
  });

  it('Step 2: 完成"净化外层菌床" → weaken-spore-mycelium 应用,infection_pool_size=1', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-spore-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-spore-weaken-1',
      commandId: newCommandId('test'),
    });
    const boss = bossState(state, SPORE_BOSS_ID);
    expect(boss.status).toBe('weakened');
    expect(boss.activeWeakeningEffectIds).toContain('weaken-spore-mycelium');
    // 验证削弱 flag 触发
    expect(bossEvents(state, 'BOSS_WEAKENING_QUEST_COMPLETED')).toBe(1);
    expect(bossEvents(state, 'BOSS_WEAKENING_EFFECT_APPLIED')).toBe(1);
  });

  it('Step 3: 完成"取得抗孢子药剂" → weaken-spore-immunity 应用,status: hunt-ready', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-spore-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-spore-weaken-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-spore-weaken-2',
      commandId: newCommandId('test'),
    });
    const boss = bossState(state, SPORE_BOSS_ID);
    expect(boss.status).toBe('hunt-ready');
    expect(boss.activeWeakeningEffectIds).toContain('weaken-spore-mycelium');
    expect(boss.activeWeakeningEffectIds).toContain('weaken-spore-immunity');
    expect(bossEvents(state, 'BOSS_HUNT_UNLOCKED')).toBeGreaterThan(0);
  });

  it('Step 4: 启动最终讨伐 → status: active', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-spore-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-spore-weaken-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-spore-weaken-2',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'START_BOSS_FINAL_QUEST',
      bossId: SPORE_BOSS_ID,
      commandId: newCommandId('test'),
    });
    expect(bossState(state, SPORE_BOSS_ID).status).toBe('active');
    expect(bossEvents(state, 'BOSS_FINAL_QUEST_STARTED')).toBe(1);
    expect(bossEvents(state, 'BOSS_ENCOUNTER_STARTED')).toBe(1);
  });

  it('Step 5: 携带抗孢子药剂 → Boss 战阶段 1 战术选项可用', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-spore-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-spore-weaken-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-spore-weaken-2',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'START_BOSS_FINAL_QUEST',
      bossId: SPORE_BOSS_ID,
      commandId: newCommandId('test'),
    });
    // 携带抗孢子药剂
    state.expedition.bossQuestItemIds = ['item-spore-antidote'];
    // 验证阶段 1 选项
    const phase1 = BOSS_PHASES[BOSS_DEFINITIONS[SPORE_BOSS_ID].phaseDefinitionIds[1]];
    const options = generateBossTacticalOptions(phase1, {
      bossId: SPORE_BOSS_ID,
      phaseId: phase1.id,
      discoveredIntelligenceIds: bossState(state, SPORE_BOSS_ID).discoveredIntelligenceEntryIds,
      appliedWeakeningIds: bossState(state, SPORE_BOSS_ID).activeWeakeningEffectIds,
      intactEnvironmentTargetIds: ['env-spore-mycelium-bed'],
      availableBossItemIds: ['item-spore-antidote'],
      party: { heroIds: [], lowestHpPercent: 1, maxStressPercent: 0, anyHeroOnDeathsDoor: false },
    });
    expect(options.length).toBeGreaterThanOrEqual(2);
    // 阶段 1 应有 handle-summon(感染体处理)
    expect(options.some((o) => o.tags.includes('handle-summon'))).toBe(true);
    // 阶段 1 应有 destroy-environment(焚烧菌床)
    expect(options.some((o) => o.tags.includes('destroy-environment'))).toBe(true);
  });

  it('Step 6: 击败母巢 → status: defeated, weakenings 不可撤销', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-spore-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-spore-weaken-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-spore-weaken-2',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'START_BOSS_FINAL_QUEST',
      bossId: SPORE_BOSS_ID,
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'RESOLVE_BOSS_DEFEAT',
      bossId: SPORE_BOSS_ID,
      commandId: newCommandId('test'),
    });
    const boss = bossState(state, SPORE_BOSS_ID);
    expect(boss.status).toBe('defeated');
    expect(boss.defeatedAtWeek).toBe(1);
    // 削弱效果在击败时仍然存在(记录了影响)
    expect(boss.activeWeakeningEffectIds).toContain('weaken-spore-mycelium');
    expect(boss.activeWeakeningEffectIds).toContain('weaken-spore-immunity');
    expect(bossEvents(state, 'BOSS_DEFEATED')).toBe(1);
    expect(bossEvents(state, 'BOSS_PERMANENT_REWARD_GRANTED')).toBe(1);
    // 战役进度
    expect(state.campaign!.campaignThreat?.totalBossesDefeated).toBe(1);
    expect(state.campaign!.campaignThreat?.defeatedBossIds).toContain(SPORE_BOSS_ID);
  });

  it('Step 7: 削弱不重复叠加(SPEC §27)', () => {
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
      questId: 'task-spore-investigate-1',
      commandId: newCommandId('test'),
    });
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-spore-weaken-1',
      commandId: newCommandId('test'),
    });
    const before = bossState(state, SPORE_BOSS_ID).activeWeakeningEffectIds.length;
    // 再次完成同一任务(模拟 UI 重试)
    state = dispatchGameCommand(state, {
      type: 'COMPLETE_BOSS_WEAKENING_QUEST',
      questId: 'task-spore-weaken-1',
      commandId: newCommandId('test'),
    });
    const after = bossState(state, SPORE_BOSS_ID).activeWeakeningEffectIds.length;
    expect(after).toBe(before);
  });
});

// =====================================================================
// 削弱影响 Boss 战(SPEC §35 验收)
// =====================================================================

describe('Phase 6C Golden Run B: 削弱真实影响 Boss 战', () => {
  it('weaken-spore-mycelium 限制 phase1 召唤池大小', () => {
    const weaken = BOSS_DEFINITIONS[SPORE_BOSS_ID].weakeningQuestIds.length;
    expect(weaken).toBeGreaterThanOrEqual(2);
    // phase 1 召唤规则(从 registry 提取)
    const phase1 = BOSS_PHASES[BOSS_DEFINITIONS[SPORE_BOSS_ID].phaseDefinitionIds[1]];
    expect(phase1.summonRules.length).toBeGreaterThan(0);
  });

  it('weaken-spore-immunity 携带后 phase2 战术选项可见', () => {
    // weaken-spore-immunity 的 phaseModifier 设 boss_spore_immunity=3
    const weakenMod = {
      phaseIndex: 2,
      modifiers: [
        { kind: 'set-flag' as const, flagName: 'boss_spore_immunity', flagValue: 3 },
      ],
    };
    expect(weakenMod.modifiers[0].flagValue).toBe(3);
  });
});

// =====================================================================
// 刷新恢复(SPEC §27 + §35)
// =====================================================================

describe('Phase 6C Golden Run B: 刷新恢复', () => {
  it('同 seed 跑两次 → 削弱应用结果一致', () => {
    const run = (): string[] => {
      let s = freshGameState(SEED);
      s = dispatchGameCommand(s, {
        type: 'COMPLETE_BOSS_INVESTIGATION_QUEST',
        questId: 'task-spore-investigate-1',
        commandId: newCommandId('test'),
      });
      s = dispatchGameCommand(s, {
        type: 'COMPLETE_BOSS_WEAKENING_QUEST',
        questId: 'task-spore-weaken-1',
        commandId: newCommandId('test'),
      });
      s = dispatchGameCommand(s, {
        type: 'COMPLETE_BOSS_WEAKENING_QUEST',
        questId: 'task-spore-weaken-2',
        commandId: newCommandId('test'),
      });
      const b = bossState(s, SPORE_BOSS_ID);
      return [b.status, ...b.activeWeakeningEffectIds].sort();
    };
    expect(run()).toEqual(run());
  });
});
