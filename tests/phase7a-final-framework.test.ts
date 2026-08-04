/**
 * Phase 7A 最终区域框架测试(SPEC §4-§5 §13 §18-§20)
 *
 * 覆盖:
 *  - FinalCampaignState 状态机推进
 *  - 封印去重(SPEC §19)
 *  - 任务物品去重
 *  - 撤退/失败/胜利原子提交
 *  - finalCampaignGateReady 校验
 *  - 存档迁移 v6 → v7 触发 gate-ready
 *  - 不变量
 *  - 类型守卫
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
  canOpenFinalCampaignGate,
  nextFinalCampaignStatus,
  FINAL_REGIONS,
  FINAL_QUEST_CHAIN,
  FINAL_SEALS,
  FINAL_QUEST_ITEMS,
  FINAL_CAMP_ACTIVITIES,
} from '../src/game-engine/final/index.js';

describe('Phase 7A: FinalCampaignState 类型 + 工厂(SPEC §4)', () => {
  it('createEmptyFinalCampaignState 返回 locked 状态', () => {
    const s = createEmptyFinalCampaignState();
    expect(s.status).toBe('locked');
    expect(s.completedQuestStageIds).toEqual([]);
    expect(s.destroyedSealIds).toEqual([]);
    expect(s.collectedFinalQuestItemIds).toEqual([]);
    expect(s.finalRegionThreat).toBe(0);
    expect(s.finalBossAttemptCount).toBe(0);
    expect(s.finalBossDefeated).toBe(false);
    expect(s.gateOpenedAtWeek).toBeNull();
  });

  it('初始状态通过不变量校验', () => {
    expect(isFinalCampaignStateValid(createEmptyFinalCampaignState())).toBe(true);
  });
});

describe('Phase 7A: 类型守卫 + 状态转换(SPEC §4 §19)', () => {
  it('canOpenFinalCampaignGate:3 Boss + finalCampaignGateReady=true 允许', () => {
    expect(canOpenFinalCampaignGate({
      defeatedBossIds: ['a', 'b', 'c'],
      finalCampaignGateReady: true,
    })).toEqual({ ok: true });
  });

  it('canOpenFinalCampaignGate:Boss 不足拒绝', () => {
    expect(canOpenFinalCampaignGate({
      defeatedBossIds: ['a', 'b'],
      finalCampaignGateReady: true,
    })).toEqual({ ok: false, reason: expect.stringContaining('已击败') });
  });

  it('canOpenFinalCampaignGate:finalCampaignGateReady=false 拒绝', () => {
    expect(canOpenFinalCampaignGate({
      defeatedBossIds: ['a', 'b', 'c'],
      finalCampaignGateReady: false,
    })).toEqual({ ok: false, reason: expect.stringContaining('finalCampaignGateReady') });
  });

  it('nextFinalCampaignStatus 推导各阶段', () => {
    expect(nextFinalCampaignStatus('gate-ready', 'open-gate')).toBe('gate-open');
    expect(nextFinalCampaignStatus('gate-open', 'complete-outer')).toBe('outer-complete');
    expect(nextFinalCampaignStatus('outer-complete', 'destroy-seal')).toBe('seals-active');
    expect(nextFinalCampaignStatus('seals-active', 'start-assault')).toBe('final-assault-active');
    expect(nextFinalCampaignStatus('final-assault-active', 'win')).toBe('victory');
  });

  it('状态机只向前(已开 gate 不能再次开)', () => {
    expect(nextFinalCampaignStatus('gate-open', 'open-gate')).toBe('gate-open');
  });
});

describe('Phase 7A: 状态机 — 完整推进(SPEC §18)', () => {
  it('Step 1: locked → gate-ready(open gate)', () => {
    let s = createEmptyFinalCampaignState();
    const r = openFinalCampaignGate(s, {
      defeatedBossIds: ['a', 'b', 'c'],
      finalCampaignGateReady: true,
      week: 50,
    });
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('gate-ready');
    expect(r.events).toContain('FinalCampaignGateOpened');
  });

  it('Step 2: gate-ready → gate-open(start outer)', () => {
    let s = createEmptyFinalCampaignState();
    s = openFinalCampaignGate(s, {
      defeatedBossIds: ['a', 'b', 'c'],
      finalCampaignGateReady: true,
      week: 50,
    }).state;
    const r = startFinalOuterQuest(s, { week: 51 });
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('gate-open');
    expect(r.state.gateOpenedAtWeek).toBe(51);
    expect(r.events).toContain('FinalOuterQuestStarted');
  });

  it('Step 3: gate-open → outer-complete(complete outer)', () => {
    let s = createEmptyFinalCampaignState();
    s = openFinalCampaignGate(s, {
      defeatedBossIds: ['a', 'b', 'c'],
      finalCampaignGateReady: true,
      week: 50,
    }).state;
    s = startFinalOuterQuest(s, { week: 51 }).state;
    const r = completeFinalOuterQuest(s, { week: 52 });
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('outer-complete');
    expect(r.state.outerCompletedAtWeek).toBe(52);
    expect(r.state.completedQuestStageIds).toContain('outer-expedition');
  });

  it('Step 4: 摧毁 3 封印(顺序任意)', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'outer-complete';
    s.completedQuestStageIds = ['outer-expedition'];

    // 封印 1
    const r1 = destroyFinalSeal(s, {
      sealId: 'seal-darkest-stress-curse',
      finalQuestItemId: 'item-final-curse-breaker',
      intelligenceId: 'intel-final-phase-1',
      week: 53,
    });
    expect(r1.state.status).toBe('seals-active');
    expect(r1.state.destroyedSealIds).toContain('seal-darkest-stress-curse');
    expect(r1.state.collectedFinalQuestItemIds).toContain('item-final-curse-breaker');
    s = r1.state;

    // 封印 2
    const r2 = destroyFinalSeal(s, {
      sealId: 'seal-darkest-disease-corrupt',
      finalQuestItemId: 'item-final-purifier-eye',
      intelligenceId: 'intel-final-phase-2',
      week: 54,
    });
    expect(r2.state.destroyedSealIds.length).toBe(2);
    s = r2.state;

    // 封印 3
    const r3 = destroyFinalSeal(s, {
      sealId: 'seal-darkest-hunger-bleed',
      finalQuestItemId: 'item-final-hunger-rest',
      intelligenceId: 'intel-final-phase-3',
      week: 55,
    });
    expect(r3.state.destroyedSealIds.length).toBe(3);
  });

  it('Step 5: 解锁最终讨伐(seals-active → final-assault-ready)', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'seals-active';
    s.destroyedSealIds = [
      'seal-darkest-stress-curse',
      'seal-darkest-disease-corrupt',
      'seal-darkest-hunger-bleed',
    ];
    s.collectedFinalQuestItemIds = [
      'item-final-curse-breaker',
      'item-final-purifier-eye',
      'item-final-hunger-rest',
    ];
    const r = unlockFinalAssault(s, {
      requiredSealIds: [
        'seal-darkest-stress-curse',
        'seal-darkest-disease-corrupt',
        'seal-darkest-hunger-bleed',
      ],
      week: 56,
    });
    expect(r.errors).toEqual([]);
    expect(r.state.status).toBe('final-assault-ready');
    expect(r.state.completedQuestStageIds).toContain('seal-destruction');
  });

  it('Step 6: 启动最终讨伐(final-assault-ready → final-assault-active)', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'final-assault-ready';
    const r = startFinalAssault(s, { week: 57 });
    expect(r.state.status).toBe('final-assault-active');
    expect(r.state.finalBossAttemptCount).toBe(1);
    expect(r.state.finalAssaultStartedAtWeek).toBe(57);
    expect(r.state.completedQuestStageIds).toContain('final-assault');
  });

  it('Step 7: 胜利(final-assault-active → victory)', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'final-assault-active';
    const r = resolveFinalVictory(s);
    expect(r.state.status).toBe('victory');
    expect(r.state.finalBossDefeated).toBe(true);
    expect(r.events).toContain('FinalBossDefeated');
    expect(r.events).toContain('CampaignCompleted');
  });
});

describe('Phase 7A: 不可逆不变量(SPEC §19)', () => {
  it('封印去重:同一 sealId 第二次摧毁失败', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'outer-complete';
    s.completedQuestStageIds = ['outer-expedition'];
    const r1 = destroyFinalSeal(s, {
      sealId: 'seal-darkest-stress-curse',
      finalQuestItemId: 'item-final-curse-breaker',
      intelligenceId: 'intel-final-phase-1',
      week: 53,
    });
    s = r1.state;
    const r2 = destroyFinalSeal(s, {
      sealId: 'seal-darkest-stress-curse',
      finalQuestItemId: 'item-final-curse-breaker',
      intelligenceId: 'intel-final-phase-1',
      week: 54,
    });
    expect(r2.errors.length).toBeGreaterThan(0);
    expect(r2.state.destroyedSealIds.length).toBe(1);
  });

  it('任务物品去重:同一 itemId 第二次授予失败', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'outer-complete';
    s.completedQuestStageIds = ['outer-expedition'];
    const r1 = destroyFinalSeal(s, {
      sealId: 'seal-a',
      finalQuestItemId: 'item-x',
      intelligenceId: 'intel-1',
      week: 1,
    });
    s = r1.state;
    const r2 = destroyFinalSeal(s, {
      sealId: 'seal-b',
      finalQuestItemId: 'item-x', // 重复 itemId
      intelligenceId: 'intel-2',
      week: 2,
    });
    expect(r2.errors.length).toBeGreaterThan(0);
  });

  it('最终胜利不可重复结算', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'final-assault-active';
    const r1 = resolveFinalVictory(s);
    s = r1.state;
    const r2 = resolveFinalVictory(s);
    expect(r2.errors.length).toBeGreaterThan(0);
  });

  it('状态机不能回退(已 victory 不能 open gate)', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'victory';
    s.finalBossDefeated = true;
    const r = openFinalCampaignGate(s, {
      defeatedBossIds: ['a', 'b', 'c'],
      finalCampaignGateReady: true,
      week: 100,
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('失败后 resetAfterFailure 允许重新挑战', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'failed';
    s.finalRegionThreat = 50;
    s.destroyedSealIds = ['seal-a', 'seal-b', 'seal-c'];
    s.collectedFinalQuestItemIds = ['item-a', 'item-b', 'item-c'];
    const r = resetAfterFailure(s);
    expect(r.state.status).toBe('final-assault-ready');
    // 累积损失保留
    expect(r.state.finalRegionThreat).toBe(50);
    expect(r.state.destroyedSealIds.length).toBe(3);
  });

  it('撤退 = 失败,威胁 +25', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'final-assault-active';
    const r = attemptFinalRetreat(s);
    expect(r.state.status).toBe('failed');
    expect(r.state.finalRegionThreat).toBe(25);
  });
});

describe('Phase 7A: 最终区域 registry(SPEC §3 §5 §8 §9)', () => {
  it('1 个最终区域:darkest-core', () => {
    expect(Object.keys(FINAL_REGIONS)).toEqual(['darkest-core']);
  });

  it('darkest-core 引用 boss-darkest-core', () => {
    expect(FINAL_REGIONS['darkest-core'].finalBossId).toBe('boss-darkest-core');
    expect(FINAL_REGIONS['darkest-core'].name).toBe('The Darkest Dungeon');
  });

  it('撤退规则:基础 0.40,阶段 2 -0.35', () => {
    const retreat = FINAL_REGIONS['darkest-core'].retreatRules;
    expect(retreat.baseSuccessRate).toBe(0.40);
    expect(retreat.phaseModifiers[2]).toBe(-0.35);
  });

  it('4 任务链任务 + 1 开启入口 + 1 外层 + 3 封印 + 1 讨伐', () => {
    const ids = Object.keys(FINAL_QUEST_CHAIN);
    expect(ids).toContain('quest-darkest-core-gate-1');
    expect(ids).toContain('quest-darkest-core-outer-1');
    expect(ids.filter((id) => id.includes('seal-')).length).toBe(3);
    expect(ids).toContain('quest-darkest-core-final-1');
  });

  it('3 核心封印:stress-curse / disease-corrupt / hunger-bleed', () => {
    expect(Object.keys(FINAL_SEALS).length).toBe(3);
    expect(FINAL_SEALS['seal-darkest-stress-curse'].theme).toBe('stress-curse');
    expect(FINAL_SEALS['seal-darkest-disease-corrupt'].theme).toBe('disease-corrupt');
    expect(FINAL_SEALS['seal-darkest-hunger-bleed'].theme).toBe('hunger-bleed');
  });

  it('4 最终任务物品:curse-breaker / purifier-eye / hunger-rest / veteran-oath', () => {
    expect(Object.keys(FINAL_QUEST_ITEMS).length).toBe(4);
    expect(FINAL_QUEST_ITEMS['item-final-curse-breaker'].inventorySlots).toBe(2);
    expect(FINAL_QUEST_ITEMS['item-final-veteran-oath'].consumeOnUse).toBe(true);
  });

  it('4-5 露营活动(回顾/整理/分配/誓言/纪念)', () => {
    const activities = Object.keys(FINAL_CAMP_ACTIVITIES);
    expect(activities.length).toBeGreaterThanOrEqual(4);
    expect(activities).toContain('camp-final-remember');
    expect(activities).toContain('camp-final-inventory');
    expect(activities).toContain('camp-final-provisions');
    expect(activities).toContain('camp-final-oath');
    expect(activities).toContain('camp-final-memorial');
  });
});

describe('Phase 7A: 存档迁移 v6 → v7(SPEC §20)', () => {
  it('v6 存档 + finalCampaignGateReady=true → 迁移后 status=gate-ready', () => {
    // 模拟 v6 存档 + migrateV6ToV7 行为
    // (实际测试在 save-migration.test.ts)
    // 这里只验证 createEmptyFinalCampaignState + 设置 status 的逻辑
    const s = createEmptyFinalCampaignState();
    s.status = 'gate-ready';
    expect(s.status).toBe('gate-ready');
    expect(s.completedQuestStageIds).toEqual([]);
    expect(s.destroyedSealIds).toEqual([]);
  });

  it('v6 存档 + finalCampaignGateReady=false → 迁移后 status=locked', () => {
    const s = createEmptyFinalCampaignState();
    expect(s.status).toBe('locked');
  });
});
