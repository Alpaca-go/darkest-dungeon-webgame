/**
 * 默认四人英雄队伍(Phase 1 规格)
 *
 * 阵型(对照开发文档 §8):
 *   rank 4 (back): 瘟疫医生 Plague Doctor
 *   rank 3:        修女 Vestal
 *   rank 2:        强盗 Highwayman
 *   rank 1 (front): 十字军 Crusader
 *
 * 每个英雄装备 4 个技能(从技能库中选)
 * 基础属性对照开发文档 §8.1-8.4
 */

import { buildActor } from '../builders.js';
import type { BattleActor, EquippedSkill } from '../../game-engine/types.js';
import {
  CRUSADER_DEFAULT_LOADOUT,
  HIGHWAYMAN_DEFAULT_LOADOUT,
  VESTAL_DEFAULT_LOADOUT,
  PLAGUE_DOCTOR_DEFAULT_LOADOUT,
} from '../skills/index.js';

export const PARTY_LINEUP: { actor: BattleActor; skills: EquippedSkill[] }[] = [
  {
    actor: buildActor({
      id: 'hero.crusader',
      name: 'Reynauld',
      archetype: 'crusader',
      rank: 1,
      maxHp: 33,
      dodge: 5,
      protection: 0,
      speed: 2,
      accuracy: 0,
      crit: 3,
      bleedResist: 0.3,
      blightResist: 0.3,
      stunResist: 0.2,
      moveResist: 0.3,
      deathblowResist: 0.67,
    }),
    skills: CRUSADER_DEFAULT_LOADOUT.map((skillId) => ({ skillId })),
  },
  {
    actor: buildActor({
      id: 'hero.highwayman',
      name: 'Dismas',
      archetype: 'highwayman',
      rank: 2,
      maxHp: 25,
      dodge: 10,
      protection: 0,
      speed: 5,
      accuracy: 0,
      crit: 5,
      bleedResist: 0.2,
      blightResist: 0.2,
      stunResist: 0.3,
      moveResist: 0.4,
      deathblowResist: 0.67,
    }),
    skills: HIGHWAYMAN_DEFAULT_LOADOUT.map((skillId) => ({ skillId })),
  },
  {
    actor: buildActor({
      id: 'hero.vestal',
      name: 'Junia',
      archetype: 'vestal',
      rank: 3,
      maxHp: 24,
      dodge: 0,
      protection: 0,
      speed: 4,
      accuracy: 0,
      crit: 2,
      bleedResist: 0.25,
      blightResist: 0.25,
      stunResist: 0.3,
      moveResist: 0.3,
      deathblowResist: 0.67,
    }),
    skills: VESTAL_DEFAULT_LOADOUT.map((skillId) => ({ skillId })),
  },
  {
    actor: buildActor({
      id: 'hero.plague_doctor',
      name: 'Paracelsus',
      archetype: 'plague_doctor',
      rank: 4,
      maxHp: 22,
      dodge: 10,
      protection: 0,
      speed: 7,
      accuracy: 0,
      crit: 3,
      bleedResist: 0.4,
      blightResist: 0.4,
      stunResist: 0.3,
      moveResist: 0.3,
      deathblowResist: 0.67,
    }),
    skills: PLAGUE_DOCTOR_DEFAULT_LOADOUT.map((skillId) => ({ skillId })),
  },
];
