export * from './crusader.js';
export * from './highwayman.js';
export * from './vestal.js';
export * from './plague-doctor.js';
export * from './enemies.js';

import { CRUSADER_SKILLS } from './crusader.js';
import { HIGHWAYMAN_SKILLS } from './highwayman.js';
import { VESTAL_SKILLS } from './vestal.js';
import { PLAGUE_DOCTOR_SKILLS } from './plague-doctor.js';
import { ENEMY_SKILLS } from './enemies.js';
import type { SkillDefinition } from '../../game-engine/types.js';

export const ALL_SKILLS: SkillDefinition[] = [
  ...CRUSADER_SKILLS,
  ...HIGHWAYMAN_SKILLS,
  ...VESTAL_SKILLS,
  ...PLAGUE_DOCTOR_SKILLS,
  ...ENEMY_SKILLS,
];

export function getSkillsByArchetype(archetype: string): SkillDefinition[] {
  return ALL_SKILLS.filter((s) => s.ownerArchetype === archetype);
}

export function buildSkillRegistry(
  additional?: Record<string, SkillDefinition>,
): Record<string, SkillDefinition> {
  const reg: Record<string, SkillDefinition> = {};
  for (const s of ALL_SKILLS) {
    reg[s.id] = s;
  }
  if (additional) {
    Object.assign(reg, additional);
  }
  return reg;
}
