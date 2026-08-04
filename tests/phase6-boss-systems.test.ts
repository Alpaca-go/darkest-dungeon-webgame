/**
 * Phase 6A Boss 三大系统测试
 *  - 区域威胁(threat.ts)
 *  - 选择生成(choice-generator.ts)
 *  - Boss 战结算(encounter-resolver.ts)
 */

import { describe, it, expect } from 'vitest';

import {
  BOSS_DEFINITIONS,
  BOSS_PHASES,
} from '../src/game-engine/boss/registry.js';
import {
  // threat
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
  // choice
  generateBossTacticalOptions,
  applyIntelligenceUnlock,
  applyWeakening,
  removeWeakening,
  // encounter
  initBossEncounter,
  advanceRound,
  checkPhaseTransition,
  calcRetreatSuccessRate,
  applyRetreatSuccess,
  applyRetreatFailure,
  applyVictory,
  applyFailure,
} from '../src/game-engine/boss/index.js';

import type {
  RegionThreatProgress,
  BossEncounterState,
  IntelligenceUnlockSource,
} from '../src/game-engine/boss/index.js';

const BOSS = BOSS_DEFINITIONS['boss-test-arbiter'];

// =====================================================================
// 区域威胁 (SPEC §6 §27)
// =====================================================================

describe('Phase 6A: 区域威胁 clamp + state 映射', () => {
  it('clamp 0-100', () => {
    expect(clampThreatValue(50)).toBe(50);
    expect(clampThreatValue(-10)).toBe(0);
    expect(clampThreatValue(150)).toBe(100);
    expect(clampThreatValue(NaN)).toBe(0);
    expect(clampThreatValue(Infinity)).toBe(100);
  });

  it('stateFromThreatValue 阈值映射(SPEC §6.1)', () => {
    expect(stateFromThreatValue(0, false)).toBe('dormant');
    expect(stateFromThreatValue(19, false)).toBe('dormant');
    expect(stateFromThreatValue(20, false)).toBe('stirring');
    expect(stateFromThreatValue(39, false)).toBe('stirring');
    expect(stateFromThreatValue(40, false)).toBe('active');
    expect(stateFromThreatValue(59, false)).toBe('active');
    expect(stateFromThreatValue(60, false)).toBe('uncontrolled');
    expect(stateFromThreatValue(79, false)).toBe('uncontrolled');
    expect(stateFromThreatValue(80, false)).toBe('boss-revealed');
    expect(stateFromThreatValue(100, false)).toBe('boss-revealed');
  });

  it('bossDefeated=true → boss-defeated 优先', () => {
    expect(stateFromThreatValue(0, true)).toBe('boss-defeated');
    expect(stateFromThreatValue(50, true)).toBe('boss-defeated');
    expect(stateFromThreatValue(100, true)).toBe('boss-defeated');
  });
});

describe('Phase 6A: 区域威胁 影响函数', () => {
  it('createEmptyRegionThreat 初始 dormant 0', () => {
    const t = createEmptyRegionThreat('ruins');
    expect(t.threatValue).toBe(0);
    expect(t.state).toBe('dormant');
    expect(t.activeThreatModifierIds).toEqual([]);
  });

  it('applyThreatDelta + clamp', () => {
    const t = createEmptyRegionThreat('ruins');
    const r1 = applyThreatDelta(t, 50);
    expect(r1.threatValue).toBe(50);
    expect(r1.state).toBe('active');
    const r2 = applyThreatDelta(r1, 100); // 50 + 100 = 150 → clamp 100
    expect(r2.threatValue).toBe(100);
    expect(r2.state).toBe('boss-revealed');
    const r3 = applyThreatDelta(r2, -200); // 100 - 200 = -100 → clamp 0
    expect(r3.threatValue).toBe(0);
  });

  it('applyBossDefeatThreatReduction 大幅下降 + 改 state', () => {
    const t: RegionThreatProgress = {
      ...createEmptyRegionThreat('ruins'),
      threatValue: 80,
      state: 'boss-revealed',
    };
    const r = applyBossDefeatThreatReduction(t, 60);
    expect(r.threatValue).toBe(20);
    expect(r.state).toBe('boss-defeated');
  });

  it('applyQuestSuccess / applyQuestFailure 数值正确', () => {
    const t = createEmptyRegionThreat('ruins');
    // 0 - 5 = -5 → clamp 0
    expect(applyQuestSuccess(t).threatValue).toBe(0);
    const t50: RegionThreatProgress = { ...t, threatValue: 50 };
    expect(applyQuestSuccess(t50).threatValue).toBe(45);
    expect(applyQuestFailure(t50).threatValue).toBe(58);
  });

  it('applyInvestigationComplete / applyWeakeningComplete', () => {
    const t50: RegionThreatProgress = { ...createEmptyRegionThreat('ruins'), threatValue: 50 };
    expect(applyInvestigationComplete(t50).threatValue).toBe(47);
    expect(applyWeakeningComplete(t50).threatValue).toBe(45);
  });

  it('advanceWeek 应用 weeklyGrowth', () => {
    const t: RegionThreatProgress = {
      ...createEmptyRegionThreat('ruins'),
      threatValue: 50,
      weeklyGrowth: 5,
    };
    expect(advanceWeek(t).threatValue).toBe(55);
  });

  it('isThreatValid 不变量校验(SPEC §27)', () => {
    expect(isThreatValid({ ...createEmptyRegionThreat('ruins'), threatValue: 0 })).toBe(true);
    expect(isThreatValid({ ...createEmptyRegionThreat('ruins'), threatValue: 100 })).toBe(true);
    expect(isThreatValid({ ...createEmptyRegionThreat('ruins'), threatValue: -1 })).toBe(false);
    expect(isThreatValid({ ...createEmptyRegionThreat('ruins'), threatValue: 101 })).toBe(false);
    expect(isThreatValid({ ...createEmptyRegionThreat('ruins'), threatValue: 50.5 })).toBe(false);
  });
});

// =====================================================================
// 选择生成 (SPEC §13)
// =====================================================================

describe('Phase 6A: Boss 战术选择生成', () => {
  const phase0 = BOSS_PHASES[BOSS.phaseDefinitionIds[0]];

  it('返回 2-4 个选项', () => {
    const choices = generateBossTacticalOptions(phase0, {
      bossId: BOSS.id,
      phaseId: phase0.id,
      discoveredIntelligenceIds: [],
      appliedWeakeningIds: [],
      intactEnvironmentTargetIds: [],
      availableBossItemIds: [],
      party: { heroIds: [], lowestHpPercent: 1, maxStressPercent: 0, anyHeroOnDeathsDoor: false },
    });
    expect(choices.length).toBeGreaterThanOrEqual(2);
    expect(choices.length).toBeLessThanOrEqual(4);
  });

  it('选项带有正确 sourceDefinitionId 和 phase tag', () => {
    const choices = generateBossTacticalOptions(phase0, {
      bossId: BOSS.id,
      phaseId: phase0.id,
      discoveredIntelligenceIds: [],
      appliedWeakeningIds: [],
      intactEnvironmentTargetIds: [],
      availableBossItemIds: [],
      party: { heroIds: [], lowestHpPercent: 1, maxStressPercent: 0, anyHeroOnDeathsDoor: false },
    });
    for (const c of choices) {
      expect(c.tags).toContain('boss-tactical');
      expect(c.tags).toContain('phase-0');
      expect(c.sourceDefinitionId).toBeTruthy();
    }
  });

  it('阶段 0 至少 1 个 attack-core 类别', () => {
    const choices = generateBossTacticalOptions(phase0, {
      bossId: BOSS.id,
      phaseId: phase0.id,
      discoveredIntelligenceIds: [],
      appliedWeakeningIds: [],
      intactEnvironmentTargetIds: [],
      availableBossItemIds: [],
      party: { heroIds: [], lowestHpPercent: 1, maxStressPercent: 0, anyHeroOnDeathsDoor: false },
    });
    const hasAttack = choices.some((c) => c.tags.includes('attack-core'));
    expect(hasAttack).toBe(true);
  });

  it('阶段 2 必须包含 retreat 类别', () => {
    const phase2 = BOSS_PHASES[BOSS.phaseDefinitionIds[2]];
    const choices = generateBossTacticalOptions(phase2, {
      bossId: BOSS.id,
      phaseId: phase2.id,
      discoveredIntelligenceIds: [],
      appliedWeakeningIds: [],
      intactEnvironmentTargetIds: [],
      availableBossItemIds: [],
      party: { heroIds: [], lowestHpPercent: 1, maxStressPercent: 0, anyHeroOnDeathsDoor: false },
    });
    const hasRetreat = choices.some((c) => c.tags.includes('retreat'));
    expect(hasRetreat).toBe(true);
  });
});

describe('Phase 6A: 情报 / 削弱 应用(幂等)', () => {
  it('applyIntelligenceUnlock 幂等(SPEC §27 不变量)', () => {
    const src: IntelligenceUnlockSource = {
      type: 'investigation-quest',
      sourceId: 'intel-attack-1',
    };
    const r1 = applyIntelligenceUnlock([], src);
    expect(r1).toEqual(['intel-attack-1']);
    const r2 = applyIntelligenceUnlock(r1, src);
    expect(r2).toEqual(['intel-attack-1']);
  });

  it('applyIntelligenceUnlock 不存在 sourceId → 不变', () => {
    const src: IntelligenceUnlockSource = { type: 'elite-encounter', sourceId: 'intel-not-exist' };
    expect(applyIntelligenceUnlock([], src)).toEqual([]);
  });

  it('applyWeakening 幂等', () => {
    expect(applyWeakening([], 'weaken-summon-altar')).toEqual(['weaken-summon-altar']);
    expect(applyWeakening(['weaken-summon-altar'], 'weaken-summon-altar')).toEqual(['weaken-summon-altar']);
    expect(applyWeakening(['weaken-summon-altar'], 'weaken-stress-curse')).toEqual([
      'weaken-summon-altar',
      'weaken-stress-curse',
    ]);
  });

  it('removeWeakening', () => {
    expect(removeWeakening(['a', 'b'], 'a')).toEqual(['b']);
  });
});

// =====================================================================
// Boss 战结算 (SPEC §26.3 §11 §15 §16 §17)
// =====================================================================

describe('Phase 6A: initBossEncounter', () => {
  it('初始化为 active 状态 + 阶段 0', () => {
    const enc = initBossEncounter(BOSS, 100, []);
    expect(enc.bossId).toBe(BOSS.id);
    expect(enc.encounterStatus).toBe('active');
    expect(enc.phaseIndex).toBe(0);
    expect(enc.round).toBe(0);
    expect(enc.bossHp).toBe(100);
    expect(enc.environmentTargets.length).toBeGreaterThan(0);
  });

  it('携带削弱效果', () => {
    const enc = initBossEncounter(BOSS, 100, ['weaken-summon-altar']);
    expect(enc.appliedWeakeningEffectIds).toEqual(['weaken-summon-altar']);
  });
});

describe('Phase 6A: advanceRound', () => {
  it('轮数 +1', () => {
    const enc = initBossEncounter(BOSS, 100, []);
    expect(advanceRound(enc).round).toBe(1);
  });

  it('非 active 不变', () => {
    const enc: BossEncounterState = { ...initBossEncounter(BOSS, 100, []), encounterStatus: 'retreated' };
    expect(advanceRound(enc).round).toBe(0);
  });
});

describe('Phase 6A: 阶段转换(SPEC §11)', () => {
  it('阶段 0 exitCondition 不满足 → 保持', () => {
    const enc = initBossEncounter(BOSS, 100, []);
    const flags = { boss_phase_rounds: 0 };
    const next = checkPhaseTransition(enc, BOSS, flags);
    expect(next.phaseIndex).toBe(0);
  });

  it('阶段 0 exitCondition 满足 → 阶段 1', () => {
    const enc = initBossEncounter(BOSS, 100, []);
    const flags = { boss_phase_rounds: 3 };
    const next = checkPhaseTransition(enc, BOSS, flags);
    expect(next.phaseIndex).toBe(1);
    expect(next.bossStatusTags).toContain('entered-phase-1');
  });

  it('阶段 1 → 阶段 2', () => {
    const enc: BossEncounterState = {
      ...initBossEncounter(BOSS, 100, []),
      phaseIndex: 1,
      currentPhaseId: BOSS.phaseDefinitionIds[1],
    };
    const flags = { boss_phase_rounds: 6 };
    const next = checkPhaseTransition(enc, BOSS, flags);
    expect(next.phaseIndex).toBe(2);
  });

  it('已经是最后阶段 → 保持', () => {
    const lastPhase = BOSS.phaseDefinitionIds[BOSS.phaseDefinitionIds.length - 1];
    const enc: BossEncounterState = {
      ...initBossEncounter(BOSS, 100, []),
      phaseIndex: BOSS.phaseDefinitionIds.length - 1,
      currentPhaseId: lastPhase,
    };
    const next = checkPhaseTransition(enc, BOSS, {});
    expect(next.phaseIndex).toBe(BOSS.phaseDefinitionIds.length - 1);
  });
});

describe('Phase 6A: 撤退规则(SPEC §15)', () => {
  it('calcRetreatSuccessRate 阶段 0 最高', () => {
    const r0 = calcRetreatSuccessRate(BOSS, 0);
    const r2 = calcRetreatSuccessRate(BOSS, 2);
    expect(r0).toBeGreaterThan(r2);
  });

  it('calcRetreatSuccessRate clamp 0-1', () => {
    const r = calcRetreatSuccessRate(BOSS, 0);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });

  it('applyRetreatSuccess 撤退成功', () => {
    const enc = initBossEncounter(BOSS, 100, ['weaken-stress-curse']);
    const r = applyRetreatSuccess(enc, BOSS);
    expect(r.encounterStatus).toBe('retreated');
    expect(r.retreatAttemptCount).toBe(1);
    // weaken-stress-curse 在 lossRules 中 → 失效
    expect(r.appliedWeakeningEffectIds).toEqual([]);
  });

  it('applyRetreatSuccess 保留非 lossRule 削弱', () => {
    const enc = initBossEncounter(BOSS, 100, ['weaken-summon-altar', 'weaken-stress-curse']);
    const r = applyRetreatSuccess(enc, BOSS);
    // weaken-summon-altar 保留
    expect(r.appliedWeakeningEffectIds).toContain('weaken-summon-altar');
    expect(r.appliedWeakeningEffectIds).not.toContain('weaken-stress-curse');
  });

  it('applyRetreatFailure', () => {
    const enc = initBossEncounter(BOSS, 100, []);
    const r = applyRetreatFailure(enc);
    expect(r.encounterStatus).toBe('retreating');
    expect(r.retreatAttemptCount).toBe(1);
  });
});

describe('Phase 6A: 胜利 / 失败(SPEC §16 §17)', () => {
  it('applyVictory 终态', () => {
    const enc = initBossEncounter(BOSS, 100, []);
    const r = applyVictory(enc);
    expect(r.encounterStatus).toBe('victory');
    expect(r.bossHp).toBe(0);
  });

  it('applyFailure 终态', () => {
    const enc = initBossEncounter(BOSS, 100, []);
    const r = applyFailure(enc);
    expect(r.encounterStatus).toBe('failed');
  });
});
