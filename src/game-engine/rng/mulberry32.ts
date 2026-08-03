/**
 * Mulberry32:32-bit 状态 PRNG,周期约 2^32,质量够用且实现极简。
 * 文档:https://gist.github.com/tommyettinger/46a3a64aa90f02ee9eb1e0d2c95406de
 */

import type { Rng, RngState } from './types.js';

const ALGO = 'mulberry32' as const;

function stringToSeed(input: string): number {
  // FNV-1a 32-bit,作为字符串种子的初始状态
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // 保证非零
  return h >>> 0 || 0x9e3779b9;
}

export class Mulberry32 implements Rng {
  private stateValue: number;

  constructor(state: number | string) {
    this.stateValue = typeof state === 'string' ? stringToSeed(state) : (state >>> 0);
    if (this.stateValue === 0) {
      this.stateValue = 0x9e3779b9;
    }
  }

  get state(): RngState {
    return { algorithm: ALGO, state: this.stateValue };
  }

  /** 推进状态并返回新 raw 32-bit 值 */
  private step(): number {
    this.stateValue = (this.stateValue + 0x6d2b79f5) >>> 0;
    let t = this.stateValue;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  nextFloat(): number {
    return this.step() / 0x1_0000_0000;
  }

  nextInt(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error('nextInt requires integer bounds');
    }
    if (max < min) {
      throw new Error(`nextInt: max (${max}) < min (${min})`);
    }
    const range = max - min + 1;
    // 取 32-bit,然后 mod 范围
    const r = this.step() % range;
    return min + r;
  }

  chance(p: number): boolean {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.nextFloat() < p;
  }

  weighted<T>(items: T[], weight: (item: T) => number): T {
    if (items.length === 0) {
      throw new Error('weighted: empty items');
    }
    const weights = items.map((it) => {
      const w = weight(it);
      if (w < 0) throw new Error('weighted: negative weight not allowed');
      return w;
    });
    const total = weights.reduce((acc, w) => acc + w, 0);
    if (total <= 0) {
      throw new Error('weighted: total weight must be positive');
    }
    let pick = this.nextFloat() * total;
    for (let i = 0; i < items.length; i++) {
      const w = weights[i]!;
      pick -= w;
      if (pick < 0) {
        return items[i]!;
      }
    }
    return items[items.length - 1]!;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('pick: empty items');
    }
    const idx = this.nextInt(0, items.length - 1);
    return items[idx]!;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }

  fork(): Rng {
    // 用下一步的 raw 值作为 fork 的种子
    const seed = this.step();
    return new Mulberry32(seed);
  }
}
