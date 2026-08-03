/**
 * 十字军(Crusader)技能库
 *
 * Phase 1 规格(对照开发文档 §8.1):
 * - 重击: rank 1-2 → 敌方 1-2,标准伤害,高命中
 * - 圣枪突击: rank 3-4 → 敌方 1-3, +15% 伤害,使用后自身前进 1
 * - 震慑打击: rank 1-2 → 敌方 1-2, -50% 伤害,附加眩晕
 * - 防御姿态: rank 1-3 → 自身,获得 PROT 增益持续 2 回合
 *
 * Phase 0 共有 6 技能,Phase 1 固定 4 技能。保留其他技能供后续扩展。
 */

import { buildSkill } from '../builders.js';
import type { SkillDefinition } from '../../game-engine/types.js';

export const CRUSADER_SKILLS: SkillDefinition[] = [
  // Phase 1 默认 4 技能
  buildSkill({
    id: 'crusader.smite',
    name: '重击',
    ownerArchetype: 'crusader',
    usableFromRanks: [1, 2],
    targetRanks: [1, 2],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 95,
    damageModifier: 0,
    critModifier: 4,
    baseDamage: { min: 7, max: 11 },
    effects: [{ type: 'damage' }],
    cooldown: 0,
  }),
  buildSkill({
    id: 'crusader.holy_lance',
    name: '圣枪突击',
    ownerArchetype: 'crusader',
    usableFromRanks: [3, 4],
    targetRanks: [1, 2, 3],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 85,
    damageModifier: 0.15,
    critModifier: 5,
    baseDamage: { min: 6, max: 10 },
    moveSelf: -1, // 使用后向前(降低 rank)
    effects: [{ type: 'damage' }],
    cooldown: 2,
  }),
  buildSkill({
    id: 'crusader.stunning_blow',
    name: '震慑打击',
    ownerArchetype: 'crusader',
    usableFromRanks: [1, 2],
    targetRanks: [1, 2],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 90,
    damageModifier: -0.5,
    critModifier: 2,
    baseDamage: { min: 3, max: 5 },
    effects: [
      { type: 'damage' },
      { type: 'stun', duration: 1, resistTarget: 'stunResist' },
    ],
    cooldown: 2,
  }),
  buildSkill({
    id: 'crusader.bulwark',
    name: '防御姿态',
    ownerArchetype: 'crusader',
    usableFromRanks: [1, 2, 3],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'self',
    targetMode: 'self',
    accuracy: 100,
    damageModifier: 0,
    critModifier: 0,
    baseDamage: { min: 0, max: 0 },
    effects: [{ type: 'prot_buff', amount: 25, duration: 2 }],
    cooldown: 3,
  }),

  // 额外技能(预留扩展)
  buildSkill({
    id: 'crusader.inspiring_cry',
    name: '激励怒吼',
    ownerArchetype: 'crusader',
    usableFromRanks: [1, 2, 3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'self',
    targetMode: 'self',
    accuracy: 100,
    damageModifier: 0,
    critModifier: 0,
    baseDamage: { min: 0, max: 0 },
    effects: [{ type: 'heal', flat: 4 }],
    cooldown: 2,
  }),
  buildSkill({
    id: 'crusader.zealous_accusation',
    name: '狂热指控',
    ownerArchetype: 'crusader',
    usableFromRanks: [1, 2, 3],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 85,
    damageModifier: 0,
    critModifier: 3,
    baseDamage: { min: 3, max: 5 },
    moveTarget: 1,
    effects: [{ type: 'damage' }, { type: 'mark', duration: 2 }],
    cooldown: 2,
  }),
];

/** Phase 1 默认装备的 4 个技能 */
export const CRUSADER_DEFAULT_LOADOUT = [
  'crusader.smite',
  'crusader.holy_lance',
  'crusader.stunning_blow',
  'crusader.bulwark',
];
