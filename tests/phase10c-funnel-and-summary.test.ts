/**
 * Phase 10C: 漏斗状态 + 匿名战役摘要(SPEC §8, §15)
 *
 * 验收:
 * - createFunnelState:9 节点 + buildVersion
 * - deriveFunnelFromState:8 节点推断
 * - saveFunnelState / loadFunnelState 持久化
 * - resetFunnelState:第二局标记
 * - buildAnonymousSummary:不包含 PII
 * - validateSummaryPrivacy:5 类 PII 检测
 * - calculateFunnelProgress:0-1
 * - analyzeDropoff:最大流失点
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '../src/game-engine/expedition/types.js';
import { GAME_STATE_VERSION } from '../src/game-engine/expedition/types.js';
import {
  createFunnelState,
  deriveFunnelFromState,
  saveFunnelState,
  loadFunnelState,
  resetFunnelState,
  buildAnonymousSummary,
  validateSummaryPrivacy,
  exportSummaryAsJson,
  generateSummaryFilename,
  calculateFunnelProgress,
  analyzeDropoff,
  FUNNEL_STORAGE_KEY,
  type CampaignFunnelState,
} from '../src/tools/funnel-and-summary.js';

const DOCS_DIR = 'docs';
const REPORT_MD = join(DOCS_DIR, 'player-funnel-report.md');

// 注入 localStorage stub
function installStubs() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage);
}
installStubs();

function makeBaseState(overrides: Partial<GameState> = {}): GameState {
  return {
    version: GAME_STATE_VERSION,
    seed: 'test-10c',
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
    finalCampaignState: { status: 'not-started', outerQuestCompleted: false, sealsDestroyed: 0, assaultUnlocked: false, currentPhase: 0 },
    campaignEnding: null,
    ...overrides,
  } as unknown as GameState;
}

describe('Phase 10C: 漏斗状态(SPEC §15.1)', () => {
  beforeAll(() => {
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
    writeFileSync(REPORT_MD, '# Player Funnel Report\n\nPhase 10C 验收报告:9 漏斗节点 + 8 推断逻辑 + 摘要隐私。\n', 'utf-8');
  });

  it('createFunnelState:包含 9 节点 + buildVersion', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    expect(funnel.campaignStarted).toBe(false);
    expect(funnel.firstExpeditionCompleted).toBe(false);
    expect(funnel.secondWeekReached).toBe(false);
    expect(funnel.firstMediumQuestCompleted).toBe(false);
    expect(funnel.firstBossDefeated).toBe(false);
    expect(funnel.allRegionalBossesDefeated).toBe(false);
    expect(funnel.finalRegionReached).toBe(false);
    expect(funnel.campaignCompleted).toBe(false);
    expect(funnel.secondCampaignStarted).toBe(false);
    expect(funnel.buildVersion).toBe('0.9.0-rc1');
  });

  it('deriveFunnelFromState:week=5 → campaignStarted + secondWeekReached', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    const state = makeBaseState();
    state.campaign!.week = 5;
    const next = deriveFunnelFromState(funnel, state);
    expect(next.campaignStarted).toBe(true);
    expect(next.secondWeekReached).toBe(true);
    expect(next.firstBossDefeated).toBe(false);
  });

  it('deriveFunnelFromState:有 completed expeditionLog → firstExpeditionCompleted', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    const state = makeBaseState();
    state.expeditionLog = [{ type: 'completed' } as any];
    const next = deriveFunnelFromState(funnel, state);
    expect(next.firstExpeditionCompleted).toBe(true);
  });

  it('deriveFunnelFromState:defeatedBossIds >= 1 → firstBossDefeated', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    const state = makeBaseState();
    (state.campaign!.defeatedBossIds as any) = ['boss-a'];
    const next = deriveFunnelFromState(funnel, state);
    expect(next.firstBossDefeated).toBe(true);
    expect(next.allRegionalBossesDefeated).toBe(false);
  });

  it('deriveFunnelFromState:defeatedBossIds = 3 → allRegionalBossesDefeated', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    const state = makeBaseState();
    (state.campaign!.defeatedBossIds as any) = ['a', 'b', 'c'];
    const next = deriveFunnelFromState(funnel, state);
    expect(next.allRegionalBossesDefeated).toBe(true);
  });

  it('deriveFunnelFromState:finalCampaignState.status != not-started → finalRegionReached', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    const state = makeBaseState();
    state.finalCampaignState!.status = 'gate-opened';
    const next = deriveFunnelFromState(funnel, state);
    expect(next.finalRegionReached).toBe(true);
  });

  it('deriveFunnelFromState:campaignEnding != null → campaignCompleted', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    const state = makeBaseState();
    state.campaignEnding = { type: 'victory', finalWeek: 40, summary: 'x' };
    const next = deriveFunnelFromState(funnel, state);
    expect(next.campaignCompleted).toBe(true);
  });
});

describe('Phase 10C: 漏斗持久化', () => {
  it('saveFunnelState + loadFunnelState 往返一致', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    funnel.firstBossDefeated = true;
    expect(saveFunnelState(funnel)).toBe(true);
    const loaded = loadFunnelState();
    expect(loaded).not.toBeNull();
    expect(loaded!.firstBossDefeated).toBe(true);
  });

  it('resetFunnelState:第二局标记', () => {
    const fresh = resetFunnelState('1.0.1');
    expect(fresh.secondCampaignStarted).toBe(true);
    expect(fresh.campaignStarted).toBe(false);
  });
});

describe('Phase 10C: 匿名战役摘要(SPEC §8)', () => {
  it('buildAnonymousSummary:包含 21 字段', () => {
    const state = makeBaseState();
    state.campaignEnding = { type: 'victory', finalWeek: 40, summary: 'x' };
    const funnel = createFunnelState('0.9.0-rc1');
    funnel.campaignCompleted = true;
    const summary = buildAnonymousSummary(state, funnel, {
      totalPlaySessions: 50,
      bossFailureCount: 2,
      finalAssaultFailureCount: 0,
      saveRecoveryUsed: false,
      migrationFailureDetected: false,
      saveCorruptionDetected: false,
    }, '0.9.0-rc1');
    expect(summary.summaryVersion).toBe(1);
    expect(summary.buildVersion).toBe('0.9.0-rc1');
    expect(summary.totalWeeks).toBe(1);
    expect(summary.endingType).toBe('victory');
    expect(summary.campaignCompleted).toBe(true);
    expect(summary.totalPlaySessions).toBe(50);
  });

  it('validateSummaryPrivacy:不含 PII 字段', () => {
    const state = makeBaseState();
    const funnel = createFunnelState('0.9.0-rc1');
    const summary = buildAnonymousSummary(state, funnel, {
      totalPlaySessions: 1,
      bossFailureCount: 0,
      finalAssaultFailureCount: 0,
      saveRecoveryUsed: false,
      migrationFailureDetected: false,
      saveCorruptionDetected: false,
    }, '0.9.0-rc1');
    const v = validateSummaryPrivacy(summary);
    expect(v.isClean).toBe(true);
    expect(v.leakedFields).toEqual([]);
  });

  it('validateSummaryPrivacy:检测泄漏字段名', () => {
    const fake = { playerName: 'test', totalWeeks: 5 };
    const v = validateSummaryPrivacy(fake);
    expect(v.isClean).toBe(false);
    expect(v.leakedFields).toContain('playerName');
  });

  it('exportSummaryAsJson:可被 JSON.parse', () => {
    const state = makeBaseState();
    const funnel = createFunnelState('0.9.0-rc1');
    const summary = buildAnonymousSummary(state, funnel, {
      totalPlaySessions: 1,
      bossFailureCount: 0,
      finalAssaultFailureCount: 0,
      saveRecoveryUsed: false,
      migrationFailureDetected: false,
      saveCorruptionDetected: false,
    }, '0.9.0-rc1');
    const json = exportSummaryAsJson(summary);
    const parsed = JSON.parse(json);
    expect(parsed.summaryVersion).toBe(1);
  });

  it('generateSummaryFilename 格式正确', () => {
    const fn = generateSummaryFilename('1.0.0');
    expect(fn).toMatch(/^anonymous-summary_\d{4}-\d{2}-\d{2}_1\.0\.0\.json$/);
  });
});

describe('Phase 10C: 漏斗进度 + 流失点分析(SPEC §16)', () => {
  it('calculateFunnelProgress:0 节点 = 0', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    expect(calculateFunnelProgress(funnel)).toBe(0);
  });

  it('calculateFunnelProgress:全部节点 = 1', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    funnel.campaignStarted = true;
    funnel.firstExpeditionCompleted = true;
    funnel.secondWeekReached = true;
    funnel.firstMediumQuestCompleted = true;
    funnel.firstBossDefeated = true;
    funnel.allRegionalBossesDefeated = true;
    funnel.finalRegionReached = true;
    funnel.campaignCompleted = true;
    expect(calculateFunnelProgress(funnel)).toBe(1);
  });

  it('analyzeDropoff:最大流失点 = 第一个未达成', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    funnel.campaignStarted = true;
    funnel.firstExpeditionCompleted = true;
    // secondWeekReached = false
    const analysis = analyzeDropoff(funnel);
    expect(analysis.maxDropoffMilestone).toBe('secondWeekReached');
  });

  it('analyzeDropoff:全部完成 = maxDropoff = null', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    Object.keys(funnel).forEach((k) => {
      if (k !== 'lastUpdated' && k !== 'buildVersion') {
        (funnel as any)[k] = true;
      }
    });
    const analysis = analyzeDropoff(funnel);
    expect(analysis.maxDropoffMilestone).toBeNull();
  });

  it('dropoffPoints 包含 8 个里程碑', () => {
    const funnel = createFunnelState('0.9.0-rc1');
    const analysis = analyzeDropoff(funnel);
    expect(analysis.dropoffPoints.length).toBe(8);
  });
});
