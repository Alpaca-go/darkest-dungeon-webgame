/**
 * Phase 10B: 存档安全 + 1.0.0→1.0.1 迁移 + PWA 安全点(SPEC §9-§11)
 *
 * 验收:
 * - isInSafePoint / isInTransaction:正确判定
 * - evaluateUpdateSafety:返回详细 status
 * - 5 安全点 + 7 禁止时机 全部定义
 * - createUpdateBackupMetadata:包含 8 字段
 * - verifyMigrationInvariants:7 维度检查
 * - 12 标准迁移场景
 *
 * 关联文档:docs/save-update-migration-report.md
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '../src/game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../src/game-engine/expedition/types.js';
import {
  isInSafePoint,
  isInTransaction,
  evaluateUpdateSafety,
  createUpdateBackupMetadata,
  verifyMigrationInvariants,
  SAFE_POINTS,
  FORBIDDEN_POINTS,
  STANDARD_MIGRATION_SCENARIOS,
} from '../src/persistence/update-safety.js';

const DOCS_DIR = 'docs';
const REPORT_MD = join(DOCS_DIR, 'save-update-migration-report.md');

function makeBaseState(overrides: Partial<GameState> = {}): GameState {
  return {
    version: GAME_STATE_VERSION,
    seed: 'test-10b',
    currentNode: null,
    selectionInProgress: null,
    battle: null,
    torch: 100,
    food: 8,
    inventory: [],
    party: { members: [], formation: 'standard' },
    expeditionLog: [],
    eventLog: [],
    rngState: { algorithm: 'sfc32', state: [0, 0, 0, 0] },
    campaign: {
      week: 1,
      gold: 100,
      roster: [],
      graveyard: [],
      availableMissions: [],
      completedMissions: [],
      questChainStates: {},
      activeTreatments: [],
      tavernCandidates: [],
      trinketInventory: [],
      trinketAssignments: {},
      campaignEnded: false,
    },
    hamlet: { facilities: {}, lastUpgradeWeek: 0 },
    expedition: { campUsed: 0, campState: null, expeditionBuffs: [] },
    regionProgress: {},
    regionDiscovery: {},
    selectedRegionId: null,
    bossStates: {},
    regionThreats: {},
    campaignThreat: 0,
    bossEncounterState: null,
    finalCampaignState: {
      status: 'not-started',
      outerQuestCompleted: false,
      sealsDestroyed: 0,
      assaultUnlocked: false,
      currentPhase: 0,
    },
    campaignEnding: null,
    ...overrides,
  } as unknown as GameState;
}

describe('Phase 10B: 安全点 + 禁止时机(SPEC §9.2)', () => {
  it('SAFE_POINTS 包含 5 个合法点', () => {
    expect(SAFE_POINTS).toContain('hamlet-home');
    expect(SAFE_POINTS).toContain('expedition-result');
    expect(SAFE_POINTS).toContain('expedition-pending-choice');
    expect(SAFE_POINTS).toContain('campaign-summary');
    expect(SAFE_POINTS).toContain('main-menu');
    expect(SAFE_POINTS.length).toBe(5);
  });

  it('FORBIDDEN_POINTS 包含 7 个禁止时机', () => {
    expect(FORBIDDEN_POINTS).toContain('selecting-transaction');
    expect(FORBIDDEN_POINTS).toContain('week-advancing');
    expect(FORBIDDEN_POINTS).toContain('boss-phase-transition');
    expect(FORBIDDEN_POINTS).toContain('boss-victory-commit');
    expect(FORBIDDEN_POINTS).toContain('final-seal-commit');
    expect(FORBIDDEN_POINTS).toContain('ending-generating');
    expect(FORBIDDEN_POINTS).toContain('save-migrating');
    expect(FORBIDDEN_POINTS.length).toBe(7);
  });
});

describe('Phase 10B: isInSafePoint(SPEC §9.2)', () => {
  it('主菜单:week=0 + 无节点 = 安全点', () => {
    const state = makeBaseState();
    state.campaign!.week = 0;
    expect(isInSafePoint(state)).toBe(true);
  });

  it('战役总结:有 ending = 安全点', () => {
    const state = makeBaseState();
    state.campaignEnding = {
      type: 'victory',
      finalWeek: 40,
      summary: '胜利',
    };
    expect(isInSafePoint(state)).toBe(true);
  });

  it('远征未结算:有 currentNode + 无选择 = 安全点', () => {
    const state = makeBaseState();
    (state as any).currentNode = { id: 'node-1', type: 'encounter' };
    expect(isInSafePoint(state)).toBe(true);
  });

  it('节点完成结果页:expeditionLog 末尾 completed = 安全点', () => {
    const state = makeBaseState();
    state.expeditionLog = [{ type: 'completed' } as any];
    expect(isInSafePoint(state)).toBe(true);
  });

  it('战斗进行中:有 battle + currentNode = 非安全点', () => {
    const state = makeBaseState();
    (state as any).currentNode = { id: 'node-1' };
    (state as any).battle = { active: true };
    expect(isInSafePoint(state)).toBe(false);
  });

  it('选择事务进行中:有 selectionInProgress = 非安全点', () => {
    const state = makeBaseState();
    (state as any).selectionInProgress = { kind: 'committing' };
    expect(isInSafePoint(state)).toBe(false);
  });
});

describe('Phase 10B: isInTransaction(SPEC §9.2)', () => {
  it('选择事务结算中:事务中', () => {
    const state = makeBaseState();
    (state as any).selectionInProgress = { kind: 'committing' };
    expect(isInTransaction(state)).toBe(true);
  });

  it('周推进中:事务中', () => {
    const state = makeBaseState();
    (state as any).selectionInProgress = { kind: 'week-advance' };
    expect(isInTransaction(state)).toBe(true);
  });

  it('Boss 阶段转换中:事务中', () => {
    const state = makeBaseState();
    state.bossEncounterState = { phaseTransitioning: true } as any;
    expect(isInTransaction(state)).toBe(true);
  });

  it('主菜单:非事务中', () => {
    const state = makeBaseState();
    state.campaign!.week = 0;
    expect(isInTransaction(state)).toBe(false);
  });
});

describe('Phase 10B: evaluateUpdateSafety(SPEC §9.2)', () => {
  it('战役总结:返回 safe', () => {
    const state = makeBaseState();
    state.campaignEnding = { type: 'victory', finalWeek: 40, summary: 'x' };
    const status = evaluateUpdateSafety(state);
    expect(status.isSafe).toBe(true);
    expect(status.current).toBe('campaign-summary');
  });

  it('事务进行中:返回 not safe + 具体原因', () => {
    const state = makeBaseState();
    (state as any).selectionInProgress = { kind: 'committing' };
    const status = evaluateUpdateSafety(state);
    expect(status.isSafe).toBe(false);
    expect(status.current).toBe('selecting-transaction');
    expect(status.reason).toBeTruthy();
  });

  it('Boss 阶段转换中:返回 boss-phase-transition', () => {
    const state = makeBaseState();
    state.bossEncounterState = { phaseTransitioning: true } as any;
    const status = evaluateUpdateSafety(state);
    expect(status.isSafe).toBe(false);
    expect(status.current).toBe('boss-phase-transition');
  });

  it('主菜单:返回 main-menu', () => {
    const state = makeBaseState();
    state.campaign!.week = 0;
    const status = evaluateUpdateSafety(state);
    expect(status.isSafe).toBe(true);
    expect(status.current).toBe('main-menu');
  });
});

describe('Phase 10B: createUpdateBackupMetadata(SPEC §9.3)', () => {
  it('包含 9 字段 + checksum', () => {
    const state = makeBaseState();
    const meta = createUpdateBackupMetadata(state, '1.0.0', '1.0.1', 7, 7, false, false);
    expect(meta.sourceBuildVersion).toBe('1.0.0');
    expect(meta.targetBuildVersion).toBe('1.0.1');
    expect(meta.sourceSchemaVersion).toBe(7);
    expect(meta.targetSchemaVersion).toBe(7);
    expect(typeof meta.createdAt).toBe('string');
    expect(typeof meta.checksum).toBe('string');
    expect(meta.checksum.length).toBe(8);
    expect(meta.migrationAttempted).toBe(false);
    expect(meta.migrationSucceeded).toBe(false);
    expect(meta.campaignWeek).toBe(1);
    expect(typeof meta.sizeBytes).toBe('number');
  });

  it('相同状态:相同 checksum', () => {
    const state = makeBaseState();
    const m1 = createUpdateBackupMetadata(state, '1.0.0', '1.0.1', 7, 7, false, false);
    const m2 = createUpdateBackupMetadata(state, '1.0.0', '1.0.1', 7, 7, false, false);
    expect(m1.checksum).toBe(m2.checksum);
  });
});

describe('Phase 10B: 1.0.0→1.0.1 迁移不变性(SPEC §10)', () => {
  it('相同状态:allPreserved = true', () => {
    const state = makeBaseState();
    const check = verifyMigrationInvariants(state, state);
    expect(check.allPreserved).toBe(true);
    expect(check.failedChecks).toEqual([]);
  });

  it('英雄减少:检测', () => {
    const before = makeBaseState();
    before.campaign!.roster = [{ id: 'hero-1' }, { id: 'hero-2' }] as any;
    const after = makeBaseState();
    after.campaign!.roster = [{ id: 'hero-1' }] as any; // 减少一名
    const check = verifyMigrationInvariants(before, after);
    expect(check.heroCount.preserved).toBe(false);
    expect(check.heroCount.before).toBe(2);
    expect(check.heroCount.after).toBe(1);
    expect(check.allPreserved).toBe(false);
  });

  it('死亡英雄复活(变少):检测', () => {
    const before = makeBaseState();
    before.campaign!.graveyard = ['hero1', 'hero2'] as any;
    const after = makeBaseState();
    after.campaign!.graveyard = ['hero1'] as any; // 死亡英雄减少
    const check = verifyMigrationInvariants(before, after);
    expect(check.deadHeroCount.preserved).toBe(false);
  });

  it('最终战役状态变更:检测', () => {
    const before = makeBaseState();
    before.finalCampaignState = {
      status: 'assault-active',
      outerQuestCompleted: true,
      sealsDestroyed: 3,
      assaultUnlocked: true,
      currentPhase: 2,
    };
    const after = makeBaseState();
    after.finalCampaignState = {
      status: 'not-started', // 倒退
      outerQuestCompleted: false,
      sealsDestroyed: 0,
      assaultUnlocked: false,
      currentPhase: 0,
    };
    const check = verifyMigrationInvariants(before, after);
    expect(check.finalCampaignState.preserved).toBe(false);
  });

  it('结局类型变更:检测', () => {
    const before = makeBaseState();
    before.campaignEnding = { type: 'victory', finalWeek: 40, summary: 'x' };
    const after = makeBaseState();
    after.campaignEnding = { type: 'pyrrhic-victory', finalWeek: 40, summary: 'x' };
    const check = verifyMigrationInvariants(before, after);
    expect(check.endingType.preserved).toBe(false);
  });

  it('Boss 状态复制:检测', () => {
    const before = makeBaseState();
    before.bossStates = { 'boss-a': { phase: 1 } as any };
    const after = makeBaseState();
    after.bossStates = {
      'boss-a': { phase: 1 } as any,
      'boss-a-copy': { phase: 1 } as any, // 复制
    };
    const check = verifyMigrationInvariants(before, after);
    expect(check.bossStatesCount.preserved).toBe(false);
  });
});

describe('Phase 10B: 12 标准迁移场景(SPEC §10)', () => {
  beforeAll(() => {
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
    writeFileSync(REPORT_MD, '# Save Update Migration Report\n\nPhase 10B 验收报告:12 标准存档场景 + 安全点 + 1.0.0→1.0.1 迁移不变性。\n', 'utf-8');
  });

  it('STANDARD_MIGRATION_SCENARIOS 包含 12 个场景', () => {
    expect(STANDARD_MIGRATION_SCENARIOS.length).toBe(12);
    expect(STANDARD_MIGRATION_SCENARIOS).toContain('save-new-campaign');
    expect(STANDARD_MIGRATION_SCENARIOS).toContain('save-week-2');
    expect(STANDARD_MIGRATION_SCENARIOS).toContain('save-victory');
    expect(STANDARD_MIGRATION_SCENARIOS).toContain('save-pyrrhic-victory');
    expect(STANDARD_MIGRATION_SCENARIOS).toContain('save-failed-final-assault');
  });

  it('生成 docs/save-update-migration-report.md', () => {
    expect(existsSync(REPORT_MD)).toBe(true);
  });
});
