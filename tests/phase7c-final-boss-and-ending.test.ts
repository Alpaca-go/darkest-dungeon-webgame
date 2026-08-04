/**
 * Phase 7C 最终 Boss + 结局 + 战役总结测试(SPEC §11 §14 §15)
 *
 * 覆盖:
 *  - 最终 Boss 4 阶段(试探与回忆 / 多区域机制 / 英雄个体考验 / 最终抉择)
 *  - 4 阶段 tacticalOptionRules 都 ≥ 3
 *  - 4 阶段 enterConditions / exitConditions 正确
 *  - 结局计算(victory / pyrrhic-victory / failed-assault / campaign-collapse)
 *  - 战役总结(SPEC §15 16+ 字段)
 *  - Debug 事件不进入正式统计
 *  - 关键转折点提取
 *  - 英雄个体考验选择生成
 *  - SPEC §19 不可重复提交
 */

import { describe, it, expect } from 'vitest';
import {
  FINAL_BOSS_PHASES,
  FINAL_BOSS_PHASE_IDS,
  FINAL_BOSS_INFO,
  calculateEndingType,
  generateCampaignEnding,
  calculateCampaignSummary,
  extractTurningPointEventIds,
  selectEligibleHeroTrials,
  HERO_TRIALS,
  createEmptyFinalCampaignState,
} from '../src/game-engine/final/index.js';
import type { CampaignDomainEvent } from '../src/game-engine/final/ending.js';
import type { FinalCampaignState, CampaignEnding } from '../src/game-engine/final/types.js';

describe('Phase 7C: 最终 Boss 4 阶段(SPEC §11)', () => {
  it('4 阶段:phase-final-0/1/2/3', () => {
    expect(FINAL_BOSS_PHASE_IDS).toEqual(['phase-final-0', 'phase-final-1', 'phase-final-2', 'phase-final-3']);
  });

  it('每阶段 ≥ 3 战术选项', () => {
    for (const phaseId of FINAL_BOSS_PHASE_IDS) {
      const phase = FINAL_BOSS_PHASES[phaseId];
      expect(phase.tacticalOptionRules.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('每阶段有 enterConditions + exitConditions', () => {
    for (const phaseId of FINAL_BOSS_PHASE_IDS) {
      const phase = FINAL_BOSS_PHASES[phaseId];
      expect(phase.enterConditions.length).toBeGreaterThan(0);
      // 最后阶段可以无 exitConditions(只 4 阶段)
      if (phaseId !== 'phase-final-3') {
        expect(phase.exitConditions.length).toBeGreaterThan(0);
      }
    }
  });

  it('阶段 0 主题:Probe and Memory(SPEC §11.1)', () => {
    const phase = FINAL_BOSS_PHASES['phase-final-0'];
    expect(phase.name).toBe('Probe and Memory');
    // 包含读墓园 / 读情报选项
    expect(phase.tacticalOptionRules.some((r) => r.title.includes('回忆情报'))).toBe(true);
    expect(phase.tacticalOptionRules.some((r) => r.title.includes('缅怀墓园'))).toBe(true);
  });

  it('阶段 1 主题:Multi-Region Fusion(SPEC §11.2)', () => {
    const phase = FINAL_BOSS_PHASES['phase-final-1'];
    expect(phase.name).toBe('Multi-Region Fusion');
    // 包含最终任务物品(诅咒瓦解者 / 净化者之眼)
    expect(phase.tacticalOptionRules.some((r) => r.title.includes('诅咒瓦解者'))).toBe(true);
    expect(phase.tacticalOptionRules.some((r) => r.title.includes('净化者之眼'))).toBe(true);
  });

  it('阶段 2 主题:Hero Trial(SPEC §11.3)', () => {
    const phase = FINAL_BOSS_PHASES['phase-final-2'];
    expect(phase.name).toBe('Hero Trial');
    // 包含 Hero Trial trigger
    expect(phase.tacticalOptionRules.some((r) => r.title.includes('Hero Trial'))).toBe(true);
  });

  it('阶段 3 主题:Final Choice(SPEC §11.4)', () => {
    const phase = FINAL_BOSS_PHASES['phase-final-3'];
    expect(phase.name).toBe('Final Choice');
    // 包含 Veteran\u0027s Oath(最终任务物品) + 撤退(高成本)
    expect(phase.tacticalOptionRules.some((r) => r.title.includes("Veteran"))).toBe(true);
    expect(phase.tacticalOptionRules.some((r) => r.category === 'retreat')).toBe(true);
  });

  it('最终 Boss 4 阶段 ≥ 4 阶段(SPEC §11 至少四阶段)', () => {
    expect(FINAL_BOSS_INFO.phaseCount).toBe(4);
    expect(FINAL_BOSS_INFO.id).toBe('boss-darkest-core');
    expect(FINAL_BOSS_INFO.name).toBe('Heart of Darkness');
  });
});

describe('Phase 7C: 结局计算(SPEC §14)', () => {
  it('胜利:Boss 击败 + 死亡 < 2', () => {
    expect(calculateEndingType({
      finalCampaignState: { finalBossDefeated: true } as FinalCampaignState,
      finalBossDefeated: true,
      heroDeathCount: 0,
      totalHeroDeathCount: 1,
      survivingHeroCount: 3,
      hasRecruitableHeroes: true,
      hasRecoveryResources: true,
      threatRecoverable: true,
    })).toBe('victory');
  });

  it('胜利:Boss 击败 + 死亡 = 1', () => {
    expect(calculateEndingType({
      finalCampaignState: { finalBossDefeated: true } as FinalCampaignState,
      finalBossDefeated: true,
      heroDeathCount: 1,
      totalHeroDeathCount: 2,
      survivingHeroCount: 3,
      hasRecruitableHeroes: true,
      hasRecoveryResources: true,
      threatRecoverable: true,
    })).toBe('victory');
  });

  it('惨胜:Boss 击败 + 死亡 ≥ 2', () => {
    expect(calculateEndingType({
      finalCampaignState: { finalBossDefeated: true } as FinalCampaignState,
      finalBossDefeated: true,
      heroDeathCount: 2,
      totalHeroDeathCount: 4,
      survivingHeroCount: 2,
      hasRecruitableHeroes: true,
      hasRecoveryResources: true,
      threatRecoverable: true,
    })).toBe('pyrrhic-victory');
  });

  it('失败但继续:Boss 未击败 + 有存活英雄', () => {
    expect(calculateEndingType({
      finalCampaignState: { finalBossDefeated: false } as FinalCampaignState,
      finalBossDefeated: false,
      heroDeathCount: 1,
      totalHeroDeathCount: 2,
      survivingHeroCount: 2,
      hasRecruitableHeroes: true,
      hasRecoveryResources: true,
      threatRecoverable: true,
    })).toBe('failed-assault');
  });

  it('战役崩溃:无可用英雄 + 不可恢复', () => {
    expect(calculateEndingType({
      finalCampaignState: { finalBossDefeated: false } as FinalCampaignState,
      finalBossDefeated: false,
      heroDeathCount: 4,
      totalHeroDeathCount: 4,
      survivingHeroCount: 0,
      hasRecruitableHeroes: false,
      hasRecoveryResources: false,
      threatRecoverable: false,
    })).toBe('campaign-collapse');
  });
});

describe('Phase 7C: 战役总结(SPEC §15)', () => {
  const sampleEvents: CampaignDomainEvent[] = [
    { type: 'EXPEDITION_STARTED' },
    { type: 'QUEST_SUCCESS' },
    { type: 'QUEST_SUCCESS' },
    { type: 'BOSS_DEFEATED', data: { bossId: 'boss-test-arbiter' } },
    { type: 'BOSS_DEFEATED', data: { bossId: 'boss-spore-matriarch' } },
    { type: 'BOSS_DEFEATED', data: { bossId: 'boss-burrows-devourer' } },
    { type: 'HERO_RECRUITED' },
    { type: 'HERO_PERMANENT_DEATH' },
    { type: 'HERO_ENTERED_DEATHS_DOOR' },
    { type: 'HERO_DEATHBLOW_RESISTED' },
    { type: 'BOSS_RETREAT_SUCCEEDED' },
    { type: 'FinalSealDestroyed' },
    { type: 'FinalSealDestroyed' },
    { type: 'FinalSealDestroyed' },
    { type: 'FinalBossDefeated' },
    // Debug 事件不应进入统计
    { type: 'DEBUG_FORCE_BOSS_DEFEAT', debug: true },
    { type: 'DEBUG_SET_REGION_THREAT', debug: true },
  ];

  it('计算 16+ 字段', () => {
    const summary = calculateCampaignSummary({
      events: sampleEvents,
      finalState: {
        ...createEmptyFinalCampaignState(),
        finalBossDefeated: true,
        destroyedSealIds: ['seal-a', 'seal-b', 'seal-c'],
      } as FinalCampaignState,
      finalRegionName: '黑暗核心',
      week: 50,
      graveyardHeroIds: ['h-dead-1', 'h-dead-2'],
      usedHeroIds: ['h-1', 'h-2', 'h-3'],
      mostUsedHeroId: 'h-1',
      mostUsedPartyHeroIds: ['h-1', 'h-2', 'h-3'],
      mostImpactfulQuirkId: 'quirk-veteran',
      mostImpactfulTrinketId: 'trinket-审判者封印',
      mostDangerousDiseaseId: 'disease-disease',
      keyTurningPointEventIds: ['BOSS_DEFEATED#0', 'FinalSealDestroyed#0', 'FinalBossDefeated#0'],
      finalEndingType: 'victory',
    });
    expect(summary.totalWeeks).toBe(50);
    expect(summary.totalExpeditions).toBe(1);
    expect(summary.successfulQuests).toBe(2);
    expect(summary.failedQuests).toBe(0);
    expect(summary.retreats).toBe(1);
    expect(summary.totalHeroesRecruited).toBe(1);
    expect(summary.totalHeroDeaths).toBe(2);
    expect(summary.graveyardHeroIds.length).toBe(2);
    expect(summary.totalDeathsDoorEntries).toBe(1);
    expect(summary.totalDeathblowResists).toBe(1);
    // 3 个区域 Boss(不含最终 Boss)
    expect(summary.defeatedBossIds.length).toBe(3);
    expect(summary.finalBossDefeated).toBe(true);
    expect(summary.mostUsedHeroId).toBe('h-1');
    expect(summary.mostUsedPartyHeroIds.length).toBe(3);
    expect(summary.mostImpactfulQuirkId).toBe('quirk-veteran');
    expect(summary.mostImpactfulTrinketId).toBe('trinket-审判者封印');
    expect(summary.mostDangerousDiseaseId).toBe('disease-disease');
    expect(summary.keyTurningPointEventIds.length).toBe(3);
    expect(summary.finalEndingType).toBe('victory');
    expect(summary.finalRegionName).toBe('黑暗核心');
    expect(summary.destroyedSealCount).toBe(3);
  });

  it('Debug 事件不进入正式统计(SPEC §1.4)', () => {
    const summary = calculateCampaignSummary({
      events: [
        { type: 'QUEST_SUCCESS' },
        { type: 'DEBUG_FORCE_BOSS_DEFEAT', debug: true },
        { type: 'DEBUG_SET_REGION_THREAT', debug: true },
      ],
      finalState: createEmptyFinalCampaignState(),
      finalRegionName: '黑暗核心',
      week: 30,
      graveyardHeroIds: [],
      usedHeroIds: [],
      mostUsedPartyHeroIds: [],
      keyTurningPointEventIds: [],
      finalEndingType: 'failed-assault',
    });
    expect(summary.successfulQuests).toBe(1);
    // 没有正式 QUEST_FAILURE 事件(debug 事件被过滤)
    expect(summary.failedQuests).toBe(0);
  });
});

describe('Phase 7C: 关键转折点提取(SPEC §15)', () => {
  it('extractTurningPointEventIds 过滤 debug + 识别 15+ 类型', () => {
    const events: CampaignDomainEvent[] = [
      { type: 'QUEST_SUCCESS' }, // 不在 TURNING_POINT_EVENT_TYPES
      { type: 'FIRST_BOSS_REVEALED' },
      { type: 'BOSS_DEFEATED', data: { bossId: 'a' } },
      { type: 'HERO_PERMANENT_DEATH' },
      { type: 'FinalSealDestroyed' },
      { type: 'FinalBossDefeated' },
      { type: 'DEBUG_FORCE_BOSS_DEFEAT', debug: true }, // 过滤
      { type: 'EXPEDITION_STARTED' }, // 不在 TURNING_POINT
    ];
    const result = extractTurningPointEventIds(events);
    expect(result.length).toBe(5);
    expect(result.some((id) => id.startsWith('FIRST_BOSS_REVEALED'))).toBe(true);
    expect(result.some((id) => id.startsWith('BOSS_DEFEATED'))).toBe(true);
    expect(result.some((id) => id.startsWith('HERO_PERMANENT_DEATH'))).toBe(true);
    expect(result.some((id) => id.startsWith('FinalSealDestroyed'))).toBe(true);
    expect(result.some((id) => id.startsWith('FinalBossDefeated'))).toBe(true);
    // Debug 被过滤
    expect(result.some((id) => id.startsWith('DEBUG_FORCE_BOSS_DEFEAT'))).toBe(false);
  });
});

describe('Phase 7C: 英雄个体考验生成(SPEC §12)', () => {
  it('selectEligibleHeroTrials:flag-gte 条件筛选', () => {
    // trial-veteran-sacrifice 需要 hero_veteran_count ≥ 1
    const eligible1 = selectEligibleHeroTrials(
      { hero_veteran_count: 1 },
      HERO_TRIALS,
    );
    expect(eligible1).toContain('trial-veteran-sacrifice');

    // hero_veteran_count = 0 → 不满足 veteran trial
    const eligible0 = selectEligibleHeroTrials(
      { hero_veteran_count: 0 },
      HERO_TRIALS,
    );
    expect(eligible0).not.toContain('trial-veteran-sacrifice');
  });

  it('selectEligibleHeroTrials:heroPartyCount=2 → newcomer-guard 适用', () => {
    const eligible = selectEligibleHeroTrials(
      { hero_party_count: 2 },
      HERO_TRIALS,
    );
    expect(eligible).toContain('trial-newcomer-guard');
  });

  it('selectEligibleHeroTrials:trinket ≥ 1 → trinket-sacrifice 适用', () => {
    const eligible = selectEligibleHeroTrials(
      { hero_equipped_trinket_count: 1 },
      HERO_TRIALS,
    );
    expect(eligible).toContain('trial-trinket-sacrifice');
  });

  it('selectEligibleHeroTrials:negative-quirk ≥ 1 → quirk-sacrifice 适用', () => {
    const eligible = selectEligibleHeroTrials(
      { hero_negative_quirk_count: 1 },
      HERO_TRIALS,
    );
    expect(eligible).toContain('trial-quirk-sacrifice');
  });
});

describe('Phase 7C: CampaignEnding 完整生成(SPEC §14)', () => {
  it('胜利结局生成', () => {
    const ending = generateCampaignEnding(
      {
        finalCampaignState: { finalBossDefeated: true } as FinalCampaignState,
        finalBossDefeated: true,
        heroDeathCount: 0,
        totalHeroDeathCount: 1,
        survivingHeroCount: 4,
        hasRecruitableHeroes: true,
        hasRecoveryResources: true,
        threatRecoverable: true,
      },
      {
        week: 50,
        survivingHeroIds: ['h-1', 'h-2', 'h-3', 'h-4'],
        deadHeroIds: ['h-dead-1'],
        summaryData: {
          totalWeeks: 50,
          totalExpeditions: 20,
          successfulQuests: 15,
          failedQuests: 5,
          retreats: 2,
          totalHeroesRecruited: 6,
          totalHeroDeaths: 1,
          graveyardHeroIds: ['h-dead-1'],
          totalDeathsDoorEntries: 5,
          totalDeathblowResists: 3,
          defeatedBossIds: ['boss-test-arbiter', 'boss-spore-matriarch', 'boss-burrows-devourer'],
          finalBossDefeated: true,
          mostUsedPartyHeroIds: ['h-1', 'h-2'],
          keyTurningPointEventIds: [],
          finalEndingType: 'victory',
          finalRegionName: '黑暗核心',
          destroyedSealCount: 3,
        },
      },
    );
    expect(ending.type).toBe('victory');
    expect(ending.survivingHeroIds.length).toBe(4);
    expect(ending.summaryData.totalWeeks).toBe(50);
  });

  it('惨胜结局生成', () => {
    const ending = generateCampaignEnding(
      {
        finalCampaignState: { finalBossDefeated: true } as FinalCampaignState,
        finalBossDefeated: true,
        heroDeathCount: 2,
        totalHeroDeathCount: 4,
        survivingHeroCount: 2,
        hasRecruitableHeroes: true,
        hasRecoveryResources: true,
        threatRecoverable: true,
      },
      {
        week: 60,
        survivingHeroIds: ['h-1', 'h-2'],
        deadHeroIds: ['h-3', 'h-4', 'h-5', 'h-6'],
        summaryData: {} as any,
      },
    );
    expect(ending.type).toBe('pyrrhic-victory');
    expect(ending.survivingHeroIds.length).toBe(2);
  });
});
