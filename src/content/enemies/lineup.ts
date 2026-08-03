/**
 * Phase 1 默认敌人队伍(对照开发文档 §9.5)
 *
 * 阵型:
 *   rank 1 (front): 骸骨盾卫 Skeleton Defender
 *   rank 2:         骸骨士兵 Skeleton Soldier
 *   rank 3:         邪教侍僧 Cultist Acolyte
 *   rank 4 (back):  骸骨弩手 Skeleton Crossbowman
 *
 * 设计目的:验证高防前排 / 后排压力 / 后排输出 / 推拉 / 尸体阻挡 / 队伍打乱
 */

import { buildActor } from '../builders.js';
import type { BattleActor, EquippedSkill } from '../../game-engine/types.js';

export const ENEMY_LINEUP: { actor: BattleActor; skills: EquippedSkill[] }[] = [
  {
    actor: buildActor({
      id: 'enemy.skeleton_defender',
      name: '骸骨盾卫',
      archetype: 'skeleton_defender',
      side: 'enemy',
      rank: 1,
      maxHp: 30,
      dodge: 5,
      protection: 50, // 高 PROT
      speed: 2,
      accuracy: 0,
      crit: 2,
      bleedResist: 0.5,
      blightResist: 0.1,
      stunResist: 0.4, // 抗晕
      moveResist: 0.3,
      deathblowResist: 0.67,
    }),
    skills: [
      { skillId: 'skeleton_defender.shield_bash' },
      { skillId: 'skeleton_defender.push' },
      { skillId: 'skeleton_defender.defense_buff' },
    ],
  },
  {
    actor: buildActor({
      id: 'enemy.skeleton_soldier',
      name: '骸骨士兵',
      archetype: 'skeleton_soldier',
      side: 'enemy',
      rank: 2,
      maxHp: 35, // 高 HP
      dodge: 5,
      protection: 20,
      speed: 1, // 低速
      accuracy: 0,
      crit: 2,
      bleedResist: 0.5,
      blightResist: 0.1,
      stunResist: 0.2,
      moveResist: 0.3,
      deathblowResist: 0.67,
    }),
    skills: [
      { skillId: 'skeleton_soldier.slash' },
      { skillId: 'skeleton_soldier.defensive_stance' },
    ],
  },
  {
    actor: buildActor({
      id: 'enemy.cultist_acolyte',
      name: '邪教侍僧',
      archetype: 'cultist_acolyte',
      side: 'enemy',
      rank: 3,
      maxHp: 18,
      dodge: 5,
      protection: 0,
      speed: 4,
      accuracy: -5, // 命中率下降
      crit: 1,
      bleedResist: 0.2,
      blightResist: 0.3,
      stunResist: 0.4,
      moveResist: 0.3,
      deathblowResist: 0.67,
    }),
    skills: [
      { skillId: 'cultist_acolyte.hex' },
      { skillId: 'cultist_acolyte.retreat' },
    ],
  },
  {
    actor: buildActor({
      id: 'enemy.crossbowman',
      name: '骸骨弩手',
      archetype: 'crossbowman',
      side: 'enemy',
      rank: 4,
      maxHp: 22,
      dodge: 8,
      protection: 0,
      speed: 5,
      accuracy: 5,
      crit: 4,
      bleedResist: 0.4,
      blightResist: 0.2,
      stunResist: 0.3,
      moveResist: 0.3,
      deathblowResist: 0.67,
    }),
    skills: [
      { skillId: 'crossbowman.bolt' },
      { skillId: 'crossbowman.snipe' },
      { skillId: 'crossbowman.melee' },
    ],
  },
];
