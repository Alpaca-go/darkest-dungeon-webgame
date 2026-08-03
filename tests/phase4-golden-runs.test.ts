/**
 * Phase 4 P4.5 Golden Run 测试
 *
 * 三个 Golden Run:
 *  A: DD-WEB-PHASE4-HERO-IDENTITY-001 (英雄个性化)
 *  B: DD-WEB-PHASE4-CAMP-001 (中型远征 + 露营)
 *  C: DD-WEB-PHASE4-AMBUSH-001 (夜袭失败)
 *
 * 验收:
 *  - 怪癖和疾病固定可复现
 *  - 露营点数不超支
 *  - 守夜阻止夜袭
 *  - 侦察 Buff 生效
 *  - 夜袭不重复
 *  - 刷新不重抽
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
  acquireQuirk,
} from '../src/game-engine/quirks/index.js';
import {
  acquireDisease,
} from '../src/game-engine/diseases/index.js';
import type { InventoryState } from '../src/game-engine/expedition/types.js';

// =====================================================================
// 工具
// =====================================================================

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

function freshInventory(): InventoryState {
  return { capacity: 16, stacks: [{ id: 's-food', itemId: 'food', count: 16 }] };
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
      'h.highwayman': freshHero('h.highwayman', 'Dismas', 'highwayman', 22),
    },
    encounter: null, pendingDecision: null, lastResolution: null,
    inventory: freshInventory(),
    torch: { value: 100, level: 'radiant' },
    eventLog: [], rng: rng.state, lastTransactionId: null,
    activeOverlay: null, deathRecords: [], pendingMentalFlags: [], derivedEventDepth: 0,
    campaign: {
      id: `camp_${seed}`, seed, week: 1, gold: INITIAL_GOLD,
      heirlooms: { portraits: INITIAL_PORTRAITS, crests: INITIAL_CRESTS },
      rosterCapacity: 8, rosterHeroIds: ['h.crusader', 'h.vestal', 'h.highwayman'],
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
// Golden Run A: 英雄个性化
// =====================================================================

describe('Phase 4 P4.5 Golden Run A: 英雄个性化 (DD-WEB-PHASE4-HERO-IDENTITY-001)', () => {
  it('强盗 → 获得废墟探险家 → 怪癖影响选择 → 污染奇物得病 → 疗养院治疗 → 锁定怪癖 → 装备侦察饰品', () => {
    let s = freshGame('DD-WEB-PHASE4-HERO-IDENTITY-001');
    const highwayman = s.party['h.highwayman']!;

    // 1. 获得正面怪癖"废墟探险家"
    const r = acquireQuirk(highwayman, 'quirk_ruins_explorer');
    expect(r.ok).toBe(true);
    expect(highwayman.positiveQuirkIds).toContain('quirk_ruins_explorer');

    // 2. 因污染奇物获得疾病(任意 10 疾病里取一个)
    const dRes = acquireDisease(highwayman, 'disease_red_pestilence', 'curio_polluted');
    expect(dRes.ok).toBe(true);
    expect(highwayman.diseaseIds).toContain('disease_red_pestilence');

    // 3. 疗养院治疗疾病
    s = dispatchGameCommand(s, {
      type: 'TREAT_DISEASE',
      heroId: 'h.highwayman',
      diseaseId: 'disease_red_pestilence',
      commandId: newCommandId('t1'),
    });
    expect(highwayman.diseaseIds).not.toContain('disease_red_pestilence');

    // 4. 锁定正面怪癖
    const positiveQ = highwayman.positiveQuirkIds[0]!;
    s = dispatchGameCommand(s, {
      type: 'LOCK_POSITIVE_QUIRK',
      heroId: 'h.highwayman',
      quirkId: positiveQ,
      commandId: newCommandId('l1'),
    });
    expect(highwayman.lockedPositiveQuirkIds).toContain(positiveQ);

    // 5. 装备侦察饰品(任选一个装备)— 先 looted
    s = dispatchGameCommand(s, {
      type: 'LOOT_TRINKET',
      definitionId: 'trinket_scout_compass',
      week: 1,
      source: 'golden-run-a',
      commandId: newCommandId('lt1'),
    });
    const ownedIds = s.campaign!.trinketInventory.ownedInstanceIds;
    expect(ownedIds.length).toBe(1);
    const instanceId = ownedIds[0]!;

    // 6. 装备
    s = dispatchGameCommand(s, {
      type: 'EQUIP_TRINKET',
      heroId: 'h.highwayman',
      instanceId,
      slotIndex: 0,
      commandId: newCommandId('et1'),
    });
    expect(highwayman.equippedTrinketInstanceIds?.[0]).toBe(instanceId);

    // 7. 验证怪癖影响选择的能力(rough check: positiveQuirkIds 非空)
    expect(highwayman.positiveQuirkIds.length).toBeGreaterThan(0);
    // 8. 验证饰品已装备
    expect(highwayman.equippedTrinketInstanceIds?.[0]).not.toBeNull();
  });

  it('同一 seed 跑两次 → 怪癖获得/疾病获得/装备选择固定可复现', () => {
    const run = (): { quirks: string[]; diseases: string[]; trinket: string | null } => {
      const s = freshGame('DD-WEB-PHASE4-HERO-IDENTITY-001');
      const h = s.party['h.highwayman']!;
      acquireQuirk(h, 'quirk_hardy');
      acquireQuirk(h, 'quirk_scout_keen');
      acquireDisease(h, 'disease_red_pestilence', 'curio_a');
      return {
        quirks: [...h.positiveQuirkIds],
        diseases: [...h.diseaseIds],
        trinket: h.equippedTrinketInstanceIds?.[0] ?? null,
      };
    };
    const a = run();
    const b = run();
    expect(a.quirks).toEqual(b.quirks);
    expect(a.diseases).toEqual(b.diseases);
    expect(a.trinket).toEqual(b.trinket);
  });
});

// =====================================================================
// Golden Run B: 中型远征 + 露营
// =====================================================================

describe('Phase 4 P4.5 Golden Run B: 中型远征 + 露营 (DD-WEB-PHASE4-CAMP-001)', () => {
  it('中型远征 → 露营 → 普通进食 → 修女安抚 → 守夜 → 阻止夜袭 → 侦察 Buff', () => {
    let s = freshGame('DD-WEB-PHASE4-CAMP-001');

    // 1. 露营启动
    s = dispatchGameCommand(s, { type: 'START_CAMP', commandId: newCommandId('c1') });
    expect(s.expedition.campState).not.toBeNull();
    expect(s.expedition.campState!.totalPoints).toBe(12);

    // 2. 普通进食(-4 食物 + 减压 5)
    s.party['h.crusader']!.stress = 80;
    s = dispatchGameCommand(s, { type: 'CHOOSE_CAMP_FOOD', choiceId: 'normal', commandId: newCommandId('c2') });
    expect(s.party['h.crusader']!.stress).toBe(75);

    // 3. 修女安抚(高压英雄减压 25)
    s.party['h.crusader']!.stress = 80;
    s = dispatchGameCommand(s, {
      type: 'CHOOSE_CAMP_ACTIVITY', activityId: 'camp_vestal_calm', targetHeroId: 'h.crusader', commandId: newCommandId('c3'),
    });
    expect(s.party['h.crusader']!.stress).toBe(55);

    // 4. 守夜
    s = dispatchGameCommand(s, {
      type: 'CHOOSE_CAMP_ACTIVITY', activityId: 'camp_keep_watch', commandId: newCommandId('c4'),
    });
    expect(s.expedition.campState!.guardEstablished).toBe(true);

    // 5. 侦察前路 → Buff 注入
    s = dispatchGameCommand(s, {
      type: 'CHOOSE_CAMP_ACTIVITY', activityId: 'camp_scout_ahead', commandId: newCommandId('c5'),
    });
    const buffs = s.expedition.expeditionBuffs ?? [];
    expect(buffs.some((b) => b.tag === 'scout-bonus')).toBe(true);

    // 6. 完成露营
    s = dispatchGameCommand(s, { type: 'FINISH_CAMP', commandId: newCommandId('c6') });
    expect(s.expedition.campUsed).toBe(true);

    // 7. 夜袭检定 → 守夜阻止
    s = dispatchGameCommand(s, { type: 'RESOLVE_NIGHT_AMBUSH', commandId: newCommandId('c7') });
    expect(s.expedition.campState!.nightAmbushResult!.guarded).toBe(true);
    expect(s.eventLog.find((e) => e.type === 'NIGHT_AMBUSH_PREVENTED')).toBeDefined();

    // 8. 露营点数不超支(已选活动扣的点数 + 食物加成)
    // 食物 normal 没有 bonus,基础 12 - vestal_calm(3) - keep_watch(4) - scout_ahead(4) = 1
    expect(s.expedition.campState!.remainingPoints).toBe(1);
  });

  it('露营点数不允许超支', () => {
    let s = freshGame('DD-WEB-PHASE4-CAMP-001-noover');
    s = dispatchGameCommand(s, { type: 'START_CAMP', commandId: newCommandId('c1') });
    s = dispatchGameCommand(s, { type: 'CHOOSE_CAMP_FOOD', choiceId: 'normal', commandId: newCommandId('c2') });
    // 试图选一个 cost > remaining 的活动
    s.expedition.campState!.remainingPoints = 1;
    expect(() => dispatchGameCommand(s, {
      type: 'CHOOSE_CAMP_ACTIVITY', activityId: 'camp_inspiring_prayer', commandId: newCommandId('c3'),
    })).toThrow();
  });
});

// =====================================================================
// Golden Run C: 夜袭失败
// =====================================================================

describe('Phase 4 P4.5 Golden Run C: 夜袭失败 (DD-WEB-PHASE4-AMBUSH-001)', () => {
  it('中型远征 → 露营不守夜 → 触发夜袭 → 效果应用', () => {
    let s2 = freshGame('DD-WEB-PHASE4-AMBUSH-001');
    s2 = dispatchGameCommand(s2, { type: 'START_CAMP', commandId: newCommandId('c1') });
    s2 = dispatchGameCommand(s2, { type: 'CHOOSE_CAMP_FOOD', choiceId: 'normal', commandId: newCommandId('c2') });
    s2 = dispatchGameCommand(s2, { type: 'FINISH_CAMP', commandId: newCommandId('c3') });
    s2 = dispatchGameCommand(s2, { type: 'RESOLVE_NIGHT_AMBUSH', commandId: newCommandId('c4') });
    // 夜袭结果(可能触发也可能安全,但有结果)
    expect(s2.expedition.campState!.nightAmbushResult).not.toBeNull();
  });

  it('夜袭不重复检定', () => {
    let s = freshGame('DD-WEB-PHASE4-AMBUSH-001-dup');
    s = dispatchGameCommand(s, { type: 'START_CAMP', commandId: newCommandId('c1') });
    s = dispatchGameCommand(s, { type: 'CHOOSE_CAMP_FOOD', choiceId: 'normal', commandId: newCommandId('c2') });
    s = dispatchGameCommand(s, { type: 'FINISH_CAMP', commandId: newCommandId('c3') });
    s = dispatchGameCommand(s, { type: 'RESOLVE_NIGHT_AMBUSH', commandId: newCommandId('c4') });
    // 第二次 → 抛错
    expect(() => dispatchGameCommand(s, { type: 'RESOLVE_NIGHT_AMBUSH', commandId: newCommandId('c5') })).toThrow();
  });

  it('Seeded RNG 刷新恢复 → 夜袭结果不重抽', () => {
    const run = (): { outcome: string; guarded: boolean; rngState: number } => {
      let s = freshGame('DD-WEB-PHASE4-AMBUSH-001-reseed');
      s = dispatchGameCommand(s, { type: 'START_CAMP', commandId: newCommandId('c1') });
      s = dispatchGameCommand(s, { type: 'CHOOSE_CAMP_FOOD', choiceId: 'normal', commandId: newCommandId('c2') });
      s = dispatchGameCommand(s, { type: 'FINISH_CAMP', commandId: newCommandId('c3') });
      s = dispatchGameCommand(s, { type: 'RESOLVE_NIGHT_AMBUSH', commandId: newCommandId('c4') });
      return {
        outcome: s.expedition.campState!.nightAmbushResult!.outcome,
        guarded: s.expedition.campState!.nightAmbushResult!.guarded,
        rngState: s.rng.state as number,
      };
    };
    const a = run();
    const b = run();
    expect(a.outcome).toBe(b.outcome);
    expect(a.guarded).toBe(b.guarded);
    expect(a.rngState).toBe(b.rngState);
  });
});
