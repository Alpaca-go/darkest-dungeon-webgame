/**
 * Phase 4 P4.1 怪癖系统测试
 *
 * 覆盖:
 *  - QuirkDefinition 库(12 正面 + 12 负向)
 *  - acquireQuirk: 上限/替换/锁定/重复
 *  - removeNegativeQuirk / lockPositiveQuirk
 *  - 死英雄不接受怪癖
 *  - 行为冷却查询
 *  - 完整 dispatcher 集成
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
  removeNegativeQuirk,
  lockPositiveQuirk,
  unlockPositiveQuirk,
  listReplaceableQuirks,
  isPositiveQuirk,
  isNegativeQuirk,
  POSITIVE_QUIRKS,
  NEGATIVE_QUIRKS,
  ALL_QUIRKS,
} from '../src/game-engine/quirks/index.js';
import { QUIRK_MAX_POSITIVE, QUIRK_MAX_NEGATIVE } from '../src/game-engine/quirks/types.js';

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
    },
    party: {
      'h.crusader': freshHero('h.crusader', 'Reynauld', 'crusader', 1, 25),
    },
    encounter: null, pendingDecision: null, lastResolution: null,
    inventory: { capacity: 16, stacks: [] },
    torch: { value: 100, level: 'radiant' },
    eventLog: [], rng: rng.state, lastTransactionId: null,
    activeOverlay: null, deathRecords: [], pendingMentalFlags: [], derivedEventDepth: 0,
    campaign: {
      id: `camp_${seed}`, seed, week: 1, gold: INITIAL_GOLD,
      heirlooms: { portraits: INITIAL_PORTRAITS, crests: INITIAL_CRESTS },
      rosterCapacity: 8, rosterHeroIds: ['h.crusader'],
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

describe('Phase 4 怪癖: 库完整性', () => {
  it('12 个正面怪癖', () => {
    expect(Object.keys(POSITIVE_QUIRKS).length).toBeGreaterThanOrEqual(12);
    for (const def of Object.values(POSITIVE_QUIRKS)) {
      expect(def.type).toBe('positive');
      expect(def.id).toMatch(/^quirk_/);
    }
  });

  it('12 个负面怪癖', () => {
    expect(Object.keys(NEGATIVE_QUIRKS).length).toBeGreaterThanOrEqual(12);
    for (const def of Object.values(NEGATIVE_QUIRKS)) {
      expect(def.type).toBe('negative');
      expect(def.id).toMatch(/^quirk_/);
    }
  });

  it('至少 6 个怪癖带强迫行为', () => {
    let withBehavior = 0;
    for (const def of Object.values(ALL_QUIRKS)) {
      if (def.behaviors.length > 0) withBehavior += 1;
    }
    expect(withBehavior).toBeGreaterThanOrEqual(6);
  });

  it('行为定义有 cooldownDecisions(2-4)', () => {
    for (const def of Object.values(ALL_QUIRKS)) {
      for (const b of def.behaviors) {
        expect(b.cooldownDecisions).toBeGreaterThanOrEqual(2);
        expect(b.cooldownDecisions).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe('Phase 4 怪癖: acquireQuirk', () => {
  it('直接获得(未满)', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = acquireQuirk(hero, 'quirk_ruins_explorer');
    expect(r.ok).toBe(true);
    expect(hero.positiveQuirkIds).toContain('quirk_ruins_explorer');
  });

  it('idempotent:已有同怪癖不重复加', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    acquireQuirk(hero, 'quirk_ruins_explorer');
    acquireQuirk(hero, 'quirk_ruins_explorer');
    expect(hero.positiveQuirkIds.filter((q) => q === 'quirk_ruins_explorer').length).toBe(1);
  });

  it('上限 5,达到上限替换最早未锁定正面', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const ids = Object.keys(POSITIVE_QUIRKS).slice(0, 5);
    for (const id of ids) acquireQuirk(hero, id);
    expect(hero.positiveQuirkIds.length).toBe(5);
    // 加第 6 个(ids 之外) → 替换
    const r = acquireQuirk(hero, 'quirk_precise');
    expect(r.ok).toBe(true);
    expect(hero.positiveQuirkIds.length).toBe(5);
    expect(hero.positiveQuirkIds).toContain('quirk_precise');
    expect(r.replacedId).toBeDefined();
  });

  it('全部正面锁定 → 拒绝获得', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const ids = Object.keys(POSITIVE_QUIRKS).slice(0, 5);
    for (const id of ids) acquireQuirk(hero, id);
    // 强制让所有正面都锁定
    hero.lockedPositiveQuirkIds = [...hero.positiveQuirkIds];
    // 用 ids 之外的 quirk,确保不是 idempotent
    const r = acquireQuirk(hero, 'quirk_precise');
    expect(r.ok).toBe(false);
  });

  it('锁定正面怪癖不被替换', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    acquireQuirk(hero, 'quirk_ruins_explorer');
    lockPositiveQuirk(hero, 'quirk_ruins_explorer');
    // 加 4 个其它正面 — 让 positive 达到 5
    const others = ['quirk_hardy', 'quirk_holy_faith', 'quirk_quick_reflexes', 'quirk_light_keeper'];
    for (const id of others) acquireQuirk(hero, id);
    expect(hero.positiveQuirkIds.length).toBe(5);
    // 加第 6 个 → 应该替换未锁定的最早(quirk_hardy),不替换 quirk_ruins_explorer
    const r = acquireQuirk(hero, 'quirk_precise');
    expect(r.ok).toBe(true);
    expect(r.replacedId).toBe('quirk_hardy');
    expect(hero.positiveQuirkIds).toContain('quirk_ruins_explorer');
    expect(hero.positiveQuirkIds).not.toContain('quirk_hardy');
  });

  it('上限常量(SPEC §3.1)', () => {
    expect(QUIRK_MAX_POSITIVE).toBe(5);
    expect(QUIRK_MAX_NEGATIVE).toBe(5);
  });

  it('死英雄不接受怪癖', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    hero.isDead = true;
    hero.hp = 0;
    const r = acquireQuirk(hero, 'quirk_ruins_explorer');
    expect(r.ok).toBe(false);
  });

  it('未知怪癖 → 拒绝', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = acquireQuirk(hero, 'quirk_no_such');
    expect(r.ok).toBe(false);
  });
});

describe('Phase 4 怪癖: removeNegativeQuirk / lockPositiveQuirk', () => {
  it('移除一个负向怪癖', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    acquireQuirk(hero, 'quirk_afraid_of_dark');
    expect(hero.negativeQuirkIds).toContain('quirk_afraid_of_dark');
    const r = removeNegativeQuirk(hero, 'quirk_afraid_of_dark');
    expect(r.ok).toBe(true);
    expect(hero.negativeQuirkIds).not.toContain('quirk_afraid_of_dark');
  });

  it('不存在的负向怪癖 → 拒绝', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = removeNegativeQuirk(hero, 'quirk_afraid_of_dark');
    expect(r.ok).toBe(false);
  });

  it('锁定正面怪癖 + 解锁', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    acquireQuirk(hero, 'quirk_ruins_explorer');
    expect(lockPositiveQuirk(hero, 'quirk_ruins_explorer').ok).toBe(true);
    expect(hero.lockedPositiveQuirkIds).toContain('quirk_ruins_explorer');
    expect(unlockPositiveQuirk(hero, 'quirk_ruins_explorer').ok).toBe(true);
    expect(hero.lockedPositiveQuirkIds).not.toContain('quirk_ruins_explorer');
  });

  it('锁定不存在的正面 → 拒绝', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = lockPositiveQuirk(hero, 'quirk_holy_faith');
    expect(r.ok).toBe(false);
  });

  it('isPositiveQuirk / isNegativeQuirk 分类', () => {
    expect(isPositiveQuirk('quirk_hardy')).toBe(true);
    expect(isNegativeQuirk('quirk_afraid_of_dark')).toBe(true);
    expect(isPositiveQuirk('quirk_afraid_of_dark')).toBe(false);
  });
});

describe('Phase 4 怪癖: listReplaceableQuirks', () => {
  it('列出可被替换的怪癖', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    acquireQuirk(hero, 'quirk_ruins_explorer');
    acquireQuirk(hero, 'quirk_hardy');
    lockPositiveQuirk(hero, 'quirk_ruins_explorer');
    const list = listReplaceableQuirks(hero);
    expect(list.positive).toContain('quirk_hardy');
    expect(list.positive).not.toContain('quirk_ruins_explorer');
  });
});

describe('Phase 4 怪癖: dispatcher 集成', () => {
  it('GRANT_QUIRK 成功', () => {
    let s = freshGame('quirk-grant-1');
    s = dispatchGameCommand(s, {
      type: 'GRANT_QUIRK', heroId: 'h.crusader', quirkId: 'quirk_hardy', commandId: newCommandId('q'),
    });
    expect(s.party['h.crusader']!.positiveQuirkIds).toContain('quirk_hardy');
  });

  it('GRANT_QUIRK 未知 → 抛错', () => {
    const s = freshGame('quirk-no-such');
    expect(() => dispatchGameCommand(s, {
      type: 'GRANT_QUIRK', heroId: 'h.crusader', quirkId: 'quirk_nope', commandId: newCommandId('q'),
    })).toThrow();
  });

  it('REMOVE_QUIRK 移除负向', () => {
    let s = freshGame('quirk-rm-1');
    s = dispatchGameCommand(s, {
      type: 'GRANT_QUIRK', heroId: 'h.crusader', quirkId: 'quirk_afraid_of_dark', commandId: newCommandId('a'),
    });
    s = dispatchGameCommand(s, {
      type: 'REMOVE_QUIRK', heroId: 'h.crusader', quirkId: 'quirk_afraid_of_dark', commandId: newCommandId('r'),
    });
    expect(s.party['h.crusader']!.negativeQuirkIds).not.toContain('quirk_afraid_of_dark');
  });

  it('LOCK_POSITIVE_QUIRK 成功', () => {
    let s = freshGame('quirk-lock-1');
    s = dispatchGameCommand(s, {
      type: 'GRANT_QUIRK', heroId: 'h.crusader', quirkId: 'quirk_hardy', commandId: newCommandId('g'),
    });
    s = dispatchGameCommand(s, {
      type: 'LOCK_POSITIVE_QUIRK', heroId: 'h.crusader', quirkId: 'quirk_hardy', commandId: newCommandId('l'),
    });
    expect(s.party['h.crusader']!.lockedPositiveQuirkIds).toContain('quirk_hardy');
  });

  it('QUIRK_GAINED 事件 emit', () => {
    let s = freshGame('quirk-event-1');
    s = dispatchGameCommand(s, {
      type: 'GRANT_QUIRK', heroId: 'h.crusader', quirkId: 'quirk_hardy', commandId: newCommandId('g'),
    });
    const ev = s.eventLog.find((e) => e.type === 'QUIRK_GAINED');
    expect(ev).toBeDefined();
  });
});
