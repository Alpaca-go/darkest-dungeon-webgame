/**
 * 内容数据构建工具
 *
 * 帮助快速创建 BattleActor / SkillDefinition,保持类型安全。
 */

import type { BattleActor, SkillDefinition } from '../game-engine/types.js';
import type { Rank, Side } from '../game-engine/types.js';

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter.toString(36)}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export interface BuildHeroInput {
  id?: string;
  name: string;
  archetype: string;
  side?: Side;
  rank: Rank;
  maxHp: number;
  dodge: number;
  protection: number;
  speed: number;
  accuracy: number;
  crit: number;
  bleedResist: number;
  blightResist: number;
  stunResist: number;
  moveResist: number;
  deathblowResist: number;
}

export function buildActor(input: BuildHeroInput): BattleActor {
  return {
    id: input.id ?? nextId(input.side ?? 'ally'),
    kind: 'hero',
    side: input.side ?? 'ally',
    rank: input.rank,
    name: input.name,
    archetype: input.archetype,
    hp: input.maxHp,
    maxHp: input.maxHp,
    dodge: input.dodge,
    protection: input.protection,
    speed: input.speed,
    accuracy: input.accuracy,
    crit: input.crit,
    bleedResist: input.bleedResist,
    blightResist: input.blightResist,
    stunResist: input.stunResist,
    moveResist: input.moveResist,
    deathblowResist: input.deathblowResist,
    bleed: [],
    blight: [],
    stun: null,
    mark: null,
    protBuff: null,
    cooldowns: {},
    isDead: false,
  };
}

export interface BuildSkillInput {
  id?: string;
  name: string;
  ownerArchetype?: string;
  usableFromRanks: Rank[];
  targetRanks: Rank[];
  targetSide: Side | 'self';
  targetMode: 'single' | 'all' | 'adjacent' | 'self';
  accuracy: number;
  damageModifier: number;
  critModifier: number;
  baseDamage: { min: number; max: number };
  moveSelf?: number;
  moveTarget?: number;
  effects: SkillDefinition['effects'];
  cooldown?: number;
}

export function buildSkill(input: BuildSkillInput): SkillDefinition {
  const skill: SkillDefinition = {
    id: input.id ?? nextId('skill'),
    name: input.name,
    ownerArchetype: input.ownerArchetype,
    usableFromRanks: input.usableFromRanks,
    targetRanks: input.targetRanks,
    targetSide: input.targetSide,
    targetMode: input.targetMode,
    accuracy: input.accuracy,
    damageModifier: input.damageModifier,
    critModifier: input.critModifier,
    baseDamage: input.baseDamage,
    effects: input.effects,
    cooldown: input.cooldown ?? 0,
  };
  if (input.moveSelf !== undefined) skill.moveSelf = input.moveSelf;
  if (input.moveTarget !== undefined) skill.moveTarget = input.moveTarget;
  return skill;
}
