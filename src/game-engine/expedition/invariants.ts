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
 * - Phase 2:压力 0-200 / 死亡之门 ↔ HP=0 / 折磨 XOR 美德 / 派生事件深度
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
  if (state.version !== 5) {
    throw new InvariantViolation(`game state version ${state.version} != 5`);
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
    'hamlet-overview',
    'hamlet-roster',
    'hamlet-treatment',
    'hamlet-recruit',
    'hamlet-upgrades',
    'hamlet-graveyard',
    'hamlet-quest',
    'hamlet-party',
    'hamlet-provision',
    'hamlet-summary',
    'hamlet-debrief',
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
    // Phase 2 精神不变量
    if (hero.stress < 0 || hero.stress > 200) {
      throw new InvariantViolation(`hero ${hero.id} stress out of range: ${hero.stress}`);
    }
    if (hero.atDeathsDoor && hero.hp > 0) {
      throw new InvariantViolation(`hero ${hero.id} atDeathsDoor but hp ${hero.hp} > 0`);
    }
    if (hero.hp === 0 && !hero.isDead && !hero.atDeathsDoor) {
      throw new InvariantViolation(`hero ${hero.id} hp=0 but neither isDead nor atDeathsDoor`);
    }
    if (hero.afflictionId && hero.virtueId) {
      throw new InvariantViolation(`hero ${hero.id} has both affliction and virtue`);
    }
    if (hero.afflictionId && hero.resolveState !== 'afflicted') {
      throw new InvariantViolation(`hero ${hero.id} has affliction but resolveState=${hero.resolveState}`);
    }
    if (hero.virtueId && hero.resolveState !== 'virtuous') {
      throw new InvariantViolation(`hero ${hero.id} has virtue but resolveState=${hero.resolveState}`);
    }
  }
  // 派生事件深度(SPEC §11.3)
  if (state.derivedEventDepth < 0 || state.derivedEventDepth > 200) {
    throw new InvariantViolation(`derivedEventDepth out of range: ${state.derivedEventDepth}`);
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
