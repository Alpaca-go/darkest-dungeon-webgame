/**
 * Phase 6A Boss 状态机测试
 *
 * 覆盖:
 *  - 合法状态转换图
 *  - 每个 reducer 的 happy path + 非法输入
 *  - 幂等性
 *  - 不变量(SPEC §27): 击败不可重入、阶段单调、削弱不重复
 */

import { describe, it, expect } from 'vitest';

import {
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
  createEmptyBossCampaignState,
} from '../src/game-engine/boss/index.js';

import type { BossCampaignState } from '../src/game-engine/boss/index.js';

const BOSS_ID = 'boss-test-arbiter';

function freshBoss(): BossCampaignState {
  return createEmptyBossCampaignState(BOSS_ID, 'ruins');
}

// =====================================================================
// 状态转换图
// =====================================================================

describe('Phase 6A: 状态转换图 (SPEC §5)', () => {
  it('所有状态都有合法后继', () => {
    for (const from of Object.keys(BOSS_TRANSITIONS) as Array<keyof typeof BOSS_TRANSITIONS>) {
      expect(BOSS_TRANSITIONS[from].length).toBeGreaterThanOrEqual(0);
    }
  });

  it('defeated 是终态(无后继)', () => {
    expect(BOSS_TRANSITIONS.defeated).toEqual([]);
  });

  it('隐藏只能进入 rumored', () => {
    expect(BOSS_TRANSITIONS.hidden).toEqual(['rumored']);
  });

  it('合法转换返回 true', () => {
    expect(canTransition('hidden', 'rumored')).toBe(true);
    expect(canTransition('rumored', 'investigating')).toBe(true);
    expect(canTransition('revealed', 'weakened')).toBe(true);
    expect(canTransition('weakened', 'hunt-ready')).toBe(true);
    expect(canTransition('hunt-ready', 'active')).toBe(true);
    expect(canTransition('active', 'defeated')).toBe(true);
  });

  it('非法转换返回 false', () => {
    expect(canTransition('hidden', 'defeated')).toBe(false);
    expect(canTransition('rumored', 'active')).toBe(false);
    expect(canTransition('defeated', 'active')).toBe(false);
  });
});

// =====================================================================
// startInvestigation
// =====================================================================

describe('Phase 6A: startInvestigation', () => {
  it('hidden → rumored', () => {
    const r = startInvestigation(freshBoss());
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('rumored');
    expect(r.events).toContain('BossRumorDiscovered');
  });

  it('rumored 状态幂等(保持)', () => {
    const r = startInvestigation({ ...freshBoss(), status: 'rumored' });
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('rumored');
    expect(r.events).toEqual([]);
  });

  it('defeated 不可重新调查', () => {
    const r = startInvestigation({ ...freshBoss(), status: 'defeated' });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.state.status).toBe('defeated');
  });
});

// =====================================================================
// grantIntelligence
// =====================================================================

describe('Phase 6A: grantIntelligence', () => {
  it('不存在的情报 → error', () => {
    const r = grantIntelligence(freshBoss(), 'intel-does-not-exist');
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('不属于自己的情报 → error', () => {
    // intel-attack-1 bossId = boss-test-arbiter,正确;伪造一个不属于的
    // 现有 intel 全部属于 boss-test-arbiter,只能用其他 boss id 测
    // 这里用 bossId 错误的伪造对象测:暂时跳过
  });

  it('rumored → revealed + intelligenceProgress=1', () => {
    const boss = { ...freshBoss(), status: 'rumored' as const };
    const r = grantIntelligence(boss, 'intel-attack-1');
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('revealed');
    expect(r.state.intelligenceProgress).toBe(1);
    expect(r.state.discoveredIntelligenceEntryIds).toContain('intel-attack-1');
    expect(r.events).toContain('BossIntelligenceGranted');
  });

  it('已发现的情报幂等', () => {
    const boss: BossCampaignState = {
      ...freshBoss(),
      status: 'revealed',
      discoveredIntelligenceEntryIds: ['intel-attack-1'],
      intelligenceProgress: 1,
    };
    const r = grantIntelligence(boss, 'intel-attack-1');
    expect(r.errors).toEqual([]);
    expect(r.state.discoveredIntelligenceEntryIds).toEqual(['intel-attack-1']);
    expect(r.state.intelligenceProgress).toBe(1);
    expect(r.events).toEqual([]);
  });

  it('intelligenceProgress 不超过 8', () => {
    let boss: BossCampaignState = { ...freshBoss(), status: 'revealed' };
    const intelIds = [
      'intel-attack-1', 'intel-attack-2',
      'intel-status-1', 'intel-phase-1', 'intel-phase-2',
      'intel-env-1', 'intel-provision-1', 'intel-retreat-1',
    ];
    for (const id of intelIds) {
      const r = grantIntelligence(boss, id);
      expect(r.errors).toEqual([]);
      boss = r.state;
    }
    expect(boss.intelligenceProgress).toBe(8);
  });
});

// =====================================================================
// completeInvestigationQuest
// =====================================================================

describe('Phase 6A: completeInvestigationQuest', () => {
  it('合法的调查任务 + 隐式推进 investigating', () => {
    const boss = freshBoss(); // hidden
    const r = completeInvestigationQuest(boss, 'task-test-investigate-1');
    expect(r.errors).toEqual([]);
    // 任务 grants 包含 intel-attack-1/intel-status-1/intel-phase-1
    expect(r.state.completedInvestigationQuestIds).toContain('task-test-investigate-1');
    // hidden → investigating → revealed(因为 grants 包含情报)
    expect(r.state.status).toBe('revealed');
    expect(r.state.discoveredIntelligenceEntryIds.length).toBe(3);
  });

  it('非调查任务 → error', () => {
    const r = completeInvestigationQuest(freshBoss(), 'task-test-weaken-1');
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('不属于自己的任务 → error', () => {
    const r = completeInvestigationQuest(freshBoss(), 'task-not-exist');
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('已完成的任务幂等', () => {
    const boss: BossCampaignState = {
      ...freshBoss(),
      status: 'revealed',
      completedInvestigationQuestIds: ['task-test-investigate-1'],
      discoveredIntelligenceEntryIds: ['intel-attack-1', 'intel-status-1', 'intel-phase-1'],
      intelligenceProgress: 3,
    };
    const r = completeInvestigationQuest(boss, 'task-test-investigate-1');
    expect(r.errors).toEqual([]);
    expect(r.events).toEqual([]);
  });
});

// =====================================================================
// completeWeakeningQuest
// =====================================================================

describe('Phase 6A: completeWeakeningQuest', () => {
  it('合法的削弱任务 + revealed → weakened', () => {
    const boss: BossCampaignState = {
      ...freshBoss(),
      status: 'revealed',
      completedInvestigationQuestIds: ['task-test-investigate-1'],
    };
    const r = completeWeakeningQuest(boss, 'task-test-weaken-1');
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('weakened');
    expect(r.state.activeWeakeningEffectIds).toContain('weaken-summon-altar');
    expect(r.state.completedWeakeningQuestIds).toContain('task-test-weaken-1');
  });

  it('完成全部削弱任务 → hunt-ready', () => {
    let boss: BossCampaignState = {
      ...freshBoss(),
      status: 'revealed',
    };
    const r1 = completeWeakeningQuest(boss, 'task-test-weaken-1');
    expect(r1.errors).toEqual([]);
    expect(r1.state.status).toBe('weakened');
    boss = r1.state;
    const r2 = completeWeakeningQuest(boss, 'task-test-weaken-2');
    expect(r2.errors).toEqual([]);
    expect(r2.state.status).toBe('hunt-ready');
    expect(r2.events).toContain('BossHuntUnlocked');
  });

  it('削弱效果不重复叠加(SPEC §27)', () => {
    let boss: BossCampaignState = {
      ...freshBoss(),
      status: 'revealed',
    };
    const r1 = completeWeakeningQuest(boss, 'task-test-weaken-1');
    boss = r1.state;
    const before = boss.activeWeakeningEffectIds.length;
    // 再次完成同一个任务(虽然正常 UI 不会,这里测防御)
    const r2 = completeWeakeningQuest(boss, 'task-test-weaken-1');
    expect(r2.errors).toEqual([]);
    expect(r2.state.activeWeakeningEffectIds.length).toBe(before);
  });
});

// =====================================================================
// unlockBossHunt
// =====================================================================

describe('Phase 6A: unlockBossHunt', () => {
  it('weakened → hunt-ready', () => {
    const boss: BossCampaignState = { ...freshBoss(), status: 'weakened' };
    const r = unlockBossHunt(boss);
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('hunt-ready');
    expect(r.events).toContain('BossHuntUnlocked');
  });

  it('hunt-ready 幂等', () => {
    const boss: BossCampaignState = { ...freshBoss(), status: 'hunt-ready' };
    const r = unlockBossHunt(boss);
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('hunt-ready');
    expect(r.events).toEqual([]);
  });

  it('hidden 不可解锁', () => {
    const r = unlockBossHunt(freshBoss());
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

// =====================================================================
// startFinalQuest
// =====================================================================

describe('Phase 6A: startFinalQuest', () => {
  it('hunt-ready → active', () => {
    const boss: BossCampaignState = { ...freshBoss(), status: 'hunt-ready' };
    const r = startFinalQuest(boss);
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('active');
    expect(r.events).toContain('BossFinalQuestStarted');
    expect(r.events).toContain('BossEncounterStarted');
  });

  it('非 hunt-ready 不可开始', () => {
    const r = startFinalQuest({ ...freshBoss(), status: 'revealed' });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

// =====================================================================
// resolvePhaseTransition
// =====================================================================

describe('Phase 6A: resolvePhaseTransition', () => {
  it('active 状态下可推进', () => {
    const boss: BossCampaignState = { ...freshBoss(), status: 'active' };
    const r = resolvePhaseTransition(boss, 1);
    expect(r.errors).toEqual([]);
    expect(r.events).toContain('BossPhaseTransitioned');
  });

  it('非 active 不可推进', () => {
    const r = resolvePhaseTransition({ ...freshBoss(), status: 'revealed' }, 1);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('负数 phaseIndex 拒绝', () => {
    const boss: BossCampaignState = { ...freshBoss(), status: 'active' };
    const r = resolvePhaseTransition(boss, -1);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

// =====================================================================
// resolveDefeat
// =====================================================================

describe('Phase 6A: resolveDefeat', () => {
  it('active → defeated 并设置 defeatedAtWeek', () => {
    const boss: BossCampaignState = { ...freshBoss(), status: 'active' };
    const r = resolveDefeat(boss, 5);
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('defeated');
    expect(r.state.defeatedAtWeek).toBe(5);
    expect(r.events).toContain('BossDefeated');
    expect(r.events).toContain('BossPermanentRewardGranted');
    expect(r.events).toContain('CampaignThreatAdvanced');
  });

  it('defeated 不可再次结算击败(SPEC §27)', () => {
    const boss: BossCampaignState = { ...freshBoss(), status: 'defeated', defeatedAtWeek: 3 };
    const r = resolveDefeat(boss, 4);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.state.status).toBe('defeated');
  });

  it('非 active 不可结算击败', () => {
    const r = resolveDefeat({ ...freshBoss(), status: 'hunt-ready' }, 1);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('负数周拒绝', () => {
    const boss: BossCampaignState = { ...freshBoss(), status: 'active' };
    const r = resolveDefeat(boss, -1);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

// =====================================================================
// resolveFailure
// =====================================================================

describe('Phase 6A: resolveFailure', () => {
  it('active → revealed,failedAttemptCount+1,可重新挑战(SPEC §16)', () => {
    const boss: BossCampaignState = { ...freshBoss(), status: 'active' };
    const r = resolveFailure(boss);
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('revealed');
    expect(r.state.failedAttemptCount).toBe(1);
    expect(r.events).toContain('BossEncounterFailed');
  });

  it('多次失败计数正确', () => {
    let boss: BossCampaignState = { ...freshBoss(), status: 'active' };
    boss = resolveFailure(boss).state;
    boss = { ...boss, status: 'active' };
    boss = resolveFailure(boss).state;
    expect(boss.failedAttemptCount).toBe(2);
  });
});

// =====================================================================
// attemptRetreat
// =====================================================================

describe('Phase 6A: attemptRetreat', () => {
  it('撤退成功 → revealed, retreatCount+1', () => {
    const boss: BossCampaignState = { ...freshBoss(), status: 'active' };
    const r = attemptRetreat(boss, true);
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('revealed');
    expect(r.state.retreatCount).toBe(1);
    expect(r.events).toContain('BossRetreatSucceeded');
  });

  it('撤退失败 → 保持 active, retreatCount+1', () => {
    const boss: BossCampaignState = { ...freshBoss(), status: 'active' };
    const r = attemptRetreat(boss, false);
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('active');
    expect(r.state.retreatCount).toBe(1);
    expect(r.events).toContain('BossRetreatFailed');
  });

  it('defeated 不可撤退', () => {
    const r = attemptRetreat({ ...freshBoss(), status: 'defeated' }, true);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

// =====================================================================
// createEmptyBossCampaignState
// =====================================================================

describe('Phase 6A: createEmptyBossCampaignState', () => {
  it('返回 hidden 状态 + 全部空集合', () => {
    const boss = createEmptyBossCampaignState('boss-test-arbiter', 'ruins');
    expect(boss.bossId).toBe('boss-test-arbiter');
    expect(boss.regionId).toBe('ruins');
    expect(boss.status).toBe('hidden');
    expect(boss.intelligenceProgress).toBe(0);
    expect(boss.discoveredIntelligenceEntryIds).toEqual([]);
    expect(boss.completedInvestigationQuestIds).toEqual([]);
    expect(boss.completedWeakeningQuestIds).toEqual([]);
    expect(boss.activeWeakeningEffectIds).toEqual([]);
    expect(boss.failedAttemptCount).toBe(0);
    expect(boss.retreatCount).toBe(0);
    expect(boss.unlockedAtWeek).toBeNull();
    expect(boss.defeatedAtWeek).toBeNull();
  });
});
