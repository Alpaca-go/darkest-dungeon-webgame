/**
 * Boss 系统统一入口(Phase 6A)
 *
 * 6A 阶段交付:
 *  - 核心类型 (types.ts)
 *  - 测试 Boss registry (registry.ts)
 *
 * 6B 之后会追加:
 *  - state-machine.ts(状态机 + reducer)
 *  - threat.ts(区域威胁 manager)
 *  - choice-generator.ts(选择生成)
 *  - encounter-resolver.ts(Boss 战结算)
 *  - dispatcher 集成
 */

export * from './types.js';
export {
  BOSS_DEFINITIONS,
  BOSS_PHASES,
  BOSS_INTELLIGENCE,
  BOSS_WEAKENING_EFFECTS,
  BOSS_PERMANENT_REWARDS,
  BOSS_QUEST_ITEMS,
  BOSS_ENVIRONMENT_TARGETS,
  BOSS_TASKS,
  initializeBossStates,
  initializeRegionThreats,
  createEmptyCampaignThreat,
  type BossTaskMeta,
} from './registry.js';
export {
  BOSS_TRANSITIONS,
  canTransition,
  startInvestigation,
  grantIntelligence,
  completeInvestigationQuest,
  completeWeakeningQuest,
  unlockBossHunt,
  startFinalQuest,
  resolvePhaseTransition,
  resolveDefeat,
  resolveFailure,
  attemptRetreat,
  type BossReducerResult,
} from './state-machine.js';
export { createEmptyBossCampaignState } from './types.js';
export {
  stateFromThreatValue,
  clampThreatValue,
  createEmptyRegionThreat,
  applyThreatDelta,
  applyBossDefeatThreatReduction,
  advanceWeek,
  applyQuestSuccess,
  applyQuestFailure,
  applyInvestigationComplete,
  applyWeakeningComplete,
  isThreatValid,
} from './threat.js';
export {
  generateBossTacticalOptions,
  applyIntelligenceUnlock,
  applyWeakening,
  removeWeakening,
  type BossChoiceContext,
} from './choice-generator.js';
export {
  initBossEncounter,
  advanceRound,
  checkPhaseTransition,
  calcRetreatSuccessRate,
  applyRetreatSuccess,
  applyRetreatFailure,
  applyVictory,
  applyFailure,
} from './encounter-resolver.js';
