/**
 * Boss 状态机 reducer(Phase 6A)
 *
 * 核心职责:
 *  - 状态转换合法化(SPEC §5 + §27 invariant: "Boss 阶段必须按合法条件转换" / "同一阶段不得重复进入")
 *  - 命令级 reducer(startInvestigation / grantIntelligence / completeQuest / unlockHunt / startFinal / resolvePhaseTransition / resolveDefeat / resolveFailure)
 *  - 不抛异常,所有非法转换返回 errors 列表
 *
 * 设计:纯函数,dispatcher 负责把结果写回 CampaignState.bossStates[bossId]。
 */

import type {
  BossCampaignState,
  BossStatus,
} from './types.js';
import { BOSS_DEFINITIONS, BOSS_INTELLIGENCE, BOSS_TASKS, BOSS_WEAKENING_EFFECTS } from './registry.js';

// =====================================================================
// 合法状态转换
// =====================================================================

/**
 * 合法状态转换图(SPEC §5)
 * key: 当前状态;value: 允许进入的下一状态列表
 */
export const BOSS_TRANSITIONS: Record<BossStatus, BossStatus[]> = {
  hidden: ['rumored'],
  rumored: ['investigating', 'hidden'],
  investigating: ['revealed', 'rumored'],
  revealed: ['weakened', 'investigating'],
  weakened: ['hunt-ready', 'revealed'],
  'hunt-ready': ['active', 'weakened'],
  active: ['defeated', 'revealed'], // defeat 或 failure→revealed(可再次挑战)
  defeated: [], // 终态
};

/**
 * 校验状态转换是否合法(SPEC §27)
 */
export function canTransition(from: BossStatus, to: BossStatus): boolean {
  return BOSS_TRANSITIONS[from].includes(to);
}

// =====================================================================
// 命令结果类型
// =====================================================================

/**
 * Boss reducer 输出
 */
export interface BossReducerResult {
  /** 新 BossCampaignState(若 errors 非空,等于原 state) */
  state: BossCampaignState;
  /** 产生的领域事件标签(用于 dispatcher 构造 ExpeditionDomainEvent) */
  events: string[];
  /** 错误信息(空数组 = 成功) */
  errors: string[];
}

function ok(
  state: BossCampaignState,
  events: string[],
): BossReducerResult {
  return { state, events, errors: [] };
}

function fail(
  state: BossCampaignState,
  error: string,
): BossReducerResult {
  return { state, events: [], errors: [error] };
}

// =====================================================================
// 命令 reducer
// =====================================================================

/**
 * START_BOSS_INVESTIGATION
 * hidden → rumored
 * 若已 rumored / investigating 等,直接成功(幂等)
 */
export function startInvestigation(
  boss: BossCampaignState,
): BossReducerResult {
  if (boss.status === 'defeated') {
    return fail(boss, '已被击败的 Boss 不可重新调查');
  }
  if (boss.status === 'hidden') {
    return ok(
      { ...boss, status: 'rumored' },
      ['BossRumorDiscovered'],
    );
  }
  // 幂等:已 rumored/investigating/revealed/weakened/hunt-ready/active,保持
  return ok(boss, []);
}

/**
 * GRANT_BOSS_INTELLIGENCE
 * - 校验 entryId 属于该 boss
 * - 已发现则幂等返回
 * - 第一次发现 investigating → revealed
 */
export function grantIntelligence(
  boss: BossCampaignState,
  entryId: string,
): BossReducerResult {
  const intel = BOSS_INTELLIGENCE[entryId];
  if (!intel) {
    return fail(boss, `情报不存在: ${entryId}`);
  }
  if (intel.bossId !== boss.bossId) {
    return fail(boss, `情报 ${entryId} 不属于 Boss ${boss.bossId}`);
  }

  // 幂等
  if (boss.discoveredIntelligenceEntryIds.includes(entryId)) {
    return ok(boss, []);
  }

  const discovered = [...boss.discoveredIntelligenceEntryIds, entryId];
  const progress = Math.min(discovered.length, 8);

  let nextStatus: BossStatus = boss.status;
  const events: string[] = ['BossIntelligenceGranted'];

  // 第一次发现情报 → revealed
  if (boss.status === 'rumored' || boss.status === 'investigating') {
    nextStatus = 'revealed';
    events.push('BossInvestigationStarted');
  } else if (boss.status === 'hidden') {
    // 跳过调查直接发现情报也允许 → rumored → revealed
    nextStatus = 'revealed';
    events.push('BossRumorDiscovered', 'BossInvestigationStarted');
  }

  return ok(
    {
      ...boss,
      status: nextStatus,
      intelligenceProgress: progress,
      discoveredIntelligenceEntryIds: discovered,
    },
    events,
  );
}

/**
 * COMPLETE_BOSS_INVESTIGATION_QUEST
 * - 校验 quest 存在且属于该 boss 且类型 = investigation
 * - 幂等(已完成不重复计数)
 * - 完成任务时同时把任务 grants 的情报一起授予
 */
export function completeInvestigationQuest(
  boss: BossCampaignState,
  questId: string,
): BossReducerResult {
  const task = BOSS_TASKS[questId];
  if (!task) {
    return fail(boss, `任务不存在: ${questId}`);
  }
  if (task.bossId !== boss.bossId) {
    return fail(boss, `任务 ${questId} 不属于 Boss ${boss.bossId}`);
  }
  if (task.type !== 'investigation') {
    return fail(boss, `任务 ${questId} 不是调查任务`);
  }
  if (boss.completedInvestigationQuestIds.includes(questId)) {
    return ok(boss, []);
  }

  // 先更新状态
  let current: BossCampaignState = {
    ...boss,
    completedInvestigationQuestIds: [...boss.completedInvestigationQuestIds, questId],
  };
  const events: string[] = ['BossInvestigationQuestCompleted'];

  // 确保状态是 investigating 或 revealed
  if (current.status === 'hidden' || current.status === 'rumored') {
    if (canTransition(current.status, 'investigating')) {
      current = { ...current, status: 'investigating' };
      events.push('BossInvestigationStarted');
    }
  }

  // 应用任务授予的情报
  for (const grantId of task.grantsIds) {
    if (BOSS_INTELLIGENCE[grantId] && grantIntelligence(current, grantId).errors.length === 0) {
      const r = grantIntelligence(current, grantId);
      current = r.state;
      events.push(...r.events);
    }
  }

  return ok(current, events);
}

/**
 * COMPLETE_BOSS_WEAKENING_QUEST
 * - 校验 quest 存在且属于该 boss 且类型 = weakening
 * - 幂等
 * - 应用任务授予的削弱效果
 * - 至少 1 个削弱任务完成 → weakened
 * - 全部削弱任务完成 → hunt-ready
 */
export function completeWeakeningQuest(
  boss: BossCampaignState,
  questId: string,
): BossReducerResult {
  const task = BOSS_TASKS[questId];
  if (!task) {
    return fail(boss, `任务不存在: ${questId}`);
  }
  if (task.bossId !== boss.bossId) {
    return fail(boss, `任务 ${questId} 不属于 Boss ${boss.bossId}`);
  }
  if (task.type !== 'weakening') {
    return fail(boss, `任务 ${questId} 不是削弱任务`);
  }
  if (boss.completedWeakeningQuestIds.includes(questId)) {
    return ok(boss, []);
  }

  // 1. 加入已完成列表
  let current: BossCampaignState = {
    ...boss,
    completedWeakeningQuestIds: [...boss.completedWeakeningQuestIds, questId],
  };
  const events: string[] = ['BossWeakeningQuestCompleted'];

  // 2. 应用任务授予的削弱效果
  for (const grantId of task.grantsIds) {
    if (BOSS_WEAKENING_EFFECTS[grantId] && !current.activeWeakeningEffectIds.includes(grantId)) {
      current = {
        ...current,
        activeWeakeningEffectIds: [...current.activeWeakeningEffectIds, grantId],
      };
      events.push('BossWeakeningEffectApplied');
    }
  }

  // 3. 状态推进
  if (current.status === 'revealed' && current.completedWeakeningQuestIds.length > 0) {
    current = { ...current, status: 'weakened' };
  }
  // 若全部削弱任务完成 → hunt-ready
  const bossDef = BOSS_DEFINITIONS[boss.bossId];
  if (bossDef && current.completedWeakeningQuestIds.length >= bossDef.weakeningQuestIds.length) {
    current = { ...current, status: 'hunt-ready' };
    events.push('BossHuntUnlocked');
  }

  return ok(current, events);
}

/**
 * UNLOCK_BOSS_HUNT
 * weakened → hunt-ready(显式触发;若已完成所有削弱任务则可提前到 hunt-ready)
 * idempotent
 */
export function unlockBossHunt(boss: BossCampaignState): BossReducerResult {
  if (boss.status === 'defeated') {
    return fail(boss, '已被击败的 Boss 不可重新解锁');
  }
  if (boss.status === 'hunt-ready' || boss.status === 'active') {
    return ok(boss, []);
  }
  if (boss.status !== 'weakened' && boss.status !== 'revealed') {
    return fail(boss, `当前状态 ${boss.status} 不可解锁最终讨伐`);
  }
  return ok(
    { ...boss, status: 'hunt-ready' },
    ['BossHuntUnlocked'],
  );
}

/**
 * START_BOSS_FINAL_QUEST
 * hunt-ready → active
 */
export function startFinalQuest(boss: BossCampaignState): BossReducerResult {
  if (boss.status === 'defeated') {
    return fail(boss, '已被击败的 Boss 不可再次开始最终讨伐');
  }
  if (boss.status === 'hunt-ready') {
    return ok(
      { ...boss, status: 'active' },
      ['BossFinalQuestStarted', 'BossEncounterStarted'],
    );
  }
  return fail(boss, `当前状态 ${boss.status} 不可开始最终讨伐`);
}

/**
 * RESOLVE_BOSS_PHASE_TRANSITION
 * active 内部 phaseIndex 推进(不改变 status)
 * 校验 phaseIndex 单调递增
 */
export function resolvePhaseTransition(
  boss: BossCampaignState,
  nextPhaseIndex: number,
): BossReducerResult {
  if (boss.status !== 'active') {
    return fail(boss, `当前状态 ${boss.status} 不可推进阶段`);
  }
  if (nextPhaseIndex < 0) {
    return fail(boss, '阶段索引不能为负');
  }
  return ok(
    boss, // 状态本身不变(phaseIndex 在 BossEncounterState 上,不在 BossCampaignState 上)
    ['BossPhaseTransitioned', 'BossPhaseEntered'],
  );
}

/**
 * RESOLVE_BOSS_DEFEAT
 * active → defeated(终态;不可回退;SPEC §27)
 */
export function resolveDefeat(
  boss: BossCampaignState,
  week: number,
): BossReducerResult {
  if (boss.status === 'defeated') {
    return fail(boss, 'Boss 已被击败,不可重复结算');
  }
  if (boss.status !== 'active') {
    return fail(boss, `当前状态 ${boss.status} 不可结算击败`);
  }
  if (!Number.isInteger(week) || week < 0) {
    return fail(boss, '击败周必须为非负整数');
  }
  return ok(
    {
      ...boss,
      status: 'defeated',
      defeatedAtWeek: week,
    },
    ['BossDefeated', 'BossPermanentRewardGranted', 'CampaignThreatAdvanced'],
  );
}

/**
 * RESOLVE_BOSS_FAILURE
 * active → revealed(可重新挑战;SPEC §16 失败后战役继续)
 * 增加 failedAttemptCount
 */
export function resolveFailure(
  boss: BossCampaignState,
): BossReducerResult {
  if (boss.status === 'defeated') {
    return fail(boss, '已击败的 Boss 不可标记失败');
  }
  if (boss.status !== 'active') {
    return fail(boss, `当前状态 ${boss.status} 不可结算失败`);
  }
  return ok(
    {
      ...boss,
      status: 'revealed',
      failedAttemptCount: boss.failedAttemptCount + 1,
    },
    ['BossEncounterFailed'],
  );
}

/**
 * ATTEMPT_BOSS_RETREAT
 * - 检查撤退规则(由 dispatcher 提供 success 判断,本函数只更新 retreatCount)
 * - 成功 → status 保持 active 或 revealed(失败则回 revealed)
 * - 失败 → 增加 retreatCount, status 回 revealed
 */
export function attemptRetreat(
  boss: BossCampaignState,
  success: boolean,
): BossReducerResult {
  if (boss.status === 'defeated') {
    return fail(boss, '已击败的 Boss 不可撤退');
  }
  if (boss.status !== 'active') {
    return fail(boss, `当前状态 ${boss.status} 不可撤退`);
  }

  if (success) {
    return ok(
      {
        ...boss,
        status: 'revealed',
        retreatCount: boss.retreatCount + 1,
      },
      ['BossRetreatSucceeded'],
    );
  }
  return ok(
    {
      ...boss,
      retreatCount: boss.retreatCount + 1,
    },
    ['BossRetreatFailed', 'BossRetreatAttempted'],
  );
}

// =====================================================================
// 工厂函数
// =====================================================================

/**
 * 创建初始 BossCampaignState(hidden 状态)
 * 用于 dispatcher 在初始化 CampaignState 时调用
 */
export function createEmptyBossCampaignState(
  bossId: string,
  regionId: import('../regions/types.js').RegionId,
): BossCampaignState {
  return {
    bossId,
    regionId,
    status: 'hidden',
    intelligenceProgress: 0,
    discoveredIntelligenceEntryIds: [],
    completedInvestigationQuestIds: [],
    completedWeakeningQuestIds: [],
    activeWeakeningEffectIds: [],
    failedAttemptCount: 0,
    retreatCount: 0,
    unlockedAtWeek: null,
    defeatedAtWeek: null,
  };
}
