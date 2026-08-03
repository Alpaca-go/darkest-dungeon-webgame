/**
 * 怪癖管理(SPEC §3 §4)
 *
 * 获得(granted by event / curio / 等):
 *  - 上限检查:达到上限 → 替换一个未锁定的怪癖
 *  - 全锁 → 拒绝获得
 *  - 同怪癖重复 → 跳过
 *
 * 移除(疗养院 quirk-removal):
 *  - 仅可移除未锁定的负向怪癖
 *
 * 锁定(疗养院 lock-positive):
 *  - 正面怪癖可锁定(避免被替换)
 */

import type { HeroInstance } from '../expedition/types.js';
import type {
  QuirkAcquireResult,
  QuirkLockResult,
  QuirkRemoveResult,
  QuirkDefinition,
} from './types.js';
import { QUIRK_MAX_POSITIVE, QUIRK_MAX_NEGATIVE } from './types.js';
import { getQuirkDef, isPositiveQuirk, isNegativeQuirk } from './registry.js';

/** 锁定一个正面怪癖 */
export function lockPositiveQuirk(hero: HeroInstance, quirkId: string): QuirkLockResult {
  if (!hero.positiveQuirkIds) hero.positiveQuirkIds = [];
  if (!hero.lockedPositiveQuirkIds) hero.lockedPositiveQuirkIds = [];
  if (!hero.positiveQuirkIds.includes(quirkId)) {
    return { ok: false, reason: 'hero does not have this positive quirk' };
  }
  if (hero.lockedPositiveQuirkIds.includes(quirkId)) {
    return { ok: true, quirkId }; // idempotent
  }
  hero.lockedPositiveQuirkIds.push(quirkId);
  return { ok: true, quirkId };
}

/** 解锁(取消锁定一个正面怪癖) */
export function unlockPositiveQuirk(hero: HeroInstance, quirkId: string): QuirkLockResult {
  if (!hero.lockedPositiveQuirkIds) hero.lockedPositiveQuirkIds = [];
  if (!hero.lockedPositiveQuirkIds.includes(quirkId)) {
    return { ok: true, quirkId }; // idempotent
  }
  hero.lockedPositiveQuirkIds = hero.lockedPositiveQuirkIds.filter((q) => q !== quirkId);
  return { ok: true, quirkId };
}

/** 移除一个负向怪癖 */
export function removeNegativeQuirk(hero: HeroInstance, quirkId: string): QuirkRemoveResult {
  if (!hero.negativeQuirkIds) hero.negativeQuirkIds = [];
  if (!hero.negativeQuirkIds.includes(quirkId)) {
    return { ok: false, reason: 'hero does not have this negative quirk' };
  }
  hero.negativeQuirkIds = hero.negativeQuirkIds.filter((q) => q !== quirkId);
  return { ok: true, quirkId };
}

/**
 * 尝试获得一个怪癖(SPEC §4.1 §4.2)
 *
 * 规则:
 *  - 同怪癖已有 → 跳过
 *  - 上限未满 → 直接加入
 *  - 上限已满 → 替换一个未锁定的同类型怪癖
 *  - 全部锁定 → 拒绝获得
 */
export function acquireQuirk(hero: HeroInstance, quirkId: string): QuirkAcquireResult {
  const def = getQuirkDef(quirkId);
  if (!def) return { ok: false, reason: `unknown quirk: ${quirkId}` };

  // 死英雄不接受怪癖
  if (hero.isDead) return { ok: false, reason: 'dead hero cannot gain quirks' };

  if (def.type === 'positive') {
    return acquirePositiveQuirk(hero, quirkId);
  }
  return acquireNegativeQuirk(hero, quirkId);
}

function acquirePositiveQuirk(hero: HeroInstance, quirkId: string): QuirkAcquireResult {
  if (!hero.positiveQuirkIds) hero.positiveQuirkIds = [];
  if (!hero.lockedPositiveQuirkIds) hero.lockedPositiveQuirkIds = [];

  if (hero.positiveQuirkIds.includes(quirkId)) {
    return { ok: true, quirkId }; // idempotent
  }
  if (hero.positiveQuirkIds.length < QUIRK_MAX_POSITIVE) {
    hero.positiveQuirkIds.push(quirkId);
    return { ok: true, quirkId };
  }
  // 上限满,找一个未锁定的替换
  const replaceIdx = hero.positiveQuirkIds.findIndex(
    (q) => !hero.lockedPositiveQuirkIds!.includes(q),
  );
  if (replaceIdx === -1) {
    return { ok: false, reason: 'all positive quirks locked' };
  }
  const replacedId = hero.positiveQuirkIds[replaceIdx]!;
  hero.positiveQuirkIds[replaceIdx] = quirkId;
  return { ok: true, quirkId, replacedId };
}

function acquireNegativeQuirk(hero: HeroInstance, quirkId: string): QuirkAcquireResult {
  if (!hero.negativeQuirkIds) hero.negativeQuirkIds = [];
  if (hero.negativeQuirkIds.includes(quirkId)) {
    return { ok: true, quirkId }; // idempotent
  }
  if (hero.negativeQuirkIds.length < QUIRK_MAX_NEGATIVE) {
    hero.negativeQuirkIds.push(quirkId);
    return { ok: true, quirkId };
  }
  // 上限满:负向怪癖无锁定概念,直接替换最早一个
  const replacedId = hero.negativeQuirkIds[0]!;
  hero.negativeQuirkIds = [quirkId, ...hero.negativeQuirkIds.slice(1)];
  return { ok: true, quirkId, replacedId };
}

/** 是否正/负怪癖(导出) */
export { isPositiveQuirk, isNegativeQuirk, getQuirkDef };

/** 列出 hero 所有可被替换的怪癖(未锁定的正面) */
export function listReplaceableQuirks(hero: HeroInstance): { positive: string[]; negative: string[] } {
  if (!hero.positiveQuirkIds) hero.positiveQuirkIds = [];
  if (!hero.negativeQuirkIds) hero.negativeQuirkIds = [];
  if (!hero.lockedPositiveQuirkIds) hero.lockedPositiveQuirkIds = [];
  return {
    positive: hero.positiveQuirkIds.filter((q) => !hero.lockedPositiveQuirkIds!.includes(q)),
    negative: [...hero.negativeQuirkIds],
  };
}

/** Quirk 行为查询 */
export function getQuirkBehaviors(
  hero: HeroInstance,
  trigger: string,
): Array<{ quirkId: string; behavior: QuirkDefinition['behaviors'][number] }> {
  const all = [...(hero.positiveQuirkIds ?? []), ...(hero.negativeQuirkIds ?? [])];
  const matches: Array<{ quirkId: string; behavior: QuirkDefinition['behaviors'][number] }> = [];
  for (const qid of all) {
    const def = getQuirkDef(qid);
    if (!def) continue;
    for (const b of def.behaviors) {
      if (b.trigger === trigger) {
        matches.push({ quirkId: qid, behavior: b });
      }
    }
  }
  return matches;
}
