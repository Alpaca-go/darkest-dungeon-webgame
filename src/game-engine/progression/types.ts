/**
 * 成长深化类型(SPEC §9 Phase 4)
 *
 * Phase 1/2 已经把 weaponLevel/armorLevel/skillLevels/resolveLevel 上限定为 0-2。
 * Phase 4 扩展为 0-4,加 XP 曲线让远征结算提升等级。
 *
 * 设计目标:
 *  - 数据驱动,UI 不硬编码阈值
 *  - 经验 → 等级 → 治疗费用 影响
 *  - 等级变化触发 Domain Event
 */

export const MAX_LEVEL = 4;

/** XP 曲线(SPEC §9.1) */
export const XP_CURVE: readonly number[] = [0, 2, 5, 9, 14] as const;
// XP_CURVE[0] = 0 起始
// XP_CURVE[1] = 2:0 → 1 需 2 XP
// XP_CURVE[2] = 5:1 → 2 需 5 XP
// XP_CURVE[3] = 9:2 → 3 需 9 XP
// XP_CURVE[4] = 14:3 → 4 需 14 XP

/** 升级所需总 XP(从 0 算起): level N 需要 XP_CURVE[N] 总经验 */
export function totalXpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level >= MAX_LEVEL) return XP_CURVE[MAX_LEVEL]!;
  return XP_CURVE[level]!;
}

/** 根据总 XP 算当前等级 */
export function levelFromXp(totalXp: number): number {
  let lvl = 0;
  for (let i = 1; i <= MAX_LEVEL; i += 1) {
    if (totalXp >= XP_CURVE[i]!) lvl = i;
  }
  return lvl;
}

/** 升到下一级还需要的 XP(已满级 = 0) */
export function xpToNextLevel(totalXp: number): number {
  const cur = levelFromXp(totalXp);
  if (cur >= MAX_LEVEL) return 0;
  return (XP_CURVE[cur + 1] ?? 0) - totalXp;
}

/** 等级系数(用于治疗费用 / 奖励) */
export function levelCoef(level: number): number {
  return 1 + 0.2 * level;
}
