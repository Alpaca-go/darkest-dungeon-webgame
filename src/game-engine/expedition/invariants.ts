/**
 * 远征层不变量(SPEC §29)
 *
 * 任何 commit 之后,新 GameState 都必须通过 assertGameInvariants。
 * 涵盖:
 * - 版本号
 * - 视图模式合法性
 * - 火把 0-100
 * - 时间 ≥ 0
 * - 英雄 HP 0-maxHp
 * - 背包不超 capacity
 * - 当前节点存在
 * - 遭遇内的 actor 计数与 heroActorIds 一致
 * - pendingDecision 必与 mode 匹配
 */

import type { GameState } from './types.js';
import { torchLevel } from './types.js';

export class InvariantViolation extends Error {
  constructor(message: string) {
    super(`[invariant] ${message}`);
    this.name = 'InvariantViolation';
  }
}

export function assertGameInvariants(state: GameState): void {
  if (state.version !== 2) {
    throw new InvariantViolation(`game state version ${state.version} != 2`);
  }

  const validModes = new Set([
    'expedition-start',
    'node-introduction',
    'route-choice',
    'event-choice',
    'encounter-choice',
    'resolution',
    'inventory-decision',
    'expedition-success',
    'expedition-retreat',
    'expedition-failure',
    'game-error',
  ]);
  if (!validModes.has(state.mode)) {
    throw new InvariantViolation(`invalid mode ${state.mode}`);
  }

  // torch
  if (state.expedition.torch < 0 || state.expedition.torch > 100) {
    throw new InvariantViolation(`torch out of range: ${state.expedition.torch}`);
  }
  if (state.torch.value !== state.expedition.torch) {
    throw new InvariantViolation(`torch state mismatch: ${state.torch.value} vs ${state.expedition.torch}`);
  }
  if (state.torch.level !== torchLevel(state.expedition.torch)) {
    throw new InvariantViolation(`torch level mismatch`);
  }

  // time
  if (state.expedition.timeElapsed < 0) {
    throw new InvariantViolation(`negative time: ${state.expedition.timeElapsed}`);
  }

  // 英雄 HP
  for (const hero of Object.values(state.party)) {
    if (hero.hp < 0 || hero.hp > hero.maxHp) {
      throw new InvariantViolation(`hero ${hero.id} hp out of range: ${hero.hp}`);
    }
    if (hero.isDead && hero.hp > 0) {
      throw new InvariantViolation(`dead hero ${hero.id} has hp > 0`);
    }
    if (hero.rank < 1 || hero.rank > 4) {
      throw new InvariantViolation(`hero ${hero.id} rank out of range: ${hero.rank}`);
    }
  }

  // 背包
  if (state.inventory.stacks.length > state.inventory.capacity) {
    throw new InvariantViolation(`inventory over capacity: ${state.inventory.stacks.length} > ${state.inventory.capacity}`);
  }
  for (const stack of state.inventory.stacks) {
    if (stack.count <= 0) {
      throw new InvariantViolation(`stack ${stack.id} has count ${stack.count}`);
    }
  }

  // 当前节点
  if (!state.expedition.route.nodes[state.expedition.currentNodeId]) {
    throw new InvariantViolation(`unknown current node ${state.expedition.currentNodeId}`);
  }

  // 遭遇一致性
  if (state.encounter) {
    for (const id of state.encounter.heroActorIds) {
      if (!state.encounter.actors[id]) {
        throw new InvariantViolation(`encounter missing hero actor ${id}`);
      }
    }
    for (const id of state.encounter.enemyActorIds) {
      if (!state.encounter.actors[id]) {
        throw new InvariantViolation(`encounter missing enemy actor ${id}`);
      }
    }
  }

  // pendingDecision 与 mode
  const requiresDecision = new Set(['route-choice', 'event-choice', 'encounter-choice', 'inventory-decision']);
  if (requiresDecision.has(state.mode) && !state.pendingDecision) {
    throw new InvariantViolation(`mode ${state.mode} requires pendingDecision`);
  }
}
