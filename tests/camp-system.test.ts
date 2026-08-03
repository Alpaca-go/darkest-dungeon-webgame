/**
 * Phase 4 P4.4 露营系统测试
 *
 * 覆盖:
 *  - 4 种食物选择 + 食物效果
 *  - 露营点数 (12 基础)
 *  - 8 通用 + 12 职业活动(共 20)
 *  - 活动选择 + 守夜建立
 *  - 持续 Buff 注入
 *  - 夜袭检定 (Seeded RNG, 守夜阻止)
 *  - 露营完成 + 重复 campUsed 检查
 *  - dispatcher 集成 (5 个新命令)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchGameCommand, clearProcessedCommands } from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import type { GameState, HeroInstance } from '../src/game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../src/game-engine/expedition/types.js';
import { Mulberry32 } from '../src/game-engine/rng/index.js';
import { buildRuinsRoute } from '../src/content/route/ruins.js';
import {
  INITIAL_FACILITY_STATES,
  INITIAL_GOLD,
  INITIAL_PORTRAITS,
  INITIAL_CRESTS,
} from '../src/game-engine/campaign/types.js';
import {
  CAMP_BASE_POINTS,
  ALL_CAMP_ACTIVITIES,
  ACTIVITIES_BY_CATEGORY,
  startCamp,
  selectFood,
  selectActivity,
  checkNightAmbush,
  finishCamp,
  isCampCompleted,
  addBuff,
  removeBuff,
  tickBuffsOnNodeAdvance,
  tickBuffsOnEncounterEnd,
  activeBuffs,
  generateActivityOptions,
  DEFAULT_CAMP_CONFIG,
  CAMP_FOOD_CHOICES,
} from '../src/game-engine/camps/index.js';
import type { InventoryState } from '../src/game-engine/expedition/types.js';

function freshHero(id: string, name: string, archetype: HeroInstance['archetype'], maxHp: number): HeroInstance {
  return {
    id, name, archetype, tags: [], rank: 1,
    hp: maxHp, maxHp, protection: 0.1, dodge: 5, speed: 5, accuracy: 0.85, crit: 0.05,
    bleedResist: 0.3, blightResist: 0.3, stunResist: 0.3, moveResist: 0.3,
    bleed: [], blight: [], stun: null, mark: null, protBuff: null,
    cooldowns: {}, isDead: false, conditions: [], skills: ['s1', 's2', 's3'],
    stress: 0, resolveState: 'stable', afflictionId: null, virtueId: null,
    atDeathsDoor: false, deathsDoorRecoveryStacks: 0, deathblowPenalty: 0, heartAttackCount: 0,
    behaviorCooldowns: {},
    resolveLevel: 0, xp: 0, weaponLevel: 0, armorLevel: 0, skillLevels: {},
    positiveQuirkIds: [], negativeQuirkIds: [], lockedPositiveQuirkIds: [],
    diseaseIds: [], equippedTrinketInstanceIds: [null, null],
  };
}

function freshInventory(food = 12): InventoryState {
  return {
    capacity: 16,
    stacks: [{ id: 's-food', itemId: 'food', count: food }],
  };
}

function freshGame(seed: string): GameState {
  const rng = new Mulberry32(seed);
  const route = buildRuinsRoute(seed);
  return {
    version: GAME_STATE_VERSION,
    mode: 'hamlet-overview',
    seed,
    expedition: {
      id: '', routeId: route.id, seed, startedAt: new Date().toISOString(),
      currentNodeId: route.startNodeId, visitedNodeIds: [route.startNodeId], depth: 0,
      timeElapsed: 0, torch: 100, keyChoices: [], keyEvents: [], firedEventIds: [],
      eventCooldowns: {}, scoutLevel: 'unknown', route, flags: {},
      stats: { deepestNodeReached: 0, nodesVisited: 0, encounterCount: 0, trapCount: 0, hungerCount: 0, torchUsed: 0, foodUsed: 0, lowestTorch: 100, lootGained: [], itemsDiscarded: [], heroLowestHp: [] },
      objectiveCompleted: false, failed: false,
      campState: null, expeditionBuffs: [], campUsed: false,
    },
    party: {
      'h.crusader': freshHero('h.crusader', 'Reynauld', 'crusader', 25),
      'h.vestal': freshHero('h.vestal', 'Dismas', 'vestal', 20),
    },
    encounter: null, pendingDecision: null, lastResolution: null,
    inventory: freshInventory(),
    torch: { value: 100, level: 'radiant' },
    eventLog: [], rng: rng.state, lastTransactionId: null,
    activeOverlay: null, deathRecords: [], pendingMentalFlags: [], derivedEventDepth: 0,
    campaign: {
      id: `camp_${seed}`, seed, week: 1, gold: INITIAL_GOLD,
      heirlooms: { portraits: INITIAL_PORTRAITS, crests: INITIAL_CRESTS },
      rosterCapacity: 8, rosterHeroIds: ['h.crusader', 'h.vestal'],
      deadHeroIds: [], completedQuestIds: [], availableQuestIds: [], availableRecruitIds: [],
      facilityStates: structuredClone(INITIAL_FACILITY_STATES),
      trinketInventory: { ownedInstanceIds: [], equippedByHero: {} },
      status: 'active',
    },
    hamlet: {
      mode: 'weekly-summary', recruitCandidates: [], weeklyQuestIds: [],
      weeklyQuestDefs: {}, selectedQuestId: null, selectedPartyHeroIds: [],
      provisionCart: {}, weeklyNotices: [],
    },
  };
}

beforeEach(() => clearProcessedCommands());

// =====================================================================
// 静态内容
// =====================================================================

describe('Phase 4 P4.4 露营:静态内容', () => {
  it('基础露营点数 = 12', () => {
    expect(CAMP_BASE_POINTS).toBe(12);
  });

  it('22 个活动(8 通用 + 12 职业 + 2 buff 专用)', () => {
    expect(ALL_CAMP_ACTIVITIES.length).toBe(22);
  });

  it('通用 10 个活动(8 基础 + 2 buff 专用)', () => {
    expect(ACTIVITIES_BY_CATEGORY.universal.length).toBe(10);
  });

  it('4 职业 × 3 活动', () => {
    expect(ACTIVITIES_BY_CATEGORY.crusader.length).toBe(3);
    expect(ACTIVITIES_BY_CATEGORY.highwayman.length).toBe(3);
    expect(ACTIVITIES_BY_CATEGORY.vestal.length).toBe(3);
    expect(ACTIVITIES_BY_CATEGORY.plague_doctor.length).toBe(3);
  });

  it('每个活动 cost > 0 且 total <= 12', () => {
    for (const a of ALL_CAMP_ACTIVITIES) {
      expect(a.cost).toBeGreaterThan(0);
      expect(a.cost).toBeLessThanOrEqual(12);
    }
  });

  it('4 种食物选择', () => {
    expect(Object.keys(CAMP_FOOD_CHOICES)).toEqual(['feast', 'normal', 'frugal', 'none']);
  });
});

// =====================================================================
// 食物选择
// =====================================================================

describe('Phase 4 P4.4 露营:食物选择', () => {
  it('丰盛进食 -8 食物 + 全队减压 + 治疗', () => {
    const s = freshGame('food-feast');
    s.expedition.campState = {
      totalPoints: 12, remainingPoints: 12, selectedActivityIds: [],
      guardEstablished: false, campStatus: 'food-choice', foodChoiceId: null,
      nightAmbushResult: null, startedAtDepth: 0, availableActivityIds: [],
    };
    s.party['h.crusader']!.stress = 50;
    s.party['h.vestal']!.stress = 30;
    s.party['h.crusader']!.hp = 10;
    const r = selectFood(s.expedition, s.party, s.inventory, 'feast');
    expect(r.ok).toBe(true);
    expect(r.foodConsumed).toBe(8);
    expect(s.party['h.crusader']!.stress).toBe(35); // 50 - 15
    expect(s.party['h.vestal']!.stress).toBe(15); // 30 - 15
    expect(s.party['h.crusader']!.hp).toBe(15); // 10 + 5
    // 露营点数 +2
    expect(s.expedition.campState.totalPoints).toBe(14);
    // 切到 activity-choice
    expect(s.expedition.campState.campStatus).toBe('activity-choice');
  });

  it('普通进食 -4 食物 + 小幅恢复', () => {
    const s = freshGame('food-normal');
    s.expedition.campState = {
      totalPoints: 12, remainingPoints: 12, selectedActivityIds: [],
      guardEstablished: false, campStatus: 'food-choice', foodChoiceId: null,
      nightAmbushResult: null, startedAtDepth: 0, availableActivityIds: [],
    };
    s.party['h.crusader']!.stress = 20;
    const r = selectFood(s.expedition, s.party, s.inventory, 'normal');
    expect(r.ok).toBe(true);
    expect(s.party['h.crusader']!.stress).toBe(15);
  });

  it('不进食 +压力 + 受伤', () => {
    const s = freshGame('food-none');
    s.expedition.campState = {
      totalPoints: 12, remainingPoints: 12, selectedActivityIds: [],
      guardEstablished: false, campStatus: 'food-choice', foodChoiceId: null,
      nightAmbushResult: null, startedAtDepth: 0, availableActivityIds: [],
    };
    s.party['h.crusader']!.hp = 20;
    s.party['h.crusader']!.stress = 0;
    const r = selectFood(s.expedition, s.party, s.inventory, 'none');
    expect(r.ok).toBe(true);
    expect(s.party['h.crusader']!.hp).toBe(17); // 20 - 3
    expect(s.party['h.crusader']!.stress).toBe(15);
  });

  it('食物不够 → 拒绝', () => {
    const s = freshGame('food-poor');
    s.inventory = freshInventory(2); // 只 2 食物
    s.expedition.campState = {
      totalPoints: 12, remainingPoints: 12, selectedActivityIds: [],
      guardEstablished: false, campStatus: 'food-choice', foodChoiceId: null,
      nightAmbushResult: null, startedAtDepth: 0, availableActivityIds: [],
    };
    const r = selectFood(s.expedition, s.party, s.inventory, 'feast');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('not enough food');
  });
});

// =====================================================================
// 活动选择
// =====================================================================

describe('Phase 4 P4.4 露营:活动选择', () => {
  it('守夜 → 守夜建立', () => {
    const s = freshGame('act-guard');
    s.expedition.campState = {
      totalPoints: 12, remainingPoints: 12, selectedActivityIds: [],
      guardEstablished: false, campStatus: 'activity-choice', foodChoiceId: 'normal',
      nightAmbushResult: null, startedAtDepth: 0, availableActivityIds: ['camp_keep_watch'],
    };
    const r = selectActivity(s.expedition, s.party, s.inventory, 'camp_keep_watch');
    expect(r.ok).toBe(true);
    expect(s.expedition.campState.guardEstablished).toBe(true);
    expect(s.expedition.campState.remainingPoints).toBe(8); // 12 - 4
  });

  it('点数不够 → 拒绝', () => {
    const s = freshGame('act-poor');
    s.expedition.campState = {
      totalPoints: 2, remainingPoints: 2, selectedActivityIds: [],
      guardEstablished: false, campStatus: 'activity-choice', foodChoiceId: 'normal',
      nightAmbushResult: null, startedAtDepth: 0, availableActivityIds: ['camp_inspiring_prayer'],
    };
    const r = selectActivity(s.expedition, s.party, s.inventory, 'camp_inspiring_prayer');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('not enough camp points');
  });

  it('Buff 活动 → 注入 expeditionBuffs', () => {
    const s = freshGame('act-buff');
    s.expedition.campState = {
      totalPoints: 12, remainingPoints: 12, selectedActivityIds: [],
      guardEstablished: false, campStatus: 'activity-choice', foodChoiceId: 'normal',
      nightAmbushResult: null, startedAtDepth: 0, availableActivityIds: ['camp_scout_ahead'],
    };
    const r = selectActivity(s.expedition, s.party, s.inventory, 'camp_scout_ahead');
    expect(r.ok).toBe(true);
    const buffs = activeBuffs(s.expedition);
    expect(buffs.some((b) => b.tag === 'scout-bonus')).toBe(true);
  });

  it('已选过活动 → 不再出现', () => {
    const s = freshGame('act-norepeat');
    s.expedition.campState = {
      totalPoints: 20, remainingPoints: 20, selectedActivityIds: [],
      guardEstablished: false, campStatus: 'activity-choice', foodChoiceId: 'normal',
      nightAmbushResult: null, startedAtDepth: 0, availableActivityIds: [],
    };
    selectActivity(s.expedition, s.party, s.inventory, 'camp_calm_party');
    expect(s.expedition.campState.selectedActivityIds).toContain('camp_calm_party');
    const available = generateActivityOptions(s.expedition.campState, s.party);
    expect(available).not.toContain('camp_calm_party');
  });

  it('修女安抚 → 减压 25 最高压英雄', () => {
    const s = freshGame('act-vestal');
    s.expedition.campState = {
      totalPoints: 12, remainingPoints: 12, selectedActivityIds: [],
      guardEstablished: false, campStatus: 'activity-choice', foodChoiceId: 'normal',
      nightAmbushResult: null, startedAtDepth: 0, availableActivityIds: ['camp_vestal_calm'],
    };
    s.party['h.crusader']!.stress = 100;
    s.party['h.vestal']!.stress = 30;
    selectActivity(s.expedition, s.party, s.inventory, 'camp_vestal_calm', 'h.crusader');
    expect(s.party['h.crusader']!.stress).toBe(75);
  });
});

// =====================================================================
// Buff 系统
// =====================================================================

describe('Phase 4 P4.4 露营:Buff 系统', () => {
  it('addBuff + removeBuff', () => {
    const s = freshGame('buff-ar');
    addBuff(s.expedition, {
      id: 'test-1', sourceId: 't', sourceLabel: 'T', tag: 'scout-bonus',
      remainingNodes: 3, magnitude: 0.5,
    });
    expect(activeBuffs(s.expedition).length).toBe(1);
    expect(removeBuff(s.expedition, 'test-1')).toBe(true);
    expect(activeBuffs(s.expedition).length).toBe(0);
  });

  it('tickBuffsOnNodeAdvance: 节点推进 → 减少 remainingNodes', () => {
    const s = freshGame('buff-tick');
    addBuff(s.expedition, {
      id: 'test-2', sourceId: 't', sourceLabel: 'T', tag: 'scout-bonus',
      remainingNodes: 2, magnitude: 0.5,
    });
    tickBuffsOnNodeAdvance(s.expedition);
    expect(activeBuffs(s.expedition)[0]!.remainingNodes).toBe(1);
    tickBuffsOnNodeAdvance(s.expedition);
    expect(activeBuffs(s.expedition).length).toBe(0);
  });

  it('tickBuffsOnEncounterEnd: 遭遇结算 → 减少 remainingEncounters', () => {
    const s = freshGame('buff-enc');
    addBuff(s.expedition, {
      id: 'test-3', sourceId: 't', sourceLabel: 'T', tag: 'formation-steady',
      remainingEncounters: 1, magnitude: 1,
    });
    tickBuffsOnEncounterEnd(s.expedition);
    expect(activeBuffs(s.expedition).length).toBe(0);
  });
});

// =====================================================================
// 夜袭检定
// =====================================================================

describe('Phase 4 P4.4 露营:夜袭检定', () => {
  it('守夜 → 阻止夜袭', () => {
    const rng = new Mulberry32('ambush-1');
    const r = checkNightAmbush({
      rngState: rng.state,
      baseChance: 0.9,
      guardEstablished: true,
      torchValue: 100,
      hasScoutBuff: false,
      regionDanger: 0,
    });
    expect(r.guarded).toBe(true);
    expect(r.triggered).toBe(false);
    expect(r.outcome).toBe('safe');
  });

  it('高概率 + 无守夜 → 必触发', () => {
    const rng = new Mulberry32('ambush-2');
    const r = checkNightAmbush({
      rngState: rng.state,
      baseChance: 0.99,
      guardEstablished: false,
      torchValue: 100,
      hasScoutBuff: false,
      regionDanger: 0,
    });
    expect(r.triggered).toBe(true);
    expect(r.outcome).not.toBe('safe');
  });

  it('低概率 + 守夜 → 不触发', () => {
    const rng = new Mulberry32('ambush-3');
    const r = checkNightAmbush({
      rngState: rng.state,
      baseChance: 0.01,
      guardEstablished: false,
      torchValue: 100,
      hasScoutBuff: false,
      regionDanger: 0,
    });
    expect(r.triggered).toBe(false);
  });

  it('Seeded RNG → 同样本出同样结果', () => {
    const a = checkNightAmbush({
      rngState: new Mulberry32('seed-x').state,
      baseChance: 0.5, guardEstablished: false, torchValue: 50,
      hasScoutBuff: false, regionDanger: 0,
    });
    const b = checkNightAmbush({
      rngState: new Mulberry32('seed-x').state,
      baseChance: 0.5, guardEstablished: false, torchValue: 50,
      hasScoutBuff: false, regionDanger: 0,
    });
    expect(a.outcome).toBe(b.outcome);
    expect(a.triggered).toBe(b.triggered);
  });

  it('黑暗(<25 torch) → 概率上调', () => {
    // 多 seed 跑 10 次,统计黑暗触发率应高于 100 torch
    let darkCount = 0;
    let lightCount = 0;
    for (let i = 0; i < 10; i++) {
      const r = checkNightAmbush({
        rngState: new Mulberry32(`seed-dark-${i}`).state,
        baseChance: 0.3, guardEstablished: false, torchValue: 10,
        hasScoutBuff: false, regionDanger: 0,
      });
      if (r.triggered) darkCount++;
    }
    for (let i = 0; i < 10; i++) {
      const r = checkNightAmbush({
        rngState: new Mulberry32(`seed-light-${i}`).state,
        baseChance: 0.3, guardEstablished: false, torchValue: 100,
        hasScoutBuff: false, regionDanger: 0,
      });
      if (r.triggered) lightCount++;
    }
    expect(darkCount).toBeGreaterThanOrEqual(lightCount);
  });
});

// =====================================================================
// 完成露营 + campUsed
// =====================================================================

describe('Phase 4 P4.4 露营:完成 + campUsed', () => {
  it('完成露营 → campUsed=true, campState.status=completed', () => {
    const s = freshGame('finish-camp');
    s.expedition.campState = {
      totalPoints: 12, remainingPoints: 0, selectedActivityIds: ['a', 'b'],
      guardEstablished: true, campStatus: 'activity-choice', foodChoiceId: 'normal',
      nightAmbushResult: null, startedAtDepth: 0, availableActivityIds: [],
    };
    const r = finishCamp(s.expedition);
    expect(r.ok).toBe(true);
    expect(s.expedition.campUsed).toBe(true);
    expect(isCampCompleted(s.expedition.campState!)).toBe(true);
  });

  it('重复完成 → 抛错', () => {
    const s = freshGame('finish-twice');
    s.expedition.campState = {
      totalPoints: 12, remainingPoints: 12, selectedActivityIds: [],
      guardEstablished: false, campStatus: 'completed', foodChoiceId: 'normal',
      nightAmbushResult: null, startedAtDepth: 0, availableActivityIds: [],
    };
    const r = finishCamp(s.expedition);
    expect(r.ok).toBe(false);
  });
});

// =====================================================================
// 启动露营
// =====================================================================

describe('Phase 4 P4.4 露营:启动', () => {
  it('在 empty-room 节点可启动', () => {
    const s = freshGame('start-empty');
    // 默认是 empty-room 节点
    s.expedition.campUsed = false;
    s.expedition.campState = null;
    const r = startCamp(s.expedition, s.party, DEFAULT_CAMP_CONFIG, s.expedition.depth);
    expect(r.ok).toBe(true);
    expect(r.campState.totalPoints).toBe(12);
    expect(r.campState.campStatus).toBe('food-choice');
  });

  it('campUsed=true → 拒绝', () => {
    const s = freshGame('start-used');
    s.expedition.campUsed = true;
    s.expedition.campState = null;
    const r = startCamp(s.expedition, s.party, DEFAULT_CAMP_CONFIG, s.expedition.depth);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('already used');
  });
});

// =====================================================================
// Dispatcher 集成
// =====================================================================

describe('Phase 4 P4.4 露营:dispatcher 集成', () => {
  it('完整流程: 露营 → 食物 → 活动 → 夜袭 → 完成', () => {
    let s = freshGame('full-camp');
    s.party['h.crusader']!.stress = 50;
    s.party['h.vestal']!.stress = 30;
    s.party['h.crusader']!.hp = 10;

    s = dispatchGameCommand(s, { type: 'START_CAMP', commandId: newCommandId('c1') });
    expect(s.expedition.campState).not.toBeNull();
    expect(s.expedition.campState!.campStatus).toBe('food-choice');
    const ev1 = s.eventLog.find((e) => e.type === 'CAMP_STARTED');
    expect(ev1).toBeDefined();

    s = dispatchGameCommand(s, { type: 'CHOOSE_CAMP_FOOD', choiceId: 'feast', commandId: newCommandId('c2') });
    expect(s.expedition.campState!.campStatus).toBe('activity-choice');
    expect(s.party['h.crusader']!.stress).toBe(35);

    // 选一个活动
    s = dispatchGameCommand(s, {
      type: 'CHOOSE_CAMP_ACTIVITY', activityId: 'camp_keep_watch', commandId: newCommandId('c3'),
    });
    expect(s.expedition.campState!.guardEstablished).toBe(true);

    s = dispatchGameCommand(s, { type: 'FINISH_CAMP', commandId: newCommandId('c4') });
    expect(s.expedition.campUsed).toBe(true);
    expect(s.eventLog.find((e) => e.type === 'CAMP_COMPLETED')).toBeDefined();

    s = dispatchGameCommand(s, { type: 'RESOLVE_NIGHT_AMBUSH', commandId: newCommandId('c5') });
    // 守夜已建立 → 不触发
    expect(s.expedition.campState!.nightAmbushResult!.guarded).toBe(true);
    expect(s.eventLog.find((e) => e.type === 'NIGHT_AMBUSH_PREVENTED')).toBeDefined();
  });

  it('不建守夜 → 触发夜袭', () => {
    let s = freshGame('ambush-flow');
    s = dispatchGameCommand(s, { type: 'START_CAMP', commandId: newCommandId('c1') });
    s = dispatchGameCommand(s, { type: 'CHOOSE_CAMP_FOOD', choiceId: 'normal', commandId: newCommandId('c2') });
    s = dispatchGameCommand(s, { type: 'CHOOSE_CAMP_ACTIVITY', activityId: 'camp_calm_party', commandId: newCommandId('c3') });
    s = dispatchGameCommand(s, { type: 'FINISH_CAMP', commandId: newCommandId('c4') });
    s = dispatchGameCommand(s, { type: 'RESOLVE_NIGHT_AMBUSH', commandId: newCommandId('c5') });
    // 夜袭结果在 campState
    expect(s.expedition.campState!.nightAmbushResult).not.toBeNull();
  });

  it('重复 START_CAMP → 抛错', () => {
    let s = freshGame('camp-dup');
    s = dispatchGameCommand(s, { type: 'START_CAMP', commandId: newCommandId('c1') });
    s = dispatchGameCommand(s, { type: 'CHOOSE_CAMP_FOOD', choiceId: 'normal', commandId: newCommandId('c2') });
    s = dispatchGameCommand(s, { type: 'CHOOSE_CAMP_ACTIVITY', activityId: 'camp_keep_watch', commandId: newCommandId('c3') });
    s = dispatchGameCommand(s, { type: 'FINISH_CAMP', commandId: newCommandId('c4') });
    // 再次启动
    expect(() => dispatchGameCommand(s, { type: 'START_CAMP', commandId: newCommandId('c5') })).toThrow();
  });

  it('重复 RESOLVE_NIGHT_AMBUSH → 抛错', () => {
    let s = freshGame('ambush-dup');
    s = dispatchGameCommand(s, { type: 'START_CAMP', commandId: newCommandId('c1') });
    s = dispatchGameCommand(s, { type: 'CHOOSE_CAMP_FOOD', choiceId: 'normal', commandId: newCommandId('c2') });
    s = dispatchGameCommand(s, { type: 'CHOOSE_CAMP_ACTIVITY', activityId: 'camp_keep_watch', commandId: newCommandId('c3') });
    s = dispatchGameCommand(s, { type: 'FINISH_CAMP', commandId: newCommandId('c4') });
    s = dispatchGameCommand(s, { type: 'RESOLVE_NIGHT_AMBUSH', commandId: newCommandId('c5') });
    expect(() => dispatchGameCommand(s, { type: 'RESOLVE_NIGHT_AMBUSH', commandId: newCommandId('c6') })).toThrow();
  });

  it('DEBUG_FORCE_CAMP → 启动露营', () => {
    let s = freshGame('debug-force-camp');
    s = dispatchGameCommand(s, { type: 'DEBUG_FORCE_CAMP', commandId: newCommandId('d1') });
    expect(s.expedition.campState).not.toBeNull();
  });

  it('DEBUG_FORCE_NIGHT_AMBUSH prevent=true → 守夜建立', () => {
    let s = freshGame('debug-prevent');
    s = dispatchGameCommand(s, { type: 'START_CAMP', commandId: newCommandId('c1') });
    s = dispatchGameCommand(s, { type: 'DEBUG_FORCE_NIGHT_AMBUSH', prevent: true, commandId: newCommandId('d1') });
    expect(s.expedition.campState!.guardEstablished).toBe(true);
  });

  it('DEBUG_ADD_EXPEDITION_BUFF → buff 注入', () => {
    let s = freshGame('debug-buff');
    s = dispatchGameCommand(s, {
      type: 'DEBUG_ADD_EXPEDITION_BUFF', tag: 'scout-bonus', magnitude: 0.5, remainingNodes: 5,
      commandId: newCommandId('d1'),
    });
    expect(activeBuffs(s.expedition).length).toBe(1);
  });
});
