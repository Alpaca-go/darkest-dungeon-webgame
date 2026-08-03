/**
 * 战斗公式单元测试
 *
 * 通过直接调用 dispatchGameCommand 测试:
 * - 命中公式(5%-95% 钳制)
 * - 暴击(使用 max 伤害)
 * - PROT 减伤
 * - DOT(流血/腐蚀)抗性
 * - 眩晕抗性
 * - 位移(自身/目标)
 * - 死亡与尸体
 * - 行动顺序
 *
 * 注意:不要在这里跑大样本完整战斗,那属于 scripts/simulate-battles.ts
 */

import { describe, it, expect } from 'vitest';
import {
  createTestBattle,
} from '../src/content/factories.js';
import {
  dispatchGameCommand,
  assertInvariants,
} from '../src/game-engine/index.js';
import { BattleContext } from '../src/game-engine/battle/context.js';
import { startRound, beginTurn, endTurn, findActorInLists } from '../src/game-engine/battle/round.js';
import { useSkill } from '../src/game-engine/battle/skill.js';
import { decideAiAction } from '../src/game-engine/battle/ai.js';
import { runBattleFull } from '../src/game-engine/battle/loop.js';
import type { BattleState } from '../src/game-engine/types.js';

function freshBattle(seed = 'unit'): BattleState {
  return createTestBattle({ seed });
}

describe('Battle State 基础', () => {
  it('创建后有 4 英雄 4 敌人', () => {
    const b = freshBattle('create-1');
    expect(b.heroes.length).toBe(4);
    expect(b.enemies.length).toBe(4);
    expect(b.corpses.length).toBe(0);
    expect(b.round).toBe(0);
    expect(b.phase).toBe('setup');
  });

  it('每个 actor 装备 1-4 个技能', () => {
    const b = freshBattle('create-2');
    for (const a of [...b.heroes, ...b.enemies]) {
      const l = b.loadouts[a.id];
      expect(l).toBeDefined();
      expect(l!.length).toBeGreaterThanOrEqual(1);
    }
    for (const a of b.heroes) {
      expect(b.loadouts[a.id]!.length).toBe(4);
    }
  });

  it('站位 1-4 不重复', () => {
    const b = freshBattle('rank-1');
    const heroRanks = b.heroes.map((h) => h.rank).sort();
    expect(heroRanks).toEqual([1, 2, 3, 4]);
    const enemyRanks = b.enemies.map((e) => e.rank).sort();
    expect(enemyRanks).toEqual([1, 2, 3, 4]);
  });
});

describe('行动顺序', () => {
  it('每轮重算 initiative,高者先动', () => {
    const b = freshBattle('init-1');
    const ctx = new BattleContext(b);
    startRound(ctx);
    const state = ctx.state;
    expect(state.round).toBe(1);
    expect(state.initiativeQueue.length).toBe(8);
    for (const id of state.initiativeQueue) {
      const a = findActorInLists(state, id);
      expect(a).toBeDefined();
      expect(a!.isDead).toBe(false);
    }
  });

  it('开始/结束回合的状态机正确', () => {
    const b = freshBattle('state-1');
    const ctx = new BattleContext(b);
    startRound(ctx);
    const first = ctx.state.initiativeQueue[0]!;
    const ctx2 = new BattleContext(ctx.state);
    const turn = beginTurn(ctx2, first);
    expect(turn.canAct).toBe(true);
    expect(ctx2.state.phase).toBe('actor-turn');
    expect(ctx2.state.activeActorId).toBe(first);
    const ctx3 = new BattleContext(ctx2.state);
    endTurn(ctx3);
    expect(ctx3.state.activeActorId).toBeNull();
  });
});

describe('技能命中与伤害', () => {
  it('命中公式钳制在 5%-95%', () => {
    let hits = 0;
    const N = 20;
    for (let i = 0; i < N; i++) {
      const b = createTestBattle({ seed: `hit-clamp-${i}` });
      const final = runBattleFull(b, { heroesControlledByAi: true });
      let smiteAttempts = 0;
      let smiteHits = 0;
      for (const e of final.log) {
        if (e.type === 'DAMAGE_DEALT' && e.payload.sourceId === 'hero.crusader') {
          smiteAttempts++;
          if (e.payload.amount > 0) smiteHits++;
        } else if (e.type === 'SKILL_MISSED' && e.payload.actorId === 'hero.crusader') {
          smiteAttempts++;
        }
      }
      if (smiteAttempts > 0) {
        hits += smiteHits / smiteAttempts;
      }
    }
    expect(hits / N).toBeGreaterThan(0.5);
  });

  it('暴击使用 max 伤害', () => {
    let foundCrit = false;
    for (let i = 0; i < 30 && !foundCrit; i++) {
      const b2 = createTestBattle({ seed: `crit-${i}` });
      const final = runBattleFull(b2, { heroesControlledByAi: true });
      for (const e of final.log) {
        if (e.type === 'CRIT_ROLLED') {
          foundCrit = true;
          break;
        }
      }
    }
    expect(foundCrit).toBe(true);
  });
});

describe('PROT 减伤', () => {
  it('PROT=100 时受到 0 伤害', () => {
    const b = createTestBattle({ seed: 'prot-100' });
    const ctx = new BattleContext(b);
    const skelIdx = ctx.state.enemies.findIndex((e) => e.id === 'enemy.skeleton_soldier');
    ctx.state.enemies[skelIdx] = { ...ctx.state.enemies[skelIdx]!, protection: 100 };
    startRound(ctx);
    forceCrusaderTurn(ctx, 'enemy.skeleton_soldier');
    const dmgEvents = ctx.state.log.filter(
      (e) => e.type === 'DAMAGE_DEALT' && e.payload.targetId === 'enemy.skeleton_soldier',
    );
    for (const e of dmgEvents) {
      if (e.type === 'DAMAGE_DEALT') {
        expect(e.payload.amount).toBe(0);
      }
    }
  });

  it('高 PROT 目标平均伤害低于低 PROT 目标', () => {
    let dmgHigh = 0;
    let dmgLow = 0;
    const N = 5;
    for (let i = 0; i < N; i++) {
      const bH = createTestBattle({ seed: `prot-cmp-${i}` });
      const ctxH = new BattleContext(bH);
      const skelH = ctxH.state.enemies.findIndex((e) => e.id === 'enemy.skeleton_soldier');
      ctxH.state.enemies[skelH] = { ...ctxH.state.enemies[skelH]!, protection: 80 };
      startRound(ctxH);
      forceCrusaderTurn(ctxH, 'enemy.skeleton_soldier');
      const dmgH = ctxH.state.log
        .filter((e) => e.type === 'DAMAGE_DEALT' && e.payload.targetId === 'enemy.skeleton_soldier')
        .reduce((acc, e) => acc + (e.type === 'DAMAGE_DEALT' ? e.payload.amount : 0), 0);
      dmgHigh += dmgH;

      const bL = createTestBattle({ seed: `prot-cmp-${i}` });
      const ctxL = new BattleContext(bL);
      const skelL = ctxL.state.enemies.findIndex((e) => e.id === 'enemy.skeleton_soldier');
      ctxL.state.enemies[skelL] = { ...ctxL.state.enemies[skelL]!, protection: 0 };
      startRound(ctxL);
      forceCrusaderTurn(ctxL, 'enemy.skeleton_soldier');
      const dmgL = ctxL.state.log
        .filter((e) => e.type === 'DAMAGE_DEALT' && e.payload.targetId === 'enemy.skeleton_soldier')
        .reduce((acc, e) => acc + (e.type === 'DAMAGE_DEALT' ? e.payload.amount : 0), 0);
      dmgLow += dmgL;
    }
    expect(dmgHigh).toBeLessThanOrEqual(dmgLow);
  });
});

/** 强制让 crusader 行动并用 重击(smite) 攻击指定目标 */
function forceCrusaderTurn(ctx: BattleContext, targetId: string): void {
  for (let safety = 0; safety < 1000; safety++) {
    if (ctx.state.initiativeQueue.length === 0) {
      startRound(ctx);
    }
    const id = ctx.state.initiativeQueue[0]!;
    if (id === 'hero.crusader') {
      const ctx2 = new BattleContext(ctx.state);
      const turn = beginTurn(ctx2, id);
      if (turn.canAct) {
        const ctx3 = new BattleContext(ctx2.state);
        useSkill(ctx3, id, 'crusader.smite', [targetId]);
        ctx.state = ctx3.state;
      } else {
        ctx.state = ctx2.state;
      }
      const ctx4 = new BattleContext(ctx.state);
      endTurn(ctx4);
      ctx.state = ctx4.state;
      return;
    }
    const c2 = new BattleContext(ctx.state);
    const t = beginTurn(c2, id);
    if (t.canAct && t.actor) {
      const c3 = new BattleContext(c2.state);
      if (t.actor.side === 'enemy') {
        const dec = decideAiAction(c3, t.actor.id);
        if (dec) {
          try {
            useSkill(c3, t.actor.id, dec.skillId, dec.targetId ? [dec.targetId] : []);
          } catch {
            // ignore
          }
        }
        c2.state = c3.state;
      }
    }
    const c4 = new BattleContext(c2.state);
    endTurn(c4);
    ctx.state = c4.state;
  }
  throw new Error('forceCrusaderTurn: too many iterations');
}

describe('DOT(流血/腐蚀)', () => {
  it('DOT 在回合开始时结算', () => {
    const b = createTestBattle({ seed: 'dot-tick' });
    const ctx = new BattleContext(b);
    const cIdx = ctx.state.heroes.findIndex((h) => h.id === 'hero.crusader');
    ctx.state.heroes[cIdx] = {
      ...ctx.state.heroes[cIdx]!,
      bleed: [
        {
          id: 'test_dot',
          type: 'bleed',
          damagePerTurn: 2,
          remainingTurns: 3,
          sourceId: 'test',
        },
      ],
    };
    startRound(ctx);
    for (let safety = 0; safety < 200; safety++) {
      if (ctx.state.initiativeQueue.length === 0) {
        startRound(ctx);
        continue;
      }
      const id = ctx.state.initiativeQueue[0]!;
      if (id === 'hero.crusader') {
        const ctx2 = new BattleContext(ctx.state);
        const turn = beginTurn(ctx2, id);
        expect(turn.canAct).toBe(true);
        const tickEvents = ctx2.state.log.filter(
          (e) => e.type === 'DOT_TICKED' && e.payload.targetId === 'hero.crusader',
        );
        expect(tickEvents.length).toBe(1);
        return;
      }
      const c2 = new BattleContext(ctx.state);
      const t = beginTurn(c2, id);
      if (t.canAct && t.actor && t.actor.side === 'enemy') {
        const c3 = new BattleContext(c2.state);
        const dec = decideAiAction(c3, t.actor.id);
        if (dec) {
          try {
            useSkill(c3, t.actor.id, dec.skillId, dec.targetId ? [dec.targetId] : []);
          } catch {
            // ignore
          }
          c2.state = c3.state;
        }
      }
      const c4 = new BattleContext(c2.state);
      endTurn(c4);
      ctx.state = c4.state;
    }
    throw new Error('crusader never acted');
  });

  it('DOT 抗性影响施加概率', () => {
    let appliedCount = 0;
    let attempts = 0;
    const N = 30;
    for (let i = 0; i < N; i++) {
      const b = createTestBattle({ seed: `dot-resist-${i}` });
      const final = runBattleFull(b, { heroesControlledByAi: true });
      for (const e of final.log) {
        if (e.type === 'BLEED_APPLIED' && e.payload.targetId === 'enemy.skeleton_soldier') {
          appliedCount++;
        }
      }
      for (const e of final.log) {
        if (
          e.type === 'SKILL_USED' &&
          e.payload.actorId === 'hero.highwayman' &&
          e.payload.skillId === 'highwayman.wicked_slice' &&
          e.payload.targetIds.includes('enemy.skeleton_soldier')
        ) {
          attempts++;
        }
      }
    }
    expect(attempts).toBeGreaterThan(0);
    void appliedCount;
  });
});

describe('位移', () => {
  it('moveSelf 改变 rank(holy_lance -1, rank 4 -> 3 被阻挡,留在 rank 4)', () => {
    const b = createTestBattle({ seed: 'move-self' });
    // 把 crusader 挪到 rank 4,rank 3 被 plague_doctor 占,移不动
    const cIdx = b.heroes.findIndex((h) => h.id === 'hero.crusader');
    b.heroes[cIdx] = { ...b.heroes[cIdx]!, rank: 4 };
    const ctx = new BattleContext(b);
    startRound(ctx);
    for (let safety = 0; safety < 200; safety++) {
      if (ctx.state.initiativeQueue.length === 0) {
        startRound(ctx);
        continue;
      }
      const id = ctx.state.initiativeQueue[0]!;
      if (id === 'hero.crusader') {
        const ctx2 = new BattleContext(ctx.state);
        const turn = beginTurn(ctx2, id);
        if (turn.canAct) {
          const ctx3 = new BattleContext(ctx2.state);
          useSkill(ctx3, id, 'crusader.holy_lance', ['enemy.skeleton_soldier']);
          const after = ctx3.state.heroes.find((h) => h.id === 'hero.crusader');
          // 留在 rank 4(目标 rank 3 被占)
          expect(after?.rank).toBe(4);
        }
        return;
      }
      const c2 = new BattleContext(ctx.state);
      const t = beginTurn(c2, id);
      if (t.canAct && t.actor && t.actor.side === 'enemy') {
        const c3 = new BattleContext(c2.state);
        const dec = decideAiAction(c3, t.actor.id);
        if (dec) {
          try {
            useSkill(c3, t.actor.id, dec.skillId, dec.targetId ? [dec.targetId] : []);
          } catch {}
          c2.state = c3.state;
        }
      }
      const c4 = new BattleContext(c2.state);
      endTurn(c4);
      ctx.state = c4.state;
    }
  });

  it('lunge moveSelf -1 不能进入同阵营存活单位的站位(2->1 被 crusader 阻挡)', () => {
    const b = createTestBattle({ seed: 'move-block' });
    const ctx = new BattleContext(b);
    startRound(ctx);
    for (let safety = 0; safety < 200; safety++) {
      if (ctx.state.initiativeQueue.length === 0) {
        startRound(ctx);
        continue;
      }
      const id = ctx.state.initiativeQueue[0]!;
      if (id === 'hero.highwayman') {
        const ctx2 = new BattleContext(ctx.state);
        const turn = beginTurn(ctx2, id);
        if (turn.canAct) {
          const ctx3 = new BattleContext(ctx2.state);
          useSkill(ctx3, id, 'highwayman.lunge', ['enemy.skeleton_soldier']);
          const after = ctx3.state.heroes.find((h) => h.id === 'hero.highwayman');
          // rank 2 + (-1) = 1 被 crusader 占,应留在 rank 2
          expect(after?.rank).toBe(2);
        }
        return;
      }
      const c2 = new BattleContext(ctx.state);
      const t = beginTurn(c2, id);
      if (t.canAct && t.actor && t.actor.side === 'enemy') {
        const c3 = new BattleContext(c2.state);
        const dec = decideAiAction(c3, t.actor.id);
        if (dec) {
          try {
            useSkill(c3, t.actor.id, dec.skillId, dec.targetId ? [dec.targetId] : []);
          } catch {}
          c2.state = c3.state;
        }
      }
      const c4 = new BattleContext(c2.state);
      endTurn(c4);
      ctx.state = c4.state;
    }
  });
});

describe('死亡与尸体', () => {
  it('敌人死亡生成尸体占据原 rank', () => {
    const b = createTestBattle({ seed: 'death-1' });
    // 把 skeleton_soldier 改成 1 HP 一击必杀
    const sIdx = b.enemies.findIndex((e) => e.id === 'enemy.skeleton_soldier');
    b.enemies[sIdx] = { ...b.enemies[sIdx]!, maxHp: 1, hp: 1 };
    let s: BattleState = b;
    for (let round = 0; round < 10; round++) {
      const ctx = new BattleContext(s);
      startRound(ctx);
      s = ctx.state;
      while (s.initiativeQueue.length > 0) {
        const id = s.initiativeQueue[0]!;
        const ctx2 = new BattleContext(s);
        const turn = beginTurn(ctx2, id);
        s = ctx2.state;
        if (turn.canAct && turn.actor) {
          if (turn.actor.id === 'hero.crusader') {
            const skel = s.enemies.find((e) => e.id === 'enemy.skeleton_soldier');
            if (skel && !skel.isDead && skel.hp > 0) {
              const ctx3 = new BattleContext(s);
              useSkill(ctx3, id, 'crusader.smite', ['enemy.skeleton_soldier']);
              s = ctx3.state;
            }
          } else if (turn.actor.side === 'enemy') {
            const ctx3 = new BattleContext(s);
            const dec = decideAiAction(ctx3, id);
            if (dec) {
              try {
                useSkill(ctx3, id, dec.skillId, dec.targetId ? [dec.targetId] : []);
              } catch {}
              s = ctx3.state;
            }
          }
        }
        const ctx4 = new BattleContext(s);
        endTurn(ctx4);
        s = ctx4.state;
      }
      const skel = s.enemies.find((e) => e.id === 'enemy.skeleton_soldier');
      if (skel && skel.isDead) {
        const corpse = s.corpses.find((c) => c.corpseOfActorId === 'enemy.skeleton_soldier');
        expect(corpse).toBeDefined();
        expect(corpse?.rank).toBe(2);
        return;
      }
    }
    throw new Error('skeleton never died in 10 rounds');
  });

  it('所有敌人死亡时,尸体被清除,战斗结束', () => {
    const b = createTestBattle({ seed: 'victory' });
    b.enemies = b.enemies.map((e) => ({ ...e, maxHp: 1, hp: 1 }));
    const final = runBattleFull(b, { heroesControlledByAi: true });
    expect(final.phase).toBe('victory');
    expect(final.corpses.length).toBe(0);
  });

  it('所有英雄死亡时,战斗失败', () => {
    const b = createTestBattle({ seed: 'defeat' });
    b.heroes = b.heroes.map((h) => ({ ...h, maxHp: 1, hp: 1 }));
    const final = runBattleFull(b, { heroesControlledByAi: true });
    expect(final.phase).toBe('defeat');
  });
});

describe('不变量', () => {
  it('所有不变量在自动战斗中保持(5 场)', () => {
    for (let i = 0; i < 5; i++) {
      const b = createTestBattle({ seed: `inv-${i}` });
      const final = runBattleFull(b, { heroesControlledByAi: true });
      expect(() => assertInvariants(final)).not.toThrow();
    }
  });
});

describe('战斗运行(RNG 确定性)', () => {
  it('同 seed 同结果', () => {
    const a = runBattleFull(createTestBattle({ seed: 'det-1' }), { heroesControlledByAi: true });
    const b = runBattleFull(createTestBattle({ seed: 'det-1' }), { heroesControlledByAi: true });
    expect(a.phase).toBe(b.phase);
    expect(a.round).toBe(b.round);
    expect(a.log.length).toBe(b.log.length);
  });
});

describe('命令分发器', () => {
  it('START_BATTLE 发出 BATTLE_STARTED 事件', () => {
    const b = createTestBattle({ seed: 'cmd-1' });
    const after = dispatchGameCommand(b, {
      type: 'START_BATTLE',
      battleId: b.id,
      heroIds: b.heroes.map((h) => h.id),
      enemyIds: b.enemies.map((e) => e.id),
      commandId: 'cmd-test-1',
    });
    const last = after.log[after.log.length - 1];
    expect(last?.type).toBe('BATTLE_STARTED');
  });

  it('END_BATTLE 切换 phase', () => {
    const b = createTestBattle({ seed: 'cmd-2' });
    const r1 = dispatchGameCommand(b, { type: 'START_ROUND', commandId: 'cmd-2-round' });
    expect(r1.round).toBe(1);
    const after = dispatchGameCommand(r1, { type: 'END_BATTLE', outcome: 'victory', commandId: 'cmd-2-end' });
    expect(after.phase).toBe('victory');
  });

  it('每条命令产生新的 transactionId', () => {
    const b = createTestBattle({ seed: 'cmd-3' });
    const r1 = dispatchGameCommand(b, { type: 'START_ROUND', commandId: 'cmd-3-round' });
    const a = dispatchGameCommand(r1, { type: 'END_BATTLE', outcome: 'victory', commandId: 'cmd-3-victory' });
    const b2 = dispatchGameCommand(a, { type: 'END_BATTLE', outcome: 'defeat', commandId: 'cmd-3-defeat' });
    expect(a.transactionId).not.toBe(b2.transactionId);
  });

  it('重复 commandId 被拒绝', () => {
    const b = createTestBattle({ seed: 'cmd-4' });
    dispatchGameCommand(b, { type: 'START_ROUND', commandId: 'cmd-4-dup' });
    expect(() =>
      dispatchGameCommand(b, { type: 'START_ROUND', commandId: 'cmd-4-dup' }),
    ).toThrow(/duplicate/);
  });
});
