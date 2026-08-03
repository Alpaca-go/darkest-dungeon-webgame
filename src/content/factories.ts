/**
 * 内容工厂
 *
 * 把英雄和敌人组队 + 技能槽组合成 BattleActor / Loadout
 */

import { PARTY_LINEUP } from './heroes/lineup.js';
import { ENEMY_LINEUP } from './enemies/lineup.js';
import { buildSkillRegistry } from './skills/index.js';
import { createBattle } from '../game-engine/battle/create.js';
import type { BattleActor, BattleState, EquippedSkill } from '../game-engine/types.js';
import { resetIdCounter } from './builders.js';

export interface CreateTestBattleInput {
  battleId?: string;
  seed: string | number;
  /** 是否覆盖默认阵型(测试用) */
  partyOverride?: { actor: BattleActor; skills: EquippedSkill[] }[];
  enemyOverride?: { actor: BattleActor; skills: EquippedSkill[] }[];
}

export function createTestBattle(input: CreateTestBattleInput): BattleState {
  resetIdCounter();
  const party = input.partyOverride ?? PARTY_LINEUP;
  const enemies = input.enemyOverride ?? ENEMY_LINEUP;
  const heroes = party.map((p) => ({ ...p.actor, hp: p.actor.maxHp, bleed: [], blight: [], cooldowns: {}, isDead: false }));
  const enemyActors = enemies.map((p) => ({ ...p.actor, hp: p.actor.maxHp, bleed: [], blight: [], cooldowns: {}, isDead: false }));
  const loadouts: Record<string, EquippedSkill[]> = {};
  for (const p of party) {
    loadouts[p.actor.id] = p.skills.map((s) => ({ skillId: s.skillId }));
  }
  for (const e of enemies) {
    loadouts[e.actor.id] = e.skills.map((s) => ({ skillId: s.skillId }));
  }
  return createBattle({
    battleId: input.battleId ?? `battle_${Date.now()}`,
    heroes,
    enemies: enemyActors,
    loadouts,
    skillRegistry: buildSkillRegistry(),
    seed: input.seed,
  });
}

/** Golden Battle 固定 Seed(开发文档 §25) */
export const GOLDEN_SEED = 'DD-WEB-PHASE1-GOLDEN-001';
