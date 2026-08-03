/**
 * 怪癖系统类型(SPEC §3-§4 Phase 4)
 *
 * 怪癖(Quirk)是英雄的长期个性:
 *  - 最多 5 个正面 + 5 个负面
 *  - 正面可锁定(疗养院),锁定后不被替换
 *  - 部分带强迫行为,触发时影响选择
 *
 * 怪癖 vs 折磨/美德(Phase 2):
 *  - 折磨/美德:临时压力状态(1-2 周,自动清除)
 *  - 怪癖:长期个性(永久,需疗养院移除/锁定)
 */

import type { HeroInstance } from '../expedition/types.js';

/** 怪癖类型 */
export type QuirkType = 'positive' | 'negative';

/** 怪癖触发器(SPEC §4.4) */
export type QuirkBehaviorTrigger =
  | 'on-route-choice'
  | 'on-curio-choice'
  | 'on-provision-use'
  | 'on-loot-choice'
  | 'on-camp-start'
  | 'on-camp-choice'
  | 'on-retreat-choice'
  | 'on-facility-selection';

/** 怪癖行为效果(SPEC §4.4) */
export type QuirkBehaviorEffect =
  | 'force-choice'         // 强制选择某选项
  | 'block-choice'         // 阻止选择某选项
  | 'replace-choice'       // 替换选项
  | 'consume-resource'     // 消耗资源
  | 'add-stress'           // 增加压力
  | 'modify-scouting'      // 修改侦察
  | 'modify-risk-preview'  // 修改风险预览
  | 'modify-treatment-eligibility'; // 修改治疗资格

/** 怪癖行为定义 */
export interface QuirkBehaviorDefinition {
  trigger: QuirkBehaviorTrigger;
  effect: QuirkBehaviorEffect;
  /** 0-1 触发概率 */
  baseChance: number;
  /** 冷却决策数(SPEC §4.4 推荐 2-4) */
  cooldownDecisions: number;
  /** 受影响 hero 选择器(若适用) */
  targetHeroSelector?: 'self' | 'lowest-hp' | 'front-rank' | 'back-rank';
  /** 描述 */
  description: string;
}

/** 怪癖定义 */
export interface QuirkDefinition {
  id: string;
  name: string;
  type: QuirkType;
  description: string;
  tags: string[];
  /** 行为列表(0+ 个) */
  behaviors: QuirkBehaviorDefinition[];
  /** 简短工具提示(对玩家可见) */
  flavor: string;
}

/** 怪癖获取结果 */
export type QuirkAcquireResult =
  | { ok: true; quirkId: string; replacedId?: string }
  | { ok: false; reason: string };

/** 怪癖移除结果 */
export type QuirkRemoveResult =
  | { ok: true; quirkId: string }
  | { ok: false; reason: string };

/** 怪癖锁定结果 */
export type QuirkLockResult =
  | { ok: true; quirkId: string }
  | { ok: false; reason: string };

/** 上限 */
export const QUIRK_MAX_POSITIVE = 5;
export const QUIRK_MAX_NEGATIVE = 5;

/** Hero 怪癖状态(SPEC §3.1) */
export interface HeroQuirkState {
  positiveQuirkIds: string[];
  negativeQuirkIds: string[];
  lockedPositiveQuirkIds: string[];
}

/** 从 HeroInstance 提取怪癖状态 */
export function readQuirkState(hero: HeroInstance): HeroQuirkState {
  return {
    positiveQuirkIds: [...(hero.positiveQuirkIds ?? [])],
    negativeQuirkIds: [...(hero.negativeQuirkIds ?? [])],
    lockedPositiveQuirkIds: [...(hero.lockedPositiveQuirkIds ?? [])],
  };
}
