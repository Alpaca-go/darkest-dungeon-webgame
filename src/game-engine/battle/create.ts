/**
 * 战斗创建
 *
 * 给定英雄实例和敌人实例,初始化 BattleState。
 */

import { Mulberry32 } from '../rng/mulberry32.js';
import type { BattleActor, BattleState, EquippedSkill, Side, Rank } from '../types.js';
import { nextTransactionId } from '../transaction.js';

export interface CreateBattleInput {
  battleId: string;
  /** 4 个英雄实例(已装备技能) */
  heroes: BattleActor[];
  /** 4 个敌人实例(已装备技能) */
  enemies: BattleActor[];
  /** 技能槽(actorId -> 4 个技能) */
  loadouts: Record<string, EquippedSkill[]>;
  /** 技能注册表(本战斗涉及的技能定义) */
  skillRegistry: Record<string, import('../types.js').SkillDefinition>;
  /** RNG 种子 */
  seed: string | number;
}

export function createBattle(input: CreateBattleInput): BattleState {
  // 站位验证
  validateParty(input.heroes, 'ally');
  validateParty(input.enemies, 'enemy');

  // 每个 actor 都需要至少 1 个技能;英雄必须 4 个
  for (const a of [...input.heroes, ...input.enemies]) {
    const loadout = input.loadouts[a.id];
    if (!loadout) {
      throw new Error(`createBattle: actor ${a.id} has no loadout`);
    }
    if (loadout.length < 1) {
      throw new Error(`createBattle: actor ${a.id} loadout is empty`);
    }
    if (a.side === 'ally' && loadout.length !== 4) {
      throw new Error(
        `createBattle: ally ${a.id} loadout has ${loadout.length} skills, expected 4`,
      );
    }
    if (a.side === 'enemy' && loadout.length > 4) {
      throw new Error(
        `createBattle: enemy ${a.id} loadout has ${loadout.length} skills, max 4`,
      );
    }
  }

  const rng = new Mulberry32(input.seed);
  const state: BattleState = {
    id: input.battleId,
    round: 0,
    phase: 'setup',
    heroes: input.heroes.slice(),
    enemies: input.enemies.slice(),
    corpses: [],
    initiativeQueue: [],
    activeActorId: null,
    loadouts: deepCopyLoadouts(input.loadouts),
    skillRegistry: { ...input.skillRegistry },
    transactionId: nextTransactionId(),
    sequence: 0,
    rng: rng.state,
    log: [],
  };
  return state;
}

function deepCopyLoadouts(loadouts: Record<string, EquippedSkill[]>): Record<string, EquippedSkill[]> {
  const out: Record<string, EquippedSkill[]> = {};
  for (const [k, v] of Object.entries(loadouts)) {
    out[k] = v.map((s) => ({ skillId: s.skillId }));
  }
  return out;
}

function validateParty(party: BattleActor[], side: Side): void {
  if (party.length < 1 || party.length > 4) {
    throw new Error(`createBattle: ${side} must have 1-4 actors, got ${party.length}`);
  }
  const ranks = new Set<Rank>();
  for (const a of party) {
    if (a.side !== side) {
      throw new Error(`createBattle: actor ${a.id} has side ${a.side} in ${side} party`);
    }
    if (ranks.has(a.rank)) {
      throw new Error(`createBattle: ${side} party has duplicate rank ${a.rank}`);
    }
    ranks.add(a.rank);
  }
}
