/**
 * Boss 战遭遇结算(Phase 6A,SPEC §26.3)
 *
 * 职责:
 *  - Boss 战初始化(BossEncounterState)
 *  - 回合推进(基于已生成的 GeneratedChoice)
 *  - 阶段转换检查
 *  - 撤退 / 失败 / 胜利 结算
 *
 * 设计:本模块只做骨架状态推进;具体战斗效果(HP / 压力 / 死亡)由底层
 * BattleContext 处理(已由 Phase 1-2 落地)。本阶段只验证框架流程。
 */

import type {
  BossEncounterState,
  BossDefinition,
  BossPhaseDefinition,
  BossEnvironmentTargetState,
  BossEnvironmentTargetDefinition,
} from './types.js';
import {
  BOSS_PHASES,
  BOSS_ENVIRONMENT_TARGETS,
} from './registry.js';

// =====================================================================
// 初始化
// =====================================================================

/**
 * 初始化 BossEncounterState(进入 Boss 战时调用)
 */
export function initBossEncounter(
  boss: BossDefinition,
  initialBossHp: number,
  appliedWeakeningIds: string[],
): BossEncounterState {
  const phase0Id = boss.phaseDefinitionIds[0];
  const phase: BossPhaseDefinition | undefined = phase0Id ? BOSS_PHASES[phase0Id] : undefined;
  const phaseIds = phase ? phase.environmentTargetIds : [];

  const envTargets: BossEnvironmentTargetState[] = phaseIds
    .map((id: string) => BOSS_ENVIRONMENT_TARGETS[id])
    .filter((t: BossEnvironmentTargetDefinition | undefined): t is BossEnvironmentTargetDefinition => t !== undefined)
    .map((t) => ({
      targetId: t.id,
      bossId: t.bossId,
      currentHp: t.hp ?? 0,
      status: 'intact' as const,
      appliedEffectIds: [],
    }));

  return {
    bossId: boss.id,
    currentPhaseId: phase0Id ?? '',
    phaseIndex: 0,
    round: 0,
    bossHp: initialBossHp,
    bossStatusTags: [],
    environmentTargets: envTargets,
    summonEnemyIds: [],
    appliedWeakeningEffectIds: appliedWeakeningIds,
    discoveredDuringEncounterIds: [],
    retreatAttemptCount: 0,
    encounterStatus: 'active',
  };
}

// =====================================================================
// 回合推进
// =====================================================================

/**
 * 推进 1 轮(玩家已选择 tactical choice)
 * 简化版:增加 round、检测阶段转换条件、返回新状态
 * 真实战斗中,本函数会调用 BattleContext 应用 effects,然后调用 state-machine。
 */
export function advanceRound(
  encounter: BossEncounterState,
): BossEncounterState {
  if (encounter.encounterStatus !== 'active') return encounter;

  return {
    ...encounter,
    round: encounter.round + 1,
  };
}

// =====================================================================
// 阶段转换
// =====================================================================

/**
 * 检查并执行阶段转换(SPEC §11)
 * 条件:enterConditions / exitConditions
 *
 * 简化:在测试 Boss 中,阶段 0 持续 3 轮 → 阶段 1,阶段 1 持续 3 轮 → 阶段 2
 */
export function checkPhaseTransition(
  encounter: BossEncounterState,
  boss: BossDefinition,
  flags: Record<string, string | number | boolean>,
): BossEncounterState {
  if (encounter.encounterStatus !== 'active') return encounter;

  const currentPhase = BOSS_PHASES[encounter.currentPhaseId];
  if (!currentPhase) return encounter;

  // 检查退出条件
  const shouldExit = currentPhase.exitConditions.every((c) => evalPhaseCondition(c, flags));
  if (!shouldExit) return encounter;

  // 找到下一阶段
  const nextIndex = currentPhase.phaseIndex + 1;
  const nextPhaseId = boss.phaseDefinitionIds[nextIndex];
  if (!nextPhaseId) {
    // 没有下一阶段,保持
    return encounter;
  }
  const nextPhase: BossPhaseDefinition | undefined = BOSS_PHASES[nextPhaseId];
  if (!nextPhase) return encounter;

  return {
    ...encounter,
    currentPhaseId: nextPhaseId,
    phaseIndex: nextIndex,
    bossStatusTags: [...encounter.bossStatusTags, `entered-phase-${nextIndex}`],
  };
}

// =====================================================================
// 撤退 / 失败 / 胜利
// =====================================================================

/**
 * 计算撤退成功率(SPEC §15.1)
 * baseSuccessRate + phaseModifiers[phaseIndex]
 */
export function calcRetreatSuccessRate(
  boss: BossDefinition,
  phaseIndex: number,
): number {
  const base = boss.retreatRules.baseSuccessRate;
  const mod = boss.retreatRules.phaseModifiers[phaseIndex] ?? 0;
  return Math.max(0, Math.min(1, base + mod));
}

/**
 * 撤退成功后处理:阶段还原、削弱效果按 lossRules 失效
 * 规则:lossRules 中明确列出的削弱 id 才失效;其余保留
 */
export function applyRetreatSuccess(
  encounter: BossEncounterState,
  boss: BossDefinition,
): BossEncounterState {
  const { weakeningEffectLossRules } = boss.retreatRules;
  const filteredWeakening = encounter.appliedWeakeningEffectIds.filter(
    (id) => !weakeningEffectLossRules.includes(id),
  );

  return {
    ...encounter,
    encounterStatus: 'retreated',
    retreatAttemptCount: encounter.retreatAttemptCount + 1,
    appliedWeakeningEffectIds: filteredWeakening,
  };
}

/**
 * 撤退失败
 */
export function applyRetreatFailure(
  encounter: BossEncounterState,
): BossEncounterState {
  return {
    ...encounter,
    encounterStatus: 'retreating',
    retreatAttemptCount: encounter.retreatAttemptCount + 1,
  };
}

/**
 * 胜利
 */
export function applyVictory(
  encounter: BossEncounterState,
): BossEncounterState {
  return {
    ...encounter,
    encounterStatus: 'victory',
    bossHp: 0,
  };
}

/**
 * 失败(全队死亡 / 任务关键物品丢失)
 */
export function applyFailure(
  encounter: BossEncounterState,
): BossEncounterState {
  return {
    ...encounter,
    encounterStatus: 'failed',
  };
}

// =====================================================================
// 内部
// =====================================================================

function evalPhaseCondition(
  cond: { kind: string; value?: number | string; flagName?: string },
  flags: Record<string, string | number | boolean>,
): boolean {
  switch (cond.kind) {
    case 'flag-gte': {
      if (!cond.flagName) return false;
      const v = flags[cond.flagName];
      return typeof v === 'number' && typeof cond.value === 'number' && v >= cond.value;
    }
    case 'flag-lt': {
      if (!cond.flagName) return false;
      const v = flags[cond.flagName];
      return typeof v === 'number' && typeof cond.value === 'number' && v < cond.value;
    }
    case 'flag-eq': {
      if (!cond.flagName) return false;
      return flags[cond.flagName] === cond.value;
    }
    case 'flag-exists':
      return !!cond.flagName && cond.flagName in flags;
    default:
      // 未实现条件 → 默认 false(避免误进入下一阶段)
      return false;
  }
}
