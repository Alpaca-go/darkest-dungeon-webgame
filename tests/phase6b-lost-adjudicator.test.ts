/**
 * Phase 6B 失落审判者 Boss 内容测试
 *
 * 覆盖:
 *  - 名字/描述符合 dev §20.1(失落审判者/宗教/召唤/祭坛/三阶段)
 *  - 8 条情报 narrative 主题覆盖
 *  - 2 削弱任务 + 削弱效果 narrative 描述具体化
 *  - 2 环境目标 + 2 特殊物品 narrative 详细
 *  - 推荐职业/补给/饰品新增(破咒圣物)
 *  - 永久奖励 narrative 真实可用
 *
 * 不测试结构完整性(6A 已覆盖),只验证内容升级质量。
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
} from '../src/game-engine/boss/registry.js';

const BOSS_ID = 'boss-test-arbiter';

describe('Phase 6B: Boss 名称/主题(SPEC §20.1)', () => {
  it('Boss name = 失落审判者', () => {
    const boss = BOSS_DEFINITIONS[BOSS_ID];
    expect(boss.name).toBe('失落审判者');
  });

  it('Boss description 包含关键主题词', () => {
    const desc = BOSS_DEFINITIONS[BOSS_ID].description;
    // 主题词:审判/亡魂/诅咒/终末宣判/情报/削弱
    expect(desc).toMatch(/审判/);
    expect(desc).toMatch(/亡魂|召唤/);
    expect(desc).toMatch(/诅咒/);
    expect(desc).toMatch(/终末宣判|情报/);
    expect(desc).toMatch(/削弱/);
  });

  it('推荐补给升级为包含破咒圣物', () => {
    const boss = BOSS_DEFINITIONS[BOSS_ID];
    expect(boss.recommendedProvisionIds).toContain('item-test-sacred-water');
    expect(boss.recommendedProvisionIds).toContain('item-test-holy-relic');
  });
});

describe('Phase 6B: 任务 narrative 详细化', () => {
  it('调查任务 narrative 包含具体地点和动作', () => {
    const task = BOSS_TASKS['task-test-investigate-1'];
    expect(task.description.length).toBeGreaterThan(20);
    expect(task.description).toMatch(/审判厅|甬道|名册/);
  });

  it('削弱任务 1 详细说明祭坛摧毁方法', () => {
    const task = BOSS_TASKS['task-test-weaken-1'];
    expect(task.description).toMatch(/祭坛|铭文|石板/);
  });

  it('削弱任务 2 详细说明圣物来源', () => {
    const task = BOSS_TASKS['task-test-weaken-2'];
    expect(task.description).toMatch(/圣骨匣|隐修室|遗骨/);
  });

  it('最终讨伐任务提到 8-12 节点 + 3 阶段', () => {
    const task = BOSS_TASKS['task-test-final-1'];
    expect(task.description).toMatch(/8-12|专属路线/);
    expect(task.description).toMatch(/三阶段|3.*阶段/);
  });
});

describe('Phase 6B: 8 条情报 narrative 主题覆盖(SPEC §21)', () => {
  it('2 攻击模式情报 narrative 包含数值/概率', () => {
    const attackIntel = Object.values(BOSS_INTELLIGENCE)
      .filter((i) => i.category === 'attack-pattern');
    expect(attackIntel.length).toBeGreaterThanOrEqual(2);
    for (const intel of attackIntel) {
      expect(intel.revealedDetail.length).toBeGreaterThan(30);
      // 包含具体数值或概率
      expect(intel.revealedDetail).toMatch(/\d/);
    }
  });

  it('诅咒印记情报提到抗压/抗诅咒/削弱任务', () => {
    const curse = BOSS_INTELLIGENCE['intel-status-1'];
    expect(curse.revealedDetail).toMatch(/诅咒印记|圣水|破咒/);
    expect(curse.revealedDetail).toMatch(/阶段 2/); // 升级描述
  });

  it('阶段 1 情报提到召唤 + 摧毁祭坛削弱', () => {
    const phase1 = BOSS_INTELLIGENCE['intel-phase-1'];
    expect(phase1.revealedDetail).toMatch(/亡魂|召唤/);
    expect(phase1.revealedDetail).toMatch(/摧毁.*祭坛|祭坛.*摧毁/);
  });

  it('阶段 2 情报提到终末宣判 + 死亡之门阈值', () => {
    const phase2 = BOSS_INTELLIGENCE['intel-phase-2'];
    expect(phase2.revealedDetail).toMatch(/终末宣判/);
    expect(phase2.revealedDetail).toMatch(/死亡之门/);
    expect(phase2.revealedDetail).toMatch(/85|100/); // 数值阈值
  });

  it('环境目标情报提到具体弱点', () => {
    const env = BOSS_INTELLIGENCE['intel-env-1'];
    expect(env.revealedDetail).toMatch(/铭文|石板|破咒圣物/);
  });

  it('推荐补给情报具体说明数量', () => {
    const prov = BOSS_INTELLIGENCE['intel-provision-1'];
    expect(prov.revealedDetail).toMatch(/\d+/); // 至少一个数字
    expect(prov.revealedDetail).toMatch(/圣水/);
  });

  it('撤退风险情报提到阶段成功率差异', () => {
    const retreat = BOSS_INTELLIGENCE['intel-retreat-1'];
    expect(retreat.revealedDetail).toMatch(/\d+%/); // 百分比
    expect(retreat.revealedDetail).toMatch(/阶段/);
    expect(retreat.revealedDetail).toMatch(/破咒/);
  });
});

describe('Phase 6B: 削弱效果 narrative 描述具体', () => {
  it('weaken-summon-altar 描述包含"亡魂"和"祭坛"', () => {
    const w = BOSS_WEAKENING_EFFECTS['weaken-summon-altar'];
    expect(w.description).toMatch(/亡魂/);
    expect(w.description).toMatch(/祭坛/);
  });

  it('weaken-stress-curse 描述包含具体数值 + 撤退失效说明', () => {
    const w = BOSS_WEAKENING_EFFECTS['weaken-stress-curse'];
    expect(w.description).toMatch(/\d/);
    expect(w.description).toMatch(/撤退/);
  });
});

describe('Phase 6B: 阶段 narrative 主题明确(SPEC §11)', () => {
  it('阶段 0 提到审判/屏障/情报观察', () => {
    const phase = BOSS_PHASES['phase-test-0'];
    expect(phase.name).toBe('审判');
    expect(phase.description).toMatch(/审判之锤|屏障|情报/);
  });

  it('阶段 1 提到亡魂/祭坛/取舍', () => {
    const phase = BOSS_PHASES['phase-test-1'];
    expect(phase.name).toBe('召集亡者');
    expect(phase.description).toMatch(/亡魂/);
    expect(phase.description).toMatch(/祭坛/);
    expect(phase.description).toMatch(/取舍|清亡魂|攻核心/);
  });

  it('阶段 2 提到终末宣判 + 死亡之门阈值', () => {
    const phase = BOSS_PHASES['phase-test-2'];
    expect(phase.name).toBe('终末宣判');
    expect(phase.description).toMatch(/终末宣判/);
    expect(phase.description).toMatch(/85|100/);
  });

  it('阶段 2 撤退战术提到破咒圣物影响撤退成功率', () => {
    const phase = BOSS_PHASES['phase-test-2'];
    const retreatTactic = phase.tacticalOptionRules.find((r) => r.category === 'retreat');
    expect(retreatTactic).toBeDefined();
    expect(retreatTactic!.description).toMatch(/破咒/);
  });
});

describe('Phase 6B: 环境目标 narrative 详细', () => {
  it('env-test-altar 描述包含位置 + 作用 + 弱点', () => {
    const env = BOSS_ENVIRONMENT_TARGETS['env-test-altar'];
    expect(env.description).toMatch(/玄武|石/);
    expect(env.description).toMatch(/亡魂/);
    // 弱点描述可能在 description 或 interactChoices
    const hasWeaknessHint = /铭文|石板/.test(env.description)
      || env.interactChoices.some((c) => /铭文|石板/.test(c.description));
    expect(hasWeaknessHint).toBe(true);
    // 至少 2 个 interactChoices
    expect(env.interactChoices.length).toBeGreaterThanOrEqual(2);
    // 包含"暂不处理"选项
    expect(env.interactChoices.some((c) => c.id === 'env-altar-skip')).toBe(true);
  });

  it('env-test-shield 描述提到破咒圣物可穿透', () => {
    const env = BOSS_ENVIRONMENT_TARGETS['env-test-shield'];
    expect(env.interactChoices.some((c) => c.id === 'env-shield-pierce')).toBe(true);
  });
});

describe('Phase 6B: 特殊物品 narrative 详细', () => {
  it('圣水 narrative 提到来源 + 数量建议', () => {
    const item = BOSS_QUEST_ITEMS['item-test-sacred-water'];
    expect(item.description).toMatch(/圣泉/);
    expect(item.description).toMatch(/2|二/);
  });

  it('破咒圣物 narrative 提到来源 + Boss 战用法', () => {
    const item = BOSS_QUEST_ITEMS['item-test-holy-relic'];
    expect(item.description).toMatch(/隐修室|圣骨匣/);
    expect(item.description).toMatch(/屏障|祭坛/);
  });
});

describe('Phase 6B: 永久奖励 narrative 详细', () => {
  it('奖励包含饰品/任务修正词/区域 modifier', () => {
    const reward = BOSS_PERMANENT_REWARDS['reward-test-arbiter'];
    expect(reward.description).toMatch(/饰品|trinket|封印/);
    expect(reward.description).toMatch(/修正词|modifier|余威/);
    expect(reward.description).toMatch(/侦察|scouting/);
    expect(reward.description).toMatch(/抗压|stress/);
  });
});
