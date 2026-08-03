/**
 * Phase 3 dispatcher 集成测试
 *
 * 覆盖所有 Phase 3 命令的端到端:
 *  - COMPLETE_EXPEDITION_RETURN
 *  - ADVANCE_WEEK
 *  - SET_HAMLET_MODE
 *  - RECRUIT_HERO
 *  - DISMISS_HERO
 *  - ASSIGN_HERO_TO_FACILITY
 *  - CANCEL_FACILITY_ASSIGNMENT
 *  - UPGRADE_FACILITY
 *  - UPGRADE_HERO_SKILL / WEAPON / ARMOR
 *  - SELECT_WEEKLY_QUEST
 *  - SET_PARTY
 *  - BUY_PROVISION / REMOVE_PROVISION / SETTLE_PROVISION
 *  - START_SELECTED_EXPEDITION
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

describe('Phase 3 dispatcher: SET_HAMLET_MODE', () => {
  it('切换到 roster → mode = hamlet-roster', () => {
    let s = freshGame('d-set-mode-1');
    s = dispatchGameCommand(s, {
      type: 'SET_HAMLET_MODE', mode: 'roster', commandId: newCommandId('h'),
    });
    expect(s.mode).toBe('hamlet-roster');
    expect(s.hamlet!.mode).toBe('roster');
  });

  it('切换到 upgrades → mode = hamlet-upgrades', () => {
    let s = freshGame('d-set-mode-2');
    s = dispatchGameCommand(s, {
      type: 'SET_HAMLET_MODE', mode: 'upgrades', commandId: newCommandId('h'),
    });
    expect(s.mode).toBe('hamlet-upgrades');
  });

  it('切换到 weekly-summary → mode = hamlet-summary', () => {
    let s = freshGame('d-set-mode-3');
    s = dispatchGameCommand(s, {
      type: 'SET_HAMLET_MODE', mode: 'weekly-summary', commandId: newCommandId('h'),
    });
    expect(s.mode).toBe('hamlet-summary');
  });
});

describe('Phase 3 dispatcher: ADVANCE_WEEK', () => {
  it('周数 +1,刷新招募 + 任务', () => {
    let s = freshGame('d-week-1');
    expect(s.campaign!.week).toBe(1);
    s = dispatchGameCommand(s, {
      type: 'ADVANCE_WEEK', commandId: newCommandId('w'),
    });
    expect(s.campaign!.week).toBe(2);
    expect(s.campaign!.availableRecruitIds.length).toBe(3);
    expect(s.campaign!.availableQuestIds.length).toBe(3);
    expect(s.mode).toBe('hamlet-overview');
  });

  it('WEEK_ADVANCED 事件 emit', () => {
    let s = freshGame('d-week-event');
    s = dispatchGameCommand(s, {
      type: 'ADVANCE_WEEK', commandId: newCommandId('w'),
    });
    const ev = s.eventLog.find((e) => e.type === 'WEEK_ADVANCED');
    expect(ev).toBeDefined();
  });
});

describe('Phase 3 dispatcher: COMPLETE_EXPEDITION_RETURN', () => {
  it('从 expedition-success 模式 → hamlet-debrief', () => {
    let s = freshGame('d-return-1');
    s.mode = 'expedition-success';
    s = dispatchGameCommand(s, {
      type: 'COMPLETE_EXPEDITION_RETURN', commandId: newCommandId('r'),
    });
    expect(s.mode).toBe('hamlet-debrief');
  });

  it('无 campaign 状态时直接走原路径', () => {
    let s = freshGame('d-return-2');
    s.campaign = null;
    s.mode = 'expedition-success';
    s = dispatchGameCommand(s, {
      type: 'COMPLETE_EXPEDITION_RETURN', commandId: newCommandId('r'),
    });
    expect(s.mode).toBe('expedition-retreat');
  });
});

describe('Phase 3 dispatcher: RECRUIT_HERO / DISMISS_HERO', () => {
  it('RECRUIT_HERO:加入名册 + 加 hero 到 party', () => {
    let s = freshGame('d-recruit-1');
    s.hamlet!.recruitCandidates = [
      { id: 'rc1', name: 'Baldwin', archetype: 'crusader', level: 0, skills: ['s1'], stress: 0, positiveQuirkIds: [], negativeQuirkIds: [], diseaseIds: [], weeksAvailable: 1 },
    ];
    s = dispatchGameCommand(s, {
      type: 'RECRUIT_HERO',
      candidateId: 'rc1',
      baseActor: { maxHp: 25, dodge: 5, speed: 4, accuracy: 0.85, crit: 0.05, skills: ['s1', 's2'], rank: 4 },
      commandId: newCommandId('recruit'),
    });
    const newId = 'hero_rc1';
    expect(s.party[newId]).toBeDefined();
    expect(s.campaign!.rosterHeroIds).toContain(newId);
  });

  it('RECRUIT_HERO:roster 已满 → 抛错', () => {
    const s = freshGame('d-recruit-2');
    s.campaign!.rosterCapacity = 0;
    s.hamlet!.recruitCandidates = [
      { id: 'rc1', name: 'X', archetype: 'crusader', level: 0, skills: [], stress: 0, positiveQuirkIds: [], negativeQuirkIds: [], diseaseIds: [], weeksAvailable: 1 },
    ];
    expect(() => dispatchGameCommand(s, {
      type: 'RECRUIT_HERO',
      candidateId: 'rc1',
      baseActor: { maxHp: 25, dodge: 5, speed: 4, accuracy: 0.85, crit: 0.05, skills: ['s1'], rank: 1 },
      commandId: newCommandId('r'),
    })).toThrow();
  });

  it('DISMISS_HERO:活英雄 → 从 roster 移除 + 标 missing', () => {
    let s = freshGame('d-dismiss-1');
    s = dispatchGameCommand(s, {
      type: 'DISMISS_HERO', heroId: 'h.crusader', commandId: newCommandId('d'),
    });
    expect(s.campaign!.rosterHeroIds).not.toContain('h.crusader');
    expect(s.party['h.crusader']!.activityState).toBe('missing');
  });

  it('DISMISS_HERO:死英雄 → 从 deadHeroIds 移除', () => {
    let s = freshGame('d-dismiss-2');
    s.party['h.crusader']!.isDead = true;
    s.campaign!.deadHeroIds = ['h.crusader'];
    s = dispatchGameCommand(s, {
      type: 'DISMISS_HERO', heroId: 'h.crusader', commandId: newCommandId('d'),
    });
    expect(s.campaign!.deadHeroIds).not.toContain('h.crusader');
  });
});

describe('Phase 3 dispatcher: ASSIGN / CANCEL facility', () => {
  it('ASSIGN_HERO_TO_FACILITY:扣金币 + 标 activityState', () => {
    let s = freshGame('d-assign-1');
    const before = s.campaign!.gold;
    s = dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.crusader', facilityId: 'tavern', serviceId: 'stress-tavern',
      commandId: newCommandId('a'),
    });
    expect(s.campaign!.gold).toBe(before - 650);
    expect(s.party['h.crusader']!.activityState).toBe('stress-treatment');
  });

  it('CANCEL_FACILITY_ASSIGNMENT:释放 slot + 标 available', () => {
    let s = freshGame('d-cancel-1');
    s = dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.crusader', facilityId: 'tavern', serviceId: 'stress-tavern',
      commandId: newCommandId('a'),
    });
    s = dispatchGameCommand(s, {
      type: 'CANCEL_FACILITY_ASSIGNMENT',
      heroId: 'h.crusader', facilityId: 'tavern',
      commandId: newCommandId('c'),
    });
    expect(s.party['h.crusader']!.activityState).toBe('available');
    expect(s.party['h.crusader']!.assignedFacilityId).toBeNull();
  });
});

describe('Phase 3 dispatcher: UPGRADE', () => {
  it('UPGRADE_FACILITY:扣金币 + level +1 + slotCount +1', () => {
    let s = freshGame('d-upgrade-1');
    const before = s.campaign!.gold;
    const beforeSlots = s.campaign!.facilityStates['tavern']!.slotCount;
    s = dispatchGameCommand(s, {
      type: 'UPGRADE_FACILITY',
      facilityId: 'tavern',
      upgradeOptionId: 'tavern.lvl2',
      commandId: newCommandId('u'),
    });
    expect(s.campaign!.facilityStates['tavern']!.level).toBe(2);
    expect(s.campaign!.facilityStates['tavern']!.slotCount).toBe(beforeSlots + 1);
    expect(s.campaign!.gold).toBe(before - 1200);
  });

  it('UPGRADE_HERO_SKILL:扣 800 + level +1', () => {
    let s = freshGame('d-upg-skill-1');
    s.party['h.crusader']!.skillLevels = { s1: 0 };
    const before = s.campaign!.gold;
    s = dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_SKILL', heroId: 'h.crusader', skillId: 's1',
      commandId: newCommandId('u'),
    });
    expect(s.party['h.crusader']!.skillLevels!['s1']).toBe(1);
    expect(s.campaign!.gold).toBe(before - 800);
  });

  it('UPGRADE_HERO_WEAPON:扣 750 + level +1', () => {
    let s = freshGame('d-upg-weapon-1');
    const before = s.campaign!.gold;
    s = dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_WEAPON', heroId: 'h.crusader', commandId: newCommandId('u'),
    });
    expect(s.party['h.crusader']!.weaponLevel).toBe(1);
    expect(s.campaign!.gold).toBe(before - 750);
  });

  it('UPGRADE_HERO_ARMOR:扣 750 + level +1', () => {
    let s = freshGame('d-upg-armor-1');
    const before = s.campaign!.gold;
    s = dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_ARMOR', heroId: 'h.crusader', commandId: newCommandId('u'),
    });
    expect(s.party['h.crusader']!.armorLevel).toBe(1);
    expect(s.campaign!.gold).toBe(before - 750);
  });

  it('UPGRADE_HERO_WEAPON 已满级 → 抛错', () => {
    const s = freshGame('d-upg-max-1');
    s.party['h.crusader']!.weaponLevel = 2;
    expect(() => dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_WEAPON', heroId: 'h.crusader', commandId: newCommandId('u'),
    })).toThrow();
  });

  it('UPGRADE_FACILITY 金币不足 → 抛错', () => {
    const s = freshGame('d-upg-broke-1');
    s.campaign!.gold = 100;
    expect(() => dispatchGameCommand(s, {
      type: 'UPGRADE_FACILITY', facilityId: 'tavern', upgradeOptionId: 'tavern.lvl2',
      commandId: newCommandId('u'),
    })).toThrow();
  });
});

describe('Phase 3 dispatcher: SELECT_WEEKLY_QUEST / SET_PARTY', () => {
  it('SELECT_WEEKLY_QUEST:写入 hamlet.selectedQuestId', () => {
    let s = freshGame('d-quest-1');
    s.hamlet!.weeklyQuestDefs = {
      'q1': {
        id: 'q1', title: 'Test Quest', description: 'd', difficulty: 'standard',
        nodeCount: 5, threat: 'beast', recommendedClassTags: ['frontline'],
        expectedProvisions: {}, rewards: { gold: 1000, portraits: 1, crests: 1, heroXp: 50 },
      },
    };
    s.hamlet!.weeklyQuestIds = ['q1'];
    s = dispatchGameCommand(s, {
      type: 'SELECT_WEEKLY_QUEST', questId: 'q1', commandId: newCommandId('q'),
    });
    expect(s.hamlet!.selectedQuestId).toBe('q1');
  });

  it('SELECT_WEEKLY_QUEST:questId 不在 weeklyQuestDefs → 抛错', () => {
    const s = freshGame('d-quest-2');
    expect(() => dispatchGameCommand(s, {
      type: 'SELECT_WEEKLY_QUEST', questId: 'q_no_exist', commandId: newCommandId('q'),
    })).toThrow();
  });

  it('SET_PARTY:4 个 hero → 写入 selectedPartyHeroIds + 标 selected-for-party', () => {
    let s = freshGame('d-party-1');
    s = dispatchGameCommand(s, {
      type: 'SET_PARTY', heroIds: ['h.crusader', 'h.highwayman', 'h.vestal', 'h.plague_doctor'],
      commandId: newCommandId('p'),
    });
    expect(s.hamlet!.selectedPartyHeroIds).toEqual(['h.crusader', 'h.highwayman', 'h.vestal', 'h.plague_doctor']);
    expect(s.party['h.crusader']!.activityState).toBe('selected-for-party');
  });

  it('SET_PARTY:>4 个 hero → 抛错', () => {
    const s = freshGame('d-party-2');
    expect(() => dispatchGameCommand(s, {
      type: 'SET_PARTY', heroIds: ['a', 'b', 'c', 'd', 'e'], commandId: newCommandId('p'),
    })).toThrow();
  });

  it('SET_PARTY:hero 不存在 → 抛错', () => {
    const s = freshGame('d-party-3');
    expect(() => dispatchGameCommand(s, {
      type: 'SET_PARTY', heroIds: ['hero.no.such'], commandId: newCommandId('p'),
    })).toThrow();
  });

  it('SET_PARTY:死英雄不可选 → 抛错', () => {
    const s = freshGame('d-party-4');
    s.party['h.crusader']!.isDead = true;
    expect(() => dispatchGameCommand(s, {
      type: 'SET_PARTY', heroIds: ['h.crusader'], commandId: newCommandId('p'),
    })).toThrow();
  });

  it('SET_PARTY 重设时,把旧的 selected-for-party 还原', () => {
    let s = freshGame('d-party-5');
    s = dispatchGameCommand(s, {
      type: 'SET_PARTY', heroIds: ['h.crusader'], commandId: newCommandId('p1'),
    });
    expect(s.party['h.crusader']!.activityState).toBe('selected-for-party');
    s = dispatchGameCommand(s, {
      type: 'SET_PARTY', heroIds: ['h.highwayman'], commandId: newCommandId('p2'),
    });
    expect(s.party['h.crusader']!.activityState).toBe('available');
    expect(s.party['h.highwayman']!.activityState).toBe('selected-for-party');
  });
});

describe('Phase 3 dispatcher: PROVISION 购物车', () => {
  it('BUY_PROVISION:加到购物车', () => {
    let s = freshGame('d-prov-1');
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'food', count: 3, commandId: newCommandId('b'),
    });
    expect(s.hamlet!.provisionCart).toEqual({ food: 3 });
  });

  it('REMOVE_PROVISION:从购物车减', () => {
    let s = freshGame('d-prov-2');
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'food', count: 5, commandId: newCommandId('b'),
    });
    s = dispatchGameCommand(s, {
      type: 'REMOVE_PROVISION', itemId: 'food', count: 2, commandId: newCommandId('r'),
    });
    expect(s.hamlet!.provisionCart).toEqual({ food: 3 });
  });

  it('SETTLE_PROVISION:扣金币 + 加物品到背包', () => {
    let s = freshGame('d-prov-3');
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'food', count: 4, commandId: newCommandId('b'),
    });
    // food 单价 50
    const before = s.campaign!.gold;
    s = dispatchGameCommand(s, {
      type: 'SETTLE_PROVISION', commandId: newCommandId('sp'),
    });
    expect(s.campaign!.gold).toBe(before - 200);
    const foodStack = s.inventory.stacks.find((x) => x.itemId === 'food');
    expect(foodStack).toBeDefined();
    expect(foodStack!.count).toBe(4);
    expect(s.hamlet!.provisionCart).toEqual({});
  });

  it('SETTLE_PROVISION:金币不足 → 抛错', () => {
    let s = freshGame('d-prov-4');
    s.campaign!.gold = 50;
    s = dispatchGameCommand(s, {
      type: 'BUY_PROVISION', itemId: 'bandage', count: 1, commandId: newCommandId('b'),
    });
    // bandage 单价 200
    expect(() => dispatchGameCommand(s, {
      type: 'SETTLE_PROVISION', commandId: newCommandId('sp'),
    })).toThrow();
  });
});

describe('Phase 3 dispatcher: START_SELECTED_EXPEDITION', () => {
  it('已选任务 + 已选队伍 → mode = expedition-start', () => {
    let s = freshGame('d-start-exp-1');
    s.hamlet!.selectedQuestId = 'q1';
    s.hamlet!.selectedPartyHeroIds = ['h.crusader'];
    s = dispatchGameCommand(s, {
      type: 'START_SELECTED_EXPEDITION', commandId: newCommandId('e'),
    });
    expect(s.mode).toBe('expedition-start');
  });

  it('未选任务 → 抛错', () => {
    const s = freshGame('d-start-exp-2');
    s.hamlet!.selectedPartyHeroIds = ['h.crusader'];
    expect(() => dispatchGameCommand(s, {
      type: 'START_SELECTED_EXPEDITION', commandId: newCommandId('e'),
    })).toThrow();
  });

  it('未选队伍 → 抛错', () => {
    const s = freshGame('d-start-exp-3');
    s.hamlet!.selectedQuestId = 'q1';
    expect(() => dispatchGameCommand(s, {
      type: 'START_SELECTED_EXPEDITION', commandId: newCommandId('e'),
    })).toThrow();
  });
});

describe('Phase 3 dispatcher: 完整流程(3 周 + 1 远征)', () => {
  it('初始化 campaign + advanceWeek 3 次 + 招募 + 分配设施 + 升级 + 推进 1 周', () => {
    let s = freshGame('d-full-flow-1');
    // advance 3 weeks
    for (let i = 0; i < 3; i += 1) {
      s = dispatchGameCommand(s, {
        type: 'ADVANCE_WEEK', commandId: newCommandId(`w${i}`),
      });
    }
    expect(s.campaign!.week).toBe(4);

    // 招募 (第 4 周有 3 个候选)
    const candidate = s.hamlet!.recruitCandidates[0];
    if (candidate) {
      s = dispatchGameCommand(s, {
        type: 'RECRUIT_HERO',
        candidateId: candidate.id,
        baseActor: { maxHp: 22, dodge: 5, speed: 4, accuracy: 0.85, crit: 0.05, skills: ['s1'], rank: 4 },
        commandId: newCommandId('recruit'),
      });
      expect(s.campaign!.rosterHeroIds.length).toBeGreaterThanOrEqual(4);
    }

    // 分配到酒馆
    s = dispatchGameCommand(s, {
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: 'h.crusader', facilityId: 'tavern', serviceId: 'stress-tavern',
      commandId: newCommandId('a'),
    });

    // 升级武器(highwayman 不在治疗中,可以直接升级)
    s = dispatchGameCommand(s, {
      type: 'UPGRADE_HERO_WEAPON', heroId: 'h.highwayman', commandId: newCommandId('u'),
    });
    expect(s.party['h.highwayman']!.weaponLevel).toBe(1);

    // 选任务 + 组队 + 启动远征
    const qid = s.hamlet!.weeklyQuestIds[0];
    if (qid) {
      s = dispatchGameCommand(s, {
        type: 'SELECT_WEEKLY_QUEST', questId: qid, commandId: newCommandId('q'),
      });
      s = dispatchGameCommand(s, {
        type: 'SET_PARTY', heroIds: ['h.highwayman', 'h.vestal'],
        commandId: newCommandId('p'),
      });
      s = dispatchGameCommand(s, {
        type: 'START_SELECTED_EXPEDITION', commandId: newCommandId('e'),
      });
      expect(s.mode).toBe('expedition-start');
    }
  });
});
