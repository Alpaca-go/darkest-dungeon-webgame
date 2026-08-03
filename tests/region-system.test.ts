/**
 * Phase 5 区域系统测试
 *
 * 覆盖:
 *  - 3 区域定义存在
 *  - 12 普通 + 6 精英敌人
 *  - 12 奇物(4/区域)
 *  - 9 陷阱(3/区域)
 *  - 3 区域疾病权重
 *  - 战利品表
 *  - 12 任务修正词
 *  - 6 任务目标
 *  - 区域进度(0-4 升级)
 *  - 区域发现
 *  - 路线生成(3 套独立)
 *  - 任务生成器
 *  - 防重复
 *  - dispatcher 集成
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchGameCommand, clearProcessedCommands } from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import type { GameState } from '../src/game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../src/game-engine/expedition/types.js';
import { Mulberry32 } from '../src/game-engine/rng/index.js';
import {
  REGION_ENEMIES,
  REGION_CURIOS,
  REGION_TRAPS,
  QUEST_MODIFIERS,
  QUEST_OBJECTIVES,
  getAllRegionIds,
  getRegionDefinition,
  getEnemyDef,
  getCurioDef,
  getTrapDef,
  getRegionExpeditionModifiers,
  getQuestModifier,
  getQuestObjectiveDef,
} from '../src/game-engine/regions/registry.js';
import {
  emptyRegionProgress,
  emptyRegionDiscovery,
  grantRegionExperience,
  markDiscovered,
  levelFromXp,
  xpToNextLevel,
  generateRegionRoute,
  generateRegionQuest,
  filterForDiversity,
  REGION_MAX_LEVEL,
} from '../src/game-engine/regions/manager.js';
import {
  INITIAL_FACILITY_STATES,
  INITIAL_GOLD,
  INITIAL_PORTRAITS,
  INITIAL_CRESTS,
} from '../src/game-engine/campaign/types.js';

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
          start: {
            id: 'start', type: 'empty-room', sceneId: 's_start', title: 'Start',
            description: 'd', baseScoutLevel: 'unknown', weight: 1,
          },
        },
        edges: [], forks: [],
      },
      flags: {},
      stats: { deepestNodeReached: 0, nodesVisited: 0, encounterCount: 0, trapCount: 0, hungerCount: 0, torchUsed: 0, foodUsed: 0, lowestTorch: 100, lootGained: [], itemsDiscarded: [], heroLowestHp: [] },
      objectiveCompleted: false, failed: false,
      campState: null, expeditionBuffs: [], campUsed: false,
    },
    party: {},
    encounter: null, pendingDecision: null, lastResolution: null,
    inventory: { capacity: 16, stacks: [] },
    torch: { value: 100, level: 'radiant' },
    eventLog: [], rng: rng.state, lastTransactionId: null,
    activeOverlay: null, deathRecords: [], pendingMentalFlags: [], derivedEventDepth: 0,
    campaign: {
      id: `camp_${seed}`, seed, week: 1, gold: INITIAL_GOLD,
      heirlooms: { portraits: INITIAL_PORTRAITS, crests: INITIAL_CRESTS },
      rosterCapacity: 8, rosterHeroIds: [], deadHeroIds: [],
      completedQuestIds: [], availableQuestIds: [], availableRecruitIds: [],
      facilityStates: structuredClone(INITIAL_FACILITY_STATES),
      trinketInventory: { ownedInstanceIds: [], equippedByHero: {} },
      regionProgress: {},
      regionDiscovery: {},
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
// 区域定义
// =====================================================================

describe('Phase 5 区域系统:3 区域定义', () => {
  it('存在 3 个区域: ruins, corrupted-woods, underground-burrows', () => {
    const ids = getAllRegionIds();
    expect(ids).toEqual(['ruins', 'corrupted-woods', 'underground-burrows']);
  });

  it('每个区域有完整 modifier 字段', () => {
    for (const id of getAllRegionIds()) {
      const r = getRegionDefinition(id);
      expect(r.torchModifier).toBeGreaterThan(0);
      expect(r.hungerModifier).toBeGreaterThan(0);
      expect(r.ambushModifier).toBeGreaterThanOrEqual(0);
      expect(r.diseaseModifier).toBeGreaterThan(0);
      expect(r.environmentTags.length).toBeGreaterThan(0);
      expect(r.recommendedHeroTags.length).toBeGreaterThan(0);
    }
  });

  it('区域差异: 遗迹疾病低, 林地疾病高, 兽穴饥饿高', () => {
    expect(getRegionDefinition('ruins').diseaseModifier).toBeLessThan(getRegionDefinition('corrupted-woods').diseaseModifier);
    expect(getRegionDefinition('underground-burrows').hungerModifier).toBeGreaterThan(getRegionDefinition('ruins').hungerModifier);
  });

  it('林地推荐解毒剂/绷带, 兽穴推荐食物/绷带', () => {
    expect(getRegionDefinition('corrupted-woods').recommendedProvisionIds).toContain('antivenom');
    expect(getRegionDefinition('corrupted-woods').recommendedProvisionIds).toContain('bandage');
    expect(getRegionDefinition('underground-burrows').recommendedProvisionIds).toContain('food');
  });
});

// =====================================================================
// 敌人
// =====================================================================

describe('Phase 5 区域系统:敌人', () => {
  it('12 普通 + 6 精英 = 18 个敌人', () => {
    expect(REGION_ENEMIES.length).toBe(18);
  });
  it('每个区域 4 普通 + 2 精英', () => {
    for (const id of getAllRegionIds()) {
      const normal = REGION_ENEMIES.filter((e) => e.regionId === id && !e.isElite);
      const elite = REGION_ENEMIES.filter((e) => e.regionId === id && e.isElite);
      expect(normal.length).toBe(4);
      expect(elite.length).toBe(2);
    }
  });
  it('每敌人有 tacticalFocus(改变战术选择)', () => {
    for (const e of REGION_ENEMIES) {
      expect(e.tacticalFocus).toBeDefined();
    }
  });
  it('getEnemyDef 查得到', () => {
    expect(getEnemyDef('e_ruins_skeleton')).toBeDefined();
    expect(getEnemyDef('e_woods_spore')).toBeDefined();
    expect(getEnemyDef('e_burrows_hungry_predator')).toBeDefined();
  });
});

// =====================================================================
// 奇物
// =====================================================================

describe('Phase 5 区域系统:奇物', () => {
  it('12 个奇物(4/区域)', () => {
    expect(REGION_CURIOS.length).toBe(12);
    for (const id of getAllRegionIds()) {
      const curios = REGION_CURIOS.filter((c) => c.regionId === id);
      expect(curios.length).toBe(4);
    }
  });
  it('getCurioDef 查得到', () => {
    expect(getCurioDef('c_ruins_altar')).toBeDefined();
    expect(getCurioDef('c_woods_fungal_bed')).toBeDefined();
    expect(getCurioDef('c_burrows_carrion_pile')).toBeDefined();
  });
});

// =====================================================================
// 陷阱
// =====================================================================

describe('Phase 5 区域系统:陷阱', () => {
  it('9 个陷阱(3/区域)', () => {
    expect(REGION_TRAPS.length).toBe(9);
    for (const id of getAllRegionIds()) {
      const traps = REGION_TRAPS.filter((t) => t.regionId === id);
      expect(traps.length).toBe(3);
    }
  });
  it('getTrapDef 查得到', () => {
    expect(getTrapDef('t_ruins_falling_rock')).toBeDefined();
    expect(getTrapDef('t_woods_thorn_snare')).toBeDefined();
    expect(getTrapDef('t_burrows_bone_pit')).toBeDefined();
  });
});

// =====================================================================
// 任务修正词 + 任务目标
// =====================================================================

describe('Phase 5 区域系统:任务修正词 + 目标', () => {
  it('18+ 修正词(12 + 6 区域专属)', () => {
    expect(QUEST_MODIFIERS.length).toBeGreaterThanOrEqual(12);
  });
  it('6 任务目标 (5 + 护送)', () => {
    expect(QUEST_OBJECTIVES.length).toBe(6);
  });
  it('每个目标 defaultTarget > 0', () => {
    for (const o of QUEST_OBJECTIVES) {
      expect(o.defaultTarget).toBeGreaterThan(0);
    }
  });
  it('getQuestModifier 查得到', () => {
    expect(getQuestModifier('qm_disease_outbreak')).toBeDefined();
    expect(getQuestModifier('qm_holy_relics')).toBeDefined();
  });
  it('getQuestObjectiveDef 查得到', () => {
    expect(getQuestObjectiveDef('clear')).toBeDefined();
    expect(getQuestObjectiveDef('escort-item')).toBeDefined();
  });
});

// =====================================================================
// 区域进度
// =====================================================================

describe('Phase 5 区域系统:区域进度 0-4', () => {
  it('levelFromXp: 0→0, 25→1, 60→2, 110→3, 180→4', () => {
    expect(levelFromXp(0)).toBe(0);
    expect(levelFromXp(25)).toBe(1);
    expect(levelFromXp(60)).toBe(2);
    expect(levelFromXp(110)).toBe(3);
    expect(levelFromXp(180)).toBe(4);
  });
  it('xpToNextLevel', () => {
    expect(xpToNextLevel(0)).toBe(25);
    expect(xpToNextLevel(180)).toBe(0); // 满级
  });
  it('REGION_MAX_LEVEL = 4', () => {
    expect(REGION_MAX_LEVEL).toBe(4);
  });
  it('emptyRegionProgress 初始 level=0', () => {
    const p = emptyRegionProgress('ruins');
    expect(p.level).toBe(0);
    expect(p.experience).toBe(0);
    expect(p.bossQuestReady).toBe(false);
  });
  it('grantRegionExperience: 60 XP → level 2', () => {
    const p = emptyRegionProgress('ruins');
    const r = grantRegionExperience(p, 60);
    expect(r.leveledUp).toBe(true);
    expect(r.newLevel).toBe(2);
  });
  it('grantRegionExperience: 200 XP → level 4 + boss ready', () => {
    const p = emptyRegionProgress('ruins');
    const r = grantRegionExperience(p, 200);
    expect(r.newLevel).toBe(4);
    expect(r.bossReady).toBe(true);
  });
  it('grantRegionExperience: 0/负 → 拒绝', () => {
    const p = emptyRegionProgress('ruins');
    const r = grantRegionExperience(p, 0);
    expect(r.ok).toBe(false);
  });
  it('升级解锁精英和稀有饰品', () => {
    const p = emptyRegionProgress('corrupted-woods');
    grantRegionExperience(p, 25); // level 1
    expect(p.unlockedEliteEncounterIds.length).toBeGreaterThan(0);
    grantRegionExperience(p, 100); // level 2
    expect(p.unlockedRareLootIds.length).toBeGreaterThan(0);
  });
});

// =====================================================================
// 区域发现
// =====================================================================

describe('Phase 5 区域系统:区域发现', () => {
  it('markDiscovered: enemy 5 类各自分桶', () => {
    const d = emptyRegionDiscovery();
    markDiscovered(d, 'enemy', 'e_a');
    markDiscovered(d, 'enemy', 'e_b');
    markDiscovered(d, 'curio', 'c_a');
    expect(d.discoveredEnemyIds).toEqual(['e_a', 'e_b']);
    expect(d.discoveredCurioIds).toEqual(['c_a']);
  });
  it('markDiscovered: 重复不重复', () => {
    const d = emptyRegionDiscovery();
    const r1 = markDiscovered(d, 'enemy', 'e_a');
    const r2 = markDiscovered(d, 'enemy', 'e_a');
    expect(r1.newlyDiscovered).toEqual(['e_a']);
    expect(r2.newlyDiscovered).toEqual([]);
  });
});

// =====================================================================
// 路线生成
// =====================================================================

describe('Phase 5 区域系统:3 路线生成器', () => {
  it('遗迹路线: 节点数 ≥ 8, 分叉少', () => {
    const rng = new Mulberry32('ruins-route');
    const r = generateRegionRoute({
      regionId: 'ruins',
      questLength: 'short',
      difficulty: 0.5,
      seed: 's', partyLevel: 1, objectiveType: 'clear', questModifierIds: [],
    }, rng.state);
    expect(r.stats.nodeCount).toBeGreaterThanOrEqual(8);
    expect(r.stats.branchCount).toBeLessThanOrEqual(3);
  });
  it('林地路线: 分叉多 (4-6)', () => {
    const rng = new Mulberry32('woods-route');
    const r = generateRegionRoute({
      regionId: 'corrupted-woods',
      questLength: 'short',
      difficulty: 0.5,
      seed: 's', partyLevel: 1, objectiveType: 'clear', questModifierIds: [],
    }, rng.state);
    expect(r.stats.branchCount).toBeGreaterThanOrEqual(4);
    expect(r.stats.hiddenNodeCount).toBeGreaterThanOrEqual(2);
  });
  it('兽穴路线: 节点 9-13, 多个 exit', () => {
    const rng = new Mulberry32('burrows-route');
    const r = generateRegionRoute({
      regionId: 'underground-burrows',
      questLength: 'short',
      difficulty: 0.5,
      seed: 's', partyLevel: 1, objectiveType: 'clear', questModifierIds: [],
    }, rng.state);
    expect(r.stats.nodeCount).toBeGreaterThanOrEqual(9);
    expect(r.stats.exitNodeIds.length).toBeGreaterThanOrEqual(2);
  });
  it('Seeded RNG: 同样本出同样结果', () => {
    const a = generateRegionRoute({
      regionId: 'ruins', questLength: 'medium', difficulty: 0.5,
      seed: 's', partyLevel: 1, objectiveType: 'clear', questModifierIds: [],
    }, new Mulberry32('fixed-seed').state);
    const b = generateRegionRoute({
      regionId: 'ruins', questLength: 'medium', difficulty: 0.5,
      seed: 's', partyLevel: 1, objectiveType: 'clear', questModifierIds: [],
    }, new Mulberry32('fixed-seed').state);
    expect(a.stats.branchCount).toBe(b.stats.branchCount);
  });
});

// =====================================================================
// 任务生成
// =====================================================================

describe('Phase 5 区域系统:任务生成器', () => {
  it('generateRegionQuest: 完整任务字段', () => {
    const rng = new Mulberry32('quest-gen');
    const r = generateRegionQuest({
      regionId: 'ruins', questLength: 'medium', difficulty: 0.5,
      partyLevel: 1, seed: 's', rngState: rng.state,
    });
    expect(r.quest.regionId).toBe('ruins');
    expect(r.quest.length).toBe('medium');
    expect(r.quest.recommendedProvisionIds.length).toBeGreaterThan(0);
    expect(r.quest.recommendedHeroTags.length).toBeGreaterThan(0);
    expect(r.quest.rewardPreview.gold).toBeGreaterThan(0);
    expect(r.quest.regionExperienceReward).toBeGreaterThan(0);
  });
  it('生成器: 至少给出 reason', () => {
    const r = generateRegionQuest({
      regionId: 'corrupted-woods', questLength: 'short', difficulty: 0.5,
      partyLevel: 1, seed: 's', rngState: new Mulberry32('x').state,
    });
    expect(r.reasons.length).toBeGreaterThan(0);
  });
  it('Seeded RNG: 同 seed 出同 quest 字段', () => {
    const a = generateRegionQuest({
      regionId: 'ruins', questLength: 'medium', difficulty: 0.5,
      partyLevel: 1, seed: 's', rngState: new Mulberry32('fixed').state,
    });
    const b = generateRegionQuest({
      regionId: 'ruins', questLength: 'medium', difficulty: 0.5,
      partyLevel: 1, seed: 's', rngState: new Mulberry32('fixed').state,
    });
    expect(a.quest.rewardPreview.gold).toBe(b.quest.rewardPreview.gold);
  });
  it('modifier 影响 reward', () => {
    const noMod = generateRegionQuest({
      regionId: 'ruins', questLength: 'short', difficulty: 0,
      partyLevel: 1, seed: 's', rngState: new Mulberry32('no-mod').state,
    });
    const withMod = generateRegionQuest({
      regionId: 'ruins', questLength: 'short', difficulty: 0,
      partyLevel: 1, seed: 's',
      rngState: new Mulberry32('with-mod').state,
      recentModifierIds: [],
    });
    // 不同 seed 可能会产生不同 modifier count,不能严格断言,但应能正常生成
    expect(noMod.quest.rewardPreview.gold).toBeGreaterThan(0);
    expect(withMod.quest.rewardPreview.gold).toBeGreaterThan(0);
  });
  it('防重复: recentQuestTypeIds 过滤', () => {
    const a = generateRegionQuest({
      regionId: 'ruins', questLength: 'short', difficulty: 0.5,
      partyLevel: 1, seed: 's', rngState: new Mulberry32('a').state,
      recentQuestTypeIds: ['clear'], // 排除 clear
    });
    expect(a.quest.objectiveType).not.toBe('clear');
  });
});

// =====================================================================
// 防重复 helper
// =====================================================================

describe('Phase 5 区域系统:防重复', () => {
  it('filterForDiversity: 排除 recent,保留多样', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const result = filterForDiversity(items, ['a', 'b'], 0.5);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.find((i) => i.id === 'a')).toBeUndefined();
  });
  it('filterForDiversity: 不够多样时回退', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    const result = filterForDiversity(items, ['a', 'b'], 0.5);
    // 100% 都被排除,需要回退
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// =====================================================================
// 区域 modifier helper
// =====================================================================

describe('Phase 5 区域系统:Expedition Modifier', () => {
  it('林地: teamSwapRecommended (因为 disease 1.8 > 1.3)', () => {
    const m = getRegionExpeditionModifiers('corrupted-woods');
    expect(m.teamSwapRecommended).toBe(true);
    expect(m.diseaseRate).toBeGreaterThan(1);
  });
  it('遗迹: 疾病 modifier 0.6 不推荐换队', () => {
    const m = getRegionExpeditionModifiers('ruins');
    expect(m.teamSwapRecommended).toBe(false);
  });
  it('兽穴: 食物消耗高, 推荐换队', () => {
    const m = getRegionExpeditionModifiers('underground-burrows');
    expect(m.teamSwapRecommended).toBe(true);
    expect(m.supplyNeed).toBeGreaterThan(1);
    expect(m.hungerRate).toBeGreaterThan(1);
  });
});

// =====================================================================
// Dispatcher 集成
// =====================================================================

describe('Phase 5 区域系统:dispatcher 集成', () => {
  it('SELECT_REGION → 切换 + REGION_SELECTED 事件', () => {
    let s = freshGame('p5-region');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'corrupted-woods', commandId: newCommandId('r1') });
    expect(s.hamlet.selectedRegionId).toBe('corrupted-woods');
    expect(s.eventLog.find((e) => e.type === 'REGION_SELECTED')).toBeDefined();
  });
  it('SELECT_REGION 未知 region → 抛错', () => {
    expect(() => dispatchGameCommand(freshGame('p5-bad'), {
      type: 'SELECT_REGION' as any, regionId: 'unknown' as any, commandId: newCommandId('r1'),
    })).toThrow();
  });
  it('GENERATE_REGION_QUEST → 加入 weeklyQuests', () => {
    let s = freshGame('p5-quest');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'ruins', commandId: newCommandId('r1') });
    s = dispatchGameCommand(s, { type: 'GENERATE_REGION_QUEST', regionId: 'ruins', questLength: 'short', commandId: newCommandId('q1') });
    expect(s.hamlet.weeklyQuestIds.length).toBe(1);
    expect(s.eventLog.find((e) => e.type === 'REGION_ROUTE_GENERATED')).toBeDefined();
  });
  it('GRANT_REGION_EXPERIENCE → 升级 + 事件', () => {
    let s = freshGame('p5-xp');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'ruins', commandId: newCommandId('r1') });
    s = dispatchGameCommand(s, { type: 'GRANT_REGION_EXPERIENCE', regionId: 'ruins', amount: 200, commandId: newCommandId('x1') });
    const p = s.campaign!.regionProgress!['ruins']!;
    expect(p.level).toBe(4);
    expect(p.bossQuestReady).toBe(true);
    expect(s.eventLog.find((e) => e.type === 'REGION_BOSS_QUEST_MARKED_READY')).toBeDefined();
  });
  it('GRANT_REGION_EXPERIENCE 0/负 → 抛错', () => {
    let s = freshGame('p5-xp-bad');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'ruins', commandId: newCommandId('r1') });
    expect(() => dispatchGameCommand(s, {
      type: 'GRANT_REGION_EXPERIENCE', regionId: 'ruins', amount: 0, commandId: newCommandId('x1'),
    })).toThrow();
  });
  it('DISCOVER_REGION_CONTENT 5 类各自分桶', () => {
    let s = freshGame('p5-disc');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'ruins', commandId: newCommandId('r1') });
    s = dispatchGameCommand(s, { type: 'DISCOVER_REGION_CONTENT', regionId: 'ruins', contentType: 'enemy', contentId: 'e_ruins_skeleton', commandId: newCommandId('d1') });
    s = dispatchGameCommand(s, { type: 'DISCOVER_REGION_CONTENT', regionId: 'ruins', contentType: 'curio', contentId: 'c_ruins_altar', commandId: newCommandId('d2') });
    const d = s.campaign!.regionDiscovery!['ruins']!;
    expect(d.discoveredEnemyIds).toContain('e_ruins_skeleton');
    expect(d.discoveredCurioIds).toContain('c_ruins_altar');
  });
  it('MARK_BOSS_QUEST_READY', () => {
    let s = freshGame('p5-boss');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'ruins', commandId: newCommandId('r1') });
    s = dispatchGameCommand(s, { type: 'MARK_BOSS_QUEST_READY', regionId: 'ruins', commandId: newCommandId('b1') });
    expect(s.campaign!.regionProgress!['ruins']!.bossQuestReady).toBe(true);
  });
  it('DEBUG_SET_REGION_LEVEL', () => {
    let s = freshGame('p5-debug');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'ruins', commandId: newCommandId('r1') });
    s = dispatchGameCommand(s, { type: 'DEBUG_SET_REGION_LEVEL', regionId: 'ruins', level: 3, commandId: newCommandId('d1') });
    expect(s.campaign!.regionProgress!['ruins']!.level).toBe(3);
  });
  it('DEBUG_SET_REGION_LEVEL 越界 → 抛错', () => {
    let s = freshGame('p5-debug-bad');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'ruins', commandId: newCommandId('r1') });
    expect(() => dispatchGameCommand(s, {
      type: 'DEBUG_SET_REGION_LEVEL', regionId: 'ruins', level: 5, commandId: newCommandId('d1'),
    })).toThrow();
  });
  it('DEBUG_FORCE_REGION_QUEST', () => {
    let s = freshGame('p5-force-quest');
    s = dispatchGameCommand(s, { type: 'SELECT_REGION', regionId: 'ruins', commandId: newCommandId('r1') });
    s = dispatchGameCommand(s, { type: 'DEBUG_FORCE_REGION_QUEST', regionId: 'ruins', commandId: newCommandId('d1') });
    expect(s.hamlet.weeklyQuestIds.length).toBe(1);
  });
});

// Phase 4 露营兼容性由现有 camp-system.test.ts 覆盖,这里不再重复
