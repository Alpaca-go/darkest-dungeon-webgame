/**
 * Phase 4 P4.3 成长深化测试
 *
 * 覆盖:
 *  - XP 曲线(levelFromXp / totalXpForLevel / xpToNextLevel)
 *  - addXp 升级触发 resolveLevel 变化
 *  - upgradeHeroSlot 上限 4 + 费用随等级/设施变化
 *  - dispatcher 集成(GRANT_XP / UPGRADE_HERO_* 升级到 4)
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
  addXp,
  upgradeHeroSlot,
  levelFromXp,
  totalXpForLevel,
  xpToNextLevel,
  levelCoef,
  MAX_LEVEL,
  XP_CURVE,
} from '../src/game-engine/progression/index.js';

function freshHero(id: string, name: string, archetype: HeroInstance['archetype'], rank: 1 | 2 | 3 | 4, maxHp: number): HeroInstance {
  return {
    id, name, archetype, tags: [], rank,
    hp: maxHp, maxHp, protection: 0.1, dodge: 5, speed: 5, accuracy: 0.85, crit: 0.05,
    bleedResist: 0.3, blightResist: 0.3, stunResist: 0.3, moveResist: 0.3,
    bleed: [], blight: [], stun: null, mark: null, protBuff: null,
    cooldowns: {}, isDead: false, conditions: [], skills: ['s1', 's2', 's3'],
    stress: 0, resolveState: 'stable', afflictionId: null, virtueId: null,
    atDeathsDoor: false, deathsDoorRecoveryStacks: 0, deathblowPenalty: 0, heartAttackCount: 0,
    behaviorCooldowns: {},
    resolveLevel: 0, xp: 0, weaponLevel: 0, armorLevel: 0, skillLevels: {},
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

describe('Phase 4 成长: XP 曲线(SPEC §9.1)', () => {
  it('MAX_LEVEL = 4', () => {
    expect(MAX_LEVEL).toBe(4);
  });

  it('XP_CURVE = [0, 2, 5, 9, 14]', () => {
    expect(XP_CURVE).toEqual([0, 2, 5, 9, 14]);
  });

  it('totalXpForLevel: 0→1 需 2,1→2 需 5,2→3 需 9,3→4 需 14', () => {
    expect(totalXpForLevel(0)).toBe(0);
    expect(totalXpForLevel(1)).toBe(2);
    expect(totalXpForLevel(2)).toBe(5);
    expect(totalXpForLevel(3)).toBe(9);
    expect(totalXpForLevel(4)).toBe(14);
  });

  it('levelFromXp 反向计算', () => {
    expect(levelFromXp(0)).toBe(0);
    expect(levelFromXp(1)).toBe(0);
    expect(levelFromXp(2)).toBe(1);
    expect(levelFromXp(5)).toBe(2);
    expect(levelFromXp(8)).toBe(2);
    expect(levelFromXp(9)).toBe(3);
    expect(levelFromXp(14)).toBe(4);
    expect(levelFromXp(100)).toBe(4);
  });

  it('xpToNextLevel', () => {
    expect(xpToNextLevel(0)).toBe(2);
    expect(xpToNextLevel(1)).toBe(1);
    expect(xpToNextLevel(2)).toBe(3);
    expect(xpToNextLevel(4)).toBe(1);
    expect(xpToNextLevel(14)).toBe(0); // 满级
  });

  it('levelCoef: 等级 0 = 1, 等级 4 = 1.8', () => {
    expect(levelCoef(0)).toBe(1);
    expect(levelCoef(1)).toBeCloseTo(1.2);
    expect(levelCoef(4)).toBeCloseTo(1.8);
  });
});

describe('Phase 4 成长: addXp', () => {
  it('加 XP 不溢出等级 4', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    addXp(hero, 1000);
    expect(hero.resolveLevel).toBe(4);
    expect(hero.xp).toBe(14);
  });

  it('加 2 XP → 等级 1', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = addXp(hero, 2);
    expect(r.levelsGained).toBe(1);
    expect(hero.resolveLevel).toBe(1);
  });

  it('加 0 / 负 XP → 不变', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = addXp(hero, 0);
    expect(r.levelsGained).toBe(0);
    expect(hero.resolveLevel).toBe(0);
  });

  it('分批加 XP 跨等级', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    addXp(hero, 1); // 0→0
    addXp(hero, 2); // 0→1
    addXp(hero, 5); // 1→2
    addXp(hero, 9); // 2→3
    addXp(hero, 14); // 3→4
    expect(hero.resolveLevel).toBe(4);
  });
});

describe('Phase 4 成长: upgradeHeroSlot', () => {
  it('武器 0→1 升级 + 费用 = 750 × 1 × 1 = 750(等级 1 设施 1)', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = upgradeHeroSlot(hero, 'weapon', null, 750, 1);
    expect(r.ok).toBe(true);
    expect(r.newLevel).toBe(1);
    expect(r.costGold).toBe(750);
  });

  it('武器 1→2 升级 + 费用 = 750 × 1.2 × 1 = 900', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    hero.weaponLevel = 1;
    const r = upgradeHeroSlot(hero, 'weapon', null, 750, 1);
    expect(r.newLevel).toBe(2);
    expect(r.costGold).toBe(900);
  });

  it('武器可以升到 4', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    for (let i = 0; i < 4; i += 1) {
      upgradeHeroSlot(hero, 'weapon', null, 750, 2);
    }
    expect(hero.weaponLevel).toBe(4);
  });

  it('武器满级 4 → 拒绝', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    hero.weaponLevel = 4;
    const r = upgradeHeroSlot(hero, 'weapon', null, 750, 1);
    expect(r.ok).toBe(false);
  });

  it('护甲 0→1 升级', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = upgradeHeroSlot(hero, 'armor', null, 750, 1);
    expect(r.newLevel).toBe(1);
    expect(hero.armorLevel).toBe(1);
  });

  it('护甲升到 4', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    for (let i = 0; i < 4; i += 1) {
      upgradeHeroSlot(hero, 'armor', null, 750, 2);
    }
    expect(hero.armorLevel).toBe(4);
  });

  it('技能 0→1 升级(skillId)', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = upgradeHeroSlot(hero, 'skill', 's1', 800, 1);
    expect(r.newLevel).toBe(1);
    expect(hero.skillLevels!['s1']).toBe(1);
  });

  it('技能升到 4', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    for (let i = 0; i < 4; i += 1) {
      upgradeHeroSlot(hero, 'skill', 's1', 800, 2);
    }
    expect(hero.skillLevels!['s1']).toBe(4);
  });

  it('设施 2 → 费用 -10%', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = upgradeHeroSlot(hero, 'weapon', null, 750, 2);
    // 750 * 1 * 0.9 = 675
    expect(r.costGold).toBe(675);
  });
});

describe('Phase 4 成长: dispatcher 集成', () => {
  it('GRANT_XP 跨等级触发 HERO_RESOLVE_LEVEL_INCREASED', () => {
    let s = freshGame('xp-up-1');
    s = dispatchGameCommand(s, {
      type: 'GRANT_XP', heroId: 'h.crusader', amount: 5, commandId: newCommandId('xp'),
    });
    expect(s.party['h.crusader']!.resolveLevel).toBe(2);
    const ev = s.eventLog.find((e) => e.type === 'HERO_RESOLVE_LEVEL_INCREASED');
    expect(ev).toBeDefined();
  });

  it('GRANT_XP 0 → 不变,不触发事件', () => {
    let s = freshGame('xp-zero');
    s = dispatchGameCommand(s, {
      type: 'GRANT_XP', heroId: 'h.crusader', amount: 0, commandId: newCommandId('xp'),
    });
    expect(s.party['h.crusader']!.resolveLevel).toBe(0);
    expect(s.eventLog.find((e) => e.type === 'HERO_RESOLVE_LEVEL_INCREASED')).toBeUndefined();
  });

  it('GRANT_XP 死英雄 → 抛错', () => {
    const s = freshGame('xp-dead');
    s.party['h.crusader']!.isDead = true;
    s.party['h.crusader']!.hp = 0;
    expect(() => dispatchGameCommand(s, {
      type: 'GRANT_XP', heroId: 'h.crusader', amount: 5, commandId: newCommandId('xp'),
    })).toThrow();
  });

  it('UPGRADE_HERO_WEAPON 可以升到 4', () => {
    let s = freshGame('wp-up');
    for (let i = 0; i < 4; i += 1) {
      s = dispatchGameCommand(s, {
        type: 'UPGRADE_HERO_WEAPON', heroId: 'h.crusader', commandId: newCommandId(`w${i}`),
      });
    }
    expect(s.party['h.crusader']!.weaponLevel).toBe(4);
  });

  it('UPGRADE_HERO_WEAPON 满级后 → 抛错', () => {
    const s = freshGame('wp-max');
    s.party['h.crusader']!.weaponLevel = 4;
    expect(() => dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_WEAPON', heroId: 'h.crusader', commandId: newCommandId('w'),
    })).toThrow();
  });

  it('UPGRADE_HERO_ARMOR 可以升到 4', () => {
    let s = freshGame('ar-up');
    for (let i = 0; i < 4; i += 1) {
      s = dispatchGameCommand(s, {
        type: 'UPGRADE_HERO_ARMOR', heroId: 'h.crusader', commandId: newCommandId(`a${i}`),
      });
    }
    expect(s.party['h.crusader']!.armorLevel).toBe(4);
  });

  it('UPGRADE_HERO_SKILL 可以升到 4', () => {
    let s = freshGame('sk-up');
    for (let i = 0; i < 4; i += 1) {
      s = dispatchGameCommand(s, {
        type: 'UPGRADE_HERO_SKILL', heroId: 'h.crusader', skillId: 's1', commandId: newCommandId(`k${i}`),
      });
    }
    expect(s.party['h.crusader']!.skillLevels!['s1']).toBe(4);
  });
});
