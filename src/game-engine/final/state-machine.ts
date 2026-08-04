/**
 * Phase 7A: 最终任务链状态机(SPEC §5 §18.1)
 *
 * 4 阶段推进:
 *  - gate-opening    开启入口(消耗 Boss 遗物)
 *  - outer-expedition 穿越外层
 *  - seal-destruction 摧毁 3 个核心封印(可任意顺序)
 *  - final-assault    最终讨伐
 *
 * 不可逆(SPEC §19):阶段只能向前推进,不允许回到已完成的阶段。
 * 封印去重:destroySeal 同一 sealId 第二次调用返回 error。
 * 任务物品去重:grantFinalQuestItem 同一 itemId 第二次调用返回 error。
 */

import type {
  FinalCampaignState,
} from './types.js';
import { createEmptyFinalCampaignState } from './types.js';

// =====================================================================
// 状态机结果(类似 boss/state-machine.ts)
// =====================================================================

export interface FinalCampaignReducerResult {
  state: FinalCampaignState;
  events: string[];
  errors: string[];
}

function ok(state: FinalCampaignState, events: string[] = []): FinalCampaignReducerResult {
  return { state, events, errors: [] };
}

function fail(state: FinalCampaignState, error: string): FinalCampaignReducerResult {
  return { state, events: [], errors: [error] };
}

// =====================================================================
// 工厂(直接 re-export types.ts 的版本)
// =====================================================================

export function createInitialFinalCampaignState(): FinalCampaignState {
  return createEmptyFinalCampaignState();
}

// =====================================================================
// 状态机操作
// =====================================================================

/**
 * 检查是否可以解锁最终战役(SPEC §4:三 Boss 击败 + finalCampaignGateReady)
 */
export function canOpenFinalCampaignGate(args: {
  defeatedBossIds: string[];
  finalCampaignGateReady: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (args.defeatedBossIds.length < 3) {
    return { ok: false, reason: `已击败 Boss 数量不足(当前 ${args.defeatedBossIds.length},需要 3)` };
  }
  if (!args.finalCampaignGateReady) {
    return { ok: false, reason: 'finalCampaignGateReady 不为 true' };
  }
  return { ok: true };
}

/**
 * OPEN_FINAL_CAMPAIGN_GATE:locked → gate-ready
 */
export function openFinalCampaignGate(
  state: FinalCampaignState,
  args: { defeatedBossIds: string[]; finalCampaignGateReady: boolean; week: number },
): FinalCampaignReducerResult {
  if (state.status !== 'locked') {
    return fail(state, `当前状态 ${state.status} 不可开启入口`);
  }
  const check = canOpenFinalCampaignGate(args);
  if (!check.ok) {
    return fail(state, check.reason);
  }
  return ok(
    {
      ...state,
      status: 'gate-ready',
    },
    ['FinalCampaignGateOpened'],
  );
}

/**
 * START_FINAL_OUTER_QUEST:gate-ready → gate-open
 * 实际开启外层远征(消耗 Boss 遗物 +1 周)
 */
export function startFinalOuterQuest(
  state: FinalCampaignState,
  args: { week: number },
): FinalCampaignReducerResult {
  if (state.status !== 'gate-ready') {
    return fail(state, `当前状态 ${state.status} 不可开始外层`);
  }
  return ok(
    {
      ...state,
      status: 'gate-open',
      gateOpenedAtWeek: args.week,
    },
    ['FinalOuterQuestStarted'],
  );
}

/**
 * COMPLETE_FINAL_OUTER_QUEST:gate-open → outer-complete
 */
export function completeFinalOuterQuest(
  state: FinalCampaignState,
  args: { week: number },
): FinalCampaignReducerResult {
  if (state.status !== 'gate-open') {
    return fail(state, `当前状态 ${state.status} 不可完成外层`);
  }
  return ok(
    {
      ...state,
      status: 'outer-complete',
      outerCompletedAtWeek: args.week,
      completedQuestStageIds: dedupPush(state.completedQuestStageIds, 'outer-expedition'),
    },
    ['FinalOuterQuestCompleted'],
  );
}

/**
 * DESTROY_FINAL_SEAL:outer-complete → seals-active(可多次调用)
 * 封印去重(SPEC §19):同一 sealId 不可重复摧毁。
 */
export function destroyFinalSeal(
  state: FinalCampaignState,
  args: { sealId: string; finalQuestItemId: string; intelligenceId: string; week: number },
): FinalCampaignReducerResult {
  if (state.status !== 'outer-complete' && state.status !== 'seals-active') {
    return fail(state, `当前状态 ${state.status} 不可摧毁封印`);
  }
  // 封印去重
  if (state.destroyedSealIds.includes(args.sealId)) {
    return fail(state, `封印 ${args.sealId} 已摧毁`);
  }
  // 任务物品去重
  if (state.collectedFinalQuestItemIds.includes(args.finalQuestItemId)) {
    return fail(state, `任务物品 ${args.finalQuestItemId} 已领取`);
  }
  return ok(
    {
      ...state,
      status: 'seals-active',
      destroyedSealIds: [...state.destroyedSealIds, args.sealId],
      collectedFinalQuestItemIds: [
        ...state.collectedFinalQuestItemIds,
        args.finalQuestItemId,
      ],
    },
    ['FinalSealDestroyed', 'FinalQuestItemGranted'],
  );
}

/**
 * UNLOCK_FINAL_ASSAULT:seals-active → final-assault-ready(全部 3 封印摧毁)
 */
export function unlockFinalAssault(
  state: FinalCampaignState,
  args: { requiredSealIds: string[]; week: number },
): FinalCampaignReducerResult {
  if (state.status !== 'seals-active') {
    return fail(state, `当前状态 ${state.status} 不可解锁最终讨伐`);
  }
  // 验证所有必需封印都已摧毁
  for (const sealId of args.requiredSealIds) {
    if (!state.destroyedSealIds.includes(sealId)) {
      return fail(state, `封印 ${sealId} 尚未摧毁`);
    }
  }
  return ok(
    {
      ...state,
      status: 'final-assault-ready',
      completedQuestStageIds: dedupPush(state.completedQuestStageIds, 'seal-destruction'),
    },
    ['FinalAssaultUnlocked'],
  );
}

/**
 * START_FINAL_ASSAULT:final-assault-ready → final-assault-active
 */
export function startFinalAssault(
  state: FinalCampaignState,
  args: { week: number },
): FinalCampaignReducerResult {
  if (state.status !== 'final-assault-ready') {
    return fail(state, `当前状态 ${state.status} 不可开始最终讨伐`);
  }
  return ok(
    {
      ...state,
      status: 'final-assault-active',
      finalAssaultStartedAtWeek: args.week,
      finalBossAttemptCount: state.finalBossAttemptCount + 1,
      completedQuestStageIds: dedupPush(state.completedQuestStageIds, 'final-assault'),
    },
    ['FinalAssaultStarted'],
  );
}

/**
 * RESOLVE_FINAL_BOSS_VICTORY:final-assault-active → victory
 * 一次提交(SPEC §19)。
 */
export function resolveFinalVictory(
  state: FinalCampaignState,
): FinalCampaignReducerResult {
  if (state.status !== 'final-assault-active') {
    return fail(state, `当前状态 ${state.status} 不可结算胜利`);
  }
  if (state.finalBossDefeated) {
    return fail(state, '最终 Boss 已被击败,不可重复结算');
  }
  return ok(
    {
      ...state,
      status: 'victory',
      finalBossDefeated: true,
    },
    ['FinalBossDefeated', 'CampaignCompleted'],
  );
}

/**
 * RESOLVE_FINAL_BOSS_FAILURE:final-assault-active → failed(可重新挑战)
 */
export function resolveFinalFailure(
  state: FinalCampaignState,
): FinalCampaignReducerResult {
  if (state.status !== 'final-assault-active') {
    return fail(state, `当前状态 ${state.status} 不可结算失败`);
  }
  return ok(
    {
      ...state,
      status: 'failed',
      finalRegionThreat: Math.min(100, state.finalRegionThreat + 25),
    },
    ['FinalBossFailed'],
  );
}

/**
 * ATTEMPT_FINAL_RETREAT:final-assault-active → failed(Boss 保留)
 */
export function attemptFinalRetreat(
  state: FinalCampaignState,
): FinalCampaignReducerResult {
  if (state.status !== 'final-assault-active') {
    return fail(state, `当前状态 ${state.status} 不可撤退`);
  }
  return ok(
    {
      ...state,
      status: 'failed',
      finalRegionThreat: Math.min(100, state.finalRegionThreat + 25),
    },
    ['FinalRetreatAttempted', 'FinalRetreatSucceeded'],
  );
}

/**
 * RESET_AFTER_FAILURE:failed → final-assault-ready(允许重新挑战,SPEC §13)
 * 注意:不重置 destroyedSealIds / collectedFinalQuestItemIds(已摧毁保留)
 * 不重置 finalRegionThreat(累积损失)
 */
export function resetAfterFailure(
  state: FinalCampaignState,
): FinalCampaignReducerResult {
  if (state.status !== 'failed') {
    return fail(state, `当前状态 ${state.status} 不可重置`);
  }
  return ok(
    {
      ...state,
      status: 'final-assault-ready',
    },
    ['FinalAssaultResetForRetry'],
  );
}

// =====================================================================
// 不变量校验
// =====================================================================

/**
 * SPEC §19 不变量校验
 */
export function isFinalCampaignStateValid(state: FinalCampaignState): boolean {
  if (state.finalRegionThreat < 0 || state.finalRegionThreat > 100) return false;
  if (state.finalBossAttemptCount < 0) return false;
  if (state.finalBossDefeated && state.status !== 'victory') return false;
  // 状态机推进一致性
  if (state.status === 'victory' && !state.finalBossDefeated) return false;
  return true;
}

// =====================================================================
// 内部 helpers
// =====================================================================

function dedupPush<T>(arr: T[], v: T): T[] {
  if (arr.includes(v)) return arr;
  return [...arr, v];
}
