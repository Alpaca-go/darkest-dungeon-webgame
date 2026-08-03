/**
 * 修女(Vestal)技能库
 *
 * Phase 1 规格(对照开发文档 §8.3):
 * - 神圣审判: rank 3-4 → 敌方 1-4,中低伤害,自身恢复少量 HP
 * - 炫光: rank 2-4 → 敌方 1-3,低伤害,附加眩晕
 * - 单体治疗: rank 2-4 → 任意存活友军,恢复随机范围 HP
 * - 群体治疗: rank 3-4 → 所有存活友军,每名英雄恢复少量 HP
 */

import { buildSkill } from '../builders.js';
import type { SkillDefinition } from '../../game-engine/types.js';

export const VESTAL_SKILLS: SkillDefinition[] = [
  // Phase 1 默认 4 技能
  buildSkill({
    id: 'vestal.judgement',
    name: '神圣审判',
    ownerArchetype: 'vestal',
    usableFromRanks: [3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 90,
    damageModifier: 0,
    critModifier: 3,
    baseDamage: { min: 4, max: 7 },
    effects: [
      { type: 'damage' },
      { type: 'heal', flat: 2 },
    ],
    cooldown: 1,
  }),
  buildSkill({
    id: 'vestal.mace_bash',
    name: '炫光',
    ownerArchetype: 'vestal',
    usableFromRanks: [2, 3, 4],
    targetRanks: [1, 2, 3],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 95,
    damageModifier: 0,
    critModifier: 2,
    baseDamage: { min: 2, max: 4 },
    effects: [
      { type: 'damage' },
      { type: 'stun', duration: 1, resistTarget: 'stunResist' },
    ],
    cooldown: 2,
  }),
  buildSkill({
    id: 'vestal.heal',
    name: '单体治疗',
    ownerArchetype: 'vestal',
    usableFromRanks: [2, 3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'ally',
    targetMode: 'single',
    accuracy: 100,
    damageModifier: 0,
    critModifier: 0,
    baseDamage: { min: 0, max: 0 },
    effects: [{ type: 'heal', flat: 5 }],
    cooldown: 1,
  }),
  buildSkill({
    id: 'vestal.divine_light',
    name: '群体治疗',
    ownerArchetype: 'vestal',
    usableFromRanks: [3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'ally',
    targetMode: 'all',
    accuracy: 100,
    damageModifier: 0,
    critModifier: 0,
    baseDamage: { min: 0, max: 0 },
    effects: [{ type: 'heal', flat: 3 }],
    cooldown: 3,
  }),

  // 额外技能
  buildSkill({
    id: 'vestal.holy_boom',
    name: '圣光爆裂',
    ownerArchetype: 'vestal',
    usableFromRanks: [3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'enemy',
    targetMode: 'all',
    accuracy: 80,
    damageModifier: 0,
    critModifier: 2,
    baseDamage: { min: 2, max: 4 },
    effects: [
      { type: 'damage' },
      { type: 'bleed', baseDamage: 1, duration: 2, resistTarget: 'bleedResist' },
    ],
    cooldown: 3,
  }),
];

export const VESTAL_DEFAULT_LOADOUT = [
  'vestal.judgement',
  'vestal.mace_bash',
  'vestal.heal',
  'vestal.divine_light',
];
