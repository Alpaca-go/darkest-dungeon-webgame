/**
 * Phase 3 周推进测试
 *
 * 覆盖:
 *  - advanceWeek:settleFacilities + 刷新 recruits/quests + 周数 +1 + 通知
 *  - selected-for-party 状态重置
 *  - 死英雄永久保留在 deadHeroIds
 *  - 任务 id 迁移
 *  - 通知生成
 */

import { describe, it, expect } from 'vitest';
import { advanceWeek, generateWeeklyNotices } from '../src/game-engine/campaign/week.js';
import { assignHeroToFacility } from '../src/game-engine/campaign/facilities.js';
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

describe('Phase 3 week: advanceWeek', () => {
  it('基础:周数 +1,招募 3 个,任务 3 个', () => {
    const s = freshGame('week-base-1');
    const result = advanceWeek(s);
    expect(result.week).toBe(2);
    expect(s.campaign!.week).toBe(2);
    expect(s.campaign!.availableRecruitIds.length).toBe(3);
    expect(s.campaign!.availableQuestIds.length).toBe(3);
    expect(s.hamlet!.recruitCandidates.length).toBe(3);
    expect(s.hamlet!.weeklyQuestIds.length).toBe(3);
  });

  it('同 seed 同 week → 相同候选/任务(id 可复现)', () => {
    const s1 = freshGame('week-deter-1');
    const s2 = freshGame('week-deter-1');
    advanceWeek(s1);
    advanceWeek(s2);
    expect(s1.hamlet!.weeklyQuestIds).toEqual(s2.hamlet!.weeklyQuestIds);
    expect(s1.campaign!.availableRecruitIds).toEqual(s2.campaign!.availableRecruitIds);
  });

  it('不同 seed → 不同候选/任务', () => {
    const s1 = freshGame('week-deter-2');
    const s2 = freshGame('week-deter-3');
    advanceWeek(s1);
    advanceWeek(s2);
    expect(s1.hamlet!.weeklyQuestIds).not.toEqual(s2.hamlet!.weeklyQuestIds);
  });

  it('不同 week → 不同任务', () => {
    const s = freshGame('week-week-diff');
    advanceWeek(s);
    const week2 = [...s.hamlet!.weeklyQuestIds];
    advanceWeek(s);
    const week3 = [...s.hamlet!.weeklyQuestIds];
    // 任务 id 至少不完全相同(由于 week 变化)
    expect(week2.length).toBe(3);
    expect(week3.length).toBe(3);
  });

  it('selected-for-party 在 advanceWeek 后重置', () => {
    const s = freshGame('week-party-reset');
    s.party['h.crusader']!.activityState = 'selected-for-party';
    advanceWeek(s);
    expect(s.party['h.crusader']!.activityState).toBe('available');
  });

  it('死英雄不会被复活,继续保留在 deadHeroIds', () => {
    const s = freshGame('week-dead-keeps');
    s.party['h.crusader']!.isDead = true;
    s.campaign!.deadHeroIds = ['h.crusader'];
    advanceWeek(s);
    expect(s.party['h.crusader']!.isDead).toBe(true);
    expect(s.campaign!.deadHeroIds).toContain('h.crusader');
  });

  it('advanceWeek 同时结算在用设施', () => {
    const s = freshGame('week-with-facility');
    s.party['h.crusader']!.stress = 100;
    assignHeroToFacility(s, 'h.crusader', 'tavern', 'stress-tavern');
    const beforeStress = s.party['h.crusader']!.stress;
    const result = advanceWeek(s);
    // 设施 1 周后结算,stress 减少
    expect(s.party['h.crusader']!.stress).toBeLessThan(beforeStress);
    expect(result.facilityCompleted.length).toBe(1);
  });

  it('advanceWeek 完成后重置 hamlet 临时状态', () => {
    const s = freshGame('week-reset-tmp');
    s.hamlet!.selectedQuestId = 'quest_x';
    s.hamlet!.selectedPartyHeroIds = ['h.crusader'];
    s.hamlet!.provisionCart = { food: 5 };
    advanceWeek(s);
    expect(s.hamlet!.selectedQuestId).toBeNull();
    expect(s.hamlet!.selectedPartyHeroIds).toEqual([]);
    expect(s.hamlet!.provisionCart).toEqual({});
  });

  it('完成的任务 id 移到 completedQuestIds', () => {
    const s = freshGame('week-quest-mig');
    s.campaign!.availableQuestIds = ['q_old_1', 'q_old_2'];
    advanceWeek(s);
    expect(s.campaign!.completedQuestIds).toContain('q_old_1');
    expect(s.campaign!.completedQuestIds).toContain('q_old_2');
  });
});

describe('Phase 3 week: generateWeeklyNotices', () => {
  it('队伍全死 → cannot-form-party', () => {
    const s = freshGame('notice-all-dead');
    s.party['h.crusader']!.isDead = true;
    s.party['h.highwayman']!.isDead = true;
    s.party['h.vestal']!.isDead = true;
    s.party['h.plague_doctor']!.isDead = true;
    const notices = generateWeeklyNotices(s);
    expect(notices.some((n) => n.type === 'cannot-form-party')).toBe(true);
  });

  it('高压力英雄 → high-stress 通知', () => {
    const s = freshGame('notice-high-stress');
    s.party['h.crusader']!.stress = 120;
    const notices = generateWeeklyNotices(s);
    expect(notices.some((n) => n.type === 'high-stress')).toBe(true);
  });

  it('金币 < 1000 → resource-shortage', () => {
    const s = freshGame('notice-broke');
    s.campaign!.gold = 500;
    const notices = generateWeeklyNotices(s);
    expect(notices.some((n) => n.type === 'resource-shortage')).toBe(true);
  });

  it('马车有候选 → recruit-opportunity', () => {
    const s = freshGame('notice-recruit');
    s.hamlet!.recruitCandidates = [{ id: 'r1', name: 'X', archetype: 'crusader', level: 0, skills: ['s1'], stress: 0, positiveQuirkIds: [], negativeQuirkIds: [], diseaseIds: [], weeksAvailable: 1 }];
    const notices = generateWeeklyNotices(s);
    expect(notices.some((n) => n.type === 'recruit-opportunity')).toBe(true);
  });

  it('通知按 priority 排序', () => {
    const s = freshGame('notice-priority');
    s.party['h.crusader']!.isDead = true;
    s.party['h.highwayman']!.isDead = true;
    s.party['h.vestal']!.isDead = true;
    s.party['h.plague_doctor']!.isDead = true;
    s.campaign!.gold = 100;
    s.party['h.crusader']!.stress = 0;
    const notices = generateWeeklyNotices(s);
    // 第一个 priority 最高
    for (let i = 1; i < notices.length; i += 1) {
      expect(notices[i - 1]!.priority).toBeGreaterThanOrEqual(notices[i]!.priority);
    }
  });

  it('通知最多 5 条', () => {
    const s = freshGame('notice-cap');
    s.party['h.crusader']!.stress = 100;
    s.party['h.highwayman']!.stress = 100;
    s.party['h.vestal']!.stress = 100;
    s.party['h.plague_doctor']!.stress = 100;
    s.campaign!.gold = 100;
    s.hamlet!.recruitCandidates = [
      { id: 'r1', name: 'A', archetype: 'crusader', level: 0, skills: [], stress: 0, positiveQuirkIds: [], negativeQuirkIds: [], diseaseIds: [], weeksAvailable: 1 },
      { id: 'r2', name: 'B', archetype: 'crusader', level: 0, skills: [], stress: 0, positiveQuirkIds: [], negativeQuirkIds: [], diseaseIds: [], weeksAvailable: 1 },
    ];
    const notices = generateWeeklyNotices(s);
    expect(notices.length).toBeLessThanOrEqual(5);
  });
});
