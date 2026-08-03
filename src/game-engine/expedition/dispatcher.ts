/**
 * 远征命令分发器(SPEC §28)
 *
 * 统一入口:dispatchGameCommand(state, command) -> new state
 *
 * 流程:
 *   1. 去重(同 commandId 拒绝)
 *   2. validate (mode 检查)
 *   3. applyCommand(ctx, command)
 *   4. ctx.commit()
 *   5. (encounter 仍在进行时)重新生成下一轮决策
 *   6. assertInvariants
 *   7. 返回新 state
 */

import { ExpeditionContext } from './context.js';
import { resolveChosen } from './choice-resolver.js';
import { generateDecision } from './choice-generator.js';
import type { GameState, ItemId, ExpeditionState, HeroInstance, InventoryState } from './types.js';
import type { GameCommand, TravelPace } from './commands.js';
import { PARTY_LINEUP } from '../../content/heroes/lineup.js';
import { buildRuinsRoute } from '../../content/route/ruins.js';
import { DEFAULT_EXPEDITION_LOADOUT } from '../../content/items.js';
import { countItem, setItemCount } from './context.js';
import { assertGameInvariants } from './invariants.js';
import { getEncounterDef } from '../../content/encounters.js';
import { startEncounter } from './encounter-resolver.js';
import {
  applyStress,
  runResolveCheck,
  triggerResolveCheck,
  triggerHeartAttack,
  enterDeathsDoor,
  checkDeathblow,
  triggerPermanentDeath,
  grantAffliction,
  grantVirtue,
  dismissOverlay,
  AFFLICTIONS,
  VIRTUES,
} from '../mental/index.js';
import { checkAfflictionBehaviors, checkVirtueBehaviors } from '../mental/behaviors.js';
import type { AfflictionTrigger } from './types.js';
import {
  INITIAL_GOLD,
  INITIAL_PORTRAITS,
  INITIAL_CRESTS,
  INITIAL_ROSTER_CAPACITY,
  INITIAL_FACILITY_STATES,
  type CampaignState,
  type HamletState,
} from '../campaign/types.js';

export class CommandError extends Error {
  constructor(message: string) {
    super(`[command] ${message}`);
    this.name = 'CommandError';
  }
}

export class DuplicateCommandError extends CommandError {
  constructor(commandId: string) {
    super(`duplicate commandId: ${commandId}`);
    this.name = 'DuplicateCommandError';
  }
}

const processedCommandIds = new Set<string>();

export function clearProcessedCommands(): void {
  processedCommandIds.clear();
}

export function dispatchGameCommand(state: GameState, command: GameCommand): GameState {
  if (processedCommandIds.has(command.commandId)) {
    throw new DuplicateCommandError(command.commandId);
  }

  const ctx = new ExpeditionContext(state);
  applyCommand(ctx, command);
  // Phase 2 retro:提交后重置 derivedEventDepth,避免跨事务累加导致误入 game-error
  ctx.state.derivedEventDepth = 0;
  ctx.commit();

  // 触发下一轮决策
  regenerateNextDecision(ctx);

  assertGameInvariants(ctx.state);
  processedCommandIds.add(command.commandId);
  return ctx.state;
}

function applyCommand(ctx: ExpeditionContext, command: GameCommand): void {
  switch (command.type) {
    case 'START_EXPEDITION':
      return cmdStartExpedition(ctx, command.loadoutId, command.commandId);
    case 'SELECT_ROUTE':
      return resolveChosen(ctx, command.decisionId, command.choiceId);
    case 'SELECT_TRAVEL_PACE':
      return cmdSelectTravelPace(ctx, command.decisionId, command.pace, command.commandId);
    case 'CHOOSE_EVENT_OPTION':
      return resolveChosen(ctx, command.decisionId, command.choiceId);
    case 'CHOOSE_TACTICAL_OPTION':
      return resolveChosen(ctx, command.decisionId, command.choiceId);
    case 'DISCARD_INVENTORY_ITEM':
      return cmdDiscardInventoryItem(ctx, command.stackId, command.count, command.commandId);
    case 'USE_INVENTORY_ITEM':
      return cmdUseInventoryItem(ctx, command.decisionId, command.stackId, command.targetHeroId, command.commandId);
    case 'REQUEST_RETREAT':
      return cmdRequestRetreat(ctx, command.commandId);
    case 'CONFIRM_RETREAT':
      return cmdConfirmRetreat(ctx, command.commandId);
    case 'CONTINUE_AFTER_RESULT':
      return cmdContinueAfterResult(ctx, command.commandId);
    case 'DEBUG_SET_TORCH':
      return cmdDebugSetTorch(ctx, command.value, command.commandId);
    case 'DEBUG_SET_FOOD':
      return cmdDebugSetFood(ctx, command.value, command.commandId);
    case 'DEBUG_SET_HP':
      return cmdDebugSetHp(ctx, command.heroId, command.value, command.commandId);
    case 'DEBUG_GRANT_ITEM':
      return cmdDebugGrantItem(ctx, command.itemId, command.count, command.commandId);
    case 'DEBUG_MOVE_HERO':
      return cmdDebugMoveHero(ctx, command.heroId, command.rank, command.commandId);
    case 'DEBUG_TRIGGER_HUNGER':
      return cmdDebugTriggerHunger(ctx, command.commandId);
    case 'DEBUG_TRIGGER_TRAP':
      return cmdDebugTriggerTrap(ctx, command.commandId);
    case 'DEBUG_FORCE_ENCOUNTER':
      return cmdDebugForceEncounter(ctx, command.encounterDefId, command.commandId);
    case 'DEBUG_TELEPORT_NODE':
      return cmdDebugTeleportNode(ctx, command.nodeId, command.commandId);
    // Phase 2 精神系统
    case 'APPLY_STRESS':
      return cmdApplyStress(ctx, command.heroId, command.amount, command.source, command.commandId);
    case 'RESOLVE_CHECK':
      return cmdResolveCheck(ctx, command.heroId, command.commandId);
    case 'RESOLVE_AFFLICTION_BEHAVIOR':
      return cmdResolveAfflictionBehavior(ctx, command.heroId, command.trigger, command.commandId);
    case 'RESOLVE_VIRTUE_BEHAVIOR':
      return cmdResolveVirtueBehavior(ctx, command.heroId, command.trigger, command.commandId);
    case 'CHOOSE_DEATHS_DOOR_RESPONSE':
      return resolveChosen(ctx, command.decisionId, command.choiceId);
    case 'RESOLVE_DEATHBLOW':
      return cmdResolveDeathblow(ctx, command.heroId, command.sourceId, command.commandId);
    case 'CONFIRM_HERO_DEATH_RESULT':
      return cmdConfirmHeroDeath(ctx, command.deathRecordId, command.commandId);
    case 'DISMISS_OVERLAY':
      return cmdDismissOverlay(ctx, command.commandId);
    // Phase 2 调试
    case 'DEBUG_SET_STRESS':
      return cmdDebugSetStress(ctx, command.heroId, command.value, command.commandId);
    case 'DEBUG_SET_DEATHS_DOOR':
      return cmdDebugSetDeathsDoor(ctx, command.heroId, command.value, command.commandId);
    case 'DEBUG_FORCE_AFFLICTION':
      return cmdDebugForceAffliction(ctx, command.heroId, command.afflictionId, command.commandId);
    case 'DEBUG_FORCE_VIRTUE':
      return cmdDebugForceVirtue(ctx, command.heroId, command.virtueId, command.commandId);
    case 'DEBUG_FORCE_HEART_ATTACK':
      return cmdDebugForceHeartAttack(ctx, command.heroId, command.commandId);
    case 'DEBUG_FORCE_DEATHBLOW_SUCCESS':
      return cmdDebugForceDeathblowSuccess(ctx, command.heroId, command.commandId);
    case 'DEBUG_FORCE_DEATHBLOW_FAIL':
      return cmdDebugForceDeathblowFail(ctx, command.heroId, command.commandId);
    case 'DEBUG_REVIVE_HERO':
      return cmdDebugReviveHero(ctx, command.heroId, command.commandId);
  }
}

// =============== Commands ===============

function cmdStartExpedition(ctx: ExpeditionContext, _loadoutId: string, _commandId: string): void {
  void _commandId;
  // 创建 party
  const party: Record<string, HeroInstance> = {};
  for (const p of PARTY_LINEUP) {
    const baseActor = p.actor;
    party[baseActor.id] = {
      id: baseActor.id,
      name: baseActor.name,
      archetype: baseActor.archetype as any,
      tags: tagsForArchetype(baseActor.archetype),
      rank: baseActor.rank as any,
      hp: baseActor.maxHp,
      maxHp: baseActor.maxHp,
      protection: baseActor.protection,
      dodge: baseActor.dodge,
      speed: baseActor.speed,
      accuracy: baseActor.accuracy,
      crit: baseActor.crit,
      bleedResist: baseActor.bleedResist,
      blightResist: baseActor.blightResist,
      stunResist: baseActor.stunResist,
      moveResist: baseActor.moveResist,
      bleed: [],
      blight: [],
      stun: null,
      mark: null,
      protBuff: null,
      cooldowns: {},
      isDead: false,
      conditions: [],
      skills: p.skills.map((s) => s.skillId),
      // Phase 2 精神字段
      stress: 0,
      resolveState: 'stable',
      afflictionId: null,
      virtueId: null,
      atDeathsDoor: false,
      deathsDoorRecoveryStacks: 0,
      deathblowPenalty: 0,
      heartAttackCount: 0,
      behaviorCooldowns: {},
      // Phase 3 长期经营字段(SPEC §6.1)
      resolveLevel: 0,
      xp: 0,
      weaponLevel: 0,
      armorLevel: 0,
      skillLevels: Object.fromEntries(p.skills.map((s) => [s.skillId, 0])),
      positiveQuirkIds: [],
      negativeQuirkIds: [],
      diseaseIds: [],
      activityState: 'available',
      assignedFacilityId: null,
      activityWeeksRemaining: 0,
      expeditionCount: 0,
      successfulExpeditionCount: 0,
      retreatCount: 0,
      deathsDoorCount: 0,
      resistedDeathblowCount: 0,
    };
  }

  // 创建背包
  const inv: InventoryState = { capacity: 16, stacks: [] };
  for (const itemId of DEFAULT_EXPEDITION_LOADOUT) {
    const cur = countItem(inv, itemId);
    setItemCount(inv, itemId, cur + 1);
  }

  const route = buildRuinsRoute(ctx.state.seed);
  const expState: ExpeditionState = {
    id: `exp_${Date.now().toString(36)}`,
    routeId: route.id,
    seed: ctx.state.seed,
    startedAt: new Date().toISOString(),
    currentNodeId: route.startNodeId,
    visitedNodeIds: [route.startNodeId],
    depth: 0,
    timeElapsed: 0,
    torch: 100,
    keyChoices: [],
    keyEvents: [],
    firedEventIds: [],
    eventCooldowns: {},
    scoutLevel: 'fully-scouted',
    route,
    flags: {},
    stats: {
      deepestNodeReached: 0,
      nodesVisited: 0,
      encounterCount: 0,
      trapCount: 0,
      hungerCount: 0,
      torchUsed: 0,
      foodUsed: 0,
      lowestTorch: 100,
      lootGained: [],
      itemsDiscarded: [],
      heroLowestHp: [],
    },
    objectiveCompleted: false,
    failed: false,
  };

  ctx.state.party = party;
  ctx.state.inventory = inv;
  ctx.state.expedition = expState;
  ctx.state.torch = { value: 100, level: 'radiant' };
  ctx.state.mode = 'node-introduction';
  ctx.state.encounter = null;
  ctx.state.pendingDecision = null;
  ctx.state.lastResolution = null;

  // Phase 3:初始化战役 + 庄园(SPEC §29)
  if (!ctx.state.campaign) {
    const campaign: CampaignState = {
      id: `camp_${Date.now().toString(36)}`,
      seed: ctx.state.seed,
      week: 1,
      gold: INITIAL_GOLD,
      heirlooms: { portraits: INITIAL_PORTRAITS, crests: INITIAL_CRESTS },
      rosterCapacity: INITIAL_ROSTER_CAPACITY,
      rosterHeroIds: Object.keys(party),
      deadHeroIds: [],
      completedQuestIds: [],
      availableQuestIds: [],
      availableRecruitIds: [],
      facilityStates: structuredClone(INITIAL_FACILITY_STATES),
      status: 'active',
    };
    const hamlet: HamletState = {
      mode: 'weekly-summary',
      recruitCandidates: [],
      weeklyQuestIds: [],
      selectedQuestId: null,
      selectedPartyHeroIds: [],
      provisionCart: {},
      weeklyNotices: [],
    };
    ctx.state.campaign = campaign;
    ctx.state.hamlet = hamlet;
  }

  ctx.emit('EXPEDITION_STARTED', {
    expeditionId: expState.id,
    routeId: route.id,
    seed: ctx.state.seed,
    startNodeId: route.startNodeId,
  });

  // 移动到第一个节点
  moveToNode(ctx, route.startNodeId);
}

function tagsForArchetype(archetype: string): string[] {
  switch (archetype) {
    case 'crusader':
      return ['frontline', 'durable', 'stun', 'advance', 'anti-unholy', 'healer-trainer'];
    case 'highwayman':
      return ['ranged', 'bleed', 'mobile', 'trapper', 'backline-killer'];
    case 'vestal':
      return ['healer', 'stun', 'holy', 'support', 'curio-religious'];
    case 'plague_doctor':
      return ['blight', 'stun', 'cleanse', 'backline-control', 'medical'];
    default:
      return [];
  }
}

function cmdSelectTravelPace(ctx: ExpeditionContext, _decisionId: string, pace: TravelPace, _commandId: string): void {
  // 当前节点选择行进方式:消耗资源 + 进入下一节点
  const cur = ctx.state.expedition.currentNodeId;
  const node = ctx.state.expedition.route.nodes[cur];
  if (!node) return;
  const nextEdges = ctx.state.expedition.route.edges.filter((e) => e.from === cur);
  if (nextEdges.length === 0) return;
  const edge = nextEdges[0]!; // 简化:取第一个

  let time = edge.timeCost;
  let torch = edge.baseTorchCost;
  switch (pace) {
    case 'careful':
      time += 1;
      torch += 2;
      ctx.state.expedition.flags['careful-pace'] = true;
      break;
    case 'rush':
      torch -= 2;
      ctx.state.expedition.flags['rush-pace'] = true;
      break;
    case 'normal':
    default:
      break;
  }

  ctx.changeTime(time, `pace ${pace}`);
  ctx.changeTorch(-torch, `pace ${pace}`);
  ctx.emit('TRAVEL_STARTED', { edgeId: edge.id, pace, estimatedTime: time, estimatedTorch: -torch });
  ctx.state.expedition.depth += 1;
  ctx.state.expedition.stats.deepestNodeReached = Math.max(ctx.state.expedition.stats.deepestNodeReached, ctx.state.expedition.depth);
  ctx.state.expedition.stats.nodesVisited += 1;
  ctx.state.expedition.stats.torchUsed += torch;
  moveToNode(ctx, edge.to);
}

function cmdDiscardInventoryItem(ctx: ExpeditionContext, _decisionId: string, count: number, _commandId: string): void {
  // _decisionId 没用到(可直接传)
  void _decisionId;
  // 简化:丢一叠
  const stack = ctx.state.inventory.stacks[0];
  if (!stack) return;
  ctx.discardItem(stack.id, count, 'manual');
}

function cmdUseInventoryItem(ctx: ExpeditionContext, _decisionId: string, _stackId: string, _targetHeroId: string | undefined, _commandId: string): void {
  void _decisionId; void _stackId; void _commandId;
  // 简化:消耗最低 HP 英雄身上的一个 bandage
  if (ctx.hasItem('bandage')) {
    ctx.addItem('bandage', -1, 'use');
    const heroes = Object.values(ctx.state.party).filter((h) => !h.isDead);
    const lowest = heroes.reduce((a, b) => (a.hp <= b.hp ? a : b));
    ctx.changeHeroHp(lowest.id, Math.floor((lowest.maxHp * 20) / 100), 'bandage');
  }
}

function cmdRequestRetreat(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  // 简化:立即进入撤退确认
  ctx.emit('RETREAT_REQUESTED', { fromNodeId: ctx.state.expedition.currentNodeId, reason: 'manual' });
  ctx.state.pendingDecision = generateDecision(ctx, 'retreat', 'retreat');
  ctx.state.mode = 'event-choice';
}

function cmdConfirmRetreat(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  ctx.state.expedition.stats.retreatPosition = {
    nodeId: ctx.state.expedition.currentNodeId,
    depth: ctx.state.expedition.depth,
  };
  ctx.state.mode = 'expedition-retreat';
  ctx.state.expedition.failed = false;
  ctx.emit('EXPEDITION_RETREATED', {
    expeditionId: ctx.state.expedition.id,
    fromNodeId: ctx.state.expedition.currentNodeId,
    reason: 'manual',
  });
}

function cmdContinueAfterResult(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  // 简化:清空 lastResolution
  ctx.state.lastResolution = null;
  ctx.state.mode = 'event-choice';
}

// =============== Debug ===============

function cmdDebugSetTorch(ctx: ExpeditionContext, value: number, _commandId: string): void {
  void _commandId;
  ctx.setTorch(value, 'debug');
}

function cmdDebugSetFood(ctx: ExpeditionContext, value: number, _commandId: string): void {
  void _commandId;
  ctx.changeFood(value - countItem(ctx.state.inventory, 'food'), 'debug');
}

function cmdDebugSetHp(ctx: ExpeditionContext, heroId: string, value: number, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) return;
  ctx.changeHeroHp(heroId, value - hero.hp, 'debug');
}

function cmdDebugGrantItem(ctx: ExpeditionContext, itemId: ItemId, count: number, _commandId: string): void {
  void _commandId;
  ctx.addItem(itemId, count, 'debug');
}

function cmdDebugMoveHero(ctx: ExpeditionContext, heroId: string, rank: 1 | 2 | 3 | 4, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) return;
  const from = hero.rank;
  ctx.setHero({ ...hero, rank });
  ctx.emit('HERO_RANK_CHANGED', { heroId, from, to: rank, reason: 'debug' });
}

function cmdDebugTriggerHunger(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  ctx.state.expedition.stats.hungerCount += 1;
  ctx.state.pendingDecision = generateDecision(ctx, 'event', 'hunger_full_meal');
  ctx.state.mode = 'event-choice';
  ctx.emit('HUNGER_TRIGGERED', {
    nodeId: ctx.state.expedition.currentNodeId,
    timeElapsed: ctx.state.expedition.timeElapsed,
    food: countItem(ctx.state.inventory, 'food'),
  });
}

function cmdDebugTriggerTrap(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  ctx.state.expedition.stats.trapCount += 1;
  ctx.state.pendingDecision = generateDecision(ctx, 'event', 'trap_pressure_plate');
  ctx.state.mode = 'event-choice';
  ctx.emit('TRAP_TRIGGERED', { trapId: 'trap_pressure_plate', nodeId: ctx.state.expedition.currentNodeId, effects: [] });
}

function cmdDebugForceEncounter(ctx: ExpeditionContext, encounterDefId: string, _commandId: string): void {
  void _commandId;
  const def = getEncounterDef(encounterDefId);
  if (!def) return;
  const enc = startEncounter(ctx.state, def, ctx.state.seed + ':debug');
  ctx.state.encounter = enc;
  ctx.state.encounter.status = 'awaiting-choice';
  ctx.emit('ENCOUNTER_STARTED', {
    encounterId: enc.id,
    encounterDefId: enc.encounterDefId,
    nodeId: ctx.state.expedition.currentNodeId,
    heroIds: enc.heroActorIds,
    enemyIds: enc.enemyActorIds,
  });
  ctx.state.pendingDecision = generateDecision(ctx, 'encounter', enc.id);
  ctx.state.mode = 'encounter-choice';
}

function cmdDebugTeleportNode(ctx: ExpeditionContext, nodeId: string, _commandId: string): void {
  void _commandId;
  moveToNode(ctx, nodeId);
}

// =============== 状态机推进 ===============

function moveToNode(ctx: ExpeditionContext, nodeId: string): void {
  const node = ctx.state.expedition.route.nodes[nodeId];
  if (!node) {
    // 节点不存在 - 不应发生
    return;
  }
  ctx.state.expedition.currentNodeId = nodeId;
  ctx.state.expedition.scoutLevel = node.baseScoutLevel;
  if (!ctx.state.expedition.visitedNodeIds.includes(nodeId)) {
    ctx.state.expedition.visitedNodeIds.push(nodeId);
  }
  ctx.emit('NODE_ENTERED', { nodeId, nodeType: node.type, depth: ctx.state.expedition.depth });

  switch (node.type) {
    case 'route-fork':
      ctx.state.pendingDecision = generateDecision(ctx, 'route', node.forkId!);
      ctx.state.mode = 'route-choice';
      return;
    case 'encounter': {
      const def = getEncounterDef(node.encounterDefId!);
      if (!def) return;
      const enc = startEncounter(ctx.state, def, ctx.state.seed + ':' + nodeId);
      ctx.state.encounter = enc;
      ctx.state.encounter.status = 'awaiting-choice';
      ctx.emit('ENCOUNTER_STARTED', {
        encounterId: enc.id,
        encounterDefId: enc.encounterDefId,
        nodeId,
        heroIds: enc.heroActorIds,
        enemyIds: enc.enemyActorIds,
      });
      ctx.state.pendingDecision = generateDecision(ctx, 'encounter', enc.id);
      ctx.state.mode = 'encounter-choice';
      return;
    }
    case 'trap':
      ctx.state.pendingDecision = generateDecision(ctx, 'event', node.trapId!);
      ctx.state.mode = 'event-choice';
      return;
    case 'curio':
      ctx.state.pendingDecision = generateDecision(ctx, 'event', node.curioId!);
      ctx.state.mode = 'event-choice';
      return;
    case 'obstacle':
      ctx.state.pendingDecision = generateDecision(ctx, 'event', node.obstacleId!);
      ctx.state.mode = 'event-choice';
      return;
    case 'hunger':
      ctx.state.pendingDecision = generateDecision(ctx, 'event', 'hunger_full_meal');
      ctx.state.mode = 'event-choice';
      return;
    case 'objective':
      ctx.state.pendingDecision = generateDecision(ctx, 'event', node.objectiveId!);
      ctx.state.mode = 'event-choice';
      return;
    case 'exit':
      if (ctx.state.expedition.objectiveCompleted) {
        ctx.state.mode = 'expedition-success';
        ctx.emit('EXPEDITION_SUCCEEDED', {
          expeditionId: ctx.state.expedition.id,
          objectiveNodeId: ctx.state.expedition.route.objectiveNodeId,
          exitNodeId: nodeId,
        });
      } else {
        ctx.state.expedition.stats.retreatPosition = {
          nodeId,
          depth: ctx.state.expedition.depth,
        };
        ctx.state.mode = 'expedition-retreat';
        ctx.emit('EXPEDITION_RETREATED', {
          expeditionId: ctx.state.expedition.id,
          fromNodeId: nodeId,
          reason: 'forced',
        });
      }
      return;
    case 'empty-room':
    case 'corridor':
    case 'treasure':
      // 简化:corridor 自动推进
      autoAdvance(ctx);
      return;
  }
}

function autoAdvance(ctx: ExpeditionContext): void {
  const cur = ctx.state.expedition.currentNodeId;
  const nextEdges = ctx.state.expedition.route.edges.filter((e) => e.from === cur);
  if (nextEdges.length === 0) {
    // 死路:可能是终点了
    if (ctx.state.expedition.objectiveCompleted) {
      ctx.state.mode = 'expedition-success';
    } else {
      ctx.state.mode = 'expedition-retreat';
    }
    return;
  }
  // 简化:取第一条边
  const edge = nextEdges[0]!;
  ctx.changeTime(edge.timeCost, `auto-advance ${edge.id}`);
  ctx.changeTorch(-edge.baseTorchCost, `auto-advance ${edge.id}`);
  ctx.state.expedition.depth += 1;
  ctx.state.expedition.stats.deepestNodeReached = Math.max(ctx.state.expedition.stats.deepestNodeReached, ctx.state.expedition.depth);
  ctx.state.expedition.stats.nodesVisited += 1;
  ctx.state.expedition.stats.torchUsed += edge.baseTorchCost;
  moveToNode(ctx, edge.to);
}

/** 在 commit 后,如果 encounter 仍在进行且没生成新决策,生成一个 */
function regenerateNextDecision(ctx: ExpeditionContext): void {
  // 当前 mode 是 encounter-choice 但没有 pendingDecision
  if (ctx.state.mode === 'encounter-choice' && ctx.state.encounter && !ctx.state.pendingDecision) {
    ctx.state.pendingDecision = generateDecision(ctx, 'encounter', ctx.state.encounter.id);
  }
  // 当前 mode 是 event-choice 但 pendingDecision 是 null(已完成该事件)
  if (ctx.state.mode === 'event-choice' && !ctx.state.pendingDecision) {
    autoAdvance(ctx);
  }
}

// =============== Phase 2 精神命令 ===============

function cmdApplyStress(ctx: ExpeditionContext, heroId: string, amount: number, source: string, _commandId: string): void {
  void _commandId;
  applyStress(ctx, { type: 'apply-stress', heroId, amount, source });
}

function cmdResolveCheck(ctx: ExpeditionContext, heroId: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero || hero.isDead) return;
  runResolveCheck(ctx, hero);
}

function cmdResolveAfflictionBehavior(ctx: ExpeditionContext, heroId: string, trigger: string, _commandId: string): void {
  void _commandId;
  checkAfflictionBehaviors(ctx, trigger as AfflictionTrigger, heroId);
}

function cmdResolveVirtueBehavior(ctx: ExpeditionContext, heroId: string, trigger: string, _commandId: string): void {
  void _commandId;
  checkVirtueBehaviors(ctx, trigger as AfflictionTrigger, heroId);
}

function cmdResolveDeathblow(ctx: ExpeditionContext, heroId: string, sourceId: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero || hero.isDead) return;
  checkDeathblow(ctx, hero, sourceId);
}

function cmdConfirmHeroDeath(ctx: ExpeditionContext, deathRecordId: string, _commandId: string): void {
  void _commandId;
  // 标记死亡记录为已确认(目前只是日志)
  const rec = ctx.state.deathRecords.find((r) => r.id === deathRecordId);
  if (!rec) return;
  ctx.state.expedition.keyEvents.push({
    eventId: `death_confirmed_${rec.heroId}`,
    nodeId: rec.nodeId,
    outcome: `${rec.heroName} 永久死亡已确认`,
  });
}

function cmdDismissOverlay(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  dismissOverlay(ctx);
}

// =============== Phase 2 调试 ===============

function cmdDebugSetStress(ctx: ExpeditionContext, heroId: string, value: number, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) return;
  const v = Math.max(0, Math.min(200, value));
  const from = hero.stress;
  hero.stress = v;
  if (v > from) {
    ctx.emit('STRESS_APPLIED', { heroId, amount: v - from, source: 'debug', newTotal: v });
  } else if (v < from) {
    ctx.emit('STRESS_REDUCED', { heroId, amount: from - v, source: 'debug', newTotal: v });
  }
  if (from < 100 && v >= 100) triggerResolveCheck(ctx, hero);
  if (from < 200 && v >= 200) triggerHeartAttack(ctx, hero);
}

function cmdDebugSetDeathsDoor(ctx: ExpeditionContext, heroId: string, value: boolean, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero || hero.isDead) return;
  if (value && !hero.atDeathsDoor) {
    enterDeathsDoor(ctx, hero, 'debug', hero.hp);
  } else if (!value && hero.atDeathsDoor) {
    hero.atDeathsDoor = false;
    hero.hp = Math.max(1, Math.floor(hero.maxHp * 0.5));
    ctx.emit('DEATHS_DOOR_EXITED', { heroId, newHp: hero.hp, recoveryStacks: hero.deathsDoorRecoveryStacks });
  }
}

function cmdDebugForceAffliction(ctx: ExpeditionContext, heroId: string, afflictionId: string, _commandId: string): void {
  void _commandId;
  if (!AFFLICTIONS[afflictionId]) return;
  const hero = ctx.state.party[heroId];
  if (!hero) return;
  grantAffliction(ctx, hero, afflictionId);
}

function cmdDebugForceVirtue(ctx: ExpeditionContext, heroId: string, virtueId: string, _commandId: string): void {
  void _commandId;
  if (!VIRTUES[virtueId]) return;
  const hero = ctx.state.party[heroId];
  if (!hero) return;
  grantVirtue(ctx, hero, virtueId);
}

function cmdDebugForceHeartAttack(ctx: ExpeditionContext, heroId: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) return;
  hero.stress = 200;
  triggerHeartAttack(ctx, hero);
}

function cmdDebugForceDeathblowSuccess(ctx: ExpeditionContext, heroId: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero || hero.isDead) return;
  if (!hero.atDeathsDoor) {
    enterDeathsDoor(ctx, hero, 'debug', hero.hp);
  }
  // 模拟一次 damage 事件
  ctx.emit('DAMAGE_APPLIED', { sourceId: 'debug', targetId: heroId, amount: 1, preHp: 0, postHp: 0, crit: false, blockedByProt: 0 });
  // 强制成功:不调用 checkDeathblow,直接模拟一次
  hero.deathblowPenalty += 0.05;
  ctx.emit('DEATHBLOW_CHECK_STARTED', { heroId, finalResist: 1.0 });
  ctx.emit('DEATHBLOW_RESISTED', { heroId, penalty: 0.05 });
  ctx.emit('OVERLAY_SHOWN', { overlay: { kind: 'deathblow', heroId, resisted: true, cause: 'debug' } });
}

function cmdDebugForceDeathblowFail(ctx: ExpeditionContext, heroId: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero || hero.isDead) return;
  if (!hero.atDeathsDoor) {
    enterDeathsDoor(ctx, hero, 'debug', hero.hp);
  }
  ctx.emit('OVERLAY_SHOWN', { overlay: { kind: 'deathblow', heroId, resisted: false, cause: 'debug' } });
  triggerPermanentDeath(ctx, hero, 'deathblow', 'debug');
}

function cmdDebugReviveHero(ctx: ExpeditionContext, heroId: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) return;
  hero.isDead = false;
  hero.hp = hero.maxHp;
  hero.atDeathsDoor = false;
  hero.deathsDoorRecoveryStacks = 0;
  hero.deathblowPenalty = 0;
  hero.heartAttackCount = 0;
  hero.afflictionId = null;
  hero.virtueId = null;
  hero.resolveState = 'stable';
  hero.stress = 0;
  hero.behaviorCooldowns = {};
  ctx.emit('HERO_HP_CHANGED', { heroId, from: 0, to: hero.hp, source: 'debug-revive' });
}
