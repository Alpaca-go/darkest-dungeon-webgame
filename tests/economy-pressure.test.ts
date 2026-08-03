/**
 * Phase 3 经济压力测试(SPEC §42 DD-WEB-PHASE3-ECONOMY-001)
 *
 * 验证:
 *  - 金币不足以同时治疗、升级、购买保险补给
 *  - 玩家必须取舍
 *  - 不能负金币
 *  - 不能免费治疗
 *  - 不能重复退队
 *  - 资源不成为负数
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
    activityState: 'available', assignedFacilityId: null, activityWeeksRemaining: 0,
    expeditionCount: 0, successfulExpeditionCount: 0, retreatCount: 0,
    deathsDoorCount: 0, resistedDeathblowCount: 0,
  };
}

function freshGame(seed: string, gold = INITIAL_GOLD): GameState {
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
    },
    party: {
      'h.crusader': freshHero('h.crusader', 'Reynauld', 'crusader', 1, 25),
      'h.highwayman': freshHero('h.highwayman', 'Dismas', 'highwayman', 2, 22),
      'h.vestal': freshHero('h.vestal', 'Junia', 'vestal', 3, 20),
      'h.plague_doctor': freshHero('h.plague_doctor', 'Pox', 'plague_doctor', 4, 21),
    },
    encounter: null, pendingDecision: null, lastResolution: null,
    inventory: { capacity: 16, stacks: [] },
    torch: { value: 100, level: 'radiant' },
    eventLog: [], rng: rng.state, lastTransactionId: null,
    activeOverlay: null, deathRecords: [], pendingMentalFlags: [], derivedEventDepth: 0,
    campaign: {
      id: `camp_${seed}`, seed, week: 1, gold,
      heirlooms: { portraits: INITIAL_PORTRAITS, crests: INITIAL_CRESTS },
      rosterCapacity: 8, rosterHeroIds: ['h.crusader', 'h.highwayman', 'h.vestal', 'h.plague_doctor'],
      deadHeroIds: [], completedQuestIds: [], availableQuestIds: [], availableRecruitIds: [],
      facilityStates: structuredClone(INITIAL_FACILITY_STATES),
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

describe('Phase 3 经济压力: 资源约束', () => {
  it('金币不能成为负数', () => {
    let s = freshGame('econ-no-neg-1', 100);
    // 尝试花超过余额的 → 应抛错
    expect(() => dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.crusader', facilityId: 'tavern', serviceId: 'stress-tavern',
      commandId: newCommandId('a'),
    })).toThrow();
    // 失败时金币未变
    expect(s.campaign!.gold).toBe(100);
  });

  it('升级武器金币不足 → 抛错', () => {
    let s = freshGame('econ-up-no', 100);
    expect(() => dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_WEAPON', heroId: 'h.crusader', commandId: newCommandId('u'),
    })).toThrow();
    expect(s.campaign!.gold).toBe(100);
  });

  it('SETTLE_PROVISION 金币不足 → 抛错', () => {
    let s = freshGame('econ-prov-no', 50);
    // bandage 单价 200
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'bandage', count: 1, commandId: newCommandId('b'),
    });
    expect(() => dispatchGameCommand(s, {
      type: 'SETTLE_PROVISION', commandId: newCommandId('sp'),
    })).toThrow();
  });

  it('初始 8000 金币:可同时做 1 治疗 + 1 升级 + 一些补给,但不能全做满', () => {
    let s = freshGame('econ-budget-1', INITIAL_GOLD);
    // 初始 8000
    expect(s.campaign!.gold).toBe(8000);

    // 修道院 900
    s = dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.crusader', facilityId: 'abbey', serviceId: 'stress-abbey',
      commandId: newCommandId('a1'),
    });
    expect(s.campaign!.gold).toBe(7100);

    // 武器升级 750
    s = dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_WEAPON', heroId: 'h.highwayman', commandId: newCommandId('u1'),
    });
    expect(s.campaign!.gold).toBe(6350);

    // 购买 10 个食物 = 500
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'food', count: 10, commandId: newCommandId('b1'),
    });
    s = dispatchGameCommand(s, {
      type: 'SETTLE_PROVISION', commandId: newCommandId('sp1'),
    });
    expect(s.campaign!.gold).toBe(5850);

    // 设施升级 1500(铁匠铺) - 还够
    s = dispatchGameCommand(s, {
      type: 'UPGRADE_FACILITY', facilityId: 'blacksmith', upgradeOptionId: 'blacksmith.lvl2',
      commandId: newCommandId('f1'),
    });
    expect(s.campaign!.gold).toBe(4350);

    // 现在再买绷带 200 × 4 = 800 — 还够
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'bandage', count: 4, commandId: newCommandId('b2'),
    });
    s = dispatchGameCommand(s, {
      type: 'SETTLE_PROVISION', commandId: newCommandId('sp2'),
    });
    expect(s.campaign!.gold).toBe(3550);
  });

  it('金币 2000(稀缺):玩家必须取舍', () => {
    let s = freshGame('econ-scarce-1', 2000);
    // 修道院 900 + 武器 750 = 1650 (还剩 350)
    s = dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.crusader', facilityId: 'abbey', serviceId: 'stress-abbey',
      commandId: newCommandId('a1'),
    });
    s = dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_WEAPON', heroId: 'h.highwayman', commandId: newCommandId('u1'),
    });
    expect(s.campaign!.gold).toBe(350);

    // 现在做不了更多升级(750 / 800)
    expect(() => dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_ARMOR', heroId: 'h.crusader', commandId: newCommandId('u2'),
    })).toThrow();
    // 酒馆 650 也做不了
    expect(() => dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.plague_doctor', facilityId: 'tavern', serviceId: 'stress-tavern',
      commandId: newCommandId('a2'),
    })).toThrow();

    // 但还能买一些食物(50 × 3 = 150,余 200)
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'food', count: 3, commandId: newCommandId('b1'),
    });
    s = dispatchGameCommand(s, {
      type: 'SETTLE_PROVISION', commandId: newCommandId('sp1'),
    });
    expect(s.campaign!.gold).toBe(200);
  });
});

describe('Phase 3 经济压力: 不能免费治疗/重复退队', () => {
  it('治疗必须扣金币(> 0)', () => {
    const s = freshGame('econ-treat-cost', INITIAL_GOLD);
    const before = s.campaign!.gold;
    dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.crusader', facilityId: 'abbey', serviceId: 'stress-abbey',
      commandId: newCommandId('a'),
    });
    // 修道院 900
    expect(before - s.campaign!.gold).toBe(900);
  });

  it('同英雄不能重复退队(同设施)', () => {
    let s = freshGame('econ-no-repeat-1', INITIAL_GOLD);
    s = dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.crusader', facilityId: 'tavern', serviceId: 'stress-tavern',
      commandId: newCommandId('a1'),
    });
    // 第二次分配到同设施
    expect(() => dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.crusader', facilityId: 'tavern', serviceId: 'stress-tavern',
      commandId: newCommandId('a2'),
    })).toThrow();
  });

  it('同一服务付费不能多次扣(分配到不同设施)', () => {
    let s = freshGame('econ-no-double-1', INITIAL_GOLD);
    const before = s.campaign!.gold;
    // 先 cancel 然后再 assign
    s = dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.crusader', facilityId: 'tavern', serviceId: 'stress-tavern',
      commandId: newCommandId('a1'),
    });
    s = dispatchGameCommand(s, {
      type: 'CANCEL_FACILITY_ASSIGNMENT',
      heroId: 'h.crusader', facilityId: 'tavern',
      commandId: newCommandId('c1'),
    });
    // 取消时金币不退还
    expect(s.campaign!.gold).toBe(before - 650);
  });
});

describe('Phase 3 经济压力: 资源不成为负数', () => {
  it('肖像/纹章不成为负数(预留 Phase 4 升级)', () => {
    // Phase 3 没有肖像/纹章消耗,只断言不变负
    const s = freshGame('econ-heirloom-1');
    expect(s.campaign!.heirlooms.portraits).toBeGreaterThanOrEqual(0);
    expect(s.campaign!.heirlooms.crests).toBeGreaterThanOrEqual(0);
  });

  it('SETTLE_PROVISION 后 provisionCart 归零', () => {
    let s = freshGame('econ-cart-1', INITIAL_GOLD);
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'food', count: 5, commandId: newCommandId('b'),
    });
    expect(s.hamlet!.provisionCart).toEqual({ food: 5 });
    s = dispatchGameCommand(s, {
      type: 'SETTLE_PROVISION', commandId: newCommandId('sp'),
    });
    expect(s.hamlet!.provisionCart).toEqual({});
  });

  it('同一物品加多次 → 累加', () => {
    let s = freshGame('econ-cart-2', INITIAL_GOLD);
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'food', count: 3, commandId: newCommandId('b1'),
    });
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'food', count: 2, commandId: newCommandId('b2'),
    });
    expect(s.hamlet!.provisionCart).toEqual({ food: 5 });
  });

  it('购物车移除超过实际数量 → 抛错', () => {
    let s = freshGame('econ-rm-1', INITIAL_GOLD);
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'food', count: 2, commandId: newCommandId('b'),
    });
    expect(() => dispatchGameCommand(s, {
      type: 'REMOVE_PROVISION', itemId: 'food', count: 5, commandId: newCommandId('rm'),
    })).toThrow();
  });
});
