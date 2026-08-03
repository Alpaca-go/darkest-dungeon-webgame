/**
 * 成长深化管理(SPEC §9)
 *
 * 升级流程:
 *  1. 远征结算触发 cmdGrantXp
 *  2. manager.addXp → levelFromXp 算当前等级
 *  3. 与 hero.resolveLevel 比较 → 触发 HERO_RESOLVE_LEVEL_INCREASED
 *  4. 武器/护甲/技能等级独立(升级命令单独调)
 */

import type { HeroInstance } from '../expedition/types.js';
import { MAX_LEVEL, levelFromXp, totalXpForLevel, xpToNextLevel, levelCoef } from './types.js';

export interface XpGrantResult {
  newTotalXp: number;
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
}

/** 增加 XP 并触发升级 */
export function addXp(hero: HeroInstance, amount: number): XpGrantResult {
  if (amount <= 0) return { newTotalXp: hero.xp ?? 0, oldLevel: hero.resolveLevel ?? 0, newLevel: hero.resolveLevel ?? 0, levelsGained: 0 };
  const oldXp = hero.xp ?? 0;
  const newXp = Math.min(totalXpForLevel(MAX_LEVEL), oldXp + amount);
  hero.xp = newXp;
  const oldLevel = hero.resolveLevel ?? 0;
  const newLevel = levelFromXp(newXp);
  hero.resolveLevel = newLevel;
  return {
    newTotalXp: newXp,
    oldLevel,
    newLevel,
    levelsGained: newLevel - oldLevel,
  };
}

/** 技能/武器/护甲等级(统一 0-4) */
export type UpgradeSlot = 'skill' | 'weapon' | 'armor';

export interface UpgradeResult {
  ok: boolean;
  reason?: string;
  newLevel: number;
  costGold: number;
}

/** 升级某槽位(技能/武器/护甲) */
export function upgradeHeroSlot(
  hero: HeroInstance,
  slot: UpgradeSlot,
  skillId: string | null,
  baseCost: number,
  facilityLevel: number = 1,
): UpgradeResult {
  const currentLevel = readSlotLevel(hero, slot, skillId);
  if (currentLevel >= MAX_LEVEL) {
    return { ok: false, reason: `${slot} already maxed (level ${currentLevel})`, newLevel: currentLevel, costGold: 0 };
  }
  // 费用 = 基础 × 等级系数 × 设施系数
  const lvlCoef = levelCoef(currentLevel);
  const facCoef = Math.max(0.5, 1 - 0.1 * Math.max(0, facilityLevel - 1));
  const cost = Math.floor(baseCost * lvlCoef * facCoef);
  writeSlotLevel(hero, slot, skillId, currentLevel + 1);
  return { ok: true, newLevel: currentLevel + 1, costGold: cost };
}

/** 读槽位等级 */
export function readSlotLevel(hero: HeroInstance, slot: UpgradeSlot, skillId: string | null): number {
  if (slot === 'skill') {
    if (!skillId) return 0;
    return hero.skillLevels?.[skillId] ?? 0;
  }
  if (slot === 'weapon') return hero.weaponLevel ?? 0;
  if (slot === 'armor') return hero.armorLevel ?? 0;
  return 0;
}

/** 写槽位等级 */
function writeSlotLevel(hero: HeroInstance, slot: UpgradeSlot, skillId: string | null, level: number): void {
  if (slot === 'skill') {
    if (!skillId) return;
    if (!hero.skillLevels) hero.skillLevels = {};
    hero.skillLevels[skillId] = level;
    return;
  }
  if (slot === 'weapon') {
    hero.weaponLevel = level;
    return;
  }
  if (slot === 'armor') {
    hero.armorLevel = level;
    return;
  }
}

/** 列出 hero 全部技能等级 */
export function listHeroSkillLevels(hero: HeroInstance): Record<string, number> {
  return { ...(hero.skillLevels ?? {}) };
}

export { MAX_LEVEL, levelFromXp, totalXpForLevel, xpToNextLevel, levelCoef };
