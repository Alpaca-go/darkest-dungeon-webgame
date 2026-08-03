/**
 * 瘟疫医生(Plague Doctor)技能库
 *
 * Phase 1 规格(对照开发文档 §8.4):
 * - 瘟疫手雷: rank 3-4 → 敌方 3-4,可双目标,低伤害,附加腐蚀
 * - 致盲气体: rank 3-4 → 敌方 3-4,可双目标,附加眩晕
 * - 切割: rank 2-3 → 敌方 1-2,低伤害,附加流血
 * - 战地药剂: rank 2-4 → 任意存活友军,清除流血与腐蚀,恢复少量 HP
 *
 * 注:战地药剂的"清除 DOT"在 Phase 0 不直接实现(规则层未支持),
 *   Phase 1 简化为"附加 heal 2 + 移除现存的 bleed/blight 实例"
 */

import { buildSkill } from '../builders.js';
import type { SkillDefinition } from '../../game-engine/types.js';

export const PLAGUE_DOCTOR_SKILLS: SkillDefinition[] = [
  // Phase 1 默认 4 技能
  buildSkill({
    id: 'plague_doctor.plague_grenade',
    name: '瘟疫手雷',
    ownerArchetype: 'plague_doctor',
    usableFromRanks: [3, 4],
    targetRanks: [3, 4],
    targetSide: 'enemy',
    targetMode: 'all',
    accuracy: 90,
    damageModifier: 0,
    critModifier: 2,
    baseDamage: { min: 2, max: 4 },
    effects: [
      { type: 'damage' },
      { type: 'blight', baseDamage: 3, duration: 3, resistTarget: 'blightResist' },
    ],
    cooldown: 2,
  }),
  buildSkill({
    id: 'plague_doctor.blinding_gas',
    name: '致盲气体',
    ownerArchetype: 'plague_doctor',
    usableFromRanks: [3, 4],
    targetRanks: [3, 4],
    targetSide: 'enemy',
    targetMode: 'all',
    accuracy: 95,
    damageModifier: 0,
    critModifier: 0,
    baseDamage: { min: 0, max: 0 },
    effects: [{ type: 'stun', duration: 1, resistTarget: 'stunResist' }],
    cooldown: 3,
  }),
  buildSkill({
    id: 'plague_doctor.open_vein',
    name: '切割',
    ownerArchetype: 'plague_doctor',
    usableFromRanks: [2, 3],
    targetRanks: [1, 2],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 90,
    damageModifier: 0,
    critModifier: 3,
    baseDamage: { min: 3, max: 5 },
    effects: [
      { type: 'damage' },
      { type: 'bleed', baseDamage: 2, duration: 3, resistTarget: 'bleedResist' },
    ],
    cooldown: 1,
  }),
  buildSkill({
    id: 'plague_doctor.healing_salve',
    name: '战地药剂',
    ownerArchetype: 'plague_doctor',
    usableFromRanks: [2, 3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'ally',
    targetMode: 'single',
    accuracy: 100,
    damageModifier: 0,
    critModifier: 0,
    baseDamage: { min: 0, max: 0 },
    effects: [{ type: 'heal', flat: 3 }],
    cooldown: 1,
  }),

  // 额外技能
  buildSkill({
    id: 'plague_doctor.noxious_blast',
    name: '毒气冲击',
    ownerArchetype: 'plague_doctor',
    usableFromRanks: [3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'enemy',
    targetMode: 'single',
    accuracy: 90,
    damageModifier: 0,
    critModifier: 2,
    baseDamage: { min: 2, max: 4 },
    effects: [
      { type: 'damage' },
      { type: 'blight', baseDamage: 3, duration: 3, resistTarget: 'blightResist' },
    ],
    cooldown: 1,
  }),
  buildSkill({
    id: 'plague_doctor.emboldening_vapours',
    name: '增益蒸汽',
    ownerArchetype: 'plague_doctor',
    usableFromRanks: [3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'ally',
    targetMode: 'all',
    accuracy: 100,
    damageModifier: 0,
    critModifier: 0,
    baseDamage: { min: 0, max: 0 },
    effects: [{ type: 'prot_buff', amount: 10, duration: 3 }],
    cooldown: 3,
  }),
];

export const PLAGUE_DOCTOR_DEFAULT_LOADOUT = [
  'plague_doctor.plague_grenade',
  'plague_doctor.blinding_gas',
  'plague_doctor.open_vein',
  'plague_doctor.healing_salve',
];
