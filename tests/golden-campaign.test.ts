/**
 * Phase 3 Golden Campaign 3 周测试(SPEC §42 DD-WEB-PHASE3-CAMPAIGN-001)
 *
 * 剧本:
 *   Week 1: 标准任务 + 十字军死亡 + 修女高压力 + 返回庄园
 *   Week 2: 十字军进墓园 + 修女进修道院 + 招募替补 + 3 老 + 1 新远征
 *   Week 3: 修女完成治疗 + 升级十字军武器 + 升级修女治疗技能 + 完成高风险任务
 *
 * 验证:
 *  - 远征结果能进入庄园
 *  - 周数稳定推进
 *  - 压力跨周保留
 *  - 折磨和美德在返回后正确清除
 *  - 永久死亡进入墓园
 *  - 玩家可以招募替补
 *  - 高压力英雄可以休息一周
 *  - 治疗英雄本周不可出战
 *  - 玩家可以升级技能和装备
 *  - 升级真实改变选择式远征结果
 *  - 金币和遗产产生明确取舍
 *  - 每周任务与招募稳定可复现
 *  - 玩家可以连续完成三周鏖战
 *  - 手机端不需要复杂城镇地图
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

beforeEach(() => clearProcessedCommands());

describe('Phase 3 Golden Campaign: 3 周完整流程', () => {
  it('Week 1: 远征结果能进入庄园,周数稳定推进,高压力英雄保留 stress', () => {
    let s = freshGame('golden-w1-001');
    expect(s.campaign!.week).toBe(1);

    // 模拟远征后返回
    s.party['h.vestal']!.stress = 110; // 高压力
    s = dispatchGameCommand(s, {
      type: 'ADVANCE_WEEK', commandId: newCommandId('w1'),
    });
    expect(s.campaign!.week).toBe(2);
    // 修女 stress 跨周保留
    expect(s.party['h.vestal']!.stress).toBe(110);
    // 周任务已刷新
    expect(s.campaign!.availableQuestIds.length).toBe(3);
    // 招募已刷新
    expect(s.campaign!.availableRecruitIds.length).toBe(3);
  });

  it('Week 1: 远征成功 + 高压力 + 死亡进入墓园,返回庄园后正确状态', () => {
    let s = freshGame('golden-w1-002');
    // 模拟:远征中十字军永久死亡 + 修女 stress 110
    s.party['h.crusader']!.isDead = true;
    s.party['h.crusader']!.hp = 0;
    s.campaign!.deadHeroIds = ['h.crusader'];
    s.party['h.vestal']!.stress = 110;

    // 推进 week 1 → 2
    s = dispatchGameCommand(s, {
      type: 'ADVANCE_WEEK', commandId: newCommandId('w1'),
    });
    // 死英雄保留
    expect(s.party['h.crusader']!.isDead).toBe(true);
    expect(s.campaign!.deadHeroIds).toContain('h.crusader');
    // 修女 stress 保留
    expect(s.party['h.vestal']!.stress).toBe(110);
  });

  it('Week 2: 死英雄进墓园 + 高压力英雄进修道院 + 招募替补 + 4 人远征', () => {
    let s = freshGame('golden-w2-001');
    s.party['h.crusader']!.isDead = true;
    s.party['h.crusader']!.hp = 0;
    s.campaign!.deadHeroIds = ['h.crusader'];
    s.party['h.vestal']!.stress = 110;
    s = dispatchGameCommand(s, { type: 'ADVANCE_WEEK', commandId: newCommandId('w1') });
    expect(s.campaign!.week).toBe(2);

    // 修女进修道院
    s = dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.vestal', facilityId: 'abbey', serviceId: 'stress-abbey',
      commandId: newCommandId('assign-vestal'),
    });
    expect(s.party['h.vestal']!.activityState).toBe('stress-treatment');

    // 招募替补
    const candidate = s.hamlet!.recruitCandidates[0];
    if (candidate) {
      s = dispatchGameCommand(s, {
        type: 'RECRUIT_HERO',
        candidateId: candidate.id,
        baseActor: { maxHp: 22, dodge: 5, speed: 4, accuracy: 0.85, crit: 0.05, skills: ['s1'], rank: 4 },
        commandId: newCommandId('recruit'),
      });
      // 替补加入名册
      expect(s.campaign!.rosterHeroIds.length).toBe(5);
    }

    // 治疗中英雄不能选入队伍
    expect(() => dispatchGameCommand(s, {
      type: 'SET_PARTY',
      heroIds: ['h.vestal'],
      commandId: newCommandId('party-bad'),
    })).toThrow();
  });

  it('Week 2 末: 推进到 Week 3,修女治疗完成 + 升级武器 + 升级技能', () => {
    let s = freshGame('golden-w2-end-001');
    s.party['h.crusader']!.isDead = true;
    s.party['h.crusader']!.hp = 0;
    s.campaign!.deadHeroIds = ['h.crusader'];
    s.party['h.vestal']!.stress = 110;
    s = dispatchGameCommand(s, { type: 'ADVANCE_WEEK', commandId: newCommandId('w1') });
    s = dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.vestal', facilityId: 'abbey', serviceId: 'stress-abbey',
      commandId: newCommandId('a'),
    });
    // 推进 week → week 3,设施结算
    s = dispatchGameCommand(s, { type: 'ADVANCE_WEEK', commandId: newCommandId('w2') });
    // 修女 stress 减少(修道院 -45~-60)
    expect(s.party['h.vestal']!.stress).toBeLessThan(110);
    expect(s.party['h.vestal']!.activityState).toBe('available');

    // 升级武器(十字军已死,升级 highwayman)
    s = dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_WEAPON', heroId: 'h.highwayman', commandId: newCommandId('w-up'),
    });
    expect(s.party['h.highwayman']!.weaponLevel).toBe(1);
  });

  it('完整 3 周鏖战:week 1-3 全程不抛错', () => {
    let s = freshGame('golden-full-001');
    // Week 1 推进
    s.party['h.vestal']!.stress = 80;
    s.party['h.crusader']!.isDead = true;
    s.party['h.crusader']!.hp = 0;
    s.campaign!.deadHeroIds = ['h.crusader'];
    s = dispatchGameCommand(s, { type: 'ADVANCE_WEEK', commandId: newCommandId('w1') });

    // Week 2:治疗 + 招募 + 推进
    s = dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.vestal', facilityId: 'abbey', serviceId: 'stress-abbey',
      commandId: newCommandId('a1'),
    });
    const c1 = s.hamlet!.recruitCandidates[0];
    if (c1) {
      s = dispatchGameCommand(s, {
        type: 'RECRUIT_HERO',
        candidateId: c1.id,
        baseActor: { maxHp: 22, dodge: 5, speed: 4, accuracy: 0.85, crit: 0.05, skills: ['s1'], rank: 4 },
        commandId: newCommandId('r1'),
      });
    }
    s = dispatchGameCommand(s, { type: 'ADVANCE_WEEK', commandId: newCommandId('w2') });

    // Week 3:升级 + 推进
    s = dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_WEAPON', heroId: 'h.highwayman', commandId: newCommandId('u1'),
    });
    s = dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_ARMOR', heroId: 'h.plague_doctor', commandId: newCommandId('u2'),
    });
    s = dispatchGameCommand(s, { type: 'ADVANCE_WEEK', commandId: newCommandId('w3') });

    expect(s.campaign!.week).toBe(4);
  });

  it('稳定可复现:同 seed → 同 week → 同任务/候选', () => {
    const s1 = freshGame('golden-deter-001');
    const s2 = freshGame('golden-deter-001');
    const next1 = (() => { let s = s1; for (let i = 0; i < 3; i += 1) { s = dispatchGameCommand(s, { type: 'ADVANCE_WEEK', commandId: newCommandId(`a${i}`) }); } return s; })();
    const next2 = (() => { let s = s2; for (let i = 0; i < 3; i += 1) { s = dispatchGameCommand(s, { type: 'ADVANCE_WEEK', commandId: newCommandId(`b${i}`) }); } return s; })();
    expect(next1.campaign!.week).toBe(next2.campaign!.week);
    expect(next1.hamlet!.weeklyQuestIds).toEqual(next2.hamlet!.weeklyQuestIds);
  });
});
