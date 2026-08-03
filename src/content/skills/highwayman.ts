/**
 * 强盗(Highwayman)技能库
 *
 * Phase 1 规格(对照开发文档 §8.2):
 * - 邪恶切割: rank 1-3 → 敌方 1-2,标准伤害,附加流血
 * - 手枪射击: rank 2-4 → 敌方 2-4, -15% 伤害,对后排提高暴击
 * - 前冲决斗: rank 2-4 → 敌方 1-3, -20% 伤害,自身前进 1
 * - 后撤射击: rank 1-2 → 敌方 1-3, -30% 伤害,自身后退 1
 *
 * 注:对手枪射击的"后排暴击提高"通过"对 rank 3-4 目标附加 crit 提升"实现
 */

import { buildSkill } from '../builders.js';
import type { SkillDefinition } from '../../game-engine/types.js';

export const HIGHWAYMAN_SKILLS: SkillDefinition[] = [
  // Phase 1 默认 4 技能
  buildSkill({
    id: 'highwayman.wicked_slice',
    name: '邪恶切割',
    ownerArchetype: 'highwayman',
    usableFromRanks: [1, 2, 3],
    targetRanks: [1, 2],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 90,
    damageModifier: 0,
    critModifier: 4,
    baseDamage: { min: 5, max: 9 },
    effects: [
      { type: 'damage' },
      { type: 'bleed', baseDamage: 2, duration: 3, resistTarget: 'bleedResist' },
    ],
    cooldown: 0,
  }),
  buildSkill({
    id: 'highwayman.pistol_shot',
    name: '手枪射击',
    ownerArchetype: 'highwayman',
    usableFromRanks: [2, 3, 4],
    targetRanks: [2, 3, 4],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 90,
    damageModifier: -0.15,
    critModifier: 8, // 标准 +4 + 后排 +4
    baseDamage: { min: 4, max: 7 },
    effects: [{ type: 'damage' }, { type: 'mark', duration: 2 }],
    cooldown: 1,
  }),
  buildSkill({
    id: 'highwayman.lunge',
    name: '前冲决斗',
    ownerArchetype: 'highwayman',
    usableFromRanks: [2, 3, 4],
    targetRanks: [1, 2, 3],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 85,
    damageModifier: -0.2,
    critModifier: 3,
    baseDamage: { min: 4, max: 7 },
    moveSelf: -1, // 向前
    effects: [{ type: 'damage' }],
    cooldown: 2,
  }),
  buildSkill({
    id: 'highwayman.reposition',
    name: '后撤射击',
    ownerArchetype: 'highwayman',
    usableFromRanks: [1, 2],
    targetRanks: [1, 2, 3],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 90,
    damageModifier: -0.3,
    critModifier: 5,
    baseDamage: { min: 3, max: 6 },
    moveSelf: 1, // 向后
    effects: [{ type: 'damage' }],
    cooldown: 2,
  }),

  // 额外技能
  buildSkill({
    id: 'highwayman.open_vein',
    name: '放血',
    ownerArchetype: 'highwayman',
    usableFromRanks: [1, 2, 3],
    targetRanks: [1, 2, 3],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 90,
    damageModifier: 0,
    critModifier: 3,
    baseDamage: { min: 3, max: 5 },
    effects: [
      { type: 'damage' },
      { type: 'bleed', baseDamage: 3, duration: 3, resistTarget: 'bleedResist' },
    ],
    cooldown: 1,
  }),
  buildSkill({
    id: 'highwayman.dagger_rain',
    name: '匕首如雨',
    ownerArchetype: 'highwayman',
    usableFromRanks: [2, 3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'enemy',
    targetMode: 'adjacent',
    accuracy: 80,
    damageModifier: 0,
    critModifier: 4,
    baseDamage: { min: 3, max: 5 },
    effects: [{ type: 'damage' }, { type: 'bleed', baseDamage: 1, duration: 2, resistTarget: 'bleedResist' }],
    cooldown: 2,
  }),
];

export const HIGHWAYMAN_DEFAULT_LOADOUT = [
  'highwayman.wicked_slice',
  'highwayman.pistol_shot',
  'highwayman.lunge',
  'highwayman.reposition',
];
