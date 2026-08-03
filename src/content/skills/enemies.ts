/**
 * 敌人技能库(Phase 1 规格)
 *
 * 4 种敌人(对照开发文档 §9):
 * 1. 骸骨士兵 (Skeleton Soldier) - 前排,标准物理,高 HP,低速度
 * 2. 骸骨盾卫 (Skeleton Defender) - 前排,高 PROT,推动
 * 3. 邪教侍僧 (Cultist Acolyte) - 后排,远程
 * 4. 骸骨弩手 (Skeleton Crossbowman) - 后排输出,前排时能力下降
 */

import { buildSkill } from '../builders.js';
import type { SkillDefinition } from '../../game-engine/types.js';

export const ENEMY_SKILLS: SkillDefinition[] = [
  // ===== 骸骨士兵 (Skeleton Soldier) =====
  buildSkill({
    id: 'skeleton_soldier.slash',
    name: '斩击',
    ownerArchetype: 'skeleton_soldier',
    usableFromRanks: [1, 2],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'ally',
    targetMode: 'single',
    accuracy: 85,
    damageModifier: 0,
    critModifier: 2,
    baseDamage: { min: 5, max: 8 },
    effects: [{ type: 'damage' }],
    cooldown: 0,
  }),
  buildSkill({
    id: 'skeleton_soldier.defensive_stance',
    name: '防御架势',
    ownerArchetype: 'skeleton_soldier',
    usableFromRanks: [1, 2, 3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'self',
    targetMode: 'self',
    accuracy: 100,
    damageModifier: 0,
    critModifier: 0,
    baseDamage: { min: 0, max: 0 },
    effects: [{ type: 'prot_buff', amount: 20, duration: 2 }],
    cooldown: 3,
  }),

  // ===== 骸骨盾卫 (Skeleton Defender) =====
  buildSkill({
    id: 'skeleton_defender.shield_bash',
    name: '盾击',
    ownerArchetype: 'skeleton_defender',
    usableFromRanks: [1, 2],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'ally',
    targetMode: 'single',
    accuracy: 80,
    damageModifier: 0,
    critModifier: 2,
    baseDamage: { min: 3, max: 5 },
    effects: [{ type: 'damage' }, { type: 'stun', duration: 1, resistTarget: 'stunResist' }],
    cooldown: 1,
  }),
  buildSkill({
    id: 'skeleton_defender.push',
    name: '推动',
    ownerArchetype: 'skeleton_defender',
    usableFromRanks: [1, 2],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'ally',
    targetMode: 'single',
    accuracy: 90,
    damageModifier: 0,
    critModifier: 1,
    baseDamage: { min: 2, max: 3 },
    moveTarget: 1, // 把目标向后退
    effects: [{ type: 'damage' }],
    cooldown: 1,
  }),
  buildSkill({
    id: 'skeleton_defender.defense_buff',
    name: '防御强化',
    ownerArchetype: 'skeleton_defender',
    usableFromRanks: [1, 2, 3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'self',
    targetMode: 'self',
    accuracy: 100,
    damageModifier: 0,
    critModifier: 0,
    baseDamage: { min: 0, max: 0 },
    effects: [{ type: 'prot_buff', amount: 30, duration: 3 }],
    cooldown: 3,
  }),

  // ===== 邪教侍僧 (Cultist Acolyte) =====
  buildSkill({
    id: 'cultist_acolyte.hex',
    name: '邪术诅咒',
    ownerArchetype: 'cultist_acolyte',
    usableFromRanks: [1, 2, 3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'ally',
    targetMode: 'single',
    accuracy: 75, // 较低命中
    damageModifier: 0,
    critModifier: 1,
    baseDamage: { min: 2, max: 4 },
    effects: [{ type: 'damage' }, { type: 'mark', duration: 2 }],
    cooldown: 0,
  }),
  buildSkill({
    id: 'cultist_acolyte.retreat',
    name: '卑鄙后撤',
    ownerArchetype: 'cultist_acolyte',
    usableFromRanks: [1, 2, 3, 4],
    targetRanks: [1, 2, 3, 4],
    targetSide: 'ally',
    targetMode: 'single',
    accuracy: 90,
    damageModifier: 0,
    critModifier: 0,
    baseDamage: { min: 1, max: 2 },
    moveSelf: 1, // 自身后退
    effects: [{ type: 'damage' }],
    cooldown: 2,
  }),

  // ===== 骸骨弩手 (Skeleton Crossbowman) =====
  buildSkill({
    id: 'crossbowman.bolt',
    name: '弩箭',
    ownerArchetype: 'crossbowman',
    usableFromRanks: [1, 2, 3, 4],
    targetRanks: [2, 3, 4],
    targetSide: 'ally',
    targetMode: 'single',
    accuracy: 90,
    damageModifier: 0,
    critModifier: 5,
    baseDamage: { min: 3, max: 5 },
    effects: [{ type: 'damage' }],
    cooldown: 0,
  }),
  buildSkill({
    id: 'crossbowman.snipe',
    name: '狙击',
    ownerArchetype: 'crossbowman',
    usableFromRanks: [2, 3, 4], // 前排时不能使用
    targetRanks: [3, 4],
    targetSide: 'ally',
    targetMode: 'single',
    accuracy: 95,
    damageModifier: 0.2,
    critModifier: 10,
    baseDamage: { min: 5, max: 8 },
    effects: [{ type: 'damage' }, { type: 'mark', duration: 2 }],
    cooldown: 2,
  }),
  buildSkill({
    id: 'crossbowman.melee',
    name: '近身挥砍',
    ownerArchetype: 'crossbowman',
    usableFromRanks: [1], // 只在前排时可用
    targetRanks: [1, 2, 3, 4],
    targetSide: 'ally',
    targetMode: 'single',
    accuracy: 80,
    damageModifier: 0,
    critModifier: 3,
    baseDamage: { min: 4, max: 6 },
    effects: [{ type: 'damage' }],
    cooldown: 0,
  }),
];

/** 通过 archetype 找敌人技能 */
export function getEnemySkillsByArchetype(archetype: string): SkillDefinition[] {
  return ENEMY_SKILLS.filter((s) => s.ownerArchetype === archetype);
}
