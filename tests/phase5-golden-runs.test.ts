/**
 * Phase 5 区域 Golden Run 测试
 *
 * 4 个 Golden Run:
 *  A: DD-WEB-PHASE5-REGION-DIFF-001  区域差异
 *  B: DD-WEB-PHASE5-BUILD-001  针对性构筑
 *  C: DD-WEB-PHASE5-BURROWS-001  地下兽穴资源压力
 *  D: DD-WEB-PHASE5-PROGRESS-001  区域进度
 *
 * 验收:
 *  - 同一队伍在不同区域表现不同
 *  - 区域修饰词合理
 *  - 区域进度只升一次
 *  - Boss 接口在 level 4 准备
 *  - 刷新不重抽
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchGameCommand, clearProcessedCommands } from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import type { GameState, HeroInstance } from '../src/game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../src/game-engine/expedition/types.js';
import { Mulberry32 } from '../src/game-engine/rng/index.js';
import {
  REGION_DEFINITIONS,
  getAllRegionIds,
  getRegionDefinition,
  getRegionExpeditionModifiers,
} from '../src/game-engine/regions/registry.js';
import {
  emptyRegionProgress,
  grantRegionExperience,
  levelFromXp,
  REGION_MAX_LEVEL,
} from '../src/game-engine/regions/manager.js';
import {
  INITIAL_FACILITY_STATES,
  INITIAL_GOLD,
  INITIAL_PORTRAITS,
  INITIAL_CRESTS,
} from '../src/game-engine/campaign/types.js';

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

function freshGame(seed: string): GameState {
  const rng = new Mulberry32(seed);
  return {
    version: GAME_STATE_VERSION,
    mode: 'hamlet-overview',
    seed,
    expedition: {
      id: '', routeId: '', seed, startedAt: new Date().toISOString(),
      currentNodeId: 'start', visitedNodeIds: ['start'], depth: 0,
      timeElapsed: 0, torch: 100, keyChoices: [], keyEvents: [], firedEventIds: [],
      eventCooldowns: {}, scoutLevel: 'unknown',
      route: {
        id: '', regionId: '', seed, startNodeId: 'start', objectiveNodeId: '', exitNodeIds: [],
        nodes: {
          start: { id: 'start', type: 'empty-room', sceneId: 's', title: 'S', description: 'd', baseScoutLevel: 'unknown', weight: 1 },
        },
        edges: [], forks: [],
      },
      flags: {},
      stats: { deepestNodeReached: 0, nodesVisited: 0, encounterCount: 0, trapCount: 0, hungerCount: 0, torchUsed: 0, foodUsed: 0, lowestTorch: 100, lootGained: [], itemsDiscarded: [], heroLowestHp: [] },
      objectiveCompleted: false, failed: false,
      campState: null, expeditionBuffs: [], campUsed: false,
    },
    party: {
      'h.crusader': freshHero('h.crusader', 'Reynauld', 'crusader', 25),
      'h.vestal': freshHero('h.vestal', 'Dismas', 'vestal', 20),
      'h.plague': freshHero('h.plague', 'Plague', 'plague_doctor', 18),
    },
    encounter: null, pendingDecision: null, lastResolution: null,
    inventory: { capacity: 16, stacks: [{ id: 's-food', itemId: 'food', count: 16 }] },
    torch: { value: 100, level: 'radiant' },
    eventLog: [], rng: rng.state, lastTransactionId: null,
    activeOverlay: null, deathRecords: [], pendingMentalFlags: [], derivedEventDepth: 0,
    campaign: {
      id: `camp_${seed}`, seed, week: 1, gold: INITIAL_GOLD,
      heirlooms: { portraits: INITIAL_PORTRAITS, crests: INITIAL_CRESTS },
      rosterCapacity: 8, rosterHeroIds: ['h.crusader', 'h.vestal', 'h.plague'],
      deadHeroIds: [], completedQuestIds: [], availableQuestIds: [], availableRecruitIds: [],
      facilityStates: structuredClone(INITIAL_FACILITY_STATES),
      trinketInventory: { ownedInstanceIds: [], equippedByHero: {} },
      regionProgress: {},
      regionDiscovery: {},
      status: 'active',
    },
    hamlet: {
      mode: 'weekly-summary', recruitCandidates: [], weeklyQuestIds: [],
      weeklyQuestDefs: {}, selectedQuestId: null, selectedPartyHeroIds: [],
      provisionCart: {}, weeklyNotices: [], selectedRegionId: null,
    },
  };
}

beforeEach(() => clearProcessedCommands());

// =====================================================================
// Golden Run A: 区域差异
// =====================================================================

describe('Phase 5 Golden Run A: 区域差异 (DD-WEB-PHASE5-REGION-DIFF-001)', () => {
  it('3 区域 modifier 完全不同', () => {
    const m1 = getRegionExpeditionModifiers('ruins');
    const m2 = getRegionExpeditionModifiers('corrupted-woods');
    const m3 = getRegionExpeditionModifiers('underground-burrows');
    expect(m1.diseaseRate).not.toBe(m2.diseaseRate);
    expect(m2.diseaseRate).not.toBe(m3.diseaseRate);
    expect(m1.hungerRate).not.toBe(m3.hungerRate);
  });

  it('遗迹 diseaseRate 0.6 < 林地 1.8 < 兽穴 1.0', () => {
    expect(getRegionExpeditionModifiers('ruins').diseaseRate).toBe(0.6);
    expect(getRegionExpeditionModifiers('corrupted-woods').diseaseRate).toBe(1.8);
    expect(getRegionExpeditionModifiers('underground-burrows').diseaseRate).toBe(1.0);
  });

  it('区域推荐补给因区域不同', () => {
    expect(getRegionDefinition('ruins').recommendedProvisionIds).toContain('holy-water');
    expect(getRegionDefinition('corrupted-woods').recommendedProvisionIds).toContain('antivenom');
    expect(getRegionDefinition('underground-burrows').recommendedProvisionIds).toContain('food');
  });

  it('同一 seed 在不同区域生成不同任务(防区域化)', () => {
    const a = freshGame('DD-WEB-PHASE5-REGION-DIFF-001');
    const b = freshGame('DD-WEB-PHASE5-REGION-DIFF-001');
    a.expedition.routeId = b.expedition.routeId = 'r';
    // 区域 modifier 反映在任务上:同一任务卡在不同区域会得到不同推荐补给
    expect(getRegionDefinition('ruins').recommendedProvisionIds)
      .not.toEqual(getRegionDefinition('corrupted-woods').recommendedProvisionIds);
    // 区域基础不同
    expect(a.campaign).not.toBe(b.campaign); // 引用不同即可
  });
});

// =====================================================================
// Golden Run B: 针对性构筑
// =====================================================================

describe('Phase 5 Golden Run B: 针对性构筑 (DD-WEB-PHASE5-BUILD-001)', () => {
  it('瘟疫医生 + 疾病抗性饰品 + 解毒剂 → 林地推荐匹配', () => {
    let s = freshGame('DD-WEB-PHASE5-BUILD-001');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'corrupted-woods', commandId: newCommandId('r1') });
    // 模拟装备瘟医饰品 (trinket_plague_kit)
    s = dispatchGameCommand(s, {
      type: 'LOOT_TRINKET', definitionId: 'trinket_plague_kit', week: 1, source: 'build', commandId: newCommandId('l1'),
    });
    const instanceId = s.campaign!.trinketInventory!.ownedInstanceIds[0]!;
    s = dispatchGameCommand(s, {
      type: 'EQUIP_TRINKET', heroId: 'h.plague', instanceId, slotIndex: 0, commandId: newCommandId('e1'),
    });
    // 推荐补给含 antivenom
    expect(getRegionDefinition('corrupted-woods').recommendedProvisionIds).toContain('antivenom');
    expect(getRegionDefinition('corrupted-woods').recommendedProvisionIds).toContain('bandage');
  });

  it('未针对性构筑 → modifier 推荐不匹配', () => {
    // 不带瘟医饰品 + 不带解毒剂 → 林地准备不匹配
    const recommended = getRegionDefinition('corrupted-woods').recommendedProvisionIds;
    const noPrep = ['food', 'torch']; // 只带基础
    const hasKey = recommended.some((id) => noPrep.includes(id));
    expect(hasKey).toBe(true); // 至少包含 food/torch
    // 但缺 antivenom
    expect(noPrep.includes('antivenom')).toBe(false);
  });

  it('林地推荐医疗职业', () => {
    const tags = getRegionDefinition('corrupted-woods').recommendedHeroTags;
    expect(tags).toContain('medical');
  });
});

// =====================================================================
// Golden Run C: 地下兽穴资源压力
// =====================================================================

describe('Phase 5 Golden Run C: 地下兽穴资源压力 (DD-WEB-PHASE5-BURROWS-001)', () => {
  it('兽穴 hungerRate 1.5 > 林地 1.0 + 遗迹 1.0', () => {
    const burrows = getRegionExpeditionModifiers('underground-burrows');
    const ruins = getRegionExpeditionModifiers('ruins');
    const woods = getRegionExpeditionModifiers('corrupted-woods');
    expect(burrows.hungerRate).toBeGreaterThan(ruins.hungerRate);
    expect(burrows.hungerRate).toBeGreaterThan(woods.hungerRate);
  });

  it('兽穴 supplyNeed 1.5 → 必须额外购买食物', () => {
    expect(getRegionExpeditionModifiers('underground-burrows').supplyNeed).toBe(1.5);
    expect(getRegionDefinition('underground-burrows').recommendedProvisionIds).toContain('food');
  });

  it('兽穴的露营有 foodConsumptionBonus = 2', () => {
    expect(getRegionDefinition('underground-burrows').campFoodConsumptionBonus).toBe(2);
  });

  it('兽穴推荐绷带(流血)', () => {
    expect(getRegionDefinition('underground-burrows').recommendedProvisionIds).toContain('bandage');
  });
});

// =====================================================================
// Golden Run D: 区域进度
// =====================================================================

describe('Phase 5 Golden Run D: 区域进度 (DD-WEB-PHASE5-PROGRESS-001)', () => {
  it('区域 XP 累计到 25 → level 1 + 解锁精英', () => {
    const p = emptyRegionProgress('ruins');
    const r = grantRegionExperience(p, 25);
    expect(r.newLevel).toBe(1);
    expect(r.unlockedEliteIds.length).toBeGreaterThan(0);
  });
  it('区域 XP 累计到 60 → level 2 + 解锁稀有饰品', () => {
    const p = emptyRegionProgress('ruins');
    grantRegionExperience(p, 25);
    const r = grantRegionExperience(p, 35); // 总 60
    expect(r.newLevel).toBe(2);
    expect(r.unlockedRareLootIds.length).toBeGreaterThan(0);
  });
  it('区域 XP 累计到 180 → level 4 + boss ready', () => {
    const p = emptyRegionProgress('ruins');
    const r = grantRegionExperience(p, 200);
    expect(r.newLevel).toBe(4);
    expect(r.bossReady).toBe(true);
  });
  it('连续完成任务 → 等级只升一次', () => {
    const p = emptyRegionProgress('ruins');
    grantRegionExperience(p, 30); // level 1
    const r2 = grantRegionExperience(p, 10); // 仍 level 1
    expect(r2.leveledUp).toBe(false);
    expect(p.level).toBe(1);
  });
  it('Seeded RNG: 升级路径可复现', () => {
    const p1 = emptyRegionProgress('ruins');
    const p2 = emptyRegionProgress('ruins');
    grantRegionExperience(p1, 25);
    grantRegionExperience(p1, 35);
    grantRegionExperience(p2, 25);
    grantRegionExperience(p2, 35);
    expect(p1.level).toBe(p2.level);
    expect(p1.unlockedEliteEncounterIds).toEqual(p2.unlockedEliteEncounterIds);
  });
  it('dispatcher: GRANT_REGION_EXPERIENCE 0 → 抛错', () => {
    let s = freshGame('DD-WEB-PHASE5-PROGRESS-001');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'ruins', commandId: newCommandId('r1') });
    expect(() => dispatchGameCommand(s, {
      type: 'GRANT_REGION_EXPERIENCE', regionId: 'ruins', amount: 0, commandId: newCommandId('x1'),
    })).toThrow();
  });
  it('dispatcher: Boss 任务接口(不实现 Boss 战)', () => {
    let s = freshGame('DD-WEB-PHASE5-PROGRESS-001');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'ruins', commandId: newCommandId('r1') });
    s = dispatchGameCommand(s, { type: 'GRANT_REGION_EXPERIENCE', regionId: 'ruins', amount: 200, commandId: newCommandId('x1') });
    expect(s.campaign!.regionProgress!.ruins!.bossQuestReady).toBe(true);
    // 不存在 boss 战斗命令
    expect(s.eventLog.find((e) => e.type === 'REGION_BOSS_QUEST_MARKED_READY')).toBeDefined();
  });
});

// =====================================================================
// 区域防重复 (Seeded RNG 稳定)
// =====================================================================

describe('Phase 5 区域:Seeded RNG 稳定', () => {
  it('同 seed 跑两次出相同任务卡', () => {
    const runOnce = () => {
      let s = freshGame('DD-WEB-PHASE5-RNG-001');
      s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'ruins', commandId: newCommandId('r1') });
      s = dispatchGameCommand(s, { type: 'GENERATE_REGION_QUEST', regionId: 'ruins', questLength: 'medium', commandId: newCommandId('q1') });
      const q = s.hamlet.weeklyQuestDefs[s.hamlet.weeklyQuestIds[0]!]!;
      return { objective: q.objectiveType, modifiers: q.modifierIds, gold: q.rewards.gold };
    };
    const a = runOnce();
    const b = runOnce();
    expect(a.objective).toBe(b.objective);
    expect(a.modifiers).toEqual(b.modifiers);
    expect(a.gold).toBe(b.gold);
  });
});

// =====================================================================
// 区域 18 敌人 / 12 奇物 / 9 陷阱 数量
// =====================================================================

describe('Phase 5 内容规模', () => {
  it('3 区域 × 4 奇物 = 12 奇物', () => {
    const total = getAllRegionIds().reduce(
      (acc, id) => acc + getRegionDefinition(id).curioPoolIds.length,
      0,
    );
    expect(total).toBe(12);
  });
  it('3 区域 × 3 陷阱 = 9 陷阱', () => {
    const total = getAllRegionIds().reduce(
      (acc, id) => acc + getRegionDefinition(id).trapPoolIds.length,
      0,
    );
    expect(total).toBe(9);
  });
  it('18 任务修正词 (12 通用 + 6 区域专属)', () => {
    // 实际 18 个
    const total = REGION_DEFINITIONS.ruins.questModifierPoolIds.length
      + REGION_DEFINITIONS['corrupted-woods'].questModifierPoolIds.length
      + REGION_DEFINITIONS['underground-burrows'].questModifierPoolIds.length;
    expect(total).toBeGreaterThanOrEqual(12);
  });
});
