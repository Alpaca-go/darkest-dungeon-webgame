/**
 * Phase 4 P4.2 饰品系统测试
 *
 * 覆盖:
 *  - 20 件饰品(4 职业 + 8 通用 + 4 稀有 + 4 风险高收益)
 *  - 每件有正 modifier + 负 modifier
 *  - lootTrinket 创建 instance + 加仓库
 *  - equipTrinket / unequipTrinket 槽位管理
 *  - 职业限制 / 死英雄拒绝
 *  - 死亡回收 3 选项
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
  lootTrinket,
  equipTrinket,
  unequipTrinket,
  processDeathRecovery,
  buildTrinketDefCache,
  listTrinkets,
  listClassTrinkets,
  TRINKET_SLOT_COUNT,
} from '../src/game-engine/trinkets/index.js';
import type { TrinketInventoryState } from '../src/game-engine/trinkets/types.js';

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
      'h.highwayman': freshHero('h.highwayman', 'Dismas', 'highwayman', 2, 22),
    },
    encounter: null, pendingDecision: null, lastResolution: null,
    inventory: { capacity: 16, stacks: [] },
    torch: { value: 100, level: 'radiant' },
    eventLog: [], rng: rng.state, lastTransactionId: null,
    activeOverlay: null, deathRecords: [], pendingMentalFlags: [], derivedEventDepth: 0,
    campaign: {
      id: `camp_${seed}`, seed, week: 1, gold: INITIAL_GOLD,
      heirlooms: { portraits: INITIAL_PORTRAITS, crests: INITIAL_CRESTS },
      rosterCapacity: 8, rosterHeroIds: ['h.crusader', 'h.highwayman'],
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

describe('Phase 4 饰品: 库完整性(SPEC §7.3)', () => {
  it('至少 20 件饰品', () => {
    expect(listTrinkets().length).toBeGreaterThanOrEqual(20);
  });

  it('每件饰品有正 modifier + 负 modifier(SPEC §1.3)', () => {
    for (const def of listTrinkets()) {
      expect(def.positiveModifiers.length).toBeGreaterThan(0);
      expect(def.negativeModifiers.length).toBeGreaterThan(0);
    }
  });

  it('4 件职业限定', () => {
    const classTrinkets = listTrinkets().filter((t) => t.allowedClassIds && t.allowedClassIds.length > 0);
    expect(classTrinkets.length).toBeGreaterThanOrEqual(4);
  });

  it('4 件稀有 very-rare(高风险高收益)', () => {
    const veryRare = listTrinkets().filter((t) => t.rarity === 'very-rare');
    expect(veryRare.length).toBeGreaterThanOrEqual(4);
  });

  it('每件饰品有 id / name / rarity / flavor', () => {
    for (const def of listTrinkets()) {
      expect(def.id).toMatch(/^trinket_/);
      expect(def.name.length).toBeGreaterThan(0);
      expect(['common', 'uncommon', 'rare', 'very-rare']).toContain(def.rarity);
      expect(def.flavor.length).toBeGreaterThan(0);
    }
  });

  it('职业限定正确(4 类)', () => {
    expect(listClassTrinkets('crusader').length).toBeGreaterThan(0);
    expect(listClassTrinkets('highwayman').length).toBeGreaterThan(0);
    expect(listClassTrinkets('vestal').length).toBeGreaterThan(0);
    expect(listClassTrinkets('plague_doctor').length).toBeGreaterThan(0);
  });
});

describe('Phase 4 饰品: lootTrinket', () => {
  it('创建 instance + 加到仓库', () => {
    const inv: TrinketInventoryState = { ownedInstanceIds: [], equippedByHero: {} };
    const r = lootTrinket(inv, 'trinket_sharp_ammo', 1, 'quest_reward');
    expect(r.ok).toBe(true);
    expect(inv.ownedInstanceIds.length).toBe(1);
    expect(r.instance!.definitionId).toBe('trinket_sharp_ammo');
  });

  it('未知 definitionId → 拒绝', () => {
    const inv: TrinketInventoryState = { ownedInstanceIds: [], equippedByHero: {} };
    const r = lootTrinket(inv, 'trinket_no_such', 1, 'quest');
    expect(r.ok).toBe(false);
  });

  it('MVP 仓库无容量上限', () => {
    const inv: TrinketInventoryState = { ownedInstanceIds: [], equippedByHero: {} };
    for (let i = 0; i < 50; i += 1) {
      const r = lootTrinket(inv, 'trinket_sharp_ammo', 1, 'quest');
      expect(r.ok).toBe(true);
    }
    expect(inv.ownedInstanceIds.length).toBe(50);
  });
});

describe('Phase 4 饰品: equipTrinket / unequipTrinket', () => {
  it('装备到槽位 0 + 1', () => {
    const inv: TrinketInventoryState = { ownedInstanceIds: [], equippedByHero: {} };
    const r1 = lootTrinket(inv, 'trinket_sharp_ammo', 1, 'quest');
    const r2 = lootTrinket(inv, 'trinket_iron_talisman', 1, 'quest');
    const cache = buildTrinketDefCache(inv);
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const e1 = equipTrinket(hero, r1.instance!.id, 0, cache);
    expect(e1.ok).toBe(true);
    const e2 = equipTrinket(hero, r2.instance!.id, 1, cache);
    expect(e2.ok).toBe(true);
    expect(hero.equippedTrinketInstanceIds).toEqual([r1.instance!.id, r2.instance!.id]);
  });

  it('TRINKET_SLOT_COUNT = 2', () => {
    expect(TRINKET_SLOT_COUNT).toBe(2);
  });

  it('无效槽位索引 → 拒绝', () => {
    const inv: TrinketInventoryState = { ownedInstanceIds: [], equippedByHero: {} };
    const r = lootTrinket(inv, 'trinket_sharp_ammo', 1, 'quest');
    const cache = buildTrinketDefCache(inv);
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const e = equipTrinket(hero, r.instance!.id, 5, cache);
    expect(e.ok).toBe(false);
  });

  it('死英雄不能装备', () => {
    const inv: TrinketInventoryState = { ownedInstanceIds: [], equippedByHero: {} };
    const r = lootTrinket(inv, 'trinket_sharp_ammo', 1, 'quest');
    const cache = buildTrinketDefCache(inv);
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    hero.isDead = true;
    hero.hp = 0;
    const e = equipTrinket(hero, r.instance!.id, 0, cache);
    expect(e.ok).toBe(false);
  });

  it('职业限制: crusader 不能装备 vestal 限定饰品', () => {
    const inv: TrinketInventoryState = { ownedInstanceIds: [], equippedByHero: {} };
    const r = lootTrinket(inv, 'trinket_vestals_hymn', 1, 'quest');
    const cache = buildTrinketDefCache(inv);
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const e = equipTrinket(hero, r.instance!.id, 0, cache);
    expect(e.ok).toBe(false);
  });

  it('职业限制: vestal 可以装备 vestal 限定饰品', () => {
    const inv: TrinketInventoryState = { ownedInstanceIds: [], equippedByHero: {} };
    const r = lootTrinket(inv, 'trinket_vestals_hymn', 1, 'quest');
    const cache = buildTrinketDefCache(inv);
    const hero = freshHero('h.1', 'X', 'vestal', 1, 25);
    const e = equipTrinket(hero, r.instance!.id, 0, cache);
    expect(e.ok).toBe(true);
  });

  it('通用饰品:任何职业都能装备', () => {
    const inv: TrinketInventoryState = { ownedInstanceIds: [], equippedByHero: {} };
    const r = lootTrinket(inv, 'trinket_sharp_ammo', 1, 'quest');
    const cache = buildTrinketDefCache(inv);
    for (const arch of ['crusader', 'highwayman', 'vestal', 'plague_doctor']) {
      const hero = freshHero('h.t', 'X', arch as any, 1, 25);
      const e = equipTrinket(hero, r.instance!.id, 0, cache);
      expect(e.ok).toBe(true);
      unequipTrinket(hero, 0);
    }
  });

  it('卸下饰品 + 槽位恢复 null', () => {
    const inv: TrinketInventoryState = { ownedInstanceIds: [], equippedByHero: {} };
    const r = lootTrinket(inv, 'trinket_sharp_ammo', 1, 'quest');
    const cache = buildTrinketDefCache(inv);
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    equipTrinket(hero, r.instance!.id, 0, cache);
    const u = unequipTrinket(hero, 0);
    expect(u.ok).toBe(true);
    expect(hero.equippedTrinketInstanceIds![0]).toBeNull();
  });

  it('空槽卸下 → 拒绝', () => {
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    const u = unequipTrinket(hero, 0);
    expect(u.ok).toBe(false);
  });
});

describe('Phase 4 饰品: processDeathRecovery(SPEC §8.2)', () => {
  function setupHeroWithTrinkets(): { inv: TrinketInventoryState; hero: HeroInstance; inst1: string; inst2: string } {
    const inv: TrinketInventoryState = { ownedInstanceIds: [], equippedByHero: {} };
    const r1 = lootTrinket(inv, 'trinket_sharp_ammo', 1, 'quest');
    const r2 = lootTrinket(inv, 'trinket_iron_talisman', 1, 'quest');
    const cache = buildTrinketDefCache(inv);
    const hero = freshHero('h.1', 'X', 'crusader', 1, 25);
    equipTrinket(hero, r1.instance!.id, 0, cache);
    equipTrinket(hero, r2.instance!.id, 1, cache);
    return { inv, hero, inst1: r1.instance!.id, inst2: r2.instance!.id };
  }

  it('recover-one: 回收 1 件,放弃 1 件', () => {
    const { inv, hero, inst1 } = setupHeroWithTrinkets();
    const r = processDeathRecovery(hero, 'recover-one');
    expect(r.recovered).toEqual([inst1]);
    expect(r.abandoned.length).toBe(1);
    expect(inv.ownedInstanceIds).toContain(inst1);
  });

  it('abandon-all: 全部永久遗失(inv 由 dispatcher 处理)', () => {
    const { hero, inst1, inst2 } = setupHeroWithTrinkets();
    const r = processDeathRecovery(hero, 'abandon-all');
    expect(r.recovered).toEqual([]);
    expect(r.abandoned.sort()).toEqual([inst1, inst2].sort());
    // manager 不直接动 inv(由 dispatcher 在 PROCESS_DEATH_RECOVERY 里 splice)
  });

  it('emergency-retreat: 全部回收 + 撤退难度 +2', () => {
    const { inv, hero, inst1, inst2 } = setupHeroWithTrinkets();
    const r = processDeathRecovery(hero, 'emergency-retreat');
    expect(r.recovered.sort()).toEqual([inst1, inst2].sort());
    expect(r.abandoned).toEqual([]);
    expect(r.retreatPenalty).toBe(2);
    expect(inv.ownedInstanceIds).toContain(inst1);
    expect(inv.ownedInstanceIds).toContain(inst2);
  });

  it('死亡后槽位清空', () => {
    const { hero } = setupHeroWithTrinkets();
    processDeathRecovery(hero, 'abandon-all');
    expect(hero.equippedTrinketInstanceIds).toEqual([null, null]);
  });
});

describe('Phase 4 饰品: dispatcher 集成', () => {
  it('LOOT_TRINKET 成功', () => {
    let s = freshGame('trk-loot-1');
    s = dispatchGameCommand(s, {
      type: 'LOOT_TRINKET',
      definitionId: 'trinket_sharp_ammo', week: 1, source: 'quest_reward',
      commandId: newCommandId('t'),
    });
    expect(s.campaign!.trinketInventory!.ownedInstanceIds.length).toBe(1);
  });

  it('LOOT_TRINKET 未知 → 抛错', () => {
    const s = freshGame('trk-loot-no');
    expect(() => dispatchGameCommand(s, {
      type: 'LOOT_TRINKET',
      definitionId: 'trinket_no_such', week: 1, source: 'quest',
      commandId: newCommandId('t'),
    })).toThrow();
  });

  it('LOOT + EQUIP 链: 装备后槽位有值', () => {
    let s = freshGame('trk-equip-1');
    s = dispatchGameCommand(s, {
      type: 'LOOT_TRINKET', definitionId: 'trinket_iron_talisman', week: 1, source: 'quest',
      commandId: newCommandId('l'),
    });
    const instId = s.campaign!.trinketInventory!.ownedInstanceIds[0]!;
    s = dispatchGameCommand(s, {
      type: 'EQUIP_TRINKET', heroId: 'h.crusader', instanceId: instId, slotIndex: 0,
      commandId: newCommandId('e'),
    });
    expect(s.party['h.crusader']!.equippedTrinketInstanceIds![0]).toBe(instId);
  });

  it('EQUIP 死英雄 → 抛错', () => {
    let s = freshGame('trk-equip-dead');
    s.party['h.crusader']!.isDead = true;
    s.party['h.crusader']!.hp = 0;
    s = dispatchGameCommand(s, {
      type: 'LOOT_TRINKET', definitionId: 'trinket_sharp_ammo', week: 1, source: 'q',
      commandId: newCommandId('l'),
    });
    const instId = s.campaign!.trinketInventory!.ownedInstanceIds[0]!;
    expect(() => dispatchGameCommand(s, {
      type: 'EQUIP_TRINKET', heroId: 'h.crusader', instanceId: instId, slotIndex: 0,
      commandId: newCommandId('e'),
    })).toThrow();
  });

  it('EQUIP 不在仓库的 instance → 抛错', () => {
    const s = freshGame('trk-equip-foreign');
    expect(() => dispatchGameCommand(s, {
      type: 'EQUIP_TRINKET', heroId: 'h.crusader', instanceId: 'trk_xxx_y_1', slotIndex: 0,
      commandId: newCommandId('e'),
    })).toThrow();
  });

  it('UNEQUIP 成功', () => {
    let s = freshGame('trk-unequip-1');
    s = dispatchGameCommand(s, {
      type: 'LOOT_TRINKET', definitionId: 'trinket_sharp_ammo', week: 1, source: 'q',
      commandId: newCommandId('l'),
    });
    const instId = s.campaign!.trinketInventory!.ownedInstanceIds[0]!;
    s = dispatchGameCommand(s, {
      type: 'EQUIP_TRINKET', heroId: 'h.crusader', instanceId: instId, slotIndex: 0,
      commandId: newCommandId('e'),
    });
    s = dispatchGameCommand(s, {
      type: 'UNEQUIP_TRINKET', heroId: 'h.crusader', slotIndex: 0,
      commandId: newCommandId('u'),
    });
    expect(s.party['h.crusader']!.equippedTrinketInstanceIds![0]).toBeNull();
  });

  it('PROCESS_DEATH_RECOVERY: abandon-all 触发 TRINKET_LOST', () => {
    let s = freshGame('trk-death-1');
    s = dispatchGameCommand(s, {
      type: 'LOOT_TRINKET', definitionId: 'trinket_sharp_ammo', week: 1, source: 'q',
      commandId: newCommandId('l'),
    });
    const instId = s.campaign!.trinketInventory!.ownedInstanceIds[0]!;
    s = dispatchGameCommand(s, {
      type: 'EQUIP_TRINKET', heroId: 'h.crusader', instanceId: instId, slotIndex: 0,
      commandId: newCommandId('e'),
    });
    s = dispatchGameCommand(s, {
      type: 'PROCESS_DEATH_RECOVERY',
      heroId: 'h.crusader', choice: 'abandon-all',
      commandId: newCommandId('p'),
    });
    expect(s.campaign!.trinketInventory!.ownedInstanceIds).not.toContain(instId);
    const lost = s.eventLog.find((e) => e.type === 'TRINKET_LOST');
    expect(lost).toBeDefined();
  });

  it('TRINKET_LOOTED / TRINKET_EQUIPPED 事件 emit', () => {
    let s = freshGame('trk-events-1');
    s = dispatchGameCommand(s, {
      type: 'LOOT_TRINKET', definitionId: 'trinket_sharp_ammo', week: 1, source: 'q',
      commandId: newCommandId('l'),
    });
    const instId = s.campaign!.trinketInventory!.ownedInstanceIds[0]!;
    s = dispatchGameCommand(s, {
      type: 'EQUIP_TRINKET', heroId: 'h.crusader', instanceId: instId, slotIndex: 0,
      commandId: newCommandId('e'),
    });
    expect(s.eventLog.some((e) => e.type === 'TRINKET_LOOTED')).toBe(true);
    expect(s.eventLog.some((e) => e.type === 'TRINKET_EQUIPPED')).toBe(true);
  });
});
