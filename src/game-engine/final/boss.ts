/**
 * Phase 7C: 最终 Boss `boss-darkest-core` 4 阶段定义(SPEC §11)
 *
 * 4 阶段:
 *  - 阶段 0 Probe and Memory(读取英雄历史/墓园,触发压力,验证最终情报和任务物品)
 *  - 阶段 1 Multi-Region Fusion(压力/疾病/流血/饥饿,环境目标 + 召唤)
 *  - 阶段 2 Hero Trial(读取怪癖/疾病/饰品/历史,生成个体化选择)
 *  - 阶段 3 Final Choice(选择数量收紧,撤退成本最高,最终任务物品和牺牲选择生效)
 *
 * 选择式遭遇(SPEC §1.2 / §11),不恢复 4v4 手动战斗。
 * 阶段 ≤ 3 进入条件:boss_phase_rounds ≥ 上阶段结束时
 * 阶段 3 (finale) 进入条件:全部 3 封印已摧毁
 */

import type { BossPhaseDefinition, BossId } from '../boss/types.js';

// =====================================================================
// 最终 Boss id
// =====================================================================

export const FINAL_BOSS_ID: BossId = 'boss-darkest-core';

// =====================================================================
// 阶段 0: Probe and Memory(SPEC §11.1)
// =====================================================================

const PHASE_FINAL_0: BossPhaseDefinition = {
  id: 'phase-final-0',
  bossId: FINAL_BOSS_ID,
  phaseIndex: 0,
  name: 'Probe and Memory',
  description: 'Heart of Darkness从先祖的阴影中苏醒,审视入侵者的过去。它读取英雄历史和墓园,触发压力;允许相对安全的试探(2-3 个安全选项)。阶段结束时玩家必须确认已读情报 + 携带最终任务物品。',
  enterConditions: [
    { kind: 'flag-exists', flagName: 'boss_encounter_active' },
  ],
  exitConditions: [
    { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 3 },
  ],
  bossModifiers: [
    { kind: 'set-flag', flagName: 'final_boss_phase_0', flagValue: true },
  ],
  environmentTargetIds: [],
  summonRules: [],
  tacticalOptionRules: [
    {
      id: 'tactic-final-p0-probe',
      title: '试探性攻击',
      description: '前排试探Heart of Darkness,收集它对前排/中排的偏好信息。',
      conditions: [],
      weight: 1.0,
      category: 'attack-core',
      phaseIndex: 0,
      effects: [
        { kind: 'hp-delta', amount: 5, heroSelector: 'front-rank' },
        { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
        { kind: 'set-flag', flagName: 'final_boss_intel_p0', flagValue: true },
      ],
      riskTags: ['frontline-risk'],
    },
    {
      id: 'tactic-final-p0-read-intel',
      title: '回忆情报',
      description: '阅读已解锁的最终情报,获得本阶段 +5% 撤退成功率(基于情报完整度)。',
      conditions: [],
      weight: 0.8,
      category: 'stabilize-stress',
      phaseIndex: 0,
      effects: [
        { kind: 'set-flag', flagName: 'final_boss_intel_p0', flagValue: true },
        { kind: 'apply-stress', amount: -3, heroSelector: 'all-alive' },
      ],
      riskTags: ['safe'],
    },
    {
      id: 'tactic-final-p0-graveyard',
      title: '缅怀墓园',
      description: '若墓园英雄 ≥ 1,降低全队压力 5 + 获得 1 正面怪癖持续本战斗。',
      conditions: [],
      weight: 0.6,
      category: 'stabilize-stress',
      phaseIndex: 0,
      effects: [
        { kind: 'set-flag', flagName: 'final_boss_graveyard_blessing', flagValue: true },
        { kind: 'apply-stress', amount: -5, heroSelector: 'all-alive' },
      ],
      riskTags: ['graveyard-buff'],
    },
  ],
  phaseEvents: [
    {
      trigger: 'enter',
      effects: [
        { kind: 'set-flag', flagName: 'final_boss_entered', flagValue: true },
      ],
      narrativeHint: '最终 Boss 战开始:Heart of Darkness审视入侵者的过去',
    },
  ],
};

// =====================================================================
// 阶段 1: Multi-Region Fusion(SPEC §11.2)
// =====================================================================

const PHASE_FINAL_1: BossPhaseDefinition = {
  id: 'phase-final-1',
  bossId: FINAL_BOSS_ID,
  phaseIndex: 1,
  name: 'Multi-Region Fusion',
  description: 'Heart of Darkness开始显露真实力量:压力 / 疾病 / 流血 / 饥饿 同时存在。未摧毁的封印会强化对应机制(0 封印 = +50% 压力 +50% 疾病 +50% 流血;1 封印摧毁削弱对应 50%)。',
  enterConditions: [
    { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 3 },
  ],
  exitConditions: [
    { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 6 },
  ],
  bossModifiers: [
    { kind: 'set-flag', flagName: 'final_boss_phase_1', flagValue: true },
  ],
  environmentTargetIds: [],
  summonRules: [],
  tacticalOptionRules: [
    {
      id: 'tactic-final-p1-purify-curse',
      title: '使用诅咒瓦解者(最终任务物品)',
      description: '消耗「诅咒瓦解者」,清除全队压力 +10,移除诅咒标记,本阶段 +20% 撤退成功率。',
      conditions: [],
      weight: 1.0,
      category: 'use-item',
      phaseIndex: 1,
      effects: [
        { kind: 'apply-stress', amount: -10, heroSelector: 'all-alive' },
        { kind: 'set-flag', flagName: 'item_curse_breaker_used', flagValue: true },
        { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
      ],
      riskTags: ['consume-item', 'stress-down'],
    },
    {
      id: 'tactic-final-p1-purify-disease',
      title: '使用净化者之眼(最终任务物品)',
      description: '消耗「净化者之眼」,本轮全员免疫疾病感染 + 解除腐蚀,清空已感染疾病。',
      conditions: [],
      weight: 0.9,
      category: 'use-item',
      phaseIndex: 1,
      effects: [
        { kind: 'set-flag', flagName: 'item_purifier_eye_used', flagValue: true },
        { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
      ],
      riskTags: ['consume-item', 'disease-clean'],
    },
    {
      id: 'tactic-final-p1-all-in',
      title: '孤注一掷',
      description: '无视阶段机制,全力攻击Heart of Darkness;本轮全员压力 +8,但在阶段 2 结束前打出决定性伤害。',
      conditions: [],
      weight: 0.7,
      category: 'attack-core',
      phaseIndex: 1,
      effects: [
        { kind: 'hp-delta', amount: 18, heroSelector: 'all-alive' },
        { kind: 'apply-stress', amount: 8, heroSelector: 'all-alive' },
        { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
      ],
      riskTags: ['all-in', 'high-stress'],
    },
  ],
  phaseEvents: [
    {
      trigger: 'enter',
      effects: [
        { kind: 'set-flag', flagName: 'final_boss_multi_mechanic_active', flagValue: true },
      ],
      narrativeHint: '第二阶段:Multi-Region Fusion,压力/疾病/流血/饥饿同现',
    },
  ],
};

// =====================================================================
// 阶段 2: Hero Trial(SPEC §11.3)
// =====================================================================

const PHASE_FINAL_2: BossPhaseDefinition = {
  id: 'phase-final-2',
  bossId: FINAL_BOSS_ID,
  phaseIndex: 2,
  name: 'Hero Trial',
  description: 'Heart of Darkness针对每名英雄的怪癖、疾病、饰品、历史生成个体化选择。老兵、负面怪癖、已用饰品都会被考验。',
  enterConditions: [
    { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 6 },
  ],
  exitConditions: [
    { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 9 },
  ],
  bossModifiers: [
    { kind: 'set-flag', flagName: 'final_boss_phase_2', flagValue: true },
  ],
  environmentTargetIds: [],
  summonRules: [],
  tacticalOptionRules: [
    {
      id: 'tactic-final-p2-relief',
      title: '使用饥饿者的安息(最终任务物品)',
      description: '消耗「饥饿者的安息」,清除全队流血 + 饥饿;前排 HP 恢复 20%。',
      conditions: [],
      weight: 1.0,
      category: 'use-item',
      phaseIndex: 2,
      effects: [
        { kind: 'set-flag', flagName: 'item_hunger_rest_used', flagValue: true },
        { kind: 'hp-delta', amount: 20, heroSelector: 'front-rank' },
        { kind: 'apply-stress', amount: -5, heroSelector: 'all-alive' },
        { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
      ],
      riskTags: ['consume-item', 'bleed-clean'],
    },
    {
      id: 'tactic-final-p2-hero-trial',
      title: '触发Hero Trial',
      description: '从 HERO_TRIALS 选择 1 个适用英雄的考验(老兵/新人/饰品/怪癖)。成功:获得 trial bonus;失败:压力 +15 + 进入 Death\'s Door 风险。',
      conditions: [],
      weight: 0.9,
      category: 'force-phase',
      phaseIndex: 2,
      effects: [
        { kind: 'set-flag', flagName: 'final_boss_hero_trial_active', flagValue: true },
        { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
      ],
      riskTags: ['hero-trial', 'high-stakes'],
    },
    {
      id: 'tactic-final-p2-protect',
      title: '保护关键英雄',
      description: '让前排护住压力最高的英雄,本轮后排 -0 HP,前排 -8 HP。',
      conditions: [],
      weight: 0.5,
      category: 'protect-hero',
      phaseIndex: 2,
      effects: [
        { kind: 'hp-delta', amount: -8, heroSelector: 'front-rank' },
        { kind: 'inc-flag', flagName: 'boss_phase_rounds', amount: 1 },
      ],
      riskTags: ['frontline-tank'],
    },
  ],
  phaseEvents: [
    {
      trigger: 'enter',
      effects: [
        { kind: 'set-flag', flagName: 'final_boss_hero_trial_active', flagValue: true },
      ],
      narrativeHint: '第三阶段:Hero Trial,读取长期状态',
    },
  ],
};

// =====================================================================
// 阶段 3: Final Choice(SPEC §11.4)
// =====================================================================

const PHASE_FINAL_3: BossPhaseDefinition = {
  id: 'phase-final-3',
  bossId: FINAL_BOSS_ID,
  phaseIndex: 3,
  name: 'Final Choice',
  description: '选择数量收紧到 2-3;撤退成本最高(基础 0.10,失败 = 阶段 2 撤退失效);最终任务物品和牺牲选择生效。胜利/惨胜/失败 在本阶段决出。',
  enterConditions: [
    { kind: 'flag-gte', flagName: 'boss_phase_rounds', value: 9 },
  ],
  exitConditions: [],
  bossModifiers: [
    { kind: 'set-flag', flagName: 'final_boss_phase_3', flagValue: true },
  ],
  environmentTargetIds: [],
  summonRules: [],
  tacticalOptionRules: [
    {
      id: 'tactic-final-p3-sacrifice-protect',
      title: `使用 Veteran's Oath(最终任务物品)`,
      description: '消耗「老兵之誓」,保护一名英雄免受一次致死打击(Death\'s Door 不计入死亡)。消耗后该英雄将不可避免进入 Death\'s Door。',
      conditions: [],
      weight: 1.0,
      category: 'use-item',
      phaseIndex: 3,
      effects: [
        { kind: 'set-flag', flagName: 'item_veteran_oath_used', flagValue: true },
        { kind: 'set-flag', flagName: 'hero_oath_protected', flagValue: 1 },
      ],
      riskTags: ['consume-item', 'death-protection'],
    },
    {
      id: 'tactic-final-p3-all-in',
      title: '最终一击',
      description: '孤注一掷,全员 attack Heart of Darkness;成功后立即结算胜利(若全员 HP 平均 ≥ 30%)或惨胜(否则)。',
      conditions: [],
      weight: 0.8,
      category: 'attack-core',
      phaseIndex: 3,
      effects: [
        { kind: 'hp-delta', amount: 25, heroSelector: 'all-alive' },
        { kind: 'apply-stress', amount: 10, heroSelector: 'all-alive' },
        { kind: 'set-flag', flagName: 'final_boss_final_strike', flagValue: true },
      ],
      riskTags: ['all-in', 'final-strike'],
    },
    {
      id: 'tactic-final-p3-retreat',
      title: '尝试最终撤退',
      description: '基础 0.10(几乎无望),若饥饿者的安息未使用 +0.15,失败 = 阶段 2 撤退成本。',
      conditions: [],
      weight: 0.3,
      category: 'retreat',
      phaseIndex: 3,
      effects: [
        { kind: 'set-flag', flagName: 'boss_retreat_requested', flagValue: true },
      ],
      riskTags: ['retreat', 'high-cost'],
    },
  ],
  phaseEvents: [
    {
      trigger: 'enter',
      effects: [
        { kind: 'set-flag', flagName: 'final_boss_final_phase', flagValue: true },
      ],
      narrativeHint: '最终阶段:抉择时刻,胜利或惨胜',
    },
  ],
};

// =====================================================================
// 最终 Boss 4 阶段集合 + 注册到 boss/registry.ts
// =====================================================================

export const FINAL_BOSS_PHASES: Record<string, BossPhaseDefinition> = {
  'phase-final-0': PHASE_FINAL_0,
  'phase-final-1': PHASE_FINAL_1,
  'phase-final-2': PHASE_FINAL_2,
  'phase-final-3': PHASE_FINAL_3,
};

export const FINAL_BOSS_PHASE_IDS = ['phase-final-0', 'phase-final-1', 'phase-final-2', 'phase-final-3'] as const;

/**
 * 最终 Boss 信息(SPEC §3 finalBossId,§11 4 阶段)
 */
export const FINAL_BOSS_INFO = {
  id: FINAL_BOSS_ID,
  name: 'Heart of Darkness',
  description: 'The manifestation of ancestral sin, fusing the powers of the three region bosses. Phase 1 reads the heroes\' past, Phase 2 merges multi-region mechanics, Phase 3 tests each hero individually, Phase 4 decides the campaign outcome.',
  phaseCount: 4,
  finalRegionId: 'darkest-core',
  // 4 阶段 + 至少 1 个战术选项/阶段
  minimumTacticalOptionsPerPhase: 3,
} as const;
