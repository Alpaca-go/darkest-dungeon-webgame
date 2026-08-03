/**
 * Encounter skill 助手
 *
 * 给定 actorId,返回其技能 id 列表。
 * - heroes 走 PARTY_LINEUP 数组
 * - enemies 走 ENEMY_LINEUP 数组
 */

import { PARTY_LINEUP } from '../../content/heroes/lineup.js';
import { ENEMY_LINEUP } from '../../content/enemies/lineup.js';

export function encounter_hero_skill_ids(_enc: unknown, heroId: string): string[] | null {
  const party = PARTY_LINEUP.find((p) => p.actor.id === heroId);
  if (!party) return null;
  return party.skills.map((s) => s.skillId);
}

export function encounter_enemy_skill_ids(_enc: unknown, enemyId: string): string[] | null {
  const enemy = ENEMY_LINEUP.find((e) => e.actor.id === enemyId);
  if (!enemy) return null;
  return enemy.skills.map((s) => s.skillId);
}
