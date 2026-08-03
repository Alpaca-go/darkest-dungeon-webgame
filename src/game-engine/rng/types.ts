/**
 * RNG 类型定义
 *
 * 设计目标：
 * - 完全可注入,所有业务规则不得直接调用 Math.random()
 * - 状态可序列化,方便存档恢复
 * - 同 Seed 同序列产生同结果
 */

/** 序列化后的 RNG 状态(可放入存档) */
export interface RngState {
  /** 算法标识,用于未来切换算法时迁移 */
  algorithm: 'mulberry32';
  /** 内部状态(一个 32-bit 无符号整数) */
  state: number;
}

/** RNG 行为接口(由 mulberry32 实现) */
export interface Rng {
  /** 状态(只读快照) */
  readonly state: RngState;

  /** 返回 [0, 1) 的浮点 */
  nextFloat(): number;

  /** 返回 [min, max] 的整数 */
  nextInt(min: number, max: number): number;

  /** 二项式:成功概率 p,返回布尔 */
  chance(p: number): boolean;

  /** 从数组中加权随机(权重为正数) */
  weighted<T>(items: T[], weight: (item: T) => number): T;

  /** 从数组中等概率抽取一项 */
  pick<T>(items: readonly T[]): T;

  /** 打乱数组(Fisher-Yates)并返回新数组 */
  shuffle<T>(items: readonly T[]): T[];

  /** 返回下一个 RNG,共享类型但状态独立 */
  fork(): Rng;
}
