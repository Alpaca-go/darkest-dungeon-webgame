/**
 * 不变量(Invariants)
 *
 * 任何 commit 之后,新状态都必须通过 assertInvariants。
 * 这些规则覆盖:
 * - HP 边界
 * - 站位唯一性(每个阵营每个 rank 至多一个非尸体单位)
 * - 死亡状态一致性
 * - 行动队列完整性
 * - 尸体属性
 *
 * 不变量失败应直接抛错,绝不能让非法状态静默通过。
 */

import type { BattleActor, BattleState, Rank, Side } from './types.js';

export class InvariantViolation extends Error {
  constructor(message: string) {
    super(`[invariant] ${message}`);
    this.name = 'InvariantViolation';
  }
}

function getAliveBySide(actors: BattleActor[]): BattleActor[] {
  return actors.filter((a) => !a.isDead && a.kind !== 'corpse');
}

function checkRankUniqueness(actors: BattleActor[], side: Side, where: string): void {
  const alive = getAliveBySide(actors).filter((a) => a.side === side);
  const seen = new Set<Rank>();
  for (const a of alive) {
    if (seen.has(a.rank)) {
      throw new InvariantViolation(`${where}: duplicate rank ${a.rank} on side ${side}`);
    }
    seen.add(a.rank);
  }
}

export function assertInvariants(state: BattleState): void {
  // 1. 站位必须是 1-4
  for (const a of allActors(state)) {
    if (a.rank < 1 || a.rank > 4) {
      throw new InvariantViolation(`actor ${a.id} has invalid rank ${a.rank}`);
    }
  }

  // 2. HP 边界
  for (const a of allActors(state)) {
    if (a.kind === 'corpse') {
      // 尸体:HP 0,死亡
      if (a.hp !== 0) {
        throw new InvariantViolation(`corpse ${a.id} should have hp=0, has ${a.hp}`);
      }
    } else {
      if (a.hp < 0) {
        throw new InvariantViolation(`actor ${a.id} has negative hp ${a.hp}`);
      }
      if (a.hp > a.maxHp) {
        throw new InvariantViolation(`actor ${a.id} has hp ${a.hp} > maxHp ${a.maxHp}`);
      }
      if (a.isDead && a.hp > 0) {
        throw new InvariantViolation(`dead actor ${a.id} still has hp ${a.hp}`);
      }
    }
  }

  // 3. 站位唯一性
  checkRankUniqueness(state.heroes, 'ally', 'heroes');
  checkRankUniqueness(state.enemies, 'enemy', 'enemies');

  // 4. 死亡状态一致性
  for (const a of state.heroes) {
    if (a.hp === 0 && !a.isDead && a.kind !== 'corpse') {
      // Phase 0 暂时没有死亡之门(HP 0 = 死亡)
      throw new InvariantViolation(`ally ${a.id} has hp=0 but isDead=false (Phase 0)`);
    }
  }
  for (const a of state.enemies) {
    if (a.hp === 0 && !a.isDead && a.kind !== 'corpse') {
      throw new InvariantViolation(`enemy ${a.id} has hp=0 but isDead=false (Phase 0)`);
    }
  }
  // 尸体在 enemies 列表里,但其 kind = 'corpse',isDead = true
  for (const c of state.corpses) {
    if (c.kind !== 'corpse') {
      throw new InvariantViolation(`corpse ${c.id} should have kind=corpse`);
    }
    if (!c.isDead) {
      throw new InvariantViolation(`corpse ${c.id} should be isDead=true`);
    }
  }

  // 5. 行动队列完整性
  const queueSet = new Set(state.initiativeQueue);
  if (queueSet.size !== state.initiativeQueue.length) {
    throw new InvariantViolation('initiative queue has duplicates');
  }
  for (const id of state.initiativeQueue) {
    if (!findActor(state, id)) {
      throw new InvariantViolation(`initiative queue references unknown actor ${id}`);
    }
  }

  // 6. 当前行动者必须是一个存在且存活的角色
  // (注意:active actor 在被 pop 之前从队列取出,这里不要求仍在队列中)
  if (state.activeActorId !== null) {
    const active = findActor(state, state.activeActorId);
    if (!active) {
      throw new InvariantViolation(`active actor ${state.activeActorId} not found`);
    }
    if (active.isDead) {
      throw new InvariantViolation(`active actor ${state.activeActorId} is dead`);
    }
    if (active.kind === 'corpse') {
      throw new InvariantViolation(`active actor ${state.activeActorId} is a corpse`);
    }
  }

  // 7. 队列只包含非尸体(尸体不可行动)
  for (const id of state.initiativeQueue) {
    const a = findActor(state, id);
    if (a && (a.isDead || a.kind === 'corpse')) {
      throw new InvariantViolation(`dead actor ${id} in initiative queue`);
    }
  }

  // 7. 阶段合法性
  const validPhases = new Set([
    'setup',
    'round-start',
    'actor-turn',
    'resolution',
    'round-end',
    'victory',
    'defeat',
  ]);
  if (!validPhases.has(state.phase)) {
    throw new InvariantViolation(`invalid phase ${state.phase}`);
  }
  if (state.round < 1 && state.phase !== 'setup') {
    throw new InvariantViolation(`round ${state.round} < 1 outside setup`);
  }
}

export function findActor(state: BattleState, id: string): BattleActor | undefined {
  return (
    state.heroes.find((a) => a.id === id) ??
    state.enemies.find((a) => a.id === id) ??
    state.corpses.find((a) => a.id === id)
  );
}

export function allActors(state: BattleState): BattleActor[] {
  return [...state.heroes, ...state.enemies, ...state.corpses];
}

export function liveAllies(state: BattleState): BattleActor[] {
  return state.heroes.filter((a) => !a.isDead && a.kind !== 'corpse');
}

export function liveEnemies(state: BattleState): BattleActor[] {
  return state.enemies.filter((a) => !a.isDead && a.kind !== 'corpse');
}

export function liveActors(state: BattleState): BattleActor[] {
  return [...liveAllies(state), ...liveEnemies(state)];
}
