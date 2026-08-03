/**
 * Phase 4 P4.1 疾病系统测试
 *
 * 覆盖:
 *  - 10 个疾病定义
 *  - acquireDisease 上限 3 + idempotent + 死英雄拒绝
 *  - treatDisease 费用计算 + 移除
 *  - 疗养院 disease-treatment 集成
 *  - dispatcher 集成
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
  acquireDisease,
  treatDisease,
  listTreatableDiseases,
  calculateTreatmentCost,
  listDiseases,
} from '../src/game-engine/diseases/index.js';
import { DISEASE_MAX } from '../src/game-engine/diseases/types.js';

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

describe('Phase 4 疾病: 库完整性', () => {
  it('至少 10 个疾病', () => {
    expect(listDiseases().length).toBeGreaterThanOrEqual(10);
  });

  it('每个疾病有 id / name / treatmentCostBase', () => {
    for (const def of listDiseases()) {
      expect(def.id).toMatch(/^disease_/);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.treatmentCostBase).toBeGreaterThan(0);
    }
  });

  it('上限常量(SPEC §5.1)', () => {
    expect(DISEASE_MAX).toBe(3);
  });
});

describe('Phase 4 疾病: acquireDisease', () => {
  it('直接获得', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = acquireDisease(hero, 'disease_red_pestilence', 'trap');
    expect(r.ok).toBe(true);
    expect(hero.diseaseIds).toContain('disease_red_pestilence');
  });

  it('idempotent:已有同疾病不重复', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    acquireDisease(hero, 'disease_red_pestilence', 'trap');
    acquireDisease(hero, 'disease_red_pestilence', 'trap');
    expect(hero.diseaseIds.filter((d) => d === 'disease_red_pestilence').length).toBe(1);
  });

  it('上限 3,达到上限拒绝', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    acquireDisease(hero, 'disease_red_pestilence', 'trap');
    acquireDisease(hero, 'disease_sluggish', 'trap');
    acquireDisease(hero, 'disease_lung', 'trap');
    const r = acquireDisease(hero, 'disease_tetanus', 'trap');
    expect(r.ok).toBe(false);
  });

  it('死英雄不接受', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    hero.isDead = true;
    hero.hp = 0;
    const r = acquireDisease(hero, 'disease_red_pestilence', 'trap');
    expect(r.ok).toBe(false);
  });

  it('未知疾病 → 拒绝', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = acquireDisease(hero, 'disease_no_such', 'trap');
    expect(r.ok).toBe(false);
  });
});

describe('Phase 4 疾病: calculateTreatmentCost', () => {
  it('等级 0 + 设施 1 → 基础费用', () => {
    expect(calculateTreatmentCost(500, 0, 1)).toBe(500);
  });

  it('等级 1 + 设施 1 → 1.2x', () => {
    expect(calculateTreatmentCost(500, 1, 1)).toBe(600);
  });

  it('等级 2 + 设施 2 → 1.4 * 0.9 = 1.26x', () => {
    expect(calculateTreatmentCost(500, 2, 2)).toBe(630);
  });

  it('黑死病(900) + 等级 0 + 设施 1 = 900', () => {
    expect(calculateTreatmentCost(900, 0, 1)).toBe(900);
  });
});

describe('Phase 4 疾病: treatDisease', () => {
  it('治疗一个疾病 + 扣金币', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    acquireDisease(hero, 'disease_red_pestilence', 'trap');
    const r = treatDisease(hero, 'disease_red_pestilence', 0, 1);
    expect(r.ok).toBe(true);
    expect(hero.diseaseIds).not.toContain('disease_red_pestilence');
  });

  it('不存在的疾病 → 拒绝', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const r = treatDisease(hero, 'disease_red_pestilence', 0, 1);
    expect(r.ok).toBe(false);
  });

  it('listTreatableDiseases 列出所有可治疗疾病', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    acquireDisease(hero, 'disease_red_pestilence', 'trap');
    acquireDisease(hero, 'disease_sluggish', 'trap');
    const list = listTreatableDiseases(hero, 0, 1);
    expect(list.length).toBe(2);
    expect(list[0]!.costGold).toBe(500);
  });
});

describe('Phase 4 疾病: dispatcher 集成', () => {
  it('GRANT_DISEASE 成功', () => {
    let s = freshGame('disease-grant-1');
    s = dispatchGameCommand(s, {
      type: 'GRANT_DISEASE',
      heroId: 'h.crusader', diseaseId: 'disease_red_pestilence', source: 'trap',
      commandId: newCommandId('d'),
    });
    expect(s.party['h.crusader']!.diseaseIds).toContain('disease_red_pestilence');
  });

  it('TREAT_DISEASE 扣金币 + 移除疾病', () => {
    let s = freshGame('disease-treat-1');
    s = dispatchGameCommand(s, {
      type: 'GRANT_DISEASE',
      heroId: 'h.crusader', diseaseId: 'disease_red_pestilence', source: 'trap',
      commandId: newCommandId('g'),
    });
    const goldBefore = s.campaign!.gold;
    s = dispatchGameCommand(s, {
      type: 'TREAT_DISEASE',
      heroId: 'h.crusader', diseaseId: 'disease_red_pestilence',
      commandId: newCommandId('t'),
    });
    expect(s.party['h.crusader']!.diseaseIds).not.toContain('disease_red_pestilence');
    expect(s.campaign!.gold).toBeLessThan(goldBefore);
  });

  it('TREAT_DISEASE 金币不足 → 抛错', () => {
    let s = freshGame('disease-broke-1');
    s.campaign!.gold = 50;
    s = dispatchGameCommand(s, {
      type: 'GRANT_DISEASE',
      heroId: 'h.crusader', diseaseId: 'disease_red_pestilence', source: 'trap',
      commandId: newCommandId('g'),
    });
    expect(() => dispatchGameCommand(s, {
      type: 'TREAT_DISEASE',
      heroId: 'h.crusader', diseaseId: 'disease_red_pestilence',
      commandId: newCommandId('t'),
    })).toThrow();
  });

  it('DISEASE_GAINED / DISEASE_TREATED 事件 emit', () => {
    let s = freshGame('disease-events-1');
    s = dispatchGameCommand(s, {
      type: 'GRANT_DISEASE',
      heroId: 'h.crusader', diseaseId: 'disease_red_pestilence', source: 'trap',
      commandId: newCommandId('g'),
    });
    s = dispatchGameCommand(s, {
      type: 'TREAT_DISEASE',
      heroId: 'h.crusader', diseaseId: 'disease_red_pestilence',
      commandId: newCommandId('t'),
    });
    const gained = s.eventLog.find((e) => e.type === 'DISEASE_GAINED');
    const treated = s.eventLog.find((e) => e.type === 'DISEASE_TREATED');
    expect(gained).toBeDefined();
    expect(treated).toBeDefined();
  });
});
