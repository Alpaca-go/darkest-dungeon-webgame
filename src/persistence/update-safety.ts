/**
 * Phase 10B: 存档安全 + PWA 更新(SPEC §9-§11)
 *
 * 功能:
 * - isInSafePoint:检查当前是否在安全点(可执行更新)
 * - isInTransaction:检查是否在事务中(禁止更新)
 * - createUpdateBackup:更新前自动备份
 * - getSafePoints:列出所有安全点
 * - getForbiddenPoints:列出禁止更新的时机
 * - 1.0.0→1.0.1 迁移验证
 *
 * 安全点(SPEC §9.2):
 * - 庄园首页
 * - 已完成节点结果页
 * - 远征未结算选择页
 * - 战役总结页
 *
 * 禁止更新时机(SPEC §9.2):
 * - 选择事务结算中
 * - 周推进中
 * - Boss 阶段转换中
 * - Boss 胜利提交中
 * - 最终封印提交中
 * - 结局生成中
 * - 存档导入迁移中
 */

import type { GameState } from '../game-engine/expedition/types.js';

export type SafePoint =
  | 'hamlet-home'
  | 'expedition-result'
  | 'expedition-pending-choice'
  | 'campaign-summary'
  | 'main-menu';

export type ForbiddenPoint =
  | 'selecting-transaction'
  | 'week-advancing'
  | 'boss-phase-transition'
  | 'boss-victory-commit'
  | 'final-seal-commit'
  | 'ending-generating'
  | 'save-migrating';

export const SAFE_POINTS: SafePoint[] = [
  'hamlet-home',
  'expedition-result',
  'expedition-pending-choice',
  'campaign-summary',
  'main-menu',
];

export const FORBIDDEN_POINTS: ForbiddenPoint[] = [
  'selecting-transaction',
  'week-advancing',
  'boss-phase-transition',
  'boss-victory-commit',
  'final-seal-commit',
  'ending-generating',
  'save-migrating',
];

export interface UpdateBackupMetadata {
  sourceBuildVersion: string;
  targetBuildVersion: string;
  sourceSchemaVersion: number;
  targetSchemaVersion: number;
  createdAt: string;
  checksum: string;
  migrationAttempted: boolean;
  migrationSucceeded: boolean;
  campaignWeek?: number;
  sizeBytes?: number;
}

export interface SafePointStatus {
  current: SafePoint | ForbiddenPoint;
  isSafe: boolean;
  reason: string;
}

/**
 * 检查当前 GameState 是否在安全点
 */
export function isInSafePoint(state: GameState): boolean {
  // 战役总结:有 ending
  if (state.campaignEnding) return true;

  // 远征已完成:expeditionLog 末尾为 completed + 当前无 in-progress
  if (state.expeditionLog && state.expeditionLog.length > 0) {
    const lastEntry = state.expeditionLog[state.expeditionLog.length - 1];
    if ((lastEntry as any).type === 'completed' && !state.currentNode && !state.selectionInProgress) {
      return true;
    }
  }

  // 主菜单:周 0 + 无当前节点 + 无 in-progress
  if (state.campaign?.week === 0
    && !state.currentNode
    && !state.selectionInProgress
    && !state.battle) {
    return true;
  }

  // 庄园首页(hamlet-home):week >= 1 + 无当前节点 + 无选择中 + 无战斗
  if ((state.campaign?.week ?? 0) >= 1
    && !state.currentNode
    && !state.selectionInProgress
    && !state.battle) {
    return true;
  }

  // 远征未结算:有当前节点 + 无选择中
  if (state.currentNode && !state.selectionInProgress && !state.battle) {
    return true;
  }

  return false;
}

/**
 * 检查是否在禁止更新的事务中
 */
export function isInTransaction(state: GameState): boolean {
  // 选择事务结算中
  if (state.selectionInProgress && state.selectionInProgress.kind === 'committing') {
    return true;
  }

  // 周推进中(由 campaign.advancing flag 标记 — 此处用 campaign 状态推断)
  // 简化:如果 selectionInProgress 是 week_advance 类型
  if (state.selectionInProgress?.kind === 'week-advance') {
    return true;
  }

  // Boss 阶段转换中
  if (state.bossEncounterState?.phaseTransitioning) {
    return true;
  }

  // 存档迁移中(由专门的 marker 跟踪 — 此处用 importLock 推断)
  // 简化:不在 state 中 — 假设由调用方控制

  return false;
}

/**
 * 状态评估(返回详细 status)
 */
export function evaluateUpdateSafety(state: GameState): SafePointStatus {
  if (isInTransaction(state)) {
    // 推断具体事务类型
    if (state.selectionInProgress?.kind === 'committing') {
      return {
        current: 'selecting-transaction',
        isSafe: false,
        reason: '选择事务结算中,禁止更新',
      };
    }
    if (state.bossEncounterState?.phaseTransitioning) {
      return {
        current: 'boss-phase-transition',
        isSafe: false,
        reason: 'Boss 阶段转换中,禁止更新',
      };
    }
    return {
      current: 'week-advancing',
      isSafe: false,
      reason: '事务进行中,禁止更新',
    };
  }

  if (state.campaignEnding) {
    return {
      current: 'campaign-summary',
      isSafe: true,
      reason: '战役总结页,安全点',
    };
  }

  if (state.campaign?.week === 0
    && !state.currentNode
    && !state.selectionInProgress
    && !state.battle) {
    return {
      current: 'main-menu',
      isSafe: true,
      reason: '主菜单,安全点',
    };
  }

  if (state.currentNode && !state.selectionInProgress && !state.battle) {
    return {
      current: 'expedition-pending-choice',
      isSafe: true,
      reason: '远征未结算选择页,安全点',
    };
  }

  if (state.expeditionLog && state.expeditionLog.length > 0) {
    const last = state.expeditionLog[state.expeditionLog.length - 1];
    if ((last as any).type === 'completed' && !state.currentNode) {
      return {
        current: 'expedition-result',
        isSafe: true,
        reason: '已完成节点结果页,安全点',
      };
    }
  }

  if ((state.campaign?.week ?? 0) >= 1
    && !state.currentNode
    && !state.selectionInProgress
    && !state.battle) {
    return {
      current: 'hamlet-home',
      isSafe: true,
      reason: '庄园首页,安全点',
    };
  }

  return {
    current: 'week-advancing',
    isSafe: false,
    reason: '非安全点',
  };
}

/**
 * 计算存档 checksum(FNV-1a)
 */
function fnv1aHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * 创建更新前备份 metadata
 */
export function createUpdateBackupMetadata(
  state: GameState,
  sourceBuildVersion: string,
  targetBuildVersion: string,
  sourceSchemaVersion: number,
  targetSchemaVersion: number,
  migrationAttempted: boolean,
  migrationSucceeded: boolean
): UpdateBackupMetadata {
  const json = JSON.stringify(state);
  return {
    sourceBuildVersion,
    targetBuildVersion,
    sourceSchemaVersion,
    targetSchemaVersion,
    createdAt: new Date().toISOString(),
    checksum: fnv1aHash(json),
    migrationAttempted,
    migrationSucceeded,
    campaignWeek: (state as any).campaign?.week,
    sizeBytes: json.length,
  };
}

/**
 * 1.0.0→1.0.1 迁移验证(SPEC §10)
 *
 * 关键不变性(Schema v7 跨版本兼容,1.0.0 → 1.0.1 应保持):
 * - 英雄不丢失
 * - 已死亡英雄不复活
 * - 墓园不丢失
 * - 怪癖 / 疾病 / 饰品不重复
 * - 区域进度不重置
 * - Boss 状态正确
 * - 封印不恢复
 * - 最终任务物品不复制
 * - 结局不重复
 */
export interface MigrationInvariantCheck {
  heroCount: { before: number; after: number; preserved: boolean };
  deadHeroCount: { before: number; after: number; preserved: boolean };
  trinketCount: { before: number; after: number; preserved: boolean };
  bossStatesCount: { before: number; after: number; preserved: boolean };
  regionProgressCount: { before: number; after: number; preserved: boolean };
  finalCampaignState: { before: any; after: any; preserved: boolean };
  endingType: { before: any; after: any; preserved: boolean };
  allPreserved: boolean;
  failedChecks: string[];
}

export function verifyMigrationInvariants(
  before: GameState,
  after: GameState
): MigrationInvariantCheck {
  const failed: string[] = [];
  const heroBefore = (before as any).campaign?.roster?.length || 0;
  const heroAfter = (after as any).campaign?.roster?.length || 0;
  const heroPreserved = heroAfter === heroBefore;
  if (!heroPreserved) failed.push(`heroCount: ${heroBefore} → ${heroAfter}`);

  const deadBefore = (before as any).campaign?.graveyard?.length || 0;
  const deadAfter = (after as any).campaign?.graveyard?.length || 0;
  const deadPreserved = deadAfter >= deadBefore;
  if (!deadPreserved) failed.push(`deadHeroCount decreased: ${deadBefore} → ${deadAfter}`);

  const trinketBefore = (before as any).campaign?.trinketInventory?.length || 0;
  const trinketAfter = (after as any).campaign?.trinketInventory?.length || 0;
  const trinketPreserved = trinketAfter === trinketBefore;
  if (!trinketPreserved) failed.push(`trinketCount: ${trinketBefore} → ${trinketAfter}`);

  const bossBefore = Object.keys((before as any).bossStates || {}).length;
  const bossAfter = Object.keys((after as any).bossStates || {}).length;
  const bossPreserved = bossAfter === bossBefore;
  if (!bossPreserved) failed.push(`bossStatesCount: ${bossBefore} → ${bossAfter}`);

  const regionBefore = Object.keys((before as any).regionProgress || {}).length;
  const regionAfter = Object.keys((after as any).regionProgress || {}).length;
  const regionPreserved = regionAfter === regionBefore;
  if (!regionPreserved) failed.push(`regionProgressCount: ${regionBefore} → ${regionAfter}`);

  const finalBefore = (before as any).finalCampaignState;
  const finalAfter = (after as any).finalCampaignState;
  const finalPreserved = JSON.stringify(finalBefore) === JSON.stringify(finalAfter);
  if (!finalPreserved) failed.push(`finalCampaignState changed`);

  const endingBefore = (before as any).campaignEnding;
  const endingAfter = (after as any).campaignEnding;
  const endingPreserved = JSON.stringify(endingBefore) === JSON.stringify(endingAfter);
  if (!endingPreserved) failed.push(`endingType changed`);

  return {
    heroCount: { before: heroBefore, after: heroAfter, preserved: heroPreserved },
    deadHeroCount: { before: deadBefore, after: deadAfter, preserved: deadPreserved },
    trinketCount: { before: trinketBefore, after: trinketAfter, preserved: trinketPreserved },
    bossStatesCount: { before: bossBefore, after: bossAfter, preserved: bossPreserved },
    regionProgressCount: { before: regionBefore, after: regionAfter, preserved: regionPreserved },
    finalCampaignState: { before: finalBefore, after: finalAfter, preserved: finalPreserved },
    endingType: { before: endingBefore, after: endingAfter, preserved: endingPreserved },
    allPreserved: failed.length === 0,
    failedChecks: failed,
  };
}

/**
 * 12 类标准存档迁移测试场景(SPEC §10)
 */
export const STANDARD_MIGRATION_SCENARIOS = [
  'save-new-campaign',
  'save-week-2',
  'save-medium-expedition',
  'save-high-attrition',
  'save-region-boss-ready',
  'save-boss-defeated',
  'save-three-bosses-defeated',
  'save-final-gate-ready',
  'save-before-final-boss',
  'save-victory',
  'save-pyrrhic-victory',
  'save-failed-final-assault',
] as const;

export type StandardMigrationScenario = typeof STANDARD_MIGRATION_SCENARIOS[number];
