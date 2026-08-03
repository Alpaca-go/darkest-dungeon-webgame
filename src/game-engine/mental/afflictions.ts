/**
 * 折磨定义(SPEC §6 §7 §22)
 *
 * 4 种折磨:
 *   偏执(paranoia) - 拒绝治疗, 不信任侦察
 *   恐惧(fear) - 拒绝进入高风险, 倾向撤退
 *   自虐(masochism) - 主动承担伤害, 拒绝治疗
 *   非理性(irrational) - 随机篡改, 擅自行动
 *
 * 每种至少 5 个行为(SPEC §3.1)。
 */

import type { AfflictionDefinition } from '../expedition/types.js';

export const AFFLICTIONS: Record<string, AfflictionDefinition> = {
  // ============================================================
  // 1. 偏执 (Paranoia)
  // ============================================================
  affliction_paranoia: {
    id: 'affliction_paranoia',
    name: '偏执',
    description: '怀疑所有人,拒绝合作与治疗',
    archetype: 'paranoia',
    coreTendency: ['拒绝治疗', '不信任侦察', '不愿共享资源', '指责队友', '质疑撤退方案'],
    passiveStressGain: 1.2, // 压力增长 +20%
    behaviors: [
      {
        id: 'paranoia_refuse_heal',
        trigger: 'on-healing-choice',
        effect: 'refuse-choice',
        baseChance: 0.45,
        stressModifier: 0.01,
        narrativeHint: '偏执的{target}拒绝接受治疗,声称这是下毒。',
        cooldownDecisions: 2,
      },
      {
        id: 'paranoia_distrust_scout',
        trigger: 'on-route-choice',
        effect: 'replace-choice',
        baseChance: 0.25,
        torchModifier: 0.05,
        narrativeHint: '偏执的{target}认为侦察信息是骗局,坚持走最危险的路。',
        cooldownDecisions: 2,
      },
      {
        id: 'paranoia_accuse_ally',
        trigger: 'on-node-enter',
        effect: 'add-party-stress',
        baseChance: 0.2,
        stressModifier: 0.005,
        narrativeHint: '偏执的{target}公开指责队友,造成精神压力。',
        cooldownDecisions: 3,
      },
      {
        id: 'paranoia_block_retreat',
        trigger: 'on-retreat-choice',
        effect: 'block-retreat',
        baseChance: 0.3,
        stressModifier: 0.01,
        narrativeHint: '偏执的{target}质疑撤退,认为这是逃跑。',
        cooldownDecisions: 1,
      },
      {
        id: 'paranoia_take_supply',
        trigger: 'on-resource-use',
        effect: 'consume-item',
        baseChance: 0.15,
        narrativeHint: '偏执的{target}抢走了给队友的补给。',
        cooldownDecisions: 3,
      },
    ],
  },

  // ============================================================
  // 2. 恐惧 (Fear)
  // ============================================================
  affliction_fear: {
    id: 'affliction_fear',
    name: '恐惧',
    description: '畏惧危险,在压力下放弃行动',
    archetype: 'fear',
    coreTendency: ['拒绝进入高风险节点', '遇到特定敌人时失去执行资格', '倾向撤退', '黑暗中额外压力', '遭遇时跳过行动'],
    passiveStressGain: 1.1,
    behaviors: [
      {
        id: 'fear_skip_action',
        trigger: 'before-hero-action',
        effect: 'skip-action',
        baseChance: 0.35,
        hpModifier: 0.05,
        narrativeHint: '恐惧的{target}在关键时刻失去勇气,无法执行行动。',
        cooldownDecisions: 2,
      },
      {
        id: 'fear_refuse_high_risk',
        trigger: 'on-route-choice',
        effect: 'replace-choice',
        baseChance: 0.4,
        narrativeHint: '恐惧的{target}坚持选最安全的路。',
        cooldownDecisions: 2,
      },
      {
        id: 'fear_dark_stress',
        trigger: 'on-node-enter',
        effect: 'add-self-stress',
        baseChance: 0.5,
        stressModifier: 0.03,
        torchModifier: 0.02, // torch 越低越容易触发
        narrativeHint: '恐惧的{target}在黑暗中颤抖,压力上升。',
        cooldownDecisions: 1,
      },
      {
        id: 'fear_force_retreat',
        trigger: 'on-retreat-choice',
        effect: 'replace-primary-actor',
        baseChance: 0.3,
        narrativeHint: '恐惧的{target}试图成为撤退的主要执行者。',
        cooldownDecisions: 1,
      },
      {
        id: 'fear_replace_actor',
        trigger: 'before-hero-action',
        effect: 'replace-primary-actor',
        baseChance: 0.25,
        narrativeHint: '恐惧的{target}把执行机会让给了别人。',
        cooldownDecisions: 2,
      },
    ],
  },

  // ============================================================
  // 3. 自虐 (Masochism)
  // ============================================================
  affliction_masochism: {
    id: 'affliction_masochism',
    name: '自虐',
    description: '追求痛苦,拒绝救治',
    archetype: 'masochism',
    coreTendency: ['拒绝治疗', '主动承担伤害', '选择危险路线', '低 HP 时拒绝撤退', '死亡之门时阻止救援'],
    passiveStressGain: 1.0,
    behaviors: [
      {
        id: 'masochism_refuse_heal',
        trigger: 'on-healing-choice',
        effect: 'refuse-choice',
        baseChance: 0.55,
        hpModifier: 0.1, // HP 越低越可能拒绝
        narrativeHint: '自虐的{target}拒绝被治疗,要求承受更多痛苦。',
        cooldownDecisions: 2,
      },
      {
        id: 'masochism_take_dangerous_route',
        trigger: 'on-route-choice',
        effect: 'replace-choice',
        baseChance: 0.3,
        hpModifier: 0.1,
        narrativeHint: '自虐的{target}坚持选最危险的路线。',
        cooldownDecisions: 2,
      },
      {
        id: 'masochism_block_retreat_at_low_hp',
        trigger: 'on-retreat-choice',
        effect: 'block-retreat',
        baseChance: 0.5,
        hpModifier: 0.15, // HP 低时高概率
        narrativeHint: '自虐的{target}拒绝撤退,坚持要死在这里。',
        cooldownDecisions: 2,
      },
      {
        id: 'masochism_force_curio',
        trigger: 'on-curio-choice',
        effect: 'force-curio-interaction',
        baseChance: 0.35,
        narrativeHint: '自虐的{target}擅自触碰了奇物。',
        cooldownDecisions: 2,
      },
      {
        id: 'masochism_replace_to_self',
        trigger: 'before-hero-action',
        effect: 'replace-primary-actor',
        baseChance: 0.2,
        narrativeHint: '自虐的{target}抢着要当主要执行者。',
        cooldownDecisions: 2,
      },
    ],
  },

  // ============================================================
  // 4. 非理性 (Irrational)
  // ============================================================
  affliction_irrational: {
    id: 'affliction_irrational',
    name: '非理性',
    description: '行为无法预测',
    archetype: 'irrational',
    coreTendency: ['随机篡改战术', '擅自改变站位', '跳过行动', '擅自使用补给', '擅自触碰奇物', '选择另一条路线'],
    passiveStressGain: 1.0,
    behaviors: [
      {
        id: 'irrational_random_replace',
        trigger: 'before-choice-confirm',
        effect: 'replace-choice',
        baseChance: 0.3,
        stressModifier: 0.005,
        narrativeHint: '非理性的{target}突然改变主意。',
        cooldownDecisions: 1,
      },
      {
        id: 'irrational_move_self',
        trigger: 'on-node-enter',
        effect: 'move-self',
        baseChance: 0.2,
        narrativeHint: '非理性的{target}擅自换到了别的站位。',
        cooldownDecisions: 2,
      },
      {
        id: 'irrational_skip',
        trigger: 'before-hero-action',
        effect: 'skip-action',
        baseChance: 0.25,
        narrativeHint: '非理性的{target}站在原地发呆,本轮放弃行动。',
        cooldownDecisions: 2,
      },
      {
        id: 'irrational_take_supply',
        trigger: 'on-resource-use',
        effect: 'consume-item',
        baseChance: 0.2,
        narrativeHint: '非理性的{target}擅自消耗了补给。',
        cooldownDecisions: 2,
      },
      {
        id: 'irrational_change_route',
        trigger: 'on-route-choice',
        effect: 'change-route',
        baseChance: 0.25,
        narrativeHint: '非理性的{target}坚持走另一条路。',
        cooldownDecisions: 2,
      },
    ],
  },
};

export function getAfflictionDef(id: string): AfflictionDefinition | undefined {
  return AFFLICTIONS[id];
}

export const AFFLICTION_IDS = ['affliction_paranoia', 'affliction_fear', 'affliction_masochism', 'affliction_irrational'] as const;
