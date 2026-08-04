/**
 * 区域威胁系统(Phase 6A,SPEC §6)
 *
 * 职责:
 *  - threatValue 0-100 clamp(SPEC §27 不变量)
 *  - threatValue → RegionThreatState 阈值映射
 *  - 周增长 / 任务失败 / 任务完成 / Boss 击败 等影响函数
 *  - 纯函数,不依赖 dispatcher
 */

import type {
  RegionThreatProgress,
  RegionThreatState,
} from './types.js';
import type { RegionId } from '../regions/types.js';

// =====================================================================
// 阈值(SPEC §6.1)
// =====================================================================

/** dormant 0-19, stirring 20-39, active 40-59, uncontrolled 60-79, boss-revealed 80-100 */
const THRESHOLDS: Array<{ state: RegionThreatState; min: number; max: number }> = [
  { state: 'dormant', min: 0, max: 19 },
  { state: 'stirring', min: 20, max: 39 },
  { state: 'active', min: 40, max: 59 },
  { state: 'uncontrolled', min: 60, max: 79 },
  { state: 'boss-revealed', min: 80, max: 100 },
];

/**
 * threatValue → RegionThreatState
 * boss-defeated 是终态,需由调用方单独处理
 */
export function stateFromThreatValue(value: number, regionDefeated: boolean): RegionThreatState {
  if (regionDefeated) return 'boss-defeated';
  const clamped = clampThreatValue(value);
  for (const t of THRESHOLDS) {
    if (clamped >= t.min && clamped <= t.max) return t.state;
  }
  return 'dormant';
}

/**
 * 0-100 clamp(SPEC §27 不变量: "区域威胁不得低于 0 或高于 100")
 * NaN 视为 0;Infinity 视为 100(等同上限)
 */
export function clampThreatValue(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value === Infinity) return 100;
  if (value === -Infinity) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

// =====================================================================
// 工厂
// =====================================================================

export function createEmptyRegionThreat(regionId: RegionId): RegionThreatProgress {
  return {
    regionId,
    state: 'dormant',
    threatValue: 0,
    weeklyGrowth: 0,
    activeThreatModifierIds: [],
  };
}

// =====================================================================
// 影响函数
// =====================================================================

/**
 * 应用威胁增长/下降(原子操作)
 * 来源:任务失败、撤退、忽略区域等
 */
export function applyThreatDelta(
  progress: RegionThreatProgress,
  delta: number,
  modifierIds: string[] = [],
): RegionThreatProgress {
  const newValue = clampThreatValue(progress.threatValue + delta);
  return {
    ...progress,
    threatValue: newValue,
    state: stateFromThreatValue(newValue, progress.state === 'boss-defeated'),
    activeThreatModifierIds: [
      ...progress.activeThreatModifierIds.filter((id) => !modifierIds.includes(id)),
      ...modifierIds,
    ],
  };
}

/**
 * 区域 Boss 击败 → 威胁大幅下降(SPEC §17,推荐 -60)
 * 状态改为 boss-defeated
 */
export function applyBossDefeatThreatReduction(
  progress: RegionThreatProgress,
  reduction: number = 60,
): RegionThreatProgress {
  return {
    ...progress,
    threatValue: clampThreatValue(progress.threatValue - reduction),
    state: 'boss-defeated',
    weeklyGrowth: 0,
    activeThreatModifierIds: [],
  };
}

/**
 * 周推进:应用 weeklyGrowth + 失败/忽略累积
 * SPEC §6.2: "忽略活跃区域数周" 也会增长
 */
export function advanceWeek(
  progress: RegionThreatProgress,
): RegionThreatProgress {
  return applyThreatDelta(progress, progress.weeklyGrowth);
}

/**
 * 区域任务完成 → 威胁下降(SPEC §6.3)
 */
export function applyQuestSuccess(
  progress: RegionThreatProgress,
  reduction: number = 5,
): RegionThreatProgress {
  return applyThreatDelta(progress, -reduction);
}

/**
 * 区域任务失败 / 撤退 / Boss 撤退 → 威胁上升(SPEC §6.2)
 */
export function applyQuestFailure(
  progress: RegionThreatProgress,
  increase: number = 8,
): RegionThreatProgress {
  return applyThreatDelta(progress, increase);
}

/**
 * 调查任务完成 → 威胁小降(SPEC §6.3)
 */
export function applyInvestigationComplete(
  progress: RegionThreatProgress,
  reduction: number = 3,
): RegionThreatProgress {
  return applyThreatDelta(progress, -reduction);
}

/**
 * 削弱任务完成 → 威胁小降
 */
export function applyWeakeningComplete(
  progress: RegionThreatProgress,
  reduction: number = 5,
): RegionThreatProgress {
  return applyThreatDelta(progress, -reduction);
}

// =====================================================================
// 不变量校验
// =====================================================================

/**
 * SPEC §27 不变量: "区域威胁不得低于 0 或高于 100"
 */
export function isThreatValid(progress: RegionThreatProgress): boolean {
  return progress.threatValue >= 0 && progress.threatValue <= 100
    && Number.isInteger(progress.threatValue);
}
