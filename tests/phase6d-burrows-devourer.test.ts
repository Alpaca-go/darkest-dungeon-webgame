/**
 * Phase 6D The Swine Prince Boss 内容测试
 *
 * 覆盖:
 *  - 名字/描述符合 dev §20.3(The Swine Prince/撕裂獠牙/储粮/流血/兽穴)
 *  - 8 条情报 narrative 主题覆盖
 *  - 2 削弱任务 + 削弱效果 narrative 描述具体化
 *  - 2 环境目标 + 2 特殊物品 narrative 详细
 *  - 推荐职业/补给/饰品新增(抗流血/食物高效)
 *  - 永久奖励 narrative 真实可用
 *  - 6B/6C 测试 Boss 不被破坏(intelligenceEntryIds 显式列举)
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
  initializeBossStates,
} from '../src/game-engine/boss/registry.js';

const BURROWS_BOSS_ID = 'boss-burrows-devourer';
const ARBITER_BOSS_ID = 'boss-test-arbiter';
const SPORE_BOSS_ID = 'boss-spore-matriarch';

describe('Phase 6D: The Swine Prince Boss 定义(SPEC §20.3)', () => {
  it('boss-burrows-devourer 存在', () => {
    expect(BOSS_DEFINITIONS[BURROWS_BOSS_ID]).toBeDefined();
  });

  it('Boss name = The Swine Prince', () => {
    expect(BOSS_DEFINITIONS[BURROWS_BOSS_ID].name).toBe('The Swine Prince');
  });

  it('Boss regionId = underground-burrows', () => {
    expect(BOSS_DEFINITIONS[BURROWS_BOSS_ID].regionId).toBe('warrens');
  });

  it('Boss description 包含关键主题词', () => {
    const desc = BOSS_DEFINITIONS[BURROWS_BOSS_ID].description;
    expect(desc).toMatch(/獠牙|撕裂/);
    expect(desc).toMatch(/储粮|食物/);
    expect(desc).toMatch(/流血/);
    expect(desc).toMatch(/兽穴|地下/);
    expect(desc).toMatch(/削弱|情报/);
  });

  it('推荐职业/补给符合 6D 主题', () => {
    const boss = BOSS_DEFINITIONS[BURROWS_BOSS_ID];
    expect(boss.recommendedHeroTags).toContain('frontline-tank');
    expect(boss.recommendedHeroTags).toContain('anti-bleed');
    expect(boss.recommendedProvisionIds).toContain('item-burrows-bandage');
    expect(boss.recommendedProvisionIds).toContain('item-burrows-purifier');
  });

  it('推荐饰品 tag 包含 anti-bleed + food-efficient', () => {
    const boss = BOSS_DEFINITIONS[BURROWS_BOSS_ID];
    expect(boss.recommendedTrinketTags).toContain('anti-bleed');
    expect(boss.recommendedTrinketTags).toContain('food-efficient');
  });
});

describe('Phase 6D: 6B/6C Boss 不被破坏', () => {
  it('boss-test-arbiter 仍是The Necromancer,8 条情报', () => {
    const boss = BOSS_DEFINITIONS[ARBITER_BOSS_ID];
    expect(boss.name).toBe('The Necromancer');
    expect(boss.intelligenceEntryIds.length).toBe(8);
    for (const id of boss.intelligenceEntryIds) {
      expect(id).not.toMatch(/^intel-spore-/);
      expect(id).not.toMatch(/^intel-burrows-/);
    }
  });

  it('boss-spore-matriarch 仍是The Hag,8 条情报', () => {
    const boss = BOSS_DEFINITIONS[SPORE_BOSS_ID];
    expect(boss.name).toBe('The Hag');
    expect(boss.intelligenceEntryIds.length).toBe(8);
    for (const id of boss.intelligenceEntryIds) {
      expect(id).not.toMatch(/^intel-burrows-/);
    }
  });

  it('initializeBossStates 同时为 3 个 Boss 初始化', () => {
    const states = initializeBossStates();
    expect(states[ARBITER_BOSS_ID]).toBeDefined();
    expect(states[SPORE_BOSS_ID]).toBeDefined();
    expect(states[BURROWS_BOSS_ID]).toBeDefined();
    expect(states[ARBITER_BOSS_ID].regionId).toBe('ruins');
    expect(states[SPORE_BOSS_ID].regionId).toBe('weald');
    expect(states[BURROWS_BOSS_ID].regionId).toBe('warrens');
    expect(states[ARBITER_BOSS_ID].status).toBe('hidden');
    expect(states[SPORE_BOSS_ID].status).toBe('hidden');
    expect(states[BURROWS_BOSS_ID].status).toBe('hidden');
  });
});

describe('Phase 6D: 任务 narrative 详细化', () => {
  it('调查任务 narrative 包含具体地点和动作', () => {
    const task = BOSS_TASKS['task-burrows-investigate-1'];
    expect(task.description.length).toBeGreaterThan(20);
    expect(task.description).toMatch(/兽穴|储粮|地下/);
  });

  it('削弱任务 1 详细说明储粮坑焚烧方法', () => {
    const task = BOSS_TASKS['task-burrows-weaken-1'];
    expect(task.description).toMatch(/火油|储粮|焚烧/);
  });

  it('削弱任务 2 详细说明精英护卫刺杀行动', () => {
    const task = BOSS_TASKS['task-burrows-weaken-2'];
    expect(task.description).toMatch(/刺杀|护卫|暗杀/);
  });

  it('最终讨伐任务提到血迹路线 + 三阶段', () => {
    const task = BOSS_TASKS['task-burrows-final-1'];
    expect(task.description).toMatch(/血迹|食物|流血/);
    expect(task.description).toMatch(/三阶段|3.*阶段/);
  });
});

describe('Phase 6D: 8 条情报 narrative 主题覆盖(SPEC §21)', () => {
  it('2 攻击模式情报 narrative 包含数值', () => {
    const attackIntel = Object.values(BOSS_INTELLIGENCE)
      .filter((i) => i.bossId === BURROWS_BOSS_ID && i.category === 'attack-pattern');
    expect(attackIntel.length).toBeGreaterThanOrEqual(2);
    for (const intel of attackIntel) {
      expect(intel.revealedDetail.length).toBeGreaterThan(30);
      expect(intel.revealedDetail).toMatch(/\d/);
    }
  });

  it('撕裂獠牙情报提到流血 + 战斗绷带', () => {
    const intel = BOSS_INTELLIGENCE['intel-burrows-attack-1'];
    expect(intel.revealedDetail).toMatch(/撕裂|獠牙/);
    expect(intel.revealedDetail).toMatch(/流血/);
    expect(intel.revealedDetail).toMatch(/战斗绷带/);
  });

  it('吞噬吞噬情报提到食物 + 饥饿', () => {
    const intel = BOSS_INTELLIGENCE['intel-burrows-attack-2'];
    expect(intel.revealedDetail).toMatch(/食物|饥饿/);
    expect(intel.revealedDetail).toMatch(/\d/);
  });

  it('饥饿狂潮情报提到储粮焚毁 + 削弱任务', () => {
    const intel = BOSS_INTELLIGENCE['intel-burrows-status-1'];
    expect(intel.revealedDetail).toMatch(/饥饿|狂潮/);
    expect(intel.revealedDetail).toMatch(/储粮焚毁|削弱/);
  });

  it('阶段 1 情报提到精英护卫 + 尸体堆', () => {
    const phase1 = BOSS_INTELLIGENCE['intel-burrows-phase-1'];
    expect(phase1.revealedDetail).toMatch(/精英护卫/);
    expect(phase1.revealedDetail).toMatch(/尸体堆|削弱/);
  });

  it('阶段 2 情报提到吞噬一切 + 持续流血 + 死亡之门', () => {
    const phase2 = BOSS_INTELLIGENCE['intel-burrows-phase-2'];
    expect(phase2.revealedDetail).toMatch(/吞噬/);
    expect(phase2.revealedDetail).toMatch(/流血/);
    expect(phase2.revealedDetail).toMatch(/死亡之门/);
  });

  it('环境目标情报提到支撑柱 + 储粮焚毁圣物', () => {
    const env = BOSS_INTELLIGENCE['intel-burrows-env-1'];
    expect(env.revealedDetail).toMatch(/支撑柱|火油/);
    expect(env.revealedDetail).toMatch(/储粮焚毁/);
  });

  it('推荐补给情报具体说明持续时间 + 战斗绷带', () => {
    const prov = BOSS_INTELLIGENCE['intel-burrows-provision-1'];
    expect(prov.revealedDetail).toMatch(/\d/);
    expect(prov.revealedDetail).toMatch(/战斗绷带/);
    expect(prov.revealedDetail).toMatch(/流血/);
  });

  it('撤退风险情报提到阶段成功率差异 + 削弱失效', () => {
    const retreat = BOSS_INTELLIGENCE['intel-burrows-retreat-1'];
    expect(retreat.revealedDetail).toMatch(/\d+%/);
    expect(retreat.revealedDetail).toMatch(/阶段/);
    expect(retreat.revealedDetail).toMatch(/削弱|失效/);
  });
});

describe('Phase 6D: 削弱效果 narrative 描述具体', () => {
  it('weaken-burrows-food 描述包含"储粮"和"精英护卫"', () => {
    const w = BOSS_WEAKENING_EFFECTS['weaken-burrows-food'];
    expect(w.description).toMatch(/储粮/);
    expect(w.description).toMatch(/精英护卫|护卫/);
  });

  it('weaken-burrows-guard 描述包含"护卫"和"撤退失效"', () => {
    const w = BOSS_WEAKENING_EFFECTS['weaken-burrows-guard'];
    expect(w.description).toMatch(/护卫/);
    expect(w.description).toMatch(/撤退/);
  });

  it('burrows 削弱任务来源正确', () => {
    expect(BOSS_WEAKENING_EFFECTS['weaken-burrows-food'].sourceQuestId).toBe('task-burrows-weaken-1');
    expect(BOSS_WEAKENING_EFFECTS['weaken-burrows-guard'].sourceQuestId).toBe('task-burrows-weaken-2');
  });
});

describe('Phase 6D: 阶段 narrative 主题明确(SPEC §11)', () => {
  it('阶段 0 提到潜伏捕食 + 情报观察', () => {
    const phase = BOSS_PHASES['phase-burrows-0'];
    expect(phase.name).toBe('潜伏捕食');
    expect(phase.description).toMatch(/撕裂|潜伏/);
    expect(phase.description).toMatch(/情报/);
  });

  it('阶段 0 含 3 战术选项 + 战斗绷带战术', () => {
    const phase = BOSS_PHASES['phase-burrows-0'];
    expect(phase.tacticalOptionRules.length).toBe(3);
    const bandageTactic = phase.tacticalOptionRules.find((r) => r.id === 'tactic-burrows-p0-bandage');
    expect(bandageTactic).toBeDefined();
    expect(bandageTactic!.description).toMatch(/绷带/);
  });

  it('阶段 1 提到饥饿狂潮 + 精英护卫 + 储粮', () => {
    const phase = BOSS_PHASES['phase-burrows-1'];
    expect(phase.name).toBe('饥饿狂潮');
    expect(phase.description).toMatch(/护卫/);
    expect(phase.description).toMatch(/储粮/);
  });

  it('阶段 1 召唤规则用 BossSummonRule 标准字段', () => {
    const phase = BOSS_PHASES['phase-burrows-1'];
    expect(phase.summonRules.length).toBe(1);
    const summon = phase.summonRules[0];
    expect(summon.summonId).toBe('summon-精英护卫');
    expect(summon.maxPerPhase).toBe(2);
    expect(summon.modifiers.length).toBeGreaterThan(0);
  });

  it('阶段 2 提到吞噬一切 + 流血 + 吞咽', () => {
    const phase = BOSS_PHASES['phase-burrows-2'];
    expect(phase.name).toBe('吞噬一切');
    expect(phase.description).toMatch(/流血/);
    expect(phase.description).toMatch(/吞咽/);
  });

  it('阶段 2 撤退战术提到战斗绷带影响撤退成功率', () => {
    const phase = BOSS_PHASES['phase-burrows-2'];
    const retreatTactic = phase.tacticalOptionRules.find((r) => r.category === 'retreat');
    expect(retreatTactic).toBeDefined();
    expect(retreatTactic!.description).toMatch(/绷带/);
  });
});

describe('Phase 6D: 环境目标 narrative 详细', () => {
  it('储粮坑描述包含位置 + 作用 + 弱点', () => {
    const env = BOSS_ENVIRONMENT_TARGETS['env-burrows-food-pit'];
    expect(env.description).toMatch(/储粮|食物/);
    expect(env.description).toMatch(/口粮|食物/);
    // 弱点描述可能在 description 或 interactChoices
    const hasWeaknessHint = /火油|储粮焚毁/.test(env.description)
      || env.interactChoices.some((c) => /火油|储粮焚毁/.test(c.description));
    expect(hasWeaknessHint).toBe(true);
    // 至少 2 个 interactChoices
    expect(env.interactChoices.length).toBeGreaterThanOrEqual(2);
    // 包含"暂不处理"选项
    expect(env.interactChoices.some((c) => c.id === 'env-pit-skip')).toBe(true);
  });

  it('尸体堆描述提到召唤效果 + 副作用', () => {
    const env = BOSS_ENVIRONMENT_TARGETS['env-burrows-corpse-pile'];
    expect(env.description).toMatch(/尸体|护卫/);
    expect(env.description).toMatch(/召唤|召出/);
    expect(env.description).toMatch(/护身符|削弱|搜/);
  });
});

describe('Phase 6D: 特殊物品 narrative 详细', () => {
  it('战斗绷带 narrative 提到来源 + 持续时间', () => {
    const item = BOSS_QUEST_ITEMS['item-burrows-bandage'];
    expect(item.description).toMatch(/医师|兽穴|药草/);
    expect(item.description).toMatch(/\d/);
  });

  it('储粮焚毁圣物 narrative 提到来源 + 用法', () => {
    const item = BOSS_QUEST_ITEMS['item-burrows-purifier'];
    expect(item.description).toMatch(/猎人|石罐|炼金油/);
    expect(item.description).toMatch(/储粮|精英护卫/);
  });
});

describe('Phase 6D: 永久奖励 narrative 详细', () => {
  it('奖励包含饰品/任务修正词/区域 modifier', () => {
    const reward = BOSS_PERMANENT_REWARDS['reward-burrows-devourer'];
    expect(reward.description).toMatch(/饰品|吞噬者之牙/);
    expect(reward.description).toMatch(/修正词|饥饿本能/);
    expect(reward.description).toMatch(/食物.*消耗|消耗.*食物/);
    expect(reward.description).toMatch(/警戒|scout/i);
  });
});

describe('Phase 6D: 撤退规则(SPEC §15 + §20.3)', () => {
  it('burrows Boss 基础撤退率 55%(比The Hag更低)', () => {
    const boss = BOSS_DEFINITIONS[BURROWS_BOSS_ID];
    expect(boss.retreatRules.baseSuccessRate).toBe(0.55);
  });

  it('burrows Boss 阶段 2 撤退率最低 10%(持续流血 + 饥饿压迫)', () => {
    const boss = BOSS_DEFINITIONS[BURROWS_BOSS_ID];
    const r2 = boss.retreatRules.baseSuccessRate + (boss.retreatRules.phaseModifiers[2] ?? 0);
    expect(r2).toBeCloseTo(0.10, 2);
  });

  it('burrows Boss 威胁增长 +20(3 个 Boss 中最高)', () => {
    const boss = BOSS_DEFINITIONS[BURROWS_BOSS_ID];
    expect(boss.retreatRules.threatIncrease).toBe(20);
  });

  it('burrows Boss 撤退后 weaken-burrows-food 失效', () => {
    const boss = BOSS_DEFINITIONS[BURROWS_BOSS_ID];
    expect(boss.retreatRules.weakeningEffectLossRules).toContain('weaken-burrows-food');
  });
});

describe('Phase 6D: 3 Boss 整体一致性(SPEC §27)', () => {
  it('3 Boss 都有 3 阶段 + 2 削弱 + 2 环境 + 8 情报 + 1 奖励', () => {
    const bossIds = [ARBITER_BOSS_ID, SPORE_BOSS_ID, BURROWS_BOSS_ID];
    for (const id of bossIds) {
      const boss = BOSS_DEFINITIONS[id];
      expect(boss.phaseDefinitionIds.length).toBe(3);
      expect(boss.weakeningQuestIds.length).toBe(2);
      expect(boss.environmentTargetIds.length).toBe(2);
      expect(boss.intelligenceEntryIds.length).toBe(8);
      expect(boss.permanentRewardId).toBeDefined();
    }
  });

  it('每个 Boss 阶段定义有 3 个 + 至少 2 战术选项', () => {
    for (const phase of Object.values(BOSS_PHASES)) {
      expect(phase.tacticalOptionRules.length).toBeGreaterThanOrEqual(2);
    }
  });
});
