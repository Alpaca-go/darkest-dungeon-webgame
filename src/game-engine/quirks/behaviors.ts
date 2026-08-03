/**
 * 怪癖强迫行为(SPEC §4.4)
 *
 * 怪癖行为 cooldown 状态:
 *  - 每个 hero 的每个 quirkId+trigger 独立冷却
 *  - cooldownDecisions 决策数后冷却重置
 *  - 决策数由调用方提供(每做出一个选择 -1)
 *
 * 行为查询:
 *  - getActiveQuirkBehaviors(hero, trigger):返回当前可触发的怪癖行为
 *  - applyQuirkBehavior(ctx, hero, quirkId, behavior):执行一个怪癖行为
 */

import type { HeroInstance } from '../expedition/types.js';
import { getQuirkDef } from './registry.js';
import type { QuirkBehaviorDefinition } from './types.js';

/** cooldown 状态(hero.quirkBehaviorCooldowns) */
export interface QuirkCooldownState {
  /** key = `${quirkId}:${trigger}`,value = 剩余冷却决策数 */
  [key: string]: number;
}

/** 获取所有当前可触发的怪癖行为(冷却检查 + 概率) */
export function getActiveQuirkBehaviors(
  hero: HeroInstance,
  trigger: string,
  cooldowns: QuirkCooldownState = {},
): Array<{ quirkId: string; behavior: QuirkBehaviorDefinition }> {
  const all = [...(hero.positiveQuirkIds ?? []), ...(hero.negativeQuirkIds ?? [])];
  const active: Array<{ quirkId: string; behavior: QuirkBehaviorDefinition }> = [];
  for (const qid of all) {
    const def = getQuirkDef(qid);
    if (!def) continue;
    for (const b of def.behaviors) {
      if (b.trigger !== trigger) continue;
      const cdKey = `${qid}:${b.trigger}`;
      const remaining = cooldowns[cdKey] ?? 0;
      if (remaining > 0) continue;
      // 概率检查由调用方做(需要 Seeded RNG)
      active.push({ quirkId: qid, behavior: b });
    }
  }
  return active;
}

/** 触发后更新冷却 */
export function triggerQuirkCooldown(
  cooldowns: QuirkCooldownState,
  quirkId: string,
  trigger: string,
  decisions: number,
): void {
  const key = `${quirkId}:${trigger}`;
  cooldowns[key] = decisions;
}

/** 每个决策后 -1 冷却 */
export function tickQuirkCooldowns(cooldowns: QuirkCooldownState): void {
  for (const k of Object.keys(cooldowns)) {
    cooldowns[k] = (cooldowns[k] ?? 0) - 1;
    if (cooldowns[k]! <= 0) {
      delete cooldowns[k];
    }
  }
}
