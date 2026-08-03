/**
 * 精神系统入口(SPEC §4-§16)
 *
 * 加载顺序:
 *   1. death-engine.ts(无依赖,先注册 handler 槽)
 *   2. stress-engine.ts(引用 death-engine,提供 applyStress / triggerResolveCheck / triggerHeartAttack)
 *   3. 本文件 index:把 stress-engine 的意志检定 / 心脏病 注入 death-engine 的 handler
 *   4. behaviors.ts(引用 stress-engine)
 *
 * 导出给上层 choice-resolver / dispatcher / encounter-resolver 用。
 */

import type { ExpeditionContext } from '../expedition/context.js';
import type { HeroInstance } from '../expedition/types.js';

// 1. 先注册 death-engine 的 handler 槽
import { registerMentalHandlers } from './death-engine.js';
import { triggerResolveCheck, triggerHeartAttack } from './stress-engine.js';
registerMentalHandlers(triggerResolveCheck, triggerHeartAttack);

// 2. 重新导出
export * from './afflictions.js';
export * from './virtues.js';
export * from './stress-engine.js';
export * from './death-engine.js';
export * from './behaviors.js';

// 3. 简化的对外接口
export interface ResolveCheckOutcome {
  heroId: string;
  stress: number;
  virtueChance: number;
  result: 'afflicted' | 'virtuous';
  afflictionId?: string;
  virtueId?: string;
}

/**
 * 意志检定的对外接口(给 dispatcher 用)。
 * 直接包装 stress-engine 的 triggerResolveCheck。
 */
export function runResolveCheck(ctx: ExpeditionContext, hero: HeroInstance): void {
  triggerResolveCheck(ctx, hero);
}

/**
 * 心脏病对外接口(给 dispatcher 用)。
 */
export function runHeartAttack(ctx: ExpeditionContext, hero: HeroInstance): void {
  triggerHeartAttack(ctx, hero);
}
