/**
 * Phase 7B 最终任务链内容测试(SPEC §7-§12)
 *
 * 覆盖:
 *  - 4 普通敌人 + 2 精英(SPEC §8)
 *  - 4 奇物(SPEC §8)
 *  - 3 陷阱(SPEC §8)
 *  - 16-20 节点最终路线(SPEC §7)
 *  - 5 露营活动(SPEC §10,7A 已写,这里只验证完整性)
 *  - 4 英雄个体考验(SPEC §12)
 *  - 任务链 4 阶段
 */

import { describe, it, expect } from 'vitest';
import {
  FINAL_ENEMIES,
  FINAL_CURIOS,
  FINAL_TRAPS,
  FINAL_ROUTE,
  HERO_TRIALS,
  FINAL_QUEST_CHAIN,
  FINAL_CAMP_ACTIVITIES,
  FINAL_REGIONS,
  FINAL_SEALS,
  FINAL_QUEST_ITEMS,
} from '../src/game-engine/final/index.js';

describe('Phase 7B: 4 普通敌人 + 2 精英(SPEC §8)', () => {
  it('6 个敌人,4 normal + 2 elite', () => {
    const ids = Object.keys(FINAL_ENEMIES);
    expect(ids.length).toBe(6);
    const normal = ids.filter((id) => FINAL_ENEMIES[id].tier === 'normal');
    const elite = ids.filter((id) => FINAL_ENEMIES[id].tier === 'elite');
    expect(normal.length).toBe(4);
    expect(elite.length).toBe(2);
  });

  it('4 普通敌人:记忆吞噬者/无光使徒/腐化守门者/失序之影', () => {
    expect(FINAL_ENEMIES['enemy-memory-devourer']).toBeDefined();
    expect(FINAL_ENEMIES['enemy-lightless-apostle']).toBeDefined();
    expect(FINAL_ENEMIES['enemy-corrupt-warden']).toBeDefined();
    expect(FINAL_ENEMIES['enemy-disorder-shadow']).toBeDefined();
  });

  it('2 精英:深渊执政官/终末猎手', () => {
    expect(FINAL_ENEMIES['enemy-abyss-magistrate']).toBeDefined();
    expect(FINAL_ENEMIES['enemy-final-hunter']).toBeDefined();
  });

  it('每个敌人有 description + threatTags + mechanics', () => {
    for (const enemy of Object.values(FINAL_ENEMIES)) {
      expect(enemy.description.length).toBeGreaterThanOrEqual(20);
      expect(enemy.threatTags.length).toBeGreaterThan(0);
      expect(enemy.mechanics.length).toBeGreaterThan(0);
    }
  });
});

describe('Phase 7B: 4 奇物(SPEC §8)', () => {
  it('4 奇物存在', () => {
    const ids = Object.keys(FINAL_CURIOS);
    expect(ids.length).toBe(4);
    expect(FINAL_CURIOS['curio-darkest-memorial']).toBeDefined();
    expect(FINAL_CURIOS['curio-darkest-banner']).toBeDefined();
    expect(FINAL_CURIOS['curio-darkest-shrine']).toBeDefined();
    expect(FINAL_CURIOS['curio-darkest-memory']).toBeDefined();
  });

  it('每个奇物有 2-3 选项', () => {
    for (const curio of Object.values(FINAL_CURIOS)) {
      expect(curio.options.length).toBeGreaterThanOrEqual(2);
      expect(curio.options.length).toBeLessThanOrEqual(3);
      // 必须有 safe 选项(不打扰/绕过/原样放回)
      expect(curio.options.some((o) => o.riskTags.includes('safe'))).toBe(true);
    }
  });

  it('英雄纪念碑包含 stress-down / positive-quirk 效果', () => {
    const memorial = FINAL_CURIOS['curio-darkest-memorial'];
    expect(memorial.options.some((o) => o.riskTags.includes('stress-down'))).toBe(true);
    expect(memorial.options.some((o) => o.riskTags.includes('positive-quirk'))).toBe(true);
  });

  it('封存记忆有 gamble-quirk 选项', () => {
    const memory = FINAL_CURIOS['curio-darkest-memory'];
    expect(memory.options.some((o) => o.riskTags.includes('gamble-quirk'))).toBe(true);
  });
});

describe('Phase 7B: 3 陷阱(SPEC §8)', () => {
  it('3 陷阱:记忆断层/无光裂隙/逆转封印', () => {
    expect(FINAL_TRAPS['trap-darkest-fault']).toBeDefined();
    expect(FINAL_TRAPS['trap-darkest-rift']).toBeDefined();
    expect(FINAL_TRAPS['trap-darkest-seal']).toBeDefined();
  });

  it('每个陷阱有 damage + statusEffect + detectDifficulty + disarmDifficulty', () => {
    for (const trap of Object.values(FINAL_TRAPS)) {
      expect(trap.damage).toBeGreaterThan(0);
      expect(trap.statusEffect).toBeDefined();
      expect(trap.detectDifficulty).toBeGreaterThanOrEqual(0);
      expect(trap.detectDifficulty).toBeLessThanOrEqual(100);
      expect(trap.disarmDifficulty).toBeGreaterThanOrEqual(0);
      expect(trap.disarmDifficulty).toBeLessThanOrEqual(100);
    }
  });

  it('逆转封印触发 revert-seal 效果', () => {
    expect(FINAL_TRAPS['trap-darkest-seal'].statusEffect.kind).toBe('revert-seal');
  });
});

describe('Phase 7B: 16-20 节点最终路线(SPEC §7)', () => {
  it('路线 18 节点(16-20 范围)', () => {
    expect(FINAL_ROUTE.totalNodes).toBeGreaterThanOrEqual(16);
    expect(FINAL_ROUTE.totalNodes).toBeLessThanOrEqual(20);
  });

  it('露营节点 ≥ 1', () => {
    expect(FINAL_ROUTE.campNodeIndices.length).toBeGreaterThanOrEqual(1);
  });

  it('重大背包取舍 ≥ 1', () => {
    expect(FINAL_ROUTE.tradeoffNodeIndices.length).toBeGreaterThanOrEqual(1);
  });

  it('不可逆选择 ≥ 1', () => {
    expect(FINAL_ROUTE.irreversibleNodeIndices.length).toBeGreaterThanOrEqual(1);
  });

  it('撤退判断 ≥ 1', () => {
    expect(FINAL_ROUTE.retreatDecisionNodeIndices.length).toBeGreaterThanOrEqual(1);
  });

  it('最终 Boss 准备节点在末尾', () => {
    expect(FINAL_ROUTE.bossPrepNodeIndex).toBe(FINAL_ROUTE.totalNodes - 1);
  });

  it('路线节点数量与 totalNodes 一致(分叉路径算多个节点)', () => {
    // 11 个主节点(fn-0/1/2/3/5/6/7/8/9/10/11/12/13/14/15/16/17) + 3 个分叉(fn-4-stress/disease/hunger) = 20
    expect(FINAL_ROUTE.nodes.length).toBe(FINAL_ROUTE.totalNodes);
  });

  it('路线包含 4 种节点类型:encounter/elite/curio/trap', () => {
    const types = new Set(FINAL_ROUTE.nodes.map((n) => n.type));
    expect(types.has('encounter')).toBe(true);
    expect(types.has('elite')).toBe(true);
    expect(types.has('curio')).toBe(true);
    expect(types.has('trap')).toBe(true);
    expect(types.has('camp')).toBe(true);
    expect(types.has('fork')).toBe(true);
  });
});

describe('Phase 7B: 4 英雄个体考验(SPEC §12)', () => {
  it('4 英雄个体考验存在', () => {
    const ids = Object.keys(HERO_TRIALS);
    expect(ids.length).toBe(4);
    expect(HERO_TRIALS['trial-veteran-sacrifice']).toBeDefined();
    expect(HERO_TRIALS['trial-newcomer-guard']).toBeDefined();
    expect(HERO_TRIALS['trial-trinket-sacrifice']).toBeDefined();
    expect(HERO_TRIALS['trial-quirk-sacrifice']).toBeDefined();
  });

  it('每个考验有 eligibleHeroConditions + 1+ 选择规则', () => {
    for (const trial of Object.values(HERO_TRIALS)) {
      expect(trial.eligibleHeroConditions.length).toBeGreaterThan(0);
      expect(trial.generatedChoiceRules.length).toBeGreaterThan(0);
      expect(trial.successEffects.length).toBeGreaterThan(0);
      expect(trial.failureEffects.length).toBeGreaterThan(0);
    }
  });

  it('老兵牺牲包含 high-stress / protect-others 风险', () => {
    const trial = HERO_TRIALS['trial-veteran-sacrifice'];
    const choice = trial.generatedChoiceRules[0];
    expect(choice.riskTags).toContain('high-stress');
    expect(choice.riskTags).toContain('protect-others');
  });
});

describe('Phase 7B: 4 阶段任务链(SPEC §5)', () => {
  it('任务链 4 阶段分布正确', () => {
    const stages = Object.values(FINAL_QUEST_CHAIN).map((q) => q.stage);
    expect(stages).toContain('gate-opening');
    expect(stages).toContain('outer-expedition');
    expect(stages).toContain('seal-destruction');
    expect(stages).toContain('final-assault');
  });

  it('开启入口任务无前置任务', () => {
    const gateQuest = FINAL_QUEST_CHAIN['quest-darkest-core-gate-1'];
    expect(gateQuest.prerequisiteIds).toEqual([]);
  });

  it('外层任务前置:开启入口', () => {
    const outerQuest = FINAL_QUEST_CHAIN['quest-darkest-core-outer-1'];
    expect(outerQuest.prerequisiteIds).toContain('quest-darkest-core-gate-1');
  });

  it('3 封印任务前置:外层任务', () => {
    for (const sealId of ['seal-stress', 'seal-disease', 'seal-hunger']) {
      const q = Object.values(FINAL_QUEST_CHAIN).find((qq) => qq.id.includes(sealId));
      expect(q).toBeDefined();
      expect(q!.prerequisiteIds).toContain('quest-darkest-core-outer-1');
    }
  });

  it('最终讨伐前置:3 封印任务全部完成', () => {
    const final = FINAL_QUEST_CHAIN['quest-darkest-core-final-1'];
    expect(final.prerequisiteIds.length).toBe(3);
    expect(final.prerequisiteIds).toContain('quest-darkest-core-seal-stress-1');
    expect(final.prerequisiteIds).toContain('quest-darkest-core-seal-disease-1');
    expect(final.prerequisiteIds).toContain('quest-darkest-core-seal-hunger-1');
  });
});

describe('Phase 7B: 内容完整性', () => {
  it('最终区域 routeGeneratorId 一致', () => {
    expect(FINAL_REGIONS['darkest-core'].routeGeneratorId).toBe('route-darkest-core-generator');
  });

  it('5 露营活动 + 4 任务物品 + 3 封印 + 6 敌人 + 4 奇物 + 3 陷阱 + 4 英雄考验 + 1 路线 + 1 区域', () => {
    expect(Object.keys(FINAL_CAMP_ACTIVITIES).length).toBe(5);
    expect(Object.keys(FINAL_QUEST_ITEMS).length).toBe(4);
    expect(Object.keys(FINAL_SEALS).length).toBe(3);
    expect(Object.keys(FINAL_ENEMIES).length).toBe(6);
    expect(Object.keys(FINAL_CURIOS).length).toBe(4);
    expect(Object.keys(FINAL_TRAPS).length).toBe(3);
    expect(Object.keys(HERO_TRIALS).length).toBe(4);
    expect(Object.keys(FINAL_REGIONS).length).toBe(1);
  });
});
