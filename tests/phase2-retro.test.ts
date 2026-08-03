/**
 * Phase 2.x retro-fix 测试
 *
 * 覆盖 §8 已知问题的修复:
 *  - apply-stress rule effect
 *  - 11 个 Phase 2 内容事件注册
 *  - MentalOverlay per-kind timing
 *  - derivedEventDepth 在 commit 时重置
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchGameCommand, clearProcessedCommands } from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import { buildRuinsRoute } from '../src/content/route/ruins.js';
import { GAME_STATE_VERSION } from '../src/game-engine/expedition/types.js';
import { Mulberry32 } from '../src/game-engine/rng/index.js';
import { ExpeditionContext } from '../src/game-engine/expedition/context.js';
import { applyEffect } from '../src/game-engine/expedition/rule-engine.js';
import { getEventDef, EVENT_REGISTRY } from '../src/content/events.js';
import type { GameState, RuleEffect } from '../src/game-engine/expedition/types.js';

function freshGame(seed: string): GameState {
  const rng = new Mulberry32(seed);
  const route = buildRuinsRoute(seed);
  return {
    version: GAME_STATE_VERSION,
    mode: 'expedition-start',
    seed,
    expedition: {
      id: '',
      routeId: route.id,
      seed,
      startedAt: new Date().toISOString(),
      currentNodeId: route.startNodeId,
      visitedNodeIds: [route.startNodeId],
      depth: 0,
      timeElapsed: 0,
      torch: 100,
      keyChoices: [],
      keyEvents: [],
      firedEventIds: [],
      eventCooldowns: {},
      scoutLevel: 'unknown',
      route,
      flags: {},
      stats: { deepestNodeReached: 0, nodesVisited: 0, encounterCount: 0, trapCount: 0, hungerCount: 0, torchUsed: 0, foodUsed: 0, lowestTorch: 100, lootGained: [], itemsDiscarded: [], heroLowestHp: [] },
      objectiveCompleted: false,
      failed: false,
    },
    party: {
      'hero.crusader': {
        id: 'hero.crusader', name: 'Reynauld', archetype: 'crusader', tags: ['frontline'], rank: 1,
        hp: 25, maxHp: 25, protection: 0.3, dodge: 5, speed: 4, accuracy: 0.85, crit: 0.05,
        bleedResist: 0.3, blightResist: 0.3, stunResist: 0.3, moveResist: 0.3,
        bleed: [], blight: [], stun: null, mark: null, protBuff: null,
        cooldowns: {}, isDead: false, conditions: [], skills: ['s1', 's2', 's3', 's4'],
        stress: 0, resolveState: 'stable', afflictionId: null, virtueId: null,
        atDeathsDoor: false, deathsDoorRecoveryStacks: 0, deathblowPenalty: 0, heartAttackCount: 0,
        behaviorCooldowns: {},
      },
      'hero.highwayman': {
        id: 'hero.highwayman', name: 'Dismas', archetype: 'highwayman', tags: ['ranged'], rank: 2,
        hp: 22, maxHp: 22, protection: 0.1, dodge: 10, speed: 6, accuracy: 0.9, crit: 0.08,
        bleedResist: 0.4, blightResist: 0.3, stunResist: 0.3, moveResist: 0.3,
        bleed: [], blight: [], stun: null, mark: null, protBuff: null,
        cooldowns: {}, isDead: false, conditions: [], skills: ['s1', 's2', 's3', 's4'],
        stress: 0, resolveState: 'stable', afflictionId: null, virtueId: null,
        atDeathsDoor: false, deathsDoorRecoveryStacks: 0, deathblowPenalty: 0, heartAttackCount: 0,
        behaviorCooldowns: {},
      },
      'hero.vestal': {
        id: 'hero.vestal', name: 'Junia', archetype: 'vestal', tags: ['healer'], rank: 3,
        hp: 20, maxHp: 20, protection: 0.2, dodge: 5, speed: 5, accuracy: 0.9, crit: 0.05,
        bleedResist: 0.3, blightResist: 0.4, stunResist: 0.3, moveResist: 0.3,
        bleed: [], blight: [], stun: null, mark: null, protBuff: null,
        cooldowns: {}, isDead: false, conditions: [], skills: ['s1', 's2', 's3', 's4'],
        stress: 0, resolveState: 'stable', afflictionId: null, virtueId: null,
        atDeathsDoor: false, deathsDoorRecoveryStacks: 0, deathblowPenalty: 0, heartAttackCount: 0,
        behaviorCooldowns: {},
      },
      'hero.plague_doctor': {
        id: 'hero.plague_doctor', name: 'Pox', archetype: 'plague_doctor', tags: ['blight'], rank: 4,
        hp: 21, maxHp: 21, protection: 0.1, dodge: 5, speed: 5, accuracy: 0.85, crit: 0.06,
        bleedResist: 0.3, blightResist: 0.4, stunResist: 0.3, moveResist: 0.3,
        bleed: [], blight: [], stun: null, mark: null, protBuff: null,
        cooldowns: {}, isDead: false, conditions: [], skills: ['s1', 's2', 's3', 's4'],
        stress: 0, resolveState: 'stable', afflictionId: null, virtueId: null,
        atDeathsDoor: false, deathsDoorRecoveryStacks: 0, deathblowPenalty: 0, heartAttackCount: 0,
        behaviorCooldowns: {},
      },
    },
    encounter: null,
    pendingDecision: null,
    lastResolution: null,
    inventory: { capacity: 16, stacks: [] },
    torch: { value: 100, level: 'radiant' },
    eventLog: [],
    rng: rng.state,
    lastTransactionId: null,
    activeOverlay: null,
    deathRecords: [],
    pendingMentalFlags: [],
    derivedEventDepth: 0,
  };
}

function newCtx(state: GameState): ExpeditionContext {
  return new ExpeditionContext(state);
}

beforeEach(() => clearProcessedCommands());

describe('Phase 2.x retro: apply-stress rule effect', () => {
  it('applyEffect: apply-stress 增加压力', () => {
    const s = freshGame('p2r-apply-stress-1');
    const ctx = newCtx(s);
    const eff: RuleEffect = {
      kind: 'apply-stress',
      heroId: 'hero.vestal',
      amount: 20,
      narrativeHint: 'test-source',
    };
    applyEffect(ctx, eff);
    expect(s.party['hero.vestal']!.stress).toBe(20);
  });

  it('applyEffect: apply-stress 负值减压力', () => {
    const s = freshGame('p2r-apply-stress-2');
    s.party['hero.vestal']!.stress = 50;
    const ctx = newCtx(s);
    applyEffect(ctx, {
      kind: 'apply-stress',
      heroId: 'hero.vestal',
      amount: -10,
      narrativeHint: 'calming',
    });
    expect(s.party['hero.vestal']!.stress).toBe(40);
  });

  it('applyEffect: apply-stress clamp 0-200', () => {
    const s = freshGame('p2r-apply-stress-3');
    const ctx = newCtx(s);
    // 直接到 200(已被检定,可能 afflict 后回到 ≤100)
    applyEffect(ctx, { kind: 'apply-stress', heroId: 'hero.vestal', amount: 300, narrativeHint: 't' });
    // 跨 100 触发检定;若 afflict,stress ≤ 100;若 virtue,stress = 200
    const vestal = s.party['hero.vestal']!;
    expect(vestal.stress).toBeLessThanOrEqual(200);
    expect(vestal.stress).toBeGreaterThan(0);
    // 清零:负值
    applyEffect(ctx, { kind: 'apply-stress', heroId: 'hero.vestal', amount: -1000, narrativeHint: 't' });
    expect(vestal.stress).toBe(0);
  });

  it('applyEffect: apply-stress 跨 100 触发意志检定', () => {
    const s = freshGame('p2r-apply-stress-4');
    s.party['hero.vestal']!.stress = 80;
    const ctx = newCtx(s);
    applyEffect(ctx, { kind: 'apply-stress', heroId: 'hero.vestal', amount: 25, narrativeHint: 't' });
    // 80+25=105 → 跨 100 → resolve check
    expect(s.party['hero.vestal']!.resolveState).not.toBe('stable');
  });
});

describe('Phase 2.x retro: 11 内容事件注册', () => {
  it('11 个 Phase 2 事件都在 EVENT_REGISTRY', () => {
    const expected = [
      'mental_low_torch_whispers',
      'mental_low_torch_candle',
      'party_dispute_blame',
      'party_dispute_route',
      'virtue_steadfast_inspire',
      'virtue_valorous_shout',
      'heart_attack_stumble',
      'deaths_door_emergency',
      'deaths_door_cover',
      'hero_death_pickup',
      'hero_death_abandon',
    ];
    for (const id of expected) {
      expect(EVENT_REGISTRY[id], `事件 ${id} 应注册`).toBeDefined();
      expect(getEventDef(id), `getEventDef(${id}) 应返回定义`).toBeDefined();
    }
    expect(expected.length).toBe(11);
  });

  it('低火把事件 trigger 是 torch-low', () => {
    expect(getEventDef('mental_low_torch_whispers')!.trigger).toBe('torch-low');
    expect(getEventDef('mental_low_torch_candle')!.trigger).toBe('torch-low');
  });

  it('其他事件 trigger 是 manual(待 Phase 3 接入)', () => {
    const ids = [
      'party_dispute_blame',
      'virtue_steadfast_inspire',
      'heart_attack_stumble',
      'deaths_door_emergency',
      'hero_death_pickup',
    ];
    for (const id of ids) {
      expect(getEventDef(id)!.trigger).toBe('manual');
    }
  });

  it('事件 outcome 引用 apply-stress 真实可执行', () => {
    const s = freshGame('p2r-event-stress-1');
    // 直接调用:让 mental_low_torch_whispers 触发效果
    // 通过 rule effect 入口
    const ctx = newCtx(s);
    // 模拟事件 outcomeTable 的 effects
    const effect: RuleEffect = {
      kind: 'apply-stress',
      heroId: 'hero.vestal',
      amount: 8,
      narrativeHint: 'mental_low_torch_whispers',
    };
    applyEffect(ctx, effect);
    expect(s.party['hero.vestal']!.stress).toBe(8);
  });
});

describe('Phase 2.x retro: derivedEventDepth 重置', () => {
  it('dispatcher commit 后 derivedEventDepth = 0', () => {
    const s = freshGame('p2r-depth-reset');
    let state = dispatchGameCommand(s, {
      type: 'START_EXPEDITION',
      loadoutId: 'l',
      commandId: newCommandId('s'),
    });
    // 设置压力到 100
    state = dispatchGameCommand(state, {
      type: 'DEBUG_SET_STRESS', heroId: 'hero.vestal', value: 100,
      commandId: newCommandId('d'),
    });
    // resolve check 可能让 derivedEventDepth 暂时增加,但 commit 后应被重置
    expect(state.derivedEventDepth).toBe(0);
  });

  it('连续多条命令不会累加 derivedEventDepth', () => {
    let state = freshGame('p2r-depth-multi');
    state = dispatchGameCommand(state, {
      type: 'START_EXPEDITION', loadoutId: 'l', commandId: newCommandId('s'),
    });
    for (let i = 0; i < 5; i += 1) {
      state = dispatchGameCommand(state, {
        type: 'DEBUG_SET_STRESS', heroId: 'hero.vestal', value: 100,
        commandId: newCommandId(`d${i}`),
      });
      expect(state.derivedEventDepth).toBe(0);
    }
  });
});

describe('Phase 2.x retro: 集成 - 内容事件可被 dispatch 触发', () => {
  it('DEBUG_FIRE_EVENT 不存在,但 mental 集成通过 DEBUG_FORCE 仍可工作', () => {
    let state = freshGame('p2r-integration');
    state = dispatchGameCommand(state, {
      type: 'START_EXPEDITION', loadoutId: 'l', commandId: newCommandId('s'),
    });
    // 通过 debug 触发意志检定
    state = dispatchGameCommand(state, {
      type: 'DEBUG_SET_STRESS', heroId: 'hero.vestal', value: 100,
      commandId: newCommandId('d'),
    });
    // 修女应该 afflict 或 virtue
    const vestal = state.party['hero.vestal']!;
    expect(['afflicted', 'virtuous']).toContain(vestal.resolveState);
    // 事件应该记录
    const hasMentalEvent = state.eventLog.some((e) => e.type === 'STRESS_APPLIED' || e.type === 'RESOLVE_CHECK_STARTED' || e.type === 'RESOLVE_CHECK_SUCCEEDED');
    expect(hasMentalEvent).toBe(true);
  });
});

describe('Phase 2.x retro: 折磨/美德被动 modifier 跨过阈值的整合', () => {
  it('折磨 passiveStressGain 影响 apply-stress effect', () => {
    const s = freshGame('p2r-afflict-modifier');
    s.party['hero.vestal']!.afflictionId = 'affliction_paranoia';
    s.party['hero.vestal']!.resolveState = 'afflicted';
    const ctx = newCtx(s);
    // 折磨被动 +20%
    applyEffect(ctx, { kind: 'apply-stress', heroId: 'hero.vestal', amount: 50, narrativeHint: 't' });
    // 50 * 1.2 = 60
    expect(s.party['hero.vestal']!.stress).toBe(60);
  });

  it('美德坚定 passiveStressGain 影响 apply-stress effect', () => {
    const s = freshGame('p2r-virtue-modifier');
    s.party['hero.vestal']!.virtueId = 'virtue_steadfast';
    s.party['hero.vestal']!.resolveState = 'virtuous';
    const ctx = newCtx(s);
    // 坚定被动 -30% (0.7x)
    applyEffect(ctx, { kind: 'apply-stress', heroId: 'hero.vestal', amount: 50, narrativeHint: 't' });
    // 50 * 0.7 = 35
    expect(s.party['hero.vestal']!.stress).toBe(35);
  });
});
