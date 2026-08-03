/**
 * 属性测试
 *
 * 文档要求(24.2):
 * - HP 不低于 0
 * - 压力保持 0—200 或规则允许的结算中间态(Phase 0 不含压力)
 * - 同一站位不能存在两个单格单位
 * - 死亡单位不能作为合法行动者
 * - 背包使用量不能超过容量(Phase 0 不含背包)
 * - 火把保持 0—100(Phase 0 不含火把)
 * - 同一事件一次性标记不能重复(Phase 0 不含事件)
 * - 当前行动者必须存在于行动队列
 */

import { describe, it, expect } from 'vitest';
import { createTestBattle } from '../src/content/factories.js';
import { runBattleFull } from '../src/game-engine/battle/loop.js';
import { assertInvariants } from '../src/game-engine/index.js';
import type { BattleActor, BattleState, Rank } from '../src/game-engine/types.js';

describe('属性测试 - 多场战斗后状态合法', () => {
  it('HP 始终在 [0, maxHp]', () => {
    for (let i = 0; i < 20; i++) {
      const b = createTestBattle({ seed: `prop-hp-${i}` });
      const final = runBattleFull(b, { heroesControlledByAi: true });
      for (const a of [...final.heroes, ...final.enemies]) {
        expect(a.hp).toBeGreaterThanOrEqual(0);
        expect(a.hp).toBeLessThanOrEqual(a.maxHp);
        expect(Number.isFinite(a.hp)).toBe(true);
        expect(Number.isFinite(a.maxHp)).toBe(true);
      }
      for (const c of final.corpses) {
        expect(c.hp).toBe(0);
        expect(c.isDead).toBe(true);
        expect(c.kind).toBe('corpse');
      }
    }
  });

  it('同一阵营同一站位至多一个非尸体单位', () => {
    for (let i = 0; i < 20; i++) {
      const b = createTestBattle({ seed: `prop-rank-${i}` });
      const final = runBattleFull(b, { heroesControlledByAi: true });
      checkUniqueness(final, final.heroes, 'ally');
      checkUniqueness(final, final.enemies, 'enemy');
    }
  });

  it('死亡单位不在行动队列', () => {
    for (let i = 0; i < 20; i++) {
      const b = createTestBattle({ seed: `prop-dead-${i}` });
      const final = runBattleFull(b, { heroesControlledByAi: true });
      const allIds = new Set([
        ...final.heroes.map((a) => a.id),
        ...final.enemies.map((a) => a.id),
        ...final.corpses.map((a) => a.id),
      ]);
      for (const id of final.initiativeQueue) {
        expect(allIds.has(id)).toBe(true);
        const a = findActorById(final, id);
        expect(a).toBeDefined();
        expect(a!.isDead).toBe(false);
        expect(a!.kind).not.toBe('corpse');
      }
    }
  });

  it('战斗结束时 activeActorId 为 null', () => {
    for (let i = 0; i < 20; i++) {
      const b = createTestBattle({ seed: `prop-active-${i}` });
      const final = runBattleFull(b, { heroesControlledByAi: true });
      if (final.phase === 'victory' || final.phase === 'defeat') {
        expect(final.activeActorId).toBeNull();
      }
    }
  });

  it('rng 始终是有限 32-bit 整数', () => {
    for (let i = 0; i < 20; i++) {
      const b = createTestBattle({ seed: `prop-rng-${i}` });
      const final = runBattleFull(b, { heroesControlledByAi: true });
      expect(Number.isInteger(final.rng.state)).toBe(true);
      expect(final.rng.state).toBeGreaterThanOrEqual(0);
      expect(final.rng.state).toBeLessThan(2 ** 32);
    }
  });

  it('日志 sequence 单调递增', () => {
    for (let i = 0; i < 20; i++) {
      const b = createTestBattle({ seed: `prop-seq-${i}` });
      const final = runBattleFull(b, { heroesControlledByAi: true });
      let last = 0;
      for (const e of final.log) {
        expect(e.sequence).toBeGreaterThan(last);
        last = e.sequence;
      }
    }
  });

  it('不变量始终通过', () => {
    for (let i = 0; i < 20; i++) {
      const b = createTestBattle({ seed: `prop-inv-${i}` });
      const final = runBattleFull(b, { heroesControlledByAi: true });
      expect(() => assertInvariants(final)).not.toThrow();
    }
  });
});

function checkUniqueness(state: BattleState, list: BattleActor[], side: string): void {
  const seen = new Set<Rank>();
  for (const a of list) {
    if (a.isDead || a.kind === 'corpse') continue;
    expect(seen.has(a.rank)).toBe(false);
    seen.add(a.rank);
  }
  // 站位至多 4 个
  expect(seen.size).toBeLessThanOrEqual(4);
  // 站位值在 1-4
  for (const r of seen) {
    expect(r).toBeGreaterThanOrEqual(1);
    expect(r).toBeLessThanOrEqual(4);
  }
  // 战斗结束时可能一边全灭,seen.size 可能是 0 - 这是合法的
  if (state.phase === 'victory' || state.phase === 'defeat') {
    return;
  }
  // 进行中至少要有一个活着的(否则游戏应该已经结束)
  if (seen.size === 0) {
    expect(state.phase === 'victory' || state.phase === 'defeat').toBe(true);
  }
  void side;
}

function findActorById(state: BattleState, id: string): BattleActor | undefined {
  return (
    state.heroes.find((a) => a.id === id) ??
    state.enemies.find((a) => a.id === id) ??
    state.corpses.find((a) => a.id === id)
  );
}
