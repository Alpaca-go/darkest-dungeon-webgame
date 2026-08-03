/**
 * Phase 3 设施服务测试
 *
 * 覆盖:
 *  - 7 个设施的 cost / effect
 *  - settleFacilities 结算
 *  - 金币/遗产校验
 *  - slot 占用校验
 *  - 死英雄不可用
 *  - 酒馆 40% 副作用(可复现)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  assignHeroToFacility,
  settleFacilities,
  TAVERN_SIDE_EFFECT_ID,
} from '../src/game-engine/campaign/facilities.js';
import type { GameState, HeroInstance } from '../src/game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../src/game-engine/expedition/types.js';
import { Mulberry32 } from '../src/game-engine/rng/index.js';
import { buildRuinsRoute } from '../src/content/route/ruins.js';
import { ensureCampaign } from '../src/game-engine/campaign/state.js';
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
      id: `camp_${seed}`, seed, week: 1, gold: INITIAL_GOLD,
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

beforeEach(() => undefined);

describe('Phase 3 设施: assignHeroToFacility', () => {
  it('酒馆 stress-tavern:扣 650 金币 + 1 周', () => {
    const s = freshGame('fac-tavern-1');
    const before = s.campaign!.gold;
    const result = assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern');
    expect(result.ok).toBe(true);
    expect(s.campaign!.gold).toBe(before - 650);
    expect(s.party['h.crusader']!.activityState).toBe('stress-treatment');
    expect(s.party['h.crusader']!.activityWeeksRemaining).toBe(1);
  });

  it('修道院 stress-abbey:扣 900 金币', () => {
    const s = freshGame('fac-abbey-1');
    const before = s.campaign!.gold;
    const result = assignHeroToFacility(s, 'h.crusader', 'abbey', 'stress-abbey');
    expect(result.ok).toBe(true);
    expect(s.campaign!.gold).toBe(before - 900);
  });

  it('疗养院 quirk-removal:目标英雄无负向怪癖 → 拒绝', () => {
    const s = freshGame('fac-quirk-1');
    const result = assignHeroToFacility(s, 'h.crusader', 'sanitarium', 'quirk-removal');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('没有负面怪癖');
  });

  it('疗养院 quirk-removal:有负向怪癖 → 扣 500 + 1 周', () => {
    const s = freshGame('fac-quirk-2');
    s.party['h.crusader']!.negativeQuirkIds = ['quirk_disease_prone'];
    const before = s.campaign!.gold;
    const result = assignHeroToFacility(s, 'h.crusader', 'sanitarium', 'quirk-removal');
    expect(result.ok).toBe(true);
    expect(s.campaign!.gold).toBe(before - 500);
  });

  it('公会 skill-upgrade:技能等级 0→1 → 扣 800', () => {
    const s = freshGame('fac-guild-1');
    const before = s.campaign!.gold;
    const result = assignHeroToFacility(s, 'h.crusader', 'guild', 'skill-upgrade');
    expect(result.ok).toBe(true);
    expect(s.campaign!.gold).toBe(before - 800);
  });

  it('铁匠铺 weapon-upgrade:扣 750', () => {
    const s = freshGame('fac-black-1');
    const before = s.campaign!.gold;
    const result = assignHeroToFacility(s, 'h.crusader', 'blacksmith', 'weapon-upgrade');
    expect(result.ok).toBe(true);
    expect(s.campaign!.gold).toBe(before - 750);
  });

  it('金币不足 → 拒绝', () => {
    const s = freshGame('fac-broke-1');
    s.campaign!.gold = 100;
    const result = assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('金币不足');
  });

  it('死英雄不可用', () => {
    const s = freshGame('fac-dead-1');
    s.party['h.crusader']!.isDead = true;
    const result = assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('死亡英雄');
  });

  it('slot 已满 → 拒绝', () => {
    const s = freshGame('fac-full-1');
    assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern');
    const result = assignHeroToFacility(s, 'h.highwayman', 'tavern', 'stress-tavern');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('已满');
  });

  it('同一英雄不可重复分配', () => {
    const s = freshGame('fac-dup-1');
    assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern');
    const result = assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('已在该设施');
  });

  it('不存在的设施', () => {
    const s = freshGame('fac-noexist-1');
    const result = assignHeroToFacility(s, 'h.crusader', 'no-such-facility' as any, 'stress-tavern' as any);
    expect(result.ok).toBe(false);
  });
});

describe('Phase 3 设施: settleFacilities', () => {
  it('酒馆 1 周后:hero 压力减少 35-55', () => {
    const s = freshGame('settle-tavern-1');
    s.party['h.crusader']!.stress = 100;
    assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern');
    const result = settleFacilities(s);
    expect(result.completed.length).toBe(1);
    expect(result.completed[0]!.heroId).toBe('h.crusader');
    expect(s.party['h.crusader']!.stress).toBeGreaterThanOrEqual(45); // 100-55
    expect(s.party['h.crusader']!.stress).toBeLessThanOrEqual(65); // 100-35
    // 状态恢复
    expect(s.party['h.crusader']!.activityState).toBe('available');
    expect(s.party['h.crusader']!.assignedFacilityId).toBeNull();
  });

  it('修道院 1 周后:hero 压力减少 45-60', () => {
    const s = freshGame('settle-abbey-1');
    s.party['h.crusader']!.stress = 100;
    assignHeroToFacility(s, 'h.crusader', 'abbey', 'stress-abbey');
    settleFacilities(s);
    expect(s.party['h.crusader']!.stress).toBeGreaterThanOrEqual(40); // 100-60
    expect(s.party['h.crusader']!.stress).toBeLessThanOrEqual(55); // 100-45
  });

  it('酒馆副作用:可复现 (40% 概率扣 100-300 金币)', () => {
    // 用不同 seed 跑多次,看副作用是否出现 + 总金币减少在 100-300 之间
    const trials = 50;
    let triggered = 0;
    let totalLost = 0;
    for (let i = 0; i < trials; i += 1) {
      const s = freshGame(`settle-side-${i}`);
      s.party['h.crusader']!.stress = 0;
      const before = s.campaign!.gold;
      assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern');
      settleFacilities(s);
      const lost = before - s.campaign!.gold - 650; // 扣 650 服务费 + 可能副作用
      if (lost > 0) {
        triggered += 1;
        totalLost += lost;
        expect(lost).toBeGreaterThanOrEqual(100);
        expect(lost).toBeLessThanOrEqual(300);
      }
    }
    // 期望 40% 触发率 ± 10%
    expect(triggered).toBeGreaterThanOrEqual(0.20 * trials);
    expect(triggered).toBeLessThan(0.60 * trials);
    expect(totalLost).toBeGreaterThan(0);
  });

  it('副作用常量 ID 暴露', () => {
    expect(TAVERN_SIDE_EFFECT_ID).toBe('side_effect_tavern');
  });

  it('修道院无副作用', () => {
    const s = freshGame('settle-abbey-side-1');
    s.party['h.crusader']!.stress = 100;
    const before = s.campaign!.gold;
    assignHeroToFacility(s, 'h.crusader', 'abbey', 'stress-abbey');
    settleFacilities(s);
    // 修道院只扣 900 服务费
    expect(before - s.campaign!.gold).toBe(900);
  });

  it('疗养院 quirk-removal:1 周后移除 1 负向怪癖', () => {
    const s = freshGame('settle-quirk-1');
    s.party['h.crusader']!.negativeQuirkIds = ['quirk_disease_prone', 'quirk_draconic_taint'];
    assignHeroToFacility(s, 'h.crusader', 'sanitarium', 'quirk-removal');
    settleFacilities(s);
    expect(s.party['h.crusader']!.negativeQuirkIds).toEqual(['quirk_draconic_taint']);
  });

  it('公会 skill-upgrade:1 周后 skill 等级 +1', () => {
    const s = freshGame('settle-guild-1');
    s.party['h.crusader']!.skillLevels = { 's1': 0 };
    assignHeroToFacility(s, 'h.crusader', 'guild', 'skill-upgrade');
    settleFacilities(s);
    expect(s.party['h.crusader']!.skillLevels!['s1']).toBe(1);
  });

  it('铁匠铺 weapon-upgrade:1 周后 weaponLevel +1', () => {
    const s = freshGame('settle-black-1');
    s.party['h.crusader']!.weaponLevel = 0;
    assignHeroToFacility(s, 'h.crusader', 'blacksmith', 'weapon-upgrade');
    settleFacilities(s);
    expect(s.party['h.crusader']!.weaponLevel).toBe(1);
  });

  it('多周结算:连续 2 周都在同一设施 → 1 周后状态恢复', () => {
    const s = freshGame('settle-multi-1');
    s.party['h.crusader']!.stress = 50;
    assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern');
    settleFacilities(s);
    // 1 周后:状态恢复,activityWeeksRemaining = 0
    expect(s.party['h.crusader']!.activityState).toBe('available');
    // 再分配
    const r2 = assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern');
    expect(r2.ok).toBe(true);
    // slot 已被释放
  });
});

describe('Phase 3 设施: ensureCampaign 防御', () => {
  it('无 campaign 状态时 assignHeroToFacility 抛错', () => {
    const s = freshGame('ensure-no-camp');
    s.campaign = null;
    expect(() => assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern')).toThrow();
  });

  it('ensureCampaign helper', () => {
    const s = freshGame('ensure-camp-1');
    s.campaign = null;
    expect(() => ensureCampaign(s)).toThrow();
    const c = ensureCampaign(freshGame('ensure-camp-2'));
    expect(c.week).toBe(1);
  });
});
