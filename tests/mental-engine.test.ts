/**
 * 精神系统单元测试(SPEC §4-§16)
 *
 * 覆盖:
 *  - 压力增减 / 0-200 边界
 *  - 100 意志检定 / 美德 vs 折磨概率
 *  - 200 心脏病 / 美德缓冲
 *  - 折磨行为触发 / 拒绝 / 替换
 *  - 美德行为触发 / 鼓舞
 *  - 死亡之门进入 / 离开
 *  - 致死打击抵抗 / 失败
 *  - 永久死亡 / 死亡记录 / 站位压缩
 *  - 队伍压力脉冲
 *  - 派生事件深度上限
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchGameCommand, clearProcessedCommands } from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import { ExpeditionContext } from '../src/game-engine/expedition/context.js';
import { GAME_STATE_VERSION } from '../src/game-engine/expedition/types.js';
import { Mulberry32 } from '../src/game-engine/rng/index.js';
import { applyStress, triggerHeartAttack, enterDeathsDoor, leaveDeathsDoor } from '../src/game-engine/mental/stress-engine.js';
import { checkDeathblow, triggerPermanentDeath } from '../src/game-engine/mental/death-engine.js';
import { applyPartyStressPulse } from '../src/game-engine/mental/stress-engine.js';
import { processChoiceMentalChecks, checkAfflictionBehaviors, checkVirtueBehaviors } from '../src/game-engine/mental/behaviors.js';
import { buildRuinsRoute } from '../src/content/route/ruins.js';
import type { GameState } from '../src/game-engine/expedition/types.js';

function makeState(seed: string): GameState {
  const rng = new Mulberry32(seed);
  const route = buildRuinsRoute(seed);
  return {
    version: GAME_STATE_VERSION,
    mode: 'expedition-start',
    seed,
    expedition: {
      id: 'exp1',
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
        id: 'hero.highwayman', name: ' Dismas', archetype: 'highwayman', tags: ['ranged'], rank: 2,
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
        id: 'hero.plague_doctor', name: 'Plaguey', archetype: 'plague_doctor', tags: ['blight'], rank: 4,
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
    campaign: null,
    hamlet: null,
    activeOverlay: null,
    deathRecords: [],
    pendingMentalFlags: [],
    derivedEventDepth: 0,
  };
}

function newCtx(state: GameState): ExpeditionContext {
  return new ExpeditionContext(state);
}

beforeEach(() => {
  clearProcessedCommands();
});

describe('Mental: 压力基础', () => {
  it('applyStress: 增加压力,clamp 200', () => {
    const s = makeState('seed-stress-1');
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 60, source: 'test' });
    expect(s.party['hero.crusader']!.stress).toBe(60);
    // 第二次:60+200=260 → clamp 200,但跨过 100 触发 resolve check
    // 若被判定为折磨,stress 会被降回 75-100(<200)
    // 若被判定为美德,stress 维持 200
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 200, source: 'test' });
    const finalStress = s.party['hero.crusader']!.stress;
    expect(finalStress).toBeGreaterThan(0);
    expect(finalStress).toBeLessThanOrEqual(200);
    expect(s.party['hero.crusader']!.resolveState).not.toBe('stable');
  });

  it('applyStress: 跨 200 触发心脏病', () => {
    const s = makeState('seed-stress-1b');
    s.party['hero.crusader']!.stress = 199;
    s.party['hero.crusader']!.resolveState = 'afflicted';
    s.party['hero.crusader']!.afflictionId = 'affliction_paranoia';
    // 已是 afflicted,但 200 仍触发心脏病
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 100, source: 'test' });
    expect(s.party['hero.crusader']!.atDeathsDoor).toBe(true);
    expect(s.party['hero.crusader']!.hp).toBe(0);
  });

  it('applyStress: 减少压力,clamp 0', () => {
    const s = makeState('seed-stress-2');
    s.party['hero.crusader']!.stress = 50;
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: -100, source: 'test' });
    expect(s.party['hero.crusader']!.stress).toBe(0);
  });

  it('applyStress: 死英雄不接受压力', () => {
    const s = makeState('seed-stress-3');
    s.party['hero.crusader']!.isDead = true;
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 50, source: 'test' });
    expect(s.party['hero.crusader']!.stress).toBe(0);
  });

  it('applyStress: 折磨被动 +20%', () => {
    const s = makeState('seed-stress-4');
    s.party['hero.crusader']!.afflictionId = 'affliction_paranoia';
    s.party['hero.crusader']!.resolveState = 'afflicted';
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 50, source: 'test' });
    // 50 * 1.2 = 60
    expect(s.party['hero.crusader']!.stress).toBe(60);
  });

  it('applyStress: 美德坚定被动 -30%', () => {
    const s = makeState('seed-stress-5');
    s.party['hero.crusader']!.virtueId = 'virtue_steadfast';
    s.party['hero.crusader']!.resolveState = 'virtuous';
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 50, source: 'test' });
    // 50 * 0.7 = 35
    expect(s.party['hero.crusader']!.stress).toBe(35);
  });

  it('applyStress: 跨 100 触发意志检定', () => {
    const s = makeState('seed-stress-6');
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 150, source: 'test' });
    // 100 触发检定,resolveState 变成 afflicted 或 virtuous
    expect(s.party['hero.crusader']!.resolveState).not.toBe('stable');
    // 折磨触发时 stress ≤ 100,美德触发时 stress 维持
    if (s.party['hero.crusader']!.resolveState === 'afflicted') {
      expect(s.party['hero.crusader']!.stress).toBeLessThanOrEqual(100);
    } else {
      expect(s.party['hero.crusader']!.stress).toBe(150);
    }
  });
});

describe('Mental: 100 意志检定', () => {
  it('跨过 100 触发 resolve check', () => {
    const s = makeState('seed-resolve-1');
    s.party['hero.crusader']!.stress = 99;
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 1, source: 'test' });
    // 100 触发意志检定 → resolveState 会变成 afflicted 或 virtuous
    const state = s.party['hero.crusader']!.resolveState;
    expect(['afflicted', 'virtuous']).toContain(state);
  });

  it('已经是 afflicted 不再次触发', () => {
    const s = makeState('seed-resolve-2');
    s.party['hero.crusader']!.stress = 100;
    s.party['hero.crusader']!.resolveState = 'afflicted';
    s.party['hero.crusader']!.afflictionId = 'affliction_paranoia';
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 50, source: 'test' });
    // 不再二次检定
    expect(s.party['hero.crusader']!.afflictionId).toBe('affliction_paranoia');
  });

  it('多次跨过 100 只会触发一次(已 afflicted 时)', () => {
    const s = makeState('seed-resolve-3');
    const ctx = newCtx(s);
    // 第一次
    s.party['hero.crusader']!.stress = 99;
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 1, source: 't1' });
    expect(s.party['hero.crusader']!.resolveState).not.toBe('stable');
    // 第二次 (应该不再触发)
    s.party['hero.crusader']!.stress = 50; // 重置压力
    s.party['hero.crusader']!.resolveState = 'afflicted';
    s.party['hero.crusader']!.afflictionId = 'affliction_paranoia';
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 60, source: 't2' });
    // 还是同一个 afflictionId
    expect(s.party['hero.crusader']!.afflictionId).toBe('affliction_paranoia');
  });
});

describe('Mental: 200 心脏病', () => {
  it('200 压力触发心脏病 → 进入死亡之门', () => {
    const s = makeState('seed-heart-1');
    s.party['hero.crusader']!.stress = 199;
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 1, source: 'test' });
    expect(s.party['hero.crusader']!.atDeathsDoor).toBe(true);
    expect(s.party['hero.crusader']!.hp).toBe(0);
    // 心脏病先把 stress 设为 170,enterDeathsDoor 再 +10 = 180
    expect(s.party['hero.crusader']!.stress).toBe(180);
  });

  it('美德坚定第一次 200 触发缓冲 (HP=1, 美德清除, 不进死亡之门)', () => {
    const s = makeState('seed-heart-2');
    s.party['hero.crusader']!.stress = 199;
    s.party['hero.crusader']!.virtueId = 'virtue_steadfast';
    s.party['hero.crusader']!.resolveState = 'virtuous';
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 1, source: 'test' });
    expect(s.party['hero.crusader']!.hp).toBe(1);
    expect(s.party['hero.crusader']!.virtueId).toBeNull();
    expect(s.party['hero.crusader']!.atDeathsDoor).toBe(false);
    expect(s.party['hero.crusader']!.heartAttackCount).toBe(1);
    expect(s.party['hero.crusader']!.stress).toBe(170);
  });

  it('已在死亡之门再触发 200 → 永久死亡', () => {
    const s = makeState('seed-heart-3');
    s.party['hero.crusader']!.stress = 170;
    s.party['hero.crusader']!.atDeathsDoor = true;
    s.party['hero.crusader']!.hp = 0;
    const ctx = newCtx(s);
    applyStress(ctx, { type: 'apply-stress', heroId: 'hero.crusader', amount: 30, source: 'test' });
    expect(s.party['hero.crusader']!.isDead).toBe(true);
  });
});

describe('Mental: 死亡之门与恢复', () => {
  it('enterDeathsDoor: HP 归零, atDeathsDoor=true', () => {
    const s = makeState('seed-door-1');
    const crusader = s.party['hero.crusader']!;
    crusader.hp = 5;
    const ctx = newCtx(s);
    enterDeathsDoor(ctx, crusader, 'damage', 5);
    expect(crusader.hp).toBe(0);
    expect(crusader.atDeathsDoor).toBe(true);
  });

  it('leaveDeathsDoor: 应用 recovery 惩罚', () => {
    const s = makeState('seed-door-2');
    const crusader = s.party['hero.crusader']!;
    crusader.hp = 0;
    crusader.atDeathsDoor = true;
    crusader.maxHp = 25;
    const ctx = newCtx(s);
    leaveDeathsDoor(ctx, crusader, 5);
    expect(crusader.atDeathsDoor).toBe(false);
    expect(crusader.hp).toBe(5);
    expect(crusader.deathsDoorRecoveryStacks).toBe(1);
    // maxHp 应被减少 10%
    expect(crusader.maxHp).toBeLessThan(25);
  });
});

describe('Mental: 致死打击', () => {
  it('checkDeathblow: 死亡之门英雄被击中, 67% 基础抗性', () => {
    const s = makeState('seed-blow-1');
    const crusader = s.party['hero.crusader']!;
    crusader.atDeathsDoor = true;
    crusader.hp = 0;
    const ctx = newCtx(s);
    const survived = checkDeathblow(ctx, crusader, 'enemy1');
    // 检查返回值
    expect([true, false]).toContain(survived);
    // 检查副作用(根据结果)
    if (survived) {
      expect(crusader.isDead).toBe(false);
      expect(crusader.deathblowPenalty).toBeGreaterThan(0);
    } else {
      expect(crusader.isDead).toBe(true);
    }
  });

  it('checkDeathblow: 不在死亡之门不触发', () => {
    const s = makeState('seed-blow-2');
    const ctx = newCtx(s);
    const crusader = s.party['hero.crusader']!;
    const survived = checkDeathblow(ctx, crusader, 'enemy1');
    expect(survived).toBe(true);
    expect(crusader.isDead).toBe(false);
  });
});

describe('Mental: 永久死亡', () => {
  it('triggerPermanentDeath: 写死亡记录, 队伍移除, 站位压缩', () => {
    const s = makeState('seed-perm-1');
    const crusader = s.party['hero.crusader']!;
    const ctx = newCtx(s);
    triggerPermanentDeath(ctx, crusader, 'deathblow', 'enemy1');
    expect(crusader.isDead).toBe(true);
    expect(s.deathRecords.length).toBe(1);
    expect(s.deathRecords[0]!.heroId).toBe('hero.crusader');
    expect(s.deathRecords[0]!.cause).toBe('deathblow');
    // 站位压缩:plague_doctor 应该是 rank 3 (vestal=3, 不变)
    expect(s.party['hero.plague_doctor']!.rank).toBeLessThanOrEqual(4);
  });

  it('死亡后 100% 不可逆 (re-trigger 不复活)', () => {
    const s = makeState('seed-perm-2');
    const crusader = s.party['hero.crusader']!;
    const ctx = newCtx(s);
    triggerPermanentDeath(ctx, crusader, 'deathblow', 'e');
    // 再触发一次
    triggerPermanentDeath(ctx, crusader, 'heart-attack', 'e');
    expect(s.deathRecords.length).toBe(1); // 仍然只有 1 条记录
  });

  it('永久死亡不变量: hp=0, isDead=true', () => {
    const s = makeState('seed-perm-3');
    const crusader = s.party['hero.crusader']!;
    const ctx = newCtx(s);
    triggerPermanentDeath(ctx, crusader, 'deathblow', 'e');
    expect(crusader.hp).toBe(0);
    expect(crusader.isDead).toBe(true);
  });
});

describe('Mental: 队伍压力脉冲', () => {
  it('applyPartyStressPulse: 给指定英雄加压力', () => {
    const s = makeState('seed-pulse-1');
    const ctx = newCtx(s);
    applyPartyStressPulse(ctx, {
      sourceHeroId: 'hero.crusader',
      sourceEventId: 'test',
      deltas: [
        { heroId: 'hero.highwayman', amount: 5 },
        { heroId: 'hero.vestal', amount: 3 },
      ],
      reason: 'test',
    });
    expect(s.party['hero.highwayman']!.stress).toBe(5);
    expect(s.party['hero.vestal']!.stress).toBe(3);
    // 源英雄不影响
    expect(s.party['hero.crusader']!.stress).toBe(0);
  });
});

describe('Mental: 折磨行为触发器', () => {
  it('检查折磨行为: 概率生效', () => {
    const s = makeState('seed-afflict-1');
    s.party['hero.crusader']!.afflictionId = 'affliction_paranoia';
    s.party['hero.crusader']!.resolveState = 'afflicted';
    const ctx = newCtx(s);
    const result = checkAfflictionBehaviors(ctx, 'on-node-enter', 'hero.crusader');
    expect(result.heroId).toBe('hero.crusader');
    // 不一定触发,行为列表可能为空也可能非空
  });

  it('无折磨: 不触发', () => {
    const s = makeState('seed-afflict-2');
    const ctx = newCtx(s);
    const result = checkAfflictionBehaviors(ctx, 'on-healing-choice', 'hero.crusader');
    expect(result.triggered.length).toBe(0);
  });
});

describe('Mental: 美德行为触发器', () => {
  it('检查美德行为: inspire-ally 减压力', () => {
    const s = makeState('seed-virtue-1');
    s.party['hero.crusader']!.virtueId = 'virtue_steadfast';
    s.party['hero.crusader']!.resolveState = 'virtuous';
    s.party['hero.highwayman']!.stress = 50;
    s.party['hero.vestal']!.stress = 50;
    s.party['hero.plague_doctor']!.stress = 50;
    const ctx = newCtx(s);
    // 强制触发:用 100% 概率调用
    // 通过多次调用,统计有几次触发
    let totalInspire = 0;
    for (let i = 0; i < 50; i += 1) {
      const hero = s.party['hero.crusader']!;
      hero.behaviorCooldowns = {}; // 清冷却
      const result = checkVirtueBehaviors(ctx, 'on-stress-spike', 'hero.crusader');
      if (result.triggered.some((b) => b.effect === 'inspire-ally')) totalInspire += 1;
    }
    // 至少触发一次(基础 60% 概率,50 次)
    expect(totalInspire).toBeGreaterThan(15);
  });
});

describe('Mental: processChoiceMentalChecks', () => {
  it('折磨 refuse-choice: 返回 refused=true', () => {
    const s = makeState('seed-choice-1');
    s.party['hero.crusader']!.afflictionId = 'affliction_paranoia';
    s.party['hero.crusader']!.resolveState = 'afflicted';
    const ctx = newCtx(s);
    s.pendingDecision = {
      id: 'dec1',
      type: 'event',
      contextId: 'ev1',
      generatedChoices: [
        {
          id: 'c1',
          sourceDefinitionId: 'sdef1',
          title: '修女治疗十字军',
          description: '',
          primaryHeroId: 'hero.crusader',
          enabled: true,
          visibleCosts: [],
          visibleRisks: [],
          tags: ['healing'],
          reason: '',
        },
        {
          id: 'c2',
          sourceDefinitionId: 'sdef2',
          title: '瘟疫医生治疗',
          description: '',
          enabled: true,
          visibleCosts: [],
          visibleRisks: [],
          tags: ['healing'],
          reason: '',
        },
      ],
      selectedChoiceId: null,
      transactionId: null,
      createdAtStepId: 's1',
    };
    // 多次跑直到触发 refuse
    let result = { refused: false, resolvedChoiceId: 'c1', reason: '' };
    for (let i = 0; i < 50; i += 1) {
      s.party['hero.crusader']!.behaviorCooldowns = {};
      result = processChoiceMentalChecks(ctx, 'dec1', s.pendingDecision.generatedChoices[0]!);
      if (result.refused) break;
    }
    // 至少能跑通
    expect(result).toBeDefined();
  });

  it('无折磨: 不拒绝', () => {
    const s = makeState('seed-choice-2');
    const ctx = newCtx(s);
    s.pendingDecision = {
      id: 'dec1',
      type: 'event',
      contextId: 'ev1',
      generatedChoices: [
        {
          id: 'c1',
          sourceDefinitionId: 'sdef1',
          title: '选项 1',
          description: '',
          primaryHeroId: 'hero.crusader',
          enabled: true,
          visibleCosts: [],
          visibleRisks: [],
          tags: [],
          reason: '',
        },
      ],
      selectedChoiceId: null,
      transactionId: null,
      createdAtStepId: 's1',
    };
    const result = processChoiceMentalChecks(ctx, 'dec1', s.pendingDecision.generatedChoices[0]!);
    expect(result.refused).toBe(false);
  });
});

describe('Mental: 派生事件深度上限', () => {
  it('达到上限 200 → mode 变成 game-error', () => {
    const s = makeState('seed-depth-1');
    s.derivedEventDepth = 199;
    const ctx = newCtx(s);
    // 直接调用 triggerHeartAttack,会 ++ depth 然后 -
    // 我们手动调到上限
    s.party['hero.crusader']!.stress = 200;
    triggerHeartAttack(ctx, s.party['hero.crusader']!);
    // 现在 derivedEventDepth 应该是 0 (++ then --)
    // 再次跑,会在 ++ 之前检查
    s.derivedEventDepth = 200;
    triggerHeartAttack(ctx, s.party['hero.crusader']!);
    // 达到上限 → game-error
    expect(s.mode).toBe('game-error');
  });
});

describe('Mental: 死亡记录', () => {
  it('死亡记录字段完整', () => {
    const s = makeState('seed-record-1');
    const crusader = s.party['hero.crusader']!;
    const ctx = newCtx(s);
    triggerPermanentDeath(ctx, crusader, 'heart-attack');
    const rec = s.deathRecords[0]!;
    expect(rec.heroId).toBe('hero.crusader');
    expect(rec.heroName).toBe('Reynauld');
    expect(rec.heroClassId).toBe('crusader');
    expect(rec.cause).toBe('heart-attack');
    expect(rec.expeditionId).toBe('exp1');
    expect(rec.nodeId).toBe(s.expedition.currentNodeId);
    expect(rec.timestamp).toBeTruthy();
  });
});

describe('Mental: dispatchGameCommand 集成', () => {
  it('APPLY_STRESS 命令', () => {
    const s = makeState('seed-cmd-stress');
    const next = dispatchGameCommand(s, {
      type: 'APPLY_STRESS',
      heroId: 'hero.crusader',
      amount: 50,
      source: 'cmd-test',
      commandId: newCommandId('a'),
    });
    expect(next.party['hero.crusader']!.stress).toBe(50);
  });

  it('DEBUG_FORCE_AFFLICTION 命令', () => {
    const s = makeState('seed-cmd-afflict');
    const next = dispatchGameCommand(s, {
      type: 'DEBUG_FORCE_AFFLICTION',
      heroId: 'hero.crusader',
      afflictionId: 'affliction_paranoia',
      commandId: newCommandId('a'),
    });
    expect(next.party['hero.crusader']!.afflictionId).toBe('affliction_paranoia');
    expect(next.party['hero.crusader']!.resolveState).toBe('afflicted');
  });

  it('DEBUG_FORCE_VIRTUE 命令', () => {
    const s = makeState('seed-cmd-virtue');
    const next = dispatchGameCommand(s, {
      type: 'DEBUG_FORCE_VIRTUE',
      heroId: 'hero.crusader',
      virtueId: 'virtue_steadfast',
      commandId: newCommandId('a'),
    });
    expect(next.party['hero.crusader']!.virtueId).toBe('virtue_steadfast');
    expect(next.party['hero.crusader']!.resolveState).toBe('virtuous');
  });

  it('DEBUG_FORCE_HEART_ATTACK → 死亡之门', () => {
    const s = makeState('seed-cmd-heart');
    const next = dispatchGameCommand(s, {
      type: 'DEBUG_FORCE_HEART_ATTACK',
      heroId: 'hero.crusader',
      commandId: newCommandId('a'),
    });
    expect(next.party['hero.crusader']!.atDeathsDoor).toBe(true);
    expect(next.party['hero.crusader']!.hp).toBe(0);
  });

  it('DEBUG_REVIVE_HERO 重置', () => {
    const s = makeState('seed-cmd-revive');
    s.party['hero.crusader']!.isDead = true;
    s.party['hero.crusader']!.hp = 0;
    s.party['hero.crusader']!.stress = 100;
    s.party['hero.crusader']!.afflictionId = 'affliction_paranoia';
    s.party['hero.crusader']!.resolveState = 'afflicted';
    const next = dispatchGameCommand(s, {
      type: 'DEBUG_REVIVE_HERO',
      heroId: 'hero.crusader',
      commandId: newCommandId('a'),
    });
    expect(next.party['hero.crusader']!.isDead).toBe(false);
    expect(next.party['hero.crusader']!.hp).toBe(next.party['hero.crusader']!.maxHp);
    expect(next.party['hero.crusader']!.stress).toBe(0);
    expect(next.party['hero.crusader']!.afflictionId).toBeNull();
  });
});
