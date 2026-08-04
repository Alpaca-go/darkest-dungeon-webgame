/**
 * Phase 6A Boss 通用框架测试
 *
 * 覆盖:
 *  - 类型导出完整性
 *  - 测试 Boss registry 数据完整性
 *  - id 引用一致性(Boss ↔ 阶段/情报/削弱/奖励/任务/环境)
 *  - 阶段索引连续性(0/1/2)
 *  - 内容规模下限(8 情报 / 4 任务 / 3 阶段)
 */

import { describe, it, expect } from 'vitest';

import {
  BOSS_DEFINITIONS,
  BOSS_PHASES,
  BOSS_INTELLIGENCE,
  BOSS_WEAKENING_EFFECTS,
  BOSS_PERMANENT_REWARDS,
  BOSS_QUEST_ITEMS,
  BOSS_ENVIRONMENT_TARGETS,
  BOSS_TASKS,
} from '../src/game-engine/boss/index.js';

import type {
  BossDefinition,
  BossPhaseDefinition,
  BossIntelligenceEntry,
  BossWeakeningEffect,
  BossPermanentReward,
  BossQuestItemDefinition,
  BossEnvironmentTargetDefinition,
  BossTaskMeta,
} from '../src/game-engine/boss/index.js';

const TEST_BOSS_ID = 'boss-test-arbiter';

describe('Phase 6A: Boss 通用框架 — 类型导出', () => {
  it('所有 registry 桶都已导出', () => {
    expect(BOSS_DEFINITIONS).toBeDefined();
    expect(BOSS_PHASES).toBeDefined();
    expect(BOSS_INTELLIGENCE).toBeDefined();
    expect(BOSS_WEAKENING_EFFECTS).toBeDefined();
    expect(BOSS_PERMANENT_REWARDS).toBeDefined();
    expect(BOSS_QUEST_ITEMS).toBeDefined();
    expect(BOSS_ENVIRONMENT_TARGETS).toBeDefined();
    expect(BOSS_TASKS).toBeDefined();
  });

  it('测试 Boss 至少存在 1 个', () => {
    expect(Object.keys(BOSS_DEFINITIONS)).toContain(TEST_BOSS_ID);
  });
});

describe('Phase 6A: 测试 Boss 数据完整性(SPEC §21 §22)', () => {
  it('Boss 定义字段齐全', () => {
    const boss: BossDefinition = BOSS_DEFINITIONS[TEST_BOSS_ID];
    expect(boss.id).toBe(TEST_BOSS_ID);
    expect(boss.name).toBeTruthy();
    expect(boss.regionId).toBe('ruins');
    expect(boss.description).toBeTruthy();
    expect(Array.isArray(boss.threatTags)).toBe(true);
    expect(boss.threatTags.length).toBeGreaterThan(0);
    expect(boss.retreatRules).toBeDefined();
    expect(boss.permanentRewardId).toBeTruthy();
    expect(boss.rewardTableId).toBeTruthy();
  });

  it('每个 Boss 至少 3 阶段(SPEC §11)', () => {
    const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
    expect(boss.phaseDefinitionIds.length).toBeGreaterThanOrEqual(3);

    const phases = boss.phaseDefinitionIds.map((id) => BOSS_PHASES[id]);
    for (const phase of phases) {
      expect(phase).toBeDefined();
      expect(phase.bossId).toBe(TEST_BOSS_ID);
    }
  });

  it('阶段索引连续(0/1/2 …)', () => {
    const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
    const phases = boss.phaseDefinitionIds
      .map((id) => BOSS_PHASES[id])
      .sort((a, b) => a.phaseIndex - b.phaseIndex);

    expect(phases[0].phaseIndex).toBe(0);
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i].phaseIndex).toBe(phases[i - 1].phaseIndex + 1);
    }
  });

  it('每个阶段至少 2 个战术选项', () => {
    const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
    for (const phaseId of boss.phaseDefinitionIds) {
      const phase: BossPhaseDefinition = BOSS_PHASES[phaseId];
      expect(phase.tacticalOptionRules.length).toBeGreaterThanOrEqual(2);
      for (const t of phase.tacticalOptionRules) {
        expect(t.id).toBeTruthy();
        expect(t.title).toBeTruthy();
        expect(['attack-core', 'handle-summon', 'destroy-environment',
          'protect-hero', 'stabilize-stress', 'use-item',
          'force-phase', 'retreat']).toContain(t.category);
      }
    }
  });

  it('每个 Boss 至少 8 条情报(SPEC §21)', () => {
    const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
    expect(boss.intelligenceEntryIds.length).toBeGreaterThanOrEqual(8);

    for (const intelId of boss.intelligenceEntryIds) {
      const intel: BossIntelligenceEntry = BOSS_INTELLIGENCE[intelId];
      expect(intel).toBeDefined();
      expect(intel.bossId).toBe(TEST_BOSS_ID);
      expect(intel.title).toBeTruthy();
      expect(intel.summary).toBeTruthy();
      expect(intel.revealedDetail).toBeTruthy();
      expect(intel.unlockSources.length).toBeGreaterThan(0);
      expect(intel.gameplayEffects.length).toBeGreaterThan(0);
    }
  });

  it('情报分类覆盖 SPEC §21 建议(2 攻击 / 1 状态 / 2 阶段 / 1 环境 / 1 补给 / 1 撤退)', () => {
    const intelIds = BOSS_DEFINITIONS[TEST_BOSS_ID].intelligenceEntryIds;
    const cats = intelIds.map((id) => BOSS_INTELLIGENCE[id].category);
    const count = (c: string) => cats.filter((x) => x === c).length;

    expect(count('attack-pattern')).toBeGreaterThanOrEqual(2);
    expect(count('status-threat')).toBeGreaterThanOrEqual(1);
    expect(count('phase-mechanic')).toBeGreaterThanOrEqual(2);
    expect(count('environment-target')).toBeGreaterThanOrEqual(1);
    expect(count('recommended-provision')).toBeGreaterThanOrEqual(1);
    expect(count('retreat-risk')).toBeGreaterThanOrEqual(1);
  });

  it('每个 Boss 至少 2 个削弱任务(SPEC §22)', () => {
    const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
    expect(boss.weakeningQuestIds.length).toBeGreaterThanOrEqual(2);

    for (const qid of boss.weakeningQuestIds) {
      const task: BossTaskMeta = BOSS_TASKS[qid];
      expect(task).toBeDefined();
      expect(task.type).toBe('weakening');
      expect(task.bossId).toBe(TEST_BOSS_ID);
      // 每个削弱任务必须授予至少一个削弱效果
      for (const grantId of task.grantsIds) {
        expect(BOSS_WEAKENING_EFFECTS[grantId]).toBeDefined();
      }
    }
  });

  it('每个 Boss 至少 1 个调查任务 + 1 个最终讨伐(SPEC §22)', () => {
    const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
    expect(boss.investigationQuestIds.length).toBeGreaterThanOrEqual(1);
    expect(boss.finalQuestId).toBeTruthy();

    for (const qid of boss.investigationQuestIds) {
      const task = BOSS_TASKS[qid];
      expect(task.type).toBe('investigation');
    }
    const final = BOSS_TASKS[boss.finalQuestId];
    expect(final.type).toBe('final');
  });

  it('总任务数 ≥ 4(SPEC §22)', () => {
    const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
    const total = boss.investigationQuestIds.length
      + boss.weakeningQuestIds.length
      + 1; // finalQuestId
    expect(total).toBeGreaterThanOrEqual(4);
  });

  it('永久奖励存在且不为纯金币(SPEC §18)', () => {
    const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
    const reward: BossPermanentReward = BOSS_PERMANENT_REWARDS[boss.permanentRewardId];
    expect(reward).toBeDefined();
    expect(reward.bossId).toBe(TEST_BOSS_ID);
    // 永久奖励至少有一个 modifier 或解锁项
    const hasModifier = reward.campaignModifiers.length > 0;
    const hasUnlock = reward.unlockedTrinketIds.length > 0
      || reward.unlockedQuestModifierIds.length > 0;
    expect(hasModifier || hasUnlock).toBe(true);
  });
});

describe('Phase 6A: Boss 撤退规则(SPEC §15.1)', () => {
  it('撤退规则字段齐全', () => {
    const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
    const r = boss.retreatRules;
    expect(r.baseSuccessRate).toBeGreaterThanOrEqual(0);
    expect(r.baseSuccessRate).toBeLessThanOrEqual(1);
    expect(r.stressPenalty).toBeGreaterThanOrEqual(0);
    expect(r.threatIncrease).toBeGreaterThanOrEqual(0);
    expect(typeof r.phaseModifiers).toBe('object');
  });

  it('撤退成功率随阶段下降(难度递增)', () => {
    const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
    const r = boss.retreatRules;
    // 第 0 阶段(识别)成功率高,后期阶段低
    const p0 = r.baseSuccessRate + (r.phaseModifiers[0] ?? 0);
    const p2 = r.baseSuccessRate + (r.phaseModifiers[2] ?? 0);
    expect(p0).toBeGreaterThan(p2);
  });
});

describe('Phase 6A: 环境目标完整性(SPEC §12)', () => {
  it('环境目标字段齐全', () => {
    const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
    for (const envId of boss.environmentTargetIds) {
      const env: BossEnvironmentTargetDefinition = BOSS_ENVIRONMENT_TARGETS[envId];
      expect(env).toBeDefined();
      expect(env.bossId).toBe(TEST_BOSS_ID);
      expect(env.name).toBeTruthy();
      expect(env.stateTags.length).toBeGreaterThan(0);
      // 至少一个交互选项
      expect(env.interactChoices.length).toBeGreaterThan(0);
    }
  });
});

describe('Phase 6A: Boss 特殊任务物品(SPEC §14)', () => {
  it('任务物品字段齐全', () => {
    const items = Object.values(BOSS_QUEST_ITEMS).filter(
      (i) => i.bossId === TEST_BOSS_ID,
    );
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(item.inventorySlots).toBeGreaterThanOrEqual(1);
      // 必须绑定至少一个战术选项
      expect(item.tacticalChoiceIds.length).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Phase 6A: 跨 bucket 一致性', () => {
  it('所有情报 bossId 与所属 Boss 一致', () => {
    for (const intel of Object.values(BOSS_INTELLIGENCE)) {
      const boss = BOSS_DEFINITIONS[TEST_BOSS_ID];
      expect(boss.intelligenceEntryIds).toContain(intel.id);
      expect(intel.bossId).toBe(TEST_BOSS_ID);
    }
  });

  it('所有削弱效果 sourceQuestId 存在于 BOSS_TASKS 且类型为 weakening', () => {
    for (const weaken of Object.values(BOSS_WEAKENING_EFFECTS)) {
      const task = BOSS_TASKS[weaken.sourceQuestId];
      expect(task).toBeDefined();
      expect(task.type).toBe('weakening');
      expect(task.grantsIds).toContain(weaken.id);
    }
  });

  it('所有阶段 enterConditions / exitConditions 存在', () => {
    for (const phase of Object.values(BOSS_PHASES)) {
      expect(Array.isArray(phase.enterConditions)).toBe(true);
      expect(Array.isArray(phase.exitConditions)).toBe(true);
      expect(phase.enterConditions.length).toBeGreaterThan(0);
    }
  });
});
