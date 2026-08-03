/**
 * 美德定义(SPEC §8 §9)
 *
 * 3 种美德:
 *   坚定(steadfast) - 自身压力增长降低, 鼓舞队友, 心脏病缓冲
 *   勇猛(valorous) - 正面突破收益提高, 死亡之门时自动掩护
 *   专注(focused) - 侦察更准确, 陷阱处理更稳定
 *
 * 每种至少 3 个主动行为(SPEC §3.1)。
 */

import type { VirtueDefinition } from '../expedition/types.js';

export const VIRTUES: Record<string, VirtueDefinition> = {
  // ============================================================
  // 1. 坚定 (Steadfast)
  // ============================================================
  virtue_steadfast: {
    id: 'virtue_steadfast',
    name: '坚定',
    description: '意志如铁,鼓舞同伴',
    archetype: 'steadfast',
    coreTendency: ['自身压力增长降低', '鼓舞队友', '撤退时稳定队伍', '降低折磨压力传播', '心脏病缓冲'],
    passiveStressGain: 0.7, // 压力增长 -30%
    heartAttackBuffer: true, // 第一次 200 压力时触发缓冲
    behaviors: [
      {
        id: 'steadfast_inspire_ally',
        trigger: 'on-stress-spike',
        effect: 'inspire-ally',
        baseChance: 0.6,
        narrativeHint: '坚定的{target}用话语鼓舞了全队,每人压力 -5。',
        cooldownDecisions: 1,
      },
      {
        id: 'steadfast_reduce_penalty',
        trigger: 'on-choice-failed',
        effect: 'reduce-penalty',
        baseChance: 0.4,
        narrativeHint: '坚定的{target}稳定了队伍,失败惩罚减半。',
        cooldownDecisions: 1,
      },
      {
        id: 'steadfast_lower_pulse',
        trigger: 'on-stress-spike',
        effect: 'lower-stress-pulse',
        baseChance: 0.5,
        narrativeHint: '坚定的{target}吸收了精神冲击,压力传播 -30%。',
        cooldownDecisions: 2,
      },
    ],
  },

  // ============================================================
  // 2. 勇猛 (Valorous)
  // ============================================================
  virtue_valorous: {
    id: 'virtue_valorous',
    name: '勇猛',
    description: '战斗中奋勇当先,庇护队友',
    archetype: 'valorous',
    coreTendency: ['正面突破收益提高', '低 HP 仍能稳定执行', '死亡之门时自动掩护一次', '胜利后降低队伍压力', '高风险选择成功提高收益'],
    passiveStressGain: 1.0,
    behaviors: [
      {
        id: 'valorous_shield_ally',
        trigger: 'on-ally-at-deaths-door',
        effect: 'shield-ally',
        baseChance: 0.7,
        narrativeHint: '勇猛的{target}挡在濒死队友面前,降低了他们被攻击的概率。',
        cooldownDecisions: 1,
      },
      {
        id: 'valorous_inspire_after_victory',
        trigger: 'on-stress-spike',
        effect: 'inspire-ally',
        baseChance: 0.5,
        narrativeHint: '勇猛的{target}在胜利后高呼,提振了全队士气。',
        cooldownDecisions: 1,
      },
      {
        id: 'valorous_unlock_all_in',
        trigger: 'on-ally-at-deaths-door',
        effect: 'unlock-special-choice',
        baseChance: 0.5,
        narrativeHint: '勇猛的{target}在危险中觉醒,解锁[孤注一掷]选项。',
        cooldownDecisions: 2,
      },
    ],
  },

  // ============================================================
  // 3. 专注 (Focused)
  // ============================================================
  virtue_focused: {
    id: 'virtue_focused',
    name: '专注',
    description: '冷静观察,识破陷阱',
    archetype: 'focused',
    coreTendency: ['侦察更准确', '陷阱处理更稳定', '控制战术成功率提高', '阻止一次路线篡改', '风险提示更清晰'],
    passiveStressGain: 0.85,
    behaviors: [
      {
        id: 'focused_detect_extra',
        trigger: 'on-node-enter',
        effect: 'detect-extra',
        baseChance: 0.6,
        narrativeHint: '专注的{target}发现了额外的机关,解锁了安全选项。',
        cooldownDecisions: 2,
      },
      {
        id: 'focused_block_route_change',
        trigger: 'on-route-choice',
        effect: 'guarantee-success',
        baseChance: 0.5,
        narrativeHint: '专注的{target}阻止了一次路线篡改,玩家选择被强制执行。',
        cooldownDecisions: 2,
      },
      {
        id: 'focused_inspire_ally',
        trigger: 'on-stress-spike',
        effect: 'inspire-ally',
        baseChance: 0.4,
        narrativeHint: '专注的{target}冷静分析,稳定了队伍情绪。',
        cooldownDecisions: 1,
      },
    ],
  },
};

export function getVirtueDef(id: string): VirtueDefinition | undefined {
  return VIRTUES[id];
}

export const VIRTUE_IDS = ['virtue_steadfast', 'virtue_valorous', 'virtue_focused'] as const;
