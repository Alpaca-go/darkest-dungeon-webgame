/**
 * 露营活动定义(Phase 4 P4.4)
 *
 * SPEC §12:
 *  - 8 个通用活动(守夜/整理装备/安抚队伍/检查伤势/侦察前路/讨论撤退/修补补给/保持沉默)
 *  - 12 个职业活动(每职业 3 个,4 职业:十字军/强盗/修女/瘟疫医生)
 *  - 共 20 个活动
 */

import type { CampActivityDef } from './types.js';

export const ALL_CAMP_ACTIVITIES: CampActivityDef[] = [
  // ============================================================
  // 通用 8 个(SPEC §12.2)
  // ============================================================
  {
    id: 'camp_keep_watch',
    name: '守夜',
    description: '安排轮班值守,降低夜间遇袭风险',
    category: 'universal',
    cost: 4,
    tags: ['guard'],
    effects: [],
    target: 'all',
  },
  {
    id: 'camp_sort_gear',
    name: '整理装备',
    description: '检修武器护甲,小幅恢复耐久度',
    category: 'universal',
    cost: 2,
    tags: ['flavor'],
    effects: [],
    target: 'all',
  },
  {
    id: 'camp_calm_party',
    name: '安抚队伍',
    description: '用故事或笑声降低全员压力',
    category: 'universal',
    cost: 3,
    tags: ['stress-relief'],
    effects: [{ kind: 'apply-stress', amount: -10, heroSelector: 'all-alive' }],
    target: 'all',
  },
  {
    id: 'camp_treat_wounds',
    name: '检查伤势',
    description: '包扎伤口,治疗血量最低的英雄',
    category: 'universal',
    cost: 3,
    tags: ['heal'],
    effects: [{ kind: 'heal-flat', amount: 5, heroSelector: 'lowest-hp' }],
    target: 'choice',
  },
  {
    id: 'camp_scout_ahead',
    name: '侦察前路',
    description: '派人查探后半程,获得侦察 Buff',
    category: 'universal',
    cost: 4,
    tags: ['scout'],
    effects: [],
    target: 'all',
  },
  {
    id: 'camp_discuss_retreat',
    name: '讨论撤退',
    description: '提前规划撤退路线,降低撤退成本',
    category: 'universal',
    cost: 2,
    tags: ['flavor'],
    effects: [],
    target: 'all',
  },
  {
    id: 'camp_preserve_provisions',
    name: '修补补给',
    description: '密封食物袋,延长补给时间(火把 Buff)',
    category: 'universal',
    cost: 3,
    tags: ['supply', 'buff'],
    effects: [{ kind: 'food-delta', amount: 1, itemId: 'food' }],
    target: 'all',
  },
  {
    id: 'camp_silence',
    name: '保持沉默',
    description: '在压抑的安静中休息,小幅恢复但压力上升',
    category: 'universal',
    cost: 1,
    tags: ['flavor'],
    effects: [
      { kind: 'heal-flat', amount: 1, heroSelector: 'all-alive' },
      { kind: 'apply-stress', amount: 5, heroSelector: 'all-alive' },
    ],
    target: 'all',
  },
  // ============================================================
  // 十字军(3 个)
  // ============================================================
  {
    id: 'camp_inspiring_prayer',
    name: '鼓舞祈祷',
    description: '十字军带领全队祷告,大幅降低压力',
    category: 'crusader',
    cost: 4,
    tags: ['stress-relief'],
    effects: [{ kind: 'apply-stress', amount: -20, heroSelector: 'all-alive' }],
    target: 'all',
  },
  {
    id: 'camp_guard_camp',
    name: '守护营地',
    description: '十字军亲自守夜,免疫夜袭',
    category: 'crusader',
    cost: 3,
    tags: ['guard'],
    effects: [],
    target: 'all',
  },
  {
    id: 'camp_steady_faith',
    name: '坚定信念',
    description: '十字军坚定队友意志,治疗濒死英雄',
    category: 'crusader',
    cost: 3,
    tags: ['heal', 'buff'],
    effects: [
      { kind: 'heal-flat', amount: 8, heroSelector: 'lowest-hp' },
    ],
    target: 'choice',
  },
  // ============================================================
  // 强盗(3 个)
  // ============================================================
  {
    id: 'camp_highwayman_scout',
    name: '强盗侦察',
    description: '强盗的锐利眼睛发现隐藏细节,侦察 Buff 持续更长',
    category: 'highwayman',
    cost: 4,
    tags: ['scout', 'buff'],
    effects: [],
    target: 'all',
  },
  {
    id: 'camp_check_ambush',
    name: '检查伏击',
    description: '强盗排查伏击点,降低夜袭概率',
    category: 'highwayman',
    cost: 3,
    tags: ['guard'],
    effects: [],
    target: 'all',
  },
  {
    id: 'camp_sharpen_blade',
    name: '整理武器',
    description: '强盗保养武器,提高下次命中',
    category: 'highwayman',
    cost: 2,
    tags: ['buff'],
    effects: [],
    target: 'all',
  },
  // ============================================================
  // 修女(3 个)
  // ============================================================
  {
    id: 'camp_vestal_calm',
    name: '修女安抚',
    description: '修女为高压英雄单独祈祷,大幅降低其压力',
    category: 'vestal',
    cost: 3,
    tags: ['stress-relief'],
    effects: [{ kind: 'apply-stress', amount: -25, heroSelector: 'lowest-hp' }],
    target: 'choice',
  },
  {
    id: 'camp_holy_prayer',
    name: '神圣祈祷',
    description: '修女施放神圣法术,治疗并降低疾病感染率',
    category: 'vestal',
    cost: 4,
    tags: ['heal', 'disease-prevent'],
    effects: [{ kind: 'heal-flat', amount: 4, heroSelector: 'all-alive' }],
    target: 'all',
  },
  {
    id: 'camp_ward_blessing',
    name: '祝福庇护',
    description: '修女祝福,获得疾病抗性 Buff(防一次疾病)',
    category: 'vestal',
    cost: 3,
    tags: ['disease-prevent', 'buff'],
    effects: [],
    target: 'all',
  },
  // ============================================================
  // 瘟疫医生(3 个)
  // ============================================================
  {
    id: 'camp_treat_disease',
    name: '处理疾病',
    description: '瘟疫医生治疗已染病的英雄',
    category: 'plague_doctor',
    cost: 4,
    tags: ['heal', 'disease-prevent'],
    effects: [{ kind: 'heal-flat', amount: 6, heroSelector: 'lowest-hp' }],
    target: 'choice',
  },
  {
    id: 'camp_cleanse_bleed',
    name: '清除流血/腐蚀',
    description: '瘟疫医生消毒伤口,治疗血量并降低状态',
    category: 'plague_doctor',
    cost: 3,
    tags: ['heal'],
    effects: [{ kind: 'heal-flat', amount: 5, heroSelector: 'all-alive' }],
    target: 'all',
  },
  {
    id: 'camp_prevent_infection',
    name: '预防感染',
    description: '瘟疫医生分发药剂,本露营获得疾病抗性',
    category: 'plague_doctor',
    cost: 3,
    tags: ['disease-prevent', 'buff'],
    effects: [],
    target: 'all',
  },
  // ============================================================
  // Buff 专用(通过 tags 触发)
  // ============================================================
  {
    id: 'camp_steady_formation',
    name: '稳住阵型',
    description: '阵型规整,降低下两场遭遇的阵型混乱',
    category: 'universal',
    cost: 3,
    tags: ['buff'],
    effects: [],
    target: 'all',
  },
  {
    id: 'camp_bless_arms',
    name: '祝福武器',
    description: '为武器附魔,下一场遭遇命中提高',
    category: 'universal',
    cost: 2,
    tags: ['buff'],
    effects: [],
    target: 'all',
  },
];

export function getCampActivity(id: string): CampActivityDef | undefined {
  return ALL_CAMP_ACTIVITIES.find((a) => a.id === id);
}

export const ACTIVITIES_BY_CATEGORY: Record<string, CampActivityDef[]> = {
  universal: ALL_CAMP_ACTIVITIES.filter((a) => a.category === 'universal'),
  crusader: ALL_CAMP_ACTIVITIES.filter((a) => a.category === 'crusader'),
  highwayman: ALL_CAMP_ACTIVITIES.filter((a) => a.category === 'highwayman'),
  vestal: ALL_CAMP_ACTIVITIES.filter((a) => a.category === 'vestal'),
  plague_doctor: ALL_CAMP_ACTIVITIES.filter((a) => a.category === 'plague_doctor'),
};
