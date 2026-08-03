/**
 * Seeded RNG 单元测试
 *
 * 覆盖:
 * - 同 seed 同结果
 * - 统计性质(均匀分布、范围)
 * - 状态序列化/反序列化
 * - fork 独立性
 */

import { describe, it, expect } from 'vitest';
import { Mulberry32 } from '../src/game-engine/rng/mulberry32.js';

describe('Mulberry32 RNG', () => {
  it('同 seed 产生同结果', () => {
    const a = new Mulberry32('test-seed');
    const b = new Mulberry32('test-seed');
    for (let i = 0; i < 100; i++) {
      expect(a.nextInt(1, 1000)).toBe(b.nextInt(1, 1000));
    }
  });

  it('不同 seed 产生不同结果', () => {
    const a = new Mulberry32('seed-a');
    const b = new Mulberry32('seed-b');
    let different = 0;
    for (let i = 0; i < 100; i++) {
      if (a.nextInt(1, 1000) !== b.nextInt(1, 1000)) different++;
    }
    expect(different).toBeGreaterThan(80);
  });

  it('nextInt 在范围内', () => {
    const rng = new Mulberry32('range-test');
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('nextInt 拒绝非法参数', () => {
    const rng = new Mulberry32('err-test');
    expect(() => rng.nextInt(10, 5)).toThrow();
    expect(() => rng.nextInt(1.5, 5)).toThrow();
  });

  it('nextFloat 在 [0, 1)', () => {
    const rng = new Mulberry32('float-test');
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('chance 边界', () => {
    const rng = new Mulberry32('chance-test');
    // p=0 永远 false
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('chance(0.5) 大致 50%', () => {
    const rng = new Mulberry32('chance-dist');
    let hits = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      if (rng.chance(0.5)) hits++;
    }
    const ratio = hits / N;
    expect(ratio).toBeGreaterThan(0.47);
    expect(ratio).toBeLessThan(0.53);
  });

  it('weighted 偏向高权重', () => {
    const rng = new Mulberry32('weighted-test');
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 3000; i++) {
      const picked = rng.weighted(
        [
          { id: 'a' },
          { id: 'b' },
          { id: 'c' },
        ],
        (it) => (it.id === 'a' ? 1 : it.id === 'b' ? 2 : 5),
      );
      counts[picked.id]!++;
    }
    expect(counts['c']!).toBeGreaterThan(counts['a']!);
    expect(counts['c']!).toBeGreaterThan(counts['b']!);
  });

  it('pick 等概率', () => {
    const rng = new Mulberry32('pick-test');
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) {
      const v = rng.pick(['a', 'b']);
      counts[v]!++;
    }
    expect(Math.abs(counts['a']! - counts['b']!)).toBeLessThan(150);
  });

  it('shuffle 不丢失元素', () => {
    const rng = new Mulberry32('shuffle-test');
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = rng.shuffle(input);
    expect(shuffled.length).toBe(input.length);
    expect(shuffled.slice().sort((a, b) => a - b)).toEqual(input);
  });

  it('fork 产生独立(不同)的流', () => {
    const rng = new Mulberry32('fork-test');
    const a = rng.fork();
    const b = rng.fork();
    // 两次 fork 的种子来自不同 step,所以产生的流应该不同
    let different = 0;
    for (let i = 0; i < 50; i++) {
      if (a.nextInt(1, 10000) !== b.nextInt(1, 10000)) different++;
    }
    expect(different).toBeGreaterThan(40);
  });

  it('fork 与原 rng 独立', () => {
    const rng = new Mulberry32('fork-isolated');
    const forked = rng.fork();
    // 推进原 rng
    for (let i = 0; i < 100; i++) rng.nextInt(1, 10000);
    // fork 自己的流不应被原 rng 影响
    const before = forked.nextInt(1, 1000000);
    for (let i = 0; i < 100; i++) rng.nextInt(1, 10000);
    const after = forked.nextInt(1, 1000000);
    // 两次连续取不应该相等(高概率)
    expect(before).not.toBe(after);
  });

  it('状态可序列化/反序列化', () => {
    const rng = new Mulberry32('state-test');
    for (let i = 0; i < 10; i++) rng.nextInt(1, 1000);
    const state = rng.state;
    expect(state.algorithm).toBe('mulberry32');
    const restored = new Mulberry32(state.state);
    for (let i = 0; i < 50; i++) {
      expect(rng.nextInt(1, 1000)).toBe(restored.nextInt(1, 1000));
    }
  });

  it('同 state 字符串种子同结果', () => {
    const a = new Mulberry32('hello');
    const b = new Mulberry32('hello');
    for (let i = 0; i < 50; i++) {
      expect(a.nextInt(1, 10000)).toBe(b.nextInt(1, 10000));
    }
  });

  it('数字种子也可', () => {
    const a = new Mulberry32(12345);
    const b = new Mulberry32(12345);
    for (let i = 0; i < 50; i++) {
      expect(a.nextInt(1, 10000)).toBe(b.nextInt(1, 10000));
    }
  });
});
