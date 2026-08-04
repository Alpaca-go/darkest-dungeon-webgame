/**
 * Phase 7D 6 条 Golden Run 测试(SPEC §22)
 *
 * 覆盖 6 条 Golden Run 全部通过:
 *  - A: 最终区域解锁 DD-WEB-PHASE7-GATE-001
 *  - B: 最终外层远征 DD-WEB-PHASE7-OUTER-001
 *  - C: 最终 Boss 胜利 DD-WEB-PHASE7-VICTORY-001
 *  - D: 惨胜 DD-WEB-PHASE7-PYRRHIC-001
 *  - E: 失败但继续 DD-WEB-PHASE7-FAIL-CONTINUE-001
 *  - F: 完整新档战役 DD-WEB-PHASE7-FULL-CAMPAIGN-001
 *
 * 用状态机 API 直接驱动 + 简化模拟(由于 dispatcher 还没接入 final commands,
 * 用 7A 状态机 + 7C ending API 验证完整流程)。
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyFinalCampaignState,
  openFinalCampaignGate,
  startFinalOuterQuest,
  completeFinalOuterQuest,
  destroyFinalSeal,
  unlockFinalAssault,
  startFinalAssault,
  resolveFinalVictory,
  resolveFinalFailure,
  attemptFinalRetreat,
  resetAfterFailure,
  isFinalCampaignStateValid,
  calculateEndingType,
  generateCampaignEnding,
  calculateCampaignSummary,
  FINAL_BOSS_PHASE_IDS,
} from '../src/game-engine/final/index.js';
import type { CampaignDomainEvent } from '../src/game-engine/final/ending.js';
import type { FinalCampaignState } from '../src/game-engine/final/types.js';

// 共享 helper
const GATE_READY_CTX = {
  defeatedBossIds: ['boss-test-arbiter', 'boss-spore-matriarch', 'boss-burrows-devourer'],
  finalCampaignGateReady: true,
};

describe('Phase 7D Golden Run A: 最终区域解锁(SPEC §22 A)', () => {
  it('DD-WEB-PHASE7-GATE-001:3 Boss 击败 → gate-ready → 开启入口', () => {
    let s = createEmptyFinalCampaignState();
    expect(s.status).toBe('locked');

    // 验证 canOpenFinalCampaignGate 接受 3 Boss + gate-ready
    const r1 = openFinalCampaignGate(s, { ...GATE_READY_CTX, week: 50 });
    expect(r1.errors).toEqual([]);
    expect(r1.state.status).toBe('gate-ready');
    s = r1.state;
    expect(isFinalCampaignStateValid(s)).toBe(true);
  });

  it('失败条件:2 Boss + gate-ready=true 仍被拒绝', () => {
    const s = createEmptyFinalCampaignState();
    const r = openFinalCampaignGate(s, {
      defeatedBossIds: ['a', 'b'],
      finalCampaignGateReady: true,
      week: 30,
    });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.state.status).toBe('locked');
  });

  it('失败条件:3 Boss + gate-ready=false 仍被拒绝', () => {
    const s = createEmptyFinalCampaignState();
    const r = openFinalCampaignGate(s, {
      defeatedBossIds: ['a', 'b', 'c'],
      finalCampaignGateReady: false,
      week: 30,
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe('Phase 7D Golden Run B: 最终外层远征(SPEC §22 B)', () => {
  it('DD-WEB-PHASE7-OUTER-001:开入口 → 启动外层 → 完成外层', () => {
    let s = createEmptyFinalCampaignState();
    s = openFinalCampaignGate(s, { ...GATE_READY_CTX, week: 50 }).state;
    s = startFinalOuterQuest(s, { week: 51 }).state;
    expect(s.status).toBe('gate-open');
    expect(s.gateOpenedAtWeek).toBe(51);
    s = completeFinalOuterQuest(s, { week: 52 }).state;
    expect(s.status).toBe('outer-complete');
    expect(s.outerCompletedAtWeek).toBe(52);
    expect(s.completedQuestStageIds).toContain('outer-expedition');
  });

  it('外层未开入口不可启动', () => {
    const s = createEmptyFinalCampaignState();
    const r = startFinalOuterQuest(s, { week: 50 });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe('Phase 7D Golden Run C: 最终 Boss 胜利(SPEC §22 C)', () => {
  it('DD-WEB-PHASE7-VICTORY-001:摧毁 3 封印 → 启动 → 4 阶段 → 胜利结局', () => {
    let s = createEmptyFinalCampaignState();
    s = openFinalCampaignGate(s, { ...GATE_READY_CTX, week: 50 }).state;
    s = startFinalOuterQuest(s, { week: 51 }).state;
    s = completeFinalOuterQuest(s, { week: 52 }).state;

    // 摧毁 3 封印
    s = destroyFinalSeal(s, {
      sealId: 'seal-darkest-stress-curse',
      finalQuestItemId: 'item-final-curse-breaker',
      intelligenceId: 'intel-final-phase-1',
      week: 53,
    }).state;
    s = destroyFinalSeal(s, {
      sealId: 'seal-darkest-disease-corrupt',
      finalQuestItemId: 'item-final-purifier-eye',
      intelligenceId: 'intel-final-phase-2',
      week: 54,
    }).state;
    s = destroyFinalSeal(s, {
      sealId: 'seal-darkest-hunger-bleed',
      finalQuestItemId: 'item-final-hunger-rest',
      intelligenceId: 'intel-final-phase-3',
      week: 55,
    }).state;

    expect(s.destroyedSealIds.length).toBe(3);
    expect(s.status).toBe('seals-active');

    s = unlockFinalAssault(s, {
      requiredSealIds: [
        'seal-darkest-stress-curse',
        'seal-darkest-disease-corrupt',
        'seal-darkest-hunger-bleed',
      ],
      week: 56,
    }).state;
    expect(s.status).toBe('final-assault-ready');

    s = startFinalAssault(s, { week: 57 }).state;
    expect(s.status).toBe('final-assault-active');
    expect(s.finalBossAttemptCount).toBe(1);

    // 4 阶段完成
    expect(FINAL_BOSS_PHASE_IDS.length).toBe(4);

    s = resolveFinalVictory(s).state;
    expect(s.status).toBe('victory');
    expect(s.finalBossDefeated).toBe(true);

    // 验证结局类型
    const ending = generateCampaignEnding(
      {
        finalCampaignState: s,
        finalBossDefeated: true,
        heroDeathCount: 0,
        totalHeroDeathCount: 1,
        survivingHeroCount: 4,
        hasRecruitableHeroes: true,
        hasRecoveryResources: true,
        threatRecoverable: true,
      },
      {
        week: 57,
        survivingHeroIds: ['h-1', 'h-2', 'h-3', 'h-4'],
        deadHeroIds: ['h-dead-1'],
        summaryData: {} as any,
      },
    );
    expect(ending.type).toBe('victory');
  });
});

describe('Phase 7D Golden Run D: 惨胜(SPEC §22 D)', () => {
  it('DD-WEB-PHASE7-PYRRHIC-001:阶段 4 两名英雄永久死亡 → 惨胜结局', () => {
    let s = createEmptyFinalCampaignState();
    s = openFinalCampaignGate(s, { ...GATE_READY_CTX, week: 50 }).state;
    s = startFinalOuterQuest(s, { week: 51 }).state;
    s = completeFinalOuterQuest(s, { week: 52 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-a', finalQuestItemId: 'item-a', intelligenceId: 'intel-1', week: 53 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-b', finalQuestItemId: 'item-b', intelligenceId: 'intel-2', week: 54 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-c', finalQuestItemId: 'item-c', intelligenceId: 'intel-3', week: 55 }).state;
    s = unlockFinalAssault(s, { requiredSealIds: ['seal-a', 'seal-b', 'seal-c'], week: 56 }).state;
    s = startFinalAssault(s, { week: 57 }).state;

    // 阶段 4 两名英雄永久死亡
    s = resolveFinalVictory(s).state;
    expect(s.finalBossDefeated).toBe(true);

    // 惨胜:Boss 击败 + 2+ 死亡
    const endingType = calculateEndingType({
      finalCampaignState: s,
      finalBossDefeated: true,
      heroDeathCount: 2,
      totalHeroDeathCount: 4,
      survivingHeroCount: 2,
      hasRecruitableHeroes: true,
      hasRecoveryResources: true,
      threatRecoverable: true,
    });
    expect(endingType).toBe('pyrrhic-victory');
  });
});

describe('Phase 7D Golden Run E: 失败但继续(SPEC §22 E)', () => {
  it('DD-WEB-PHASE7-FAIL-CONTINUE-001:最终讨伐失败 → 撤退 → 可重新挑战', () => {
    let s = createEmptyFinalCampaignState();
    s = openFinalCampaignGate(s, { ...GATE_READY_CTX, week: 50 }).state;
    s = startFinalOuterQuest(s, { week: 51 }).state;
    s = completeFinalOuterQuest(s, { week: 52 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-a', finalQuestItemId: 'item-a', intelligenceId: 'intel-1', week: 53 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-b', finalQuestItemId: 'item-b', intelligenceId: 'intel-2', week: 54 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-c', finalQuestItemId: 'item-c', intelligenceId: 'intel-3', week: 55 }).state;
    s = unlockFinalAssault(s, { requiredSealIds: ['seal-a', 'seal-b', 'seal-c'], week: 56 }).state;
    s = startFinalAssault(s, { week: 57 }).state;

    // 撤退失败
    s = attemptFinalRetreat(s).state;
    expect(s.status).toBe('failed');
    expect(s.finalRegionThreat).toBe(25);

    // 可重新挑战
    s = resetAfterFailure(s).state;
    expect(s.status).toBe('final-assault-ready');
    // 累积损失保留
    expect(s.finalRegionThreat).toBe(25);
    expect(s.destroyedSealIds.length).toBe(3);

    // 再次启动 + 失败(彻底失败)
    s = startFinalAssault(s, { week: 60 }).state;
    s = resolveFinalFailure(s).state;
    expect(s.status).toBe('failed');
    expect(s.finalRegionThreat).toBe(50); // 25 + 25

    // 失败但继续
    const endingType = calculateEndingType({
      finalCampaignState: s,
      finalBossDefeated: false,
      heroDeathCount: 1,
      totalHeroDeathCount: 2,
      survivingHeroCount: 2,
      hasRecruitableHeroes: true,
      hasRecoveryResources: true,
      threatRecoverable: true,
    });
    expect(endingType).toBe('failed-assault');
  });
});

describe('Phase 7D Golden Run F: 完整新档战役(SPEC §22 F)', () => {
  it('DD-WEB-PHASE7-FULL-CAMPAIGN-001:Phase 1-7 完整流程 + 总结生成', () => {
    // 简化的完整流程:
    // Phase 1-6 → 3 Boss 击败
    // Phase 7 → 入口 → 外层 → 封印 → 最终讨伐 → 胜利
    const events: CampaignDomainEvent[] = [];

    // 模拟 Phase 1-6 事件
    for (let w = 1; w <= 50; w++) {
      events.push({ type: 'EXPEDITION_STARTED', week: w });
      if (w % 2 === 0) events.push({ type: 'QUEST_SUCCESS', week: w });
      if (w % 5 === 0) events.push({ type: 'HERO_RECRUITED', week: w });
    }
    events.push({ type: 'BOSS_DEFEATED', data: { bossId: 'boss-test-arbiter' }, week: 30 });
    events.push({ type: 'BOSS_DEFEATED', data: { bossId: 'boss-spore-matriarch' }, week: 40 });
    events.push({ type: 'BOSS_DEFEATED', data: { bossId: 'boss-burrows-devourer' }, week: 48 });

    // Phase 7 事件
    events.push({ type: 'FinalCampaignGateOpened', week: 50 });
    events.push({ type: 'FinalOuterQuestStarted', week: 51 });
    events.push({ type: 'FinalOuterQuestCompleted', week: 52 });
    events.push({ type: 'FinalSealDestroyed', week: 53 });
    events.push({ type: 'FinalSealDestroyed', week: 54 });
    events.push({ type: 'FinalSealDestroyed', week: 55 });
    events.push({ type: 'FinalAssaultUnlocked', week: 56 });
    events.push({ type: 'FinalAssaultStarted', week: 57 });
    events.push({ type: 'FinalBossDefeated', week: 60 });
    events.push({ type: 'CampaignCompleted', week: 60 });

    // 验证:从 events 推导总结
    const summary = calculateCampaignSummary({
      events,
      finalState: {
        ...createEmptyFinalCampaignState(),
        status: 'victory',
        finalBossDefeated: true,
        destroyedSealIds: ['seal-a', 'seal-b', 'seal-c'],
      } as FinalCampaignState,
      finalRegionName: '黑暗核心',
      week: 60,
      graveyardHeroIds: [],
      usedHeroIds: ['h-1', 'h-2', 'h-3', 'h-4'],
      mostUsedPartyHeroIds: ['h-1', 'h-2', 'h-3', 'h-4'],
      keyTurningPointEventIds: [
        'BOSS_DEFEATED#0',
        'FinalOuterQuestCompleted#0',
        'FinalSealDestroyed#0',
        'FinalBossDefeated#0',
        'CampaignCompleted#0',
      ],
      finalEndingType: 'victory',
    });

    // 完整战役检查
    expect(summary.totalWeeks).toBe(60);
    expect(summary.totalExpeditions).toBeGreaterThanOrEqual(50);
    expect(summary.successfulQuests).toBe(25); // 2,4,6...50
    expect(summary.totalHeroesRecruited).toBe(10); // 5,10,15...50
    expect(summary.defeatedBossIds.length).toBe(3);
    expect(summary.finalBossDefeated).toBe(true);
    expect(summary.destroyedSealCount).toBe(3);
    expect(summary.finalEndingType).toBe('victory');
    expect(summary.finalRegionName).toBe('黑暗核心');
  });

  it('完整流程不变量:不变量校验通过', () => {
    let s = createEmptyFinalCampaignState();
    s = openFinalCampaignGate(s, { ...GATE_READY_CTX, week: 50 }).state;
    s = startFinalOuterQuest(s, { week: 51 }).state;
    s = completeFinalOuterQuest(s, { week: 52 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-a', finalQuestItemId: 'item-a', intelligenceId: 'intel-1', week: 53 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-b', finalQuestItemId: 'item-b', intelligenceId: 'intel-2', week: 54 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-c', finalQuestItemId: 'item-c', intelligenceId: 'intel-3', week: 55 }).state;
    s = unlockFinalAssault(s, { requiredSealIds: ['seal-a', 'seal-b', 'seal-c'], week: 56 }).state;
    s = startFinalAssault(s, { week: 57 }).state;
    s = resolveFinalVictory(s).state;
    expect(isFinalCampaignStateValid(s)).toBe(true);
  });
});
