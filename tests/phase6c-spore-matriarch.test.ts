/**
 * Phase 6C 孢疫母巢 Boss 内容测试
 *
 * 覆盖:
 *  - 名字/描述符合 dev §20.2(孢疫母巢/疾病/腐蚀/孢子/感染/林地)
 *  - 8 条情报 narrative 主题覆盖
 *  - 2 削弱任务 + 削弱效果 narrative 描述具体化
 *  - 2 环境目标 + 2 特殊物品 narrative 详细
 *  - 推荐职业/补给/饰品新增(抗病/抗孢子)
 *  - 永久奖励 narrative 真实可用
 *  - 6B 测试 Boss 不被破坏(intelligenceEntryIds 显式列举)
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

const SPORE_BOSS_ID = 'boss-spore-matriarch';
const ARBITER_BOSS_ID = 'boss-test-arbiter';

describe('Phase 6C: 孢疫母巢 Boss 定义(SPEC §20.2)', () => {
  it('boss-spore-matriarch 存在', () => {
    expect(BOSS_DEFINITIONS[SPORE_BOSS_ID]).toBeDefined();
  });

  it('Boss name = 孢疫母巢', () => {
    expect(BOSS_DEFINITIONS[SPORE_BOSS_ID].name).toBe('孢疫母巢');
  });

  it('Boss regionId = corrupted-woods', () => {
    expect(BOSS_DEFINITIONS[SPORE_BOSS_ID].regionId).toBe('corrupted-woods');
  });

  it('Boss description 包含关键主题词', () => {
    const desc = BOSS_DEFINITIONS[SPORE_BOSS_ID].description;
    expect(desc).toMatch(/真菌|孢子/);
    expect(desc).toMatch(/疾病|腐蚀/);
    expect(desc).toMatch(/菌丝|感染/);
    expect(desc).toMatch(/削弱|情报/);
  });

  it('推荐职业/补给符合 6C 主题', () => {
    const boss = BOSS_DEFINITIONS[SPORE_BOSS_ID];
    expect(boss.recommendedHeroTags).toContain('disease-resist');
    expect(boss.recommendedProvisionIds).toContain('item-spore-antidote');
    expect(boss.recommendedProvisionIds).toContain('item-spore-purifier');
  });
});

describe('Phase 6C: 6B 测试 Boss 不被破坏', () => {
  it('boss-test-arbiter 仍是失落审判者,8 条情报', () => {
    const boss = BOSS_DEFINITIONS[ARBITER_BOSS_ID];
    expect(boss.name).toBe('失落审判者');
    expect(boss.intelligenceEntryIds.length).toBe(8);
    // 不包含 spore 情报
    for (const id of boss.intelligenceEntryIds) {
      expect(id).not.toMatch(/^intel-spore-/);
    }
  });

  it('initializeBossStates 同时为 2 个 Boss 初始化', () => {
    const states = initializeBossStates();
    expect(states[ARBITER_BOSS_ID]).toBeDefined();
    expect(states[SPORE_BOSS_ID]).toBeDefined();
    expect(states[ARBITER_BOSS_ID].regionId).toBe('ruins');
    expect(states[SPORE_BOSS_ID].regionId).toBe('corrupted-woods');
    expect(states[ARBITER_BOSS_ID].status).toBe('hidden');
    expect(states[SPORE_BOSS_ID].status).toBe('hidden');
  });
});

describe('Phase 6C: 任务 narrative 详细化', () => {
  it('调查任务 narrative 包含具体地点和动作', () => {
    const task = BOSS_TASKS['task-spore-investigate-1'];
    expect(task.description.length).toBeGreaterThan(20);
    expect(task.description).toMatch(/菌床|母巢|地下/);
  });

  it('削弱任务 1 详细说明菌床焚烧方法', () => {
    const task = BOSS_TASKS['task-spore-weaken-1'];
    expect(task.description).toMatch(/火油|菌床|焚烧/);
  });

  it('削弱任务 2 详细说明抗孢子药剂来源', () => {
    const task = BOSS_TASKS['task-spore-weaken-2'];
    expect(task.description).toMatch(/高塔|抗病草药|银瓶/);
  });

  it('最终讨伐任务提到菌丝小径 + 三阶段', () => {
    const task = BOSS_TASKS['task-spore-final-1'];
    expect(task.description).toMatch(/菌丝|母巢之心/);
    expect(task.description).toMatch(/三阶段|3.*阶段/);
  });
});

describe('Phase 6C: 8 条情报 narrative 主题覆盖(SPEC §21)', () => {
  it('2 攻击模式情报 narrative 包含数值/概率', () => {
    const attackIntel = Object.values(BOSS_INTELLIGENCE)
      .filter((i) => i.bossId === SPORE_BOSS_ID && i.category === 'attack-pattern');
    expect(attackIntel.length).toBeGreaterThanOrEqual(2);
    for (const intel of attackIntel) {
      expect(intel.revealedDetail.length).toBeGreaterThan(30);
      expect(intel.revealedDetail).toMatch(/\d/);
    }
  });

  it('孢子感染情报提到抗孢子药剂 + 削弱任务', () => {
    const curse = BOSS_INTELLIGENCE['intel-spore-status-1'];
    expect(curse.revealedDetail).toMatch(/孢子|感染|抗孢子/);
    expect(curse.revealedDetail).toMatch(/抗孢子药剂|抗病/);
  });

  it('阶段 1 情报提到感染召唤 + 菌床削弱', () => {
    const phase1 = BOSS_INTELLIGENCE['intel-spore-phase-1'];
    expect(phase1.revealedDetail).toMatch(/感染体|菌床/);
    expect(phase1.revealedDetail).toMatch(/焚烧.*菌床|菌床.*焚烧/);
  });

  it('阶段 2 情报提到母巢暴走 + 死亡之门概率', () => {
    const phase2 = BOSS_INTELLIGENCE['intel-spore-phase-2'];
    expect(phase2.revealedDetail).toMatch(/孢子终爆|母巢/);
    expect(phase2.revealedDetail).toMatch(/死亡之门/);
    expect(phase2.revealedDetail).toMatch(/\d+%/); // 30% 概率
  });

  it('环境目标情报提到具体弱点 + 替代方案', () => {
    const env = BOSS_INTELLIGENCE['intel-spore-env-1'];
    expect(env.revealedDetail).toMatch(/根结|火油|抗孢子药剂/);
  });

  it('推荐补给情报具体说明持续时间', () => {
    const prov = BOSS_INTELLIGENCE['intel-spore-provision-1'];
    expect(prov.revealedDetail).toMatch(/\d/);
    expect(prov.revealedDetail).toMatch(/抗孢子药剂/);
  });

  it('撤退风险情报提到阶段成功率差异 + 削弱失效', () => {
    const retreat = BOSS_INTELLIGENCE['intel-spore-retreat-1'];
    expect(retreat.revealedDetail).toMatch(/\d+%/);
    expect(retreat.revealedDetail).toMatch(/阶段/);
    expect(retreat.revealedDetail).toMatch(/抗孢子|菌床/);
  });
});

describe('Phase 6C: 削弱效果 narrative 描述具体', () => {
  it('weaken-spore-mycelium 描述包含"感染"和"菌床"', () => {
    const w = BOSS_WEAKENING_EFFECTS['weaken-spore-mycelium'];
    expect(w.description).toMatch(/感染/);
    expect(w.description).toMatch(/菌床/);
  });

  it('weaken-spore-immunity 描述包含具体轮数 + 撤退失效', () => {
    const w = BOSS_WEAKENING_EFFECTS['weaken-spore-immunity'];
    expect(w.description).toMatch(/\d/); // 3 轮
    expect(w.description).toMatch(/撤退/);
  });
});

describe('Phase 6C: 阶段 narrative 主题明确(SPEC §11)', () => {
  it('阶段 0 提到孢子繁殖 + 情报观察', () => {
    const phase = BOSS_PHASES['phase-spore-0'];
    expect(phase.name).toBe('孢子繁殖');
    expect(phase.description).toMatch(/孢子/);
    expect(phase.description).toMatch(/情报/);
  });

  it('阶段 1 提到污染扩散 + 感染体 + 菌床', () => {
    const phase = BOSS_PHASES['phase-spore-1'];
    expect(phase.name).toBe('污染扩散');
    expect(phase.description).toMatch(/感染体/);
    expect(phase.description).toMatch(/菌床/);
    expect(phase.description).toMatch(/取舍|清感染/);
  });

  it('阶段 2 提到母巢暴走 + 孢子终爆 + 死亡之门', () => {
    const phase = BOSS_PHASES['phase-spore-2'];
    expect(phase.name).toBe('母巢暴走');
    expect(phase.description).toMatch(/孢子终爆/);
    expect(phase.description).toMatch(/死亡之门/);
  });

  it('阶段 2 撤退战术提到抗孢子药剂影响撤退成功率', () => {
    const phase = BOSS_PHASES['phase-spore-2'];
    const retreatTactic = phase.tacticalOptionRules.find((r) => r.category === 'retreat');
    expect(retreatTactic).toBeDefined();
    expect(retreatTactic!.description).toMatch(/抗孢子/);
  });
});

describe('Phase 6C: 环境目标 narrative 详细', () => {
  it('菌床描述包含位置 + 作用 + 弱点', () => {
    const env = BOSS_ENVIRONMENT_TARGETS['env-spore-mycelium-bed'];
    expect(env.description).toMatch(/腐殖|菌丝/);
    expect(env.description).toMatch(/养分/);
    // 弱点描述可能在 description 或 interactChoices
    const hasWeaknessHint = /根结|火油/.test(env.description)
      || env.interactChoices.some((c) => /根结|火油/.test(c.description));
    expect(hasWeaknessHint).toBe(true);
    // 至少 2 个 interactChoices
    expect(env.interactChoices.length).toBeGreaterThanOrEqual(2);
    // 包含"暂不处理"选项
    expect(env.interactChoices.some((c) => c.id === 'env-mycelium-skip')).toBe(true);
  });

  it('孢子囊描述提到破裂效果 + 副作用', () => {
    const env = BOSS_ENVIRONMENT_TARGETS['env-spore-spore-sac'];
    expect(env.description).toMatch(/孢子|破裂/);
    expect(env.description).toMatch(/压力/);
    expect(env.description).toMatch(/HP|生命/);
  });
});

describe('Phase 6C: 特殊物品 narrative 详细', () => {
  it('抗孢子药剂 narrative 提到来源 + 持续时间', () => {
    const item = BOSS_QUEST_ITEMS['item-spore-antidote'];
    expect(item.description).toMatch(/高塔|抗病草药/);
    expect(item.description).toMatch(/\d/);
  });

  it('菌床净化圣物 narrative 提到来源 + 用法', () => {
    const item = BOSS_QUEST_ITEMS['item-spore-purifier'];
    expect(item.description).toMatch(/隐士|木化石|符文/);
    expect(item.description).toMatch(/菌床|孢子囊/);
  });
});

describe('Phase 6C: 永久奖励 narrative 详细', () => {
  it('奖励包含饰品/任务修正词/区域 modifier', () => {
    const reward = BOSS_PERMANENT_REWARDS['reward-spore-matriarch'];
    expect(reward.description).toMatch(/饰品|母巢之眼/);
    expect(reward.description).toMatch(/修正词|菌丝共生/);
    expect(reward.description).toMatch(/抗病|disease/i);
    expect(reward.description).toMatch(/感染|infection/i);
  });
});

describe('Phase 6C: 撤退规则(SPEC §15 + §20.2)', () => {
  it('spore Boss 基础撤退率 60%(比审判者低)', () => {
    const boss = BOSS_DEFINITIONS[SPORE_BOSS_ID];
    expect(boss.retreatRules.baseSuccessRate).toBe(0.60);
  });

  it('spore Boss 阶段 2 撤退率最低 20%(孢子窒息)', () => {
    const boss = BOSS_DEFINITIONS[SPORE_BOSS_ID];
    const r2 = boss.retreatRules.baseSuccessRate + (boss.retreatRules.phaseModifiers[2] ?? 0);
    expect(r2).toBeCloseTo(0.20, 2);
  });

  it('spore Boss 威胁增长 +18(比审判者高)', () => {
    const boss = BOSS_DEFINITIONS[SPORE_BOSS_ID];
    expect(boss.retreatRules.threatIncrease).toBe(18);
  });
});
