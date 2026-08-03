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
  type FacilityId,
  type FacilityServiceId,
  type HamletMode,
} from '../campaign/types.js';
import {
  setHamletMode as setHamletModeUtil,
} from '../campaign/state.js';
import { recruitHeroToRoster } from '../campaign/recruits.js';
import { assignHeroToFacility } from '../campaign/facilities.js';
import { advanceWeek } from '../campaign/week.js';
import {
  addToProvisionCart,
  removeFromProvisionCart,
  settleProvisionCart,
} from '../campaign/provisioning.js';
import {
  acquireQuirk,
  removeNegativeQuirk,
  lockPositiveQuirk,
  getQuirkDef,
  isPositiveQuirk,
} from '../quirks/index.js';
import {
  acquireDisease,
  treatDisease,
  getDiseaseDef,
} from '../diseases/index.js';
import {
  lootTrinket,
  equipTrinket,
  unequipTrinket,
  processDeathRecovery,
  buildTrinketDefCache,
} from '../trinkets/index.js';
import {
  addXp,
  upgradeHeroSlot,
} from '../progression/index.js';

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
    // Phase 3 庄园
    case 'COMPLETE_EXPEDITION_RETURN':
      return cmdCompleteExpeditionReturn(ctx, command.commandId);
    case 'ADVANCE_WEEK':
      return cmdAdvanceWeek(ctx, command.commandId);
    case 'SET_HAMLET_MODE':
      return cmdSetHamletMode(ctx, command.mode, command.commandId);
    case 'RECRUIT_HERO':
      return cmdRecruitHero(ctx, command.candidateId, command.baseActor, command.commandId);
    case 'DISMISS_HERO':
      return cmdDismissHero(ctx, command.heroId, command.commandId);
    case 'ASSIGN_HERO_TO_FACILITY':
      return cmdAssignHeroToFacility(ctx, command.heroId, command.facilityId, command.serviceId, command.commandId);
    case 'CANCEL_FACILITY_ASSIGNMENT':
      return cmdCancelFacilityAssignment(ctx, command.heroId, command.facilityId, command.commandId);
    case 'UPGRADE_FACILITY':
      return cmdUpgradeFacility(ctx, command.facilityId, command.upgradeOptionId, command.commandId);
    case 'UPGRADE_HERO_SKILL':
      return cmdUpgradeHeroSkill(ctx, command.heroId, command.skillId, command.commandId);
    case 'UPGRADE_HERO_WEAPON':
      return cmdUpgradeHeroWeapon(ctx, command.heroId, command.commandId);
    case 'UPGRADE_HERO_ARMOR':
      return cmdUpgradeHeroArmor(ctx, command.heroId, command.commandId);
    case 'SELECT_WEEKLY_QUEST':
      return cmdSelectWeeklyQuest(ctx, command.questId, command.commandId);
    case 'SET_PARTY':
      return cmdSetParty(ctx, command.heroIds, command.commandId);
    case 'BUY_PROVISION':
      return cmdBuyProvision(ctx, command.itemId, command.count, command.commandId);
    case 'REMOVE_PROVISION':
      return cmdRemoveProvision(ctx, command.itemId, command.count, command.commandId);
    case 'SETTLE_PROVISION':
      return cmdSettleProvision(ctx, command.commandId);
    case 'START_SELECTED_EXPEDITION':
      return cmdStartSelectedExpedition(ctx, command.commandId);
    // Phase 4 怪癖 + 疾病
    case 'GRANT_QUIRK':
      return cmdGrantQuirk(ctx, command.heroId, command.quirkId, command.commandId);
    case 'REMOVE_QUIRK':
      return cmdRemoveQuirk(ctx, command.heroId, command.quirkId, command.commandId);
    case 'LOCK_POSITIVE_QUIRK':
      return cmdLockPositiveQuirk(ctx, command.heroId, command.quirkId, command.commandId);
    case 'GRANT_DISEASE':
      return cmdGrantDisease(ctx, command.heroId, command.diseaseId, command.source, command.commandId);
    case 'TREAT_DISEASE':
      return cmdTreatDisease(ctx, command.heroId, command.diseaseId, command.commandId);
    // Phase 4 饰品
    case 'LOOT_TRINKET':
      return cmdLootTrinket(ctx, command.definitionId, command.week, command.source, command.commandId);
    case 'EQUIP_TRINKET':
      return cmdEquipTrinket(ctx, command.heroId, command.instanceId, command.slotIndex, command.commandId);
    case 'UNEQUIP_TRINKET':
      return cmdUnequipTrinket(ctx, command.heroId, command.slotIndex, command.commandId);
    case 'PROCESS_DEATH_RECOVERY':
      return cmdProcessDeathRecovery(ctx, command.heroId, command.choice, command.commandId);
    case 'GRANT_XP':
      return cmdGrantXp(ctx, command.heroId, command.amount, command.commandId);
    case 'START_CAMP':
      return cmdStartCamp(ctx, command.commandId);
    case 'CHOOSE_CAMP_FOOD':
      return cmdChooseCampFood(ctx, command.choiceId, command.commandId);
    case 'CHOOSE_CAMP_ACTIVITY':
      return cmdChooseCampActivity(ctx, command.activityId, command.targetHeroId, command.commandId);
    case 'FINISH_CAMP':
      return cmdFinishCamp(ctx, command.commandId);
    case 'RESOLVE_NIGHT_AMBUSH':
      return cmdResolveNightAmbush(ctx, command.commandId);
    case 'DEBUG_FORCE_CAMP':
      return cmdDebugForceCamp(ctx, command.nodeId, command.commandId);
    case 'DEBUG_SET_CAMP_POINTS':
      return cmdDebugSetCampPoints(ctx, command.value, command.commandId);
    case 'DEBUG_FORCE_NIGHT_AMBUSH':
      return cmdDebugForceNightAmbush(ctx, command.prevent, command.commandId);
    case 'DEBUG_ADD_EXPEDITION_BUFF':
      return cmdDebugAddExpeditionBuff(ctx, command.tag, command.magnitude, command.remainingNodes, command.commandId);
    case 'SELECT_REGION':
      return cmdSelectRegion(ctx, command.regionId, command.commandId);
    case 'GENERATE_REGION_QUEST':
      return cmdGenerateRegionQuest(ctx, command.regionId, command.questLength, command.commandId);
    case 'GRANT_REGION_EXPERIENCE':
      return cmdGrantRegionExperience(ctx, command.regionId, command.amount, command.commandId);
    case 'DISCOVER_REGION_CONTENT':
      return cmdDiscoverRegionContent(ctx, command.regionId, command.contentType, command.contentId, command.commandId);
    case 'MARK_BOSS_QUEST_READY':
      return cmdMarkBossQuestReady(ctx, command.regionId, command.commandId);
    case 'DEBUG_SET_REGION_LEVEL':
      return cmdDebugSetRegionLevel(ctx, command.regionId, command.level, command.commandId);
    case 'DEBUG_FORCE_REGION_QUEST':
      return cmdDebugForceRegionQuest(ctx, command.regionId, command.commandId);
    case 'DEBUG_FORCE_ELITE_NODE':
      return; // 简化:无操作
    case 'DEBUG_EXPORT_REGION_PACKAGE':
      return; // 简化:无操作
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
      trinketInventory: { ownedInstanceIds: [], equippedByHero: {} },
      status: 'active',
    };
    const hamlet: HamletState = {
      mode: 'weekly-summary',
      recruitCandidates: [],
      weeklyQuestIds: [],
      weeklyQuestDefs: {},
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

// =============== Phase 3 庄园命令 ===============

/** 远征结算:回到庄园(debrief) */
function cmdCompleteExpeditionReturn(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  if (!ctx.state.campaign) {
    // 旧测试(无 campaign)走原路径
    ctx.state.mode = 'expedition-retreat';
    return;
  }
  // 远征成功 / 失败 状态保持
  const succeeded = ctx.state.expedition.objectiveCompleted;
  ctx.state.mode = 'hamlet-debrief';
  ctx.emit('EXPEDITION_RETURNED', {
    expeditionId: ctx.state.expedition.id,
    succeeded,
    heroIds: Object.keys(ctx.state.party).filter((id) => {
      const h = ctx.state.party[id]!;
      return !h.isDead;
    }),
    deathCount: ctx.state.deathRecords.length,
    lootSummary: { gold: 0, portraits: 0, crests: 0 },
  });
  // 把 selected-for-party 还原(让所有英雄可分配)
  for (const hero of Object.values(ctx.state.party)) {
    if (hero.activityState === 'selected-for-party') {
      hero.activityState = 'available';
      hero.assignedFacilityId = null;
      hero.activityWeeksRemaining = 0;
    }
  }
}

/** 周推进 */
function cmdAdvanceWeek(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  if (!ctx.state.campaign) {
    throw new CommandError('no campaign state, cannot advance week');
  }
  const result = advanceWeek(ctx.state);
  ctx.state.mode = 'hamlet-overview';
  ctx.emit('WEEK_ADVANCED', {
    newWeek: result.week,
    facilityCompleted: result.facilityCompleted,
    notices: result.notices,
  });
}

/** 切换庄园子页 */
function cmdSetHamletMode(ctx: ExpeditionContext, mode: HamletMode, _commandId: string): void {
  void _commandId;
  if (!ctx.state.hamlet) {
    throw new CommandError('no hamlet state, cannot set mode');
  }
  setHamletModeUtil(ctx.state, mode);
  ctx.emit('HAMLET_MODE_CHANGED', { mode });
}

/** 招募英雄 */
function cmdRecruitHero(
  ctx: ExpeditionContext,
  candidateId: string,
  baseActor: { maxHp: number; dodge: number; speed: number; accuracy: number; crit: number; skills: string[]; rank: 1 | 2 | 3 | 4 },
  _commandId: string,
): void {
  void _commandId;
  const candidate = ctx.state.hamlet?.recruitCandidates.find((c) => c.id === candidateId);
  if (!candidate) {
    throw new CommandError(`recruit candidate not found: ${candidateId}`);
  }
  const result = recruitHeroToRoster(ctx.state, candidate, baseActor);
  if (!result.ok) {
    throw new CommandError(`recruit failed: ${result.reason ?? 'unknown'}`);
  }
  ctx.emit('HERO_RECRUITED', { heroId: result.hero!.id, candidateId });
}

/** 解雇英雄(暂时不暴露给 UI,debug 用) */
function cmdDismissHero(ctx: ExpeditionContext, heroId: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) return;
  if (hero.isDead) {
    // 死英雄:从 deadHeroIds 移除,UI 不再列;保持 hp=0 满足 invariant
    if (ctx.state.campaign) {
      ctx.state.campaign.deadHeroIds = ctx.state.campaign.deadHeroIds.filter((id) => id !== heroId);
    }
    hero.hp = 0;
  } else {
    // 活英雄:从 rosterHeroIds 移除,保留 state.party(供死亡报告查)
    if (ctx.state.campaign) {
      ctx.state.campaign.rosterHeroIds = ctx.state.campaign.rosterHeroIds.filter((id) => id !== heroId);
    }
    hero.activityState = 'missing';
  }
  ctx.emit('HERO_DISMISSED', { heroId });
}

/** 分配到设施 */
function cmdAssignHeroToFacility(
  ctx: ExpeditionContext,
  heroId: string,
  facilityId: string,
  serviceId: string,
  _commandId: string,
): void {
  void _commandId;
  const result = assignHeroToFacility(ctx.state, heroId, facilityId as FacilityId, serviceId as FacilityServiceId);
  if (!result.ok) {
    throw new CommandError(`assign to facility failed: ${result.reason ?? 'unknown'}`);
  }
  ctx.emit('HERO_ASSIGNED_TO_FACILITY', { heroId, facilityId, serviceId });
}

/** 取消设施分配 */
function cmdCancelFacilityAssignment(
  ctx: ExpeditionContext,
  heroId: string,
  facilityId: string,
  _commandId: string,
): void {
  void _commandId;
  if (!ctx.state.campaign) return;
  const fac = ctx.state.campaign.facilityStates[facilityId];
  if (!fac) return;
  fac.occupiedSlots = fac.occupiedSlots.filter((s) => s.heroId !== heroId);
  const hero = ctx.state.party[heroId];
  if (hero) {
    hero.activityState = 'available';
    hero.assignedFacilityId = null;
    hero.activityWeeksRemaining = 0;
  }
  ctx.emit('HERO_REMOVED_FROM_FACILITY', { heroId, facilityId });
}

/** 设施升级 */
function cmdUpgradeFacility(
  ctx: ExpeditionContext,
  facilityId: string,
  upgradeOptionId: string,
  _commandId: string,
): void {
  void _commandId;
  if (!ctx.state.campaign) throw new CommandError('no campaign state');
  const fac = ctx.state.campaign.facilityStates[facilityId];
  if (!fac) throw new CommandError(`facility not found: ${facilityId}`);
  const opt = fac.upgradeOptions.find((o) => o.id === upgradeOptionId);
  if (!opt) throw new CommandError(`upgrade option not found: ${upgradeOptionId}`);
  if (ctx.state.campaign.gold < opt.goldCost) {
    throw new CommandError(`gold insufficient for upgrade (need ${opt.goldCost})`);
  }
  ctx.state.campaign.gold -= opt.goldCost;
  fac.level += 1;
  if (opt.effect.includes('slotCount+1')) fac.slotCount += 1;
  if (opt.effect.includes('maxSkillLevel=2')) {/* already 2-cap */}
  if (opt.effect.includes('maxWeaponLevel=2')) {/* already 2-cap */}
  // 升级完成后清掉该升级选项(只升 1 次)
  fac.upgradeOptions = fac.upgradeOptions.filter((o) => o.id !== upgradeOptionId);
  ctx.emit('FACILITY_UPGRADED', { facilityId, upgradeOptionId, newLevel: fac.level });
}

/** 升级英雄技能 */
function cmdUpgradeHeroSkill(
  ctx: ExpeditionContext,
  heroId: string,
  skillId: string,
  _commandId: string,
): void {
  void _commandId;
  if (!ctx.state.campaign) throw new CommandError('no campaign state');
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  if (!ctx.state.campaign.facilityStates['guild']) {
    throw new CommandError('guild not available');
  }
  const guildLevel = ctx.state.campaign.facilityStates['guild']?.level ?? 1;
  const r = upgradeHeroSlot(hero, 'skill', skillId, 800, guildLevel);
  if (!r.ok) throw new CommandError(`skill upgrade failed: ${r.reason}`);
  if (ctx.state.campaign.gold < r.costGold) {
    throw new CommandError(`gold insufficient (need ${r.costGold})`);
  }
  ctx.state.campaign.gold -= r.costGold;
  ctx.emit('HERO_SKILL_UPGRADED', { heroId, skillId, newLevel: r.newLevel });
}

/** 升级英雄武器 */
function cmdUpgradeHeroWeapon(ctx: ExpeditionContext, heroId: string, _commandId: string): void {
  void _commandId;
  if (!ctx.state.campaign) throw new CommandError('no campaign state');
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  const blacksmithLevel = ctx.state.campaign.facilityStates['blacksmith']?.level ?? 1;
  const r = upgradeHeroSlot(hero, 'weapon', null, 750, blacksmithLevel);
  if (!r.ok) throw new CommandError(`weapon upgrade failed: ${r.reason}`);
  if (ctx.state.campaign.gold < r.costGold) {
    throw new CommandError(`gold insufficient (need ${r.costGold})`);
  }
  ctx.state.campaign.gold -= r.costGold;
  ctx.emit('HERO_WEAPON_UPGRADED', { heroId, newLevel: r.newLevel });
}

/** 升级英雄护甲 */
function cmdUpgradeHeroArmor(ctx: ExpeditionContext, heroId: string, _commandId: string): void {
  void _commandId;
  if (!ctx.state.campaign) throw new CommandError('no campaign state');
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  const blacksmithLevel = ctx.state.campaign.facilityStates['blacksmith']?.level ?? 1;
  const r = upgradeHeroSlot(hero, 'armor', null, 750, blacksmithLevel);
  if (!r.ok) throw new CommandError(`armor upgrade failed: ${r.reason}`);
  if (ctx.state.campaign.gold < r.costGold) {
    throw new CommandError(`gold insufficient (need ${r.costGold})`);
  }
  ctx.state.campaign.gold -= r.costGold;
  ctx.emit('HERO_ARMOR_UPGRADED', { heroId, newLevel: r.newLevel });
}

/** 选本周任务 */
function cmdSelectWeeklyQuest(ctx: ExpeditionContext, questId: string, _commandId: string): void {
  void _commandId;
  if (!ctx.state.hamlet) throw new CommandError('no hamlet state');
  if (!ctx.state.hamlet.weeklyQuestDefs[questId]) {
    throw new CommandError(`quest not found: ${questId}`);
  }
  ctx.state.hamlet.selectedQuestId = questId;
  ctx.emit('QUEST_SELECTED', { questId });
}

/** 设置远征队伍 */
function cmdSetParty(ctx: ExpeditionContext, heroIds: string[], _commandId: string): void {
  void _commandId;
  if (!ctx.state.hamlet) throw new CommandError('no hamlet state');
  if (heroIds.length > 4) {
    throw new CommandError('party size must be <= 4');
  }
  // 校验:所有 id 存在 + 活 + available
  for (const id of heroIds) {
    const hero = ctx.state.party[id];
    if (!hero) throw new CommandError(`hero not in party: ${id}`);
    if (hero.isDead) throw new CommandError(`hero ${id} is dead`);
    if (hero.activityState && hero.activityState !== 'available' && hero.activityState !== 'selected-for-party') {
      throw new CommandError(`hero ${id} not available (state=${hero.activityState})`);
    }
  }
  // 把所有英雄 activityState 重置(从 selected-for-party 回到 available)
  for (const hero of Object.values(ctx.state.party)) {
    if (hero.activityState === 'selected-for-party') {
      hero.activityState = 'available';
    }
  }
  // 设新选
  ctx.state.hamlet.selectedPartyHeroIds = [...heroIds];
  for (const id of heroIds) {
    const hero = ctx.state.party[id]!;
    hero.activityState = 'selected-for-party';
  }
  ctx.emit('PARTY_SET', { heroIds });
}

/** 买补给(加到购物车) */
function cmdBuyProvision(ctx: ExpeditionContext, itemId: ItemId, count: number, _commandId: string): void {
  void _commandId;
  const result = addToProvisionCart(ctx.state, itemId, count);
  if (!result.ok) throw new CommandError(`buy provision failed: ${result.reason ?? 'unknown'}`);
  ctx.emit('PROVISION_ADDED', { itemId, count });
}

/** 从购物车移除补给 */
function cmdRemoveProvision(ctx: ExpeditionContext, itemId: ItemId, count: number, _commandId: string): void {
  void _commandId;
  const result = removeFromProvisionCart(ctx.state, itemId, count);
  if (!result.ok) throw new CommandError(`remove provision failed: ${result.reason ?? 'unknown'}`);
  ctx.emit('PROVISION_REMOVED', { itemId, count });
}

/** 结算购物车(扣金币 + 加物品) */
function cmdSettleProvision(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  const result = settleProvisionCart(ctx.state);
  if (!result.ok) throw new CommandError(`settle provision failed: ${result.reason ?? 'unknown'}`);
  ctx.emit('PROVISION_SETTLED', { totalCost: result.totalCost ?? 0 });
}

/** 从庄园开始远征(用 hamlet.selectedQuestId + selectedPartyHeroIds) */
function cmdStartSelectedExpedition(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  if (!ctx.state.hamlet) throw new CommandError('no hamlet state');
  const { selectedQuestId, selectedPartyHeroIds } = ctx.state.hamlet;
  if (!selectedQuestId) {
    throw new CommandError('no quest selected');
  }
  if (selectedPartyHeroIds.length === 0) {
    throw new CommandError('no party selected');
  }
  // 这里直接走 cmdStartExpedition 的初始化
  // 简化:复用 cmdStartExpedition 内部逻辑
  cmdStartExpeditionFromHamlet(ctx, selectedPartyHeroIds, _commandId);
}

/** 从庄园组队的远征(简化版 cmdStartExpedition) */
function cmdStartExpeditionFromHamlet(
  ctx: ExpeditionContext,
  heroIds: string[],
  _commandId: string,
): void {
  void _commandId;
  // 把选中的 hero ids 复制为新 expedition 状态
  // (此处只设置 mode + expedition 状态,真正的 cmdStartExpedition 逻辑在 Phase 1/2 已实现)
  // 简化:把所有选中英雄的 stress 传播 + 进入 node-introduction
  ctx.state.mode = 'expedition-start';
  ctx.state.pendingDecision = null;
  ctx.state.lastResolution = null;
  ctx.emit('EXPEDITION_STARTED_FROM_HAMLET', { heroIds, questId: ctx.state.hamlet?.selectedQuestId ?? null });
}

// =============== Phase 4 怪癖 + 疾病 ===============

/** 授予一个怪癖(事件/奇物/治疗结果触发,SPEC §4.1) */
function cmdGrantQuirk(ctx: ExpeditionContext, heroId: string, quirkId: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  if (!getQuirkDef(quirkId)) throw new CommandError(`unknown quirk: ${quirkId}`);
  const result = acquireQuirk(hero, quirkId);
  if (!result.ok) {
    throw new CommandError(`grant quirk failed: ${result.reason}`);
  }
  if (result.replacedId) {
    ctx.emit('QUIRK_REPLACED', { heroId, oldQuirkId: result.replacedId, newQuirkId: quirkId });
  }
  ctx.emit('QUIRK_GAINED', { heroId, quirkId, replacedId: result.replacedId, source: 'event' });
}

/** 移除一个负向怪癖(疗养院 quirk-removal 触发) */
function cmdRemoveQuirk(ctx: ExpeditionContext, heroId: string, quirkId: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  if (isPositiveQuirk(quirkId)) {
    throw new CommandError(`cannot remove positive quirk ${quirkId} via REMOVE_QUIRK`);
  }
  const result = removeNegativeQuirk(hero, quirkId);
  if (!result.ok) {
    throw new CommandError(`remove quirk failed: ${result.reason}`);
  }
  ctx.emit('QUIRK_REMOVED', { heroId, quirkId, costGold: 0 });
}

/** 锁定一个正面怪癖(疗养院 lock-positive 触发) */
function cmdLockPositiveQuirk(ctx: ExpeditionContext, heroId: string, quirkId: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  const result = lockPositiveQuirk(hero, quirkId);
  if (!result.ok) {
    throw new CommandError(`lock quirk failed: ${result.reason}`);
  }
  ctx.emit('QUIRK_LOCKED', { heroId, quirkId });
}

/** 授予一个疾病 */
function cmdGrantDisease(ctx: ExpeditionContext, heroId: string, diseaseId: string, source: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  if (!getDiseaseDef(diseaseId)) throw new CommandError(`unknown disease: ${diseaseId}`);
  const result = acquireDisease(hero, diseaseId, source as any);
  if (!result.ok) {
    throw new CommandError(`grant disease failed: ${result.reason}`);
  }
  ctx.emit('DISEASE_GAINED', { heroId, diseaseId, source });
}

/** 治疗一个疾病(疗养院 disease-treatment 触发) */
function cmdTreatDisease(ctx: ExpeditionContext, heroId: string, diseaseId: string, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  if (!ctx.state.campaign) throw new CommandError('no campaign state');
  // 设施等级从 sanitarium 拿
  const sanitariumLevel = ctx.state.campaign.facilityStates['sanitarium']?.level ?? 1;
  const heroLevel = hero.resolveLevel ?? 0;
  const result = treatDisease(hero, diseaseId, heroLevel, sanitariumLevel);
  if (!result.ok) {
    throw new CommandError(`treat disease failed: ${result.reason}`);
  }
  // 扣金币
  if (ctx.state.campaign.gold < result.costGold) {
    throw new CommandError(`gold insufficient (need ${result.costGold})`);
  }
  ctx.state.campaign.gold -= result.costGold;
  ctx.emit('DISEASE_TREATED', { heroId, diseaseId, costGold: result.costGold });
}

// =============== Phase 4 饰品 ===============

/** 战利品掉一件饰品(任务完成 / 精英 / 隐藏节点触发) */
function cmdLootTrinket(ctx: ExpeditionContext, definitionId: string, week: number, source: string, _commandId: string): void {
  void _commandId;
  if (!ctx.state.campaign) {
    if (!ctx.state.campaign) {
      // campaign null 时直接静默失败(P1/P2 旧测试不需要)
      return;
    }
  }
  const inventory = ctx.state.campaign!.trinketInventory ?? (ctx.state.campaign!.trinketInventory = { ownedInstanceIds: [], equippedByHero: {} });
  const r = lootTrinket(inventory, definitionId, week, source);
  if (!r.ok) throw new CommandError(`loot trinket failed: ${r.reason}`);
  ctx.emit('TRINKET_LOOTED', {
    trinketInstanceId: r.instance.id,
    definitionId: r.instance.definitionId,
    source,
  });
}

/** 装备饰品 */
function cmdEquipTrinket(ctx: ExpeditionContext, heroId: string, instanceId: string, slotIndex: number, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  if (!ctx.state.campaign) throw new CommandError('no campaign state');
  const inventory = ctx.state.campaign.trinketInventory;
  if (!inventory) throw new CommandError('no trinket inventory');
  if (!inventory.ownedInstanceIds.includes(instanceId)) {
    throw new CommandError(`trinket instance not in inventory: ${instanceId}`);
  }
  const cache = buildTrinketDefCache(inventory);
  const r = equipTrinket(hero, instanceId, slotIndex, cache);
  if (!r.ok) throw new CommandError(`equip failed: ${r.reason}`);
  // 同步 equippedByHero
  if (!inventory.equippedByHero[heroId]) inventory.equippedByHero[heroId] = [null, null];
  inventory.equippedByHero[heroId]![slotIndex] = instanceId;
  ctx.emit('TRINKET_EQUIPPED', { heroId, trinketInstanceId: instanceId, slotIndex });
}

/** 卸下饰品 */
function cmdUnequipTrinket(ctx: ExpeditionContext, heroId: string, slotIndex: number, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  if (!ctx.state.campaign) throw new CommandError('no campaign state');
  const r = unequipTrinket(hero, slotIndex);
  if (!r.ok) throw new CommandError(`unequip failed: ${r.reason}`);
  const inventory = ctx.state.campaign.trinketInventory;
  if (inventory && inventory.equippedByHero[heroId]) {
    inventory.equippedByHero[heroId]![slotIndex] = null;
  }
  ctx.emit('TRINKET_UNEQUIPPED', { heroId, slotIndex });
}

/** 死亡英雄饰品回收(SPEC §8.2) */
function cmdProcessDeathRecovery(ctx: ExpeditionContext, heroId: string, choice: 'recover-one' | 'abandon-all' | 'emergency-retreat', _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  if (!ctx.state.campaign) throw new CommandError('no campaign state');
  const inventory = ctx.state.campaign.trinketInventory;
  if (!inventory) throw new CommandError('no trinket inventory');
  const result = processDeathRecovery(hero, choice);
  // 同步 inventory.equippedByHero
  inventory.equippedByHero[heroId] = [null, null];
  // 回收的 instance 留在 ownedInstanceIds
  // 放弃的 instance 从 ownedInstanceIds 移除
  for (const abandoned of result.abandoned) {
    const idx = inventory.ownedInstanceIds.indexOf(abandoned);
    if (idx >= 0) inventory.ownedInstanceIds.splice(idx, 1);
    ctx.emit('TRINKET_LOST', { heroId, trinketInstanceId: abandoned, cause: 'death' });
  }
  for (const recovered of result.recovered) {
    ctx.emit('TRINKET_RECOVERED', { heroId, trinketInstanceId: recovered });
  }
}

// =============== Phase 4 成长深化 ===============

/** 授予 XP(远征结算/任务完成) */
function cmdGrantXp(ctx: ExpeditionContext, heroId: string, amount: number, _commandId: string): void {
  void _commandId;
  const hero = ctx.state.party[heroId];
  if (!hero) throw new CommandError(`hero not found: ${heroId}`);
  if (hero.isDead) throw new CommandError('dead hero cannot gain xp');
  if (amount <= 0) return;
  const r = addXp(hero, amount);
  if (r.levelsGained > 0) {
    ctx.emit('HERO_RESOLVE_LEVEL_INCREASED', { heroId, newLevel: r.newLevel });
  }
}

// =============== Phase 4 P4.4 露营命令 ===============

import {
  startCamp as campStart,
  selectFood as campSelectFood,
  selectActivity as campSelectActivity,
  finishCamp as campFinish,
  checkNightAmbush,
  applyNightAmbushResult,
  isCampCompleted,
  activeBuffs,
  DEFAULT_CAMP_CONFIG,
} from '../camps/manager.js';
import type {
  CampFoodChoiceId,
  ExpeditionBuff,
  NightAmbushOutcome,
  NightAmbushResult,
} from '../camps/types.js';

/** 夜袭 outcome → 效果数值 */
function makeNightAmbushEffects(outcome: NightAmbushOutcome): NightAmbushResult['effects'] {
  switch (outcome) {
    case 'stressed':
      return { stressDelta: 20 };
    case 'torch-lost':
      return { torchLost: 25 };
    case 'food-lost':
      return { foodLost: 3 };
    case 'formation-broken':
      return { stressDelta: 5 };
    case 'diseased':
      return { diseaseId: 'd_blight' }; // SPEC §4A 默认:腐症
    case 'partial-buff-lost':
      return { buffsLost: [] }; // 简化:不掉具体 buff
    case 'ambush-encounter':
      return { stressDelta: 10, torchLost: 10 };
    case 'safe':
    default:
      return {};
  }
}

function nightAmbushNarrative(outcome: NightAmbushOutcome, guarded: boolean): string {
  if (guarded) return '守夜成功,夜袭未发生';
  switch (outcome) {
    case 'safe': return '一夜平安';
    case 'stressed': return '黑暗中传来奇怪的声音,队伍压力上升';
    case 'torch-lost': return '篝火被风吹灭,火把下降';
    case 'food-lost': return '营地被偷,食物损失';
    case 'formation-broken': return '夜袭警报后阵型混乱';
    case 'diseased': return '一名英雄在夜袭中感染疾病';
    case 'partial-buff-lost': return '夜袭扰乱了 Buff 持续';
    case 'ambush-encounter': return '夜袭升级为伏击遭遇';
  }
}

function cmdStartCamp(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  const exp = ctx.state.expedition;
  const result = campStart(exp, ctx.state.party, DEFAULT_CAMP_CONFIG, exp.depth);
  if (!result.ok) throw new CommandError(`start camp failed: ${result.reason}`);
  exp.campState = result.campState;
  exp.campUsed = false; // finishCamp 才设 true
  ctx.emit('CAMP_STARTED', {
    nodeId: exp.currentNodeId,
    totalPoints: result.campState.totalPoints,
  });
}

function cmdChooseCampFood(ctx: ExpeditionContext, choiceId: CampFoodChoiceId, _commandId: string): void {
  void _commandId;
  const exp = ctx.state.expedition;
  if (!exp.campState) throw new CommandError('no camp state');
  const result = campSelectFood(exp, ctx.state.party, ctx.state.inventory, choiceId);
  if (!result.ok) throw new CommandError(`choose food failed: ${result.reason}`);
  ctx.emit('CAMP_FOOD_CONSUMED', {
    foodSpent: result.foodConsumed,
    choice: choiceId,
  });
  if (result.healFlat > 0) {
    ctx.emit('CAMP_HEALING_APPLIED', { heroId: 'all', amount: result.healFlat });
  }
  if (result.stressDelta !== 0) {
    ctx.emit('CAMP_STRESS_REDUCED', { heroId: 'all', amount: result.stressDelta });
  }
}

function cmdChooseCampActivity(
  ctx: ExpeditionContext,
  activityId: string,
  targetHeroId: string | undefined,
  _commandId: string,
): void {
  void _commandId;
  const exp = ctx.state.expedition;
  if (!exp.campState) throw new CommandError('no camp state');
  const result = campSelectActivity(exp, ctx.state.party, ctx.state.inventory, activityId, targetHeroId ?? null);
  if (!result.ok) throw new CommandError(`choose activity failed: ${result.reason}`);
  ctx.emit('CAMP_ACTIVITY_SELECTED', {
    activityId,
    targetHeroId,
    costPoints: result.pointsSpent,
  });
  ctx.emit('CAMP_POINTS_SPENT', {
    remainingPoints: result.remainingPoints,
  });
  if (result.buffApplied) {
    ctx.emit('CAMP_BUFF_APPLIED', { buffId: `camp-buff-${activityId}`, sourceId: activityId });
  }
}

function cmdFinishCamp(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  const exp = ctx.state.expedition;
  if (!exp.campState) throw new CommandError('no camp state');
  if (isCampCompleted(exp.campState)) {
    throw new CommandError('camp already completed');
  }
  // 标记 campState 进入 night-resolution
  exp.campState.campStatus = 'night-resolution';
  const result = campFinish(exp);
  if (!result.ok) throw new CommandError(`finish camp failed: ${result.reason}`);
  const totalBuffs = activeBuffs(exp).length;
  ctx.emit('CAMP_COMPLETED', {
    totalBuffsApplied: totalBuffs,
    totalStressReduced: 0,
    totalHealing: 0,
  });
}

function cmdResolveNightAmbush(ctx: ExpeditionContext, _commandId: string): void {
  void _commandId;
  const exp = ctx.state.expedition;
  if (!exp.campState) throw new CommandError('no camp state');
  if (exp.campState.nightAmbushResult) {
    throw new CommandError('night ambush already resolved');
  }
  if (exp.campState.campStatus !== 'completed' && exp.campState.campStatus !== 'night-resolution') {
    throw new CommandError(`camp status ${exp.campState.campStatus} cannot resolve ambush`);
  }
  const hasScoutBuff = activeBuffs(exp).some((b) => b.tag === 'scout-bonus');
  const check = checkNightAmbush({
    rngState: ctx.state.rng,
    baseChance: DEFAULT_CAMP_CONFIG.baseAmbushChance,
    guardEstablished: exp.campState.guardEstablished,
    torchValue: exp.torch,
    hasScoutBuff,
    regionDanger: 0, // Phase 5 区域填
  });
  // 持久化新 rng
  ctx.state.rng = check.newRngState;
  ctx.emit('NIGHT_AMBUSH_CHECK_STARTED', { roll: 0, prevented: check.guarded });
  const eff = makeNightAmbushEffects(check.outcome);
  const result: NightAmbushResult = {
    outcome: check.outcome,
    effects: eff,
    narrative: nightAmbushNarrative(check.outcome, check.guarded),
    guarded: check.guarded,
  };
  applyNightAmbushResult(exp, ctx.state.party, ctx.state.inventory, result);
  if (check.guarded) {
    ctx.emit('NIGHT_AMBUSH_PREVENTED', { reason: 'guard established' });
  } else if (check.triggered) {
    ctx.emit('NIGHT_AMBUSH_TRIGGERED', { outcome: mapOutcome(check.outcome) });
  }
}

function mapOutcome(o: NightAmbushOutcome): 'stress' | 'torch' | 'food' | 'formation' | 'disease' | 'ambush' {
  if (o === 'torch-lost') return 'torch';
  if (o === 'food-lost') return 'food';
  if (o === 'formation-broken') return 'formation';
  if (o === 'diseased') return 'disease';
  if (o === 'ambush-encounter') return 'ambush';
  return 'stress';
}

// =============== Phase 4 P4.4 露营调试 ===============

function cmdDebugForceCamp(ctx: ExpeditionContext, nodeId: string | undefined, _commandId: string): void {
  void _commandId;
  const exp = ctx.state.expedition;
  if (nodeId) exp.currentNodeId = nodeId;
  // 重置 campUsed 以便可以开启
  exp.campUsed = false;
  exp.campState = null;
  const result = campStart(exp, ctx.state.party, DEFAULT_CAMP_CONFIG, exp.depth);
  if (!result.ok) throw new CommandError(`force camp failed: ${result.reason}`);
  exp.campState = result.campState;
  ctx.emit('CAMP_STARTED', {
    nodeId: exp.currentNodeId,
    totalPoints: result.campState.totalPoints,
  });
}

function cmdDebugSetCampPoints(ctx: ExpeditionContext, value: number, _commandId: string): void {
  void _commandId;
  const exp = ctx.state.expedition;
  if (!exp.campState) throw new CommandError('no camp state');
  if (value < 0) throw new CommandError('camp points must be >= 0');
  exp.campState.remainingPoints = value;
  if (value > exp.campState.totalPoints) exp.campState.totalPoints = value;
}

function cmdDebugForceNightAmbush(ctx: ExpeditionContext, prevent: boolean, _commandId: string): void {
  void _commandId;
  const exp = ctx.state.expedition;
  if (!exp.campState) throw new CommandError('no camp state');
  if (prevent) {
    exp.campState.guardEstablished = true;
  } else {
    exp.campState.guardEstablished = false;
  }
}

function cmdDebugAddExpeditionBuff(
  ctx: ExpeditionContext,
  tag: string,
  magnitude: number,
  remainingNodes: number,
  _commandId: string,
): void {
  void _commandId;
  const exp = ctx.state.expedition;
  const buff: ExpeditionBuff = {
    id: `debug-buff-${tag}-${Date.now()}`,
    sourceId: 'debug',
    sourceLabel: `Debug ${tag}`,
    tag: tag as ExpeditionBuff['tag'],
    remainingNodes,
    magnitude,
  };
  if (!exp.expeditionBuffs) exp.expeditionBuffs = [];
  exp.expeditionBuffs.push(buff);
  ctx.emit('CAMP_BUFF_APPLIED', { buffId: buff.id, sourceId: 'debug' });
}

// =============== Phase 5 区域命令 ===============

import {
  emptyRegionProgress,
  emptyRegionDiscovery,
  grantRegionExperience,
  markDiscovered,
  generateRegionQuest,
} from '../regions/manager.js';
import { getAllRegionIds } from '../regions/registry.js';
import type { RegionId, RegionDiscoveryState, GeneratedQuest } from '../regions/types.js';

function ensureRegionProgress(campaign: any, regionId: RegionId): any {
  if (!campaign.regionProgress) campaign.regionProgress = {};
  if (!campaign.regionProgress[regionId]) {
    campaign.regionProgress[regionId] = emptyRegionProgress(regionId);
  }
  return campaign.regionProgress[regionId];
}

function ensureRegionDiscovery(campaign: any, regionId: RegionId): RegionDiscoveryState {
  if (!campaign.regionDiscovery) campaign.regionDiscovery = {};
  if (!campaign.regionDiscovery[regionId]) {
    campaign.regionDiscovery[regionId] = emptyRegionDiscovery();
  }
  return campaign.regionDiscovery[regionId];
}

function ensureHamlet(state: any): any {
  if (!state.hamlet) {
    state.hamlet = {
      mode: 'weekly-summary',
      recruitCandidates: [],
      weeklyQuestIds: [],
      weeklyQuestDefs: {},
      selectedQuestId: null,
      selectedPartyHeroIds: [],
      provisionCart: {},
      weeklyNotices: [],
      selectedRegionId: null,
    };
  }
  return state.hamlet;
}

function cmdSelectRegion(ctx: ExpeditionContext, regionId: RegionId, _commandId: string): void {
  void _commandId;
  if (!getAllRegionIds().includes(regionId)) {
    throw new Error(`unknown region: ${regionId}`);
  }
  if (!ctx.state.campaign) {
    throw new Error('no campaign');
  }
  ensureRegionProgress(ctx.state.campaign, regionId);
  ensureRegionDiscovery(ctx.state.campaign, regionId);
  const hamlet = ensureHamlet(ctx.state);
  hamlet.selectedRegionId = regionId;
  ctx.emit('REGION_SELECTED', { regionId });
}

function cmdGenerateRegionQuest(
  ctx: ExpeditionContext,
  regionId: RegionId,
  questLength: 'short' | 'medium',
  _commandId: string,
): void {
  void _commandId;
  if (!ctx.state.campaign) throw new Error('no campaign');
  const progress = ensureRegionProgress(ctx.state.campaign, regionId);
  const result = generateRegionQuest({
    regionId,
    questLength,
    difficulty: progress.level / 4,
    partyLevel: 1,
    seed: ctx.state.seed,
    rngState: ctx.state.rng,
  });
  ctx.state.rng = result.newRngState;
  // 加入 weeklyQuestDefs
  const hamlet = ensureHamlet(ctx.state);
  const q: GeneratedQuest = result.quest;
  hamlet.weeklyQuestIds.push(q.id);
  hamlet.weeklyQuestDefs[q.id] = {
    id: q.id,
    title: `${q.objectiveType === 'clear' ? '清理' : q.objectiveType === 'investigate' ? '调查' : q.objectiveType === 'collect' ? '收集' : q.objectiveType === 'deep' ? '深入' : q.objectiveType === 'purge' ? '净化' : '护送'}任务`,
    description: `${regionId} ${questLength} 任务,目标 ${q.objectiveType}`,
    difficulty: q.difficulty > 0.6 ? 'high-risk' : q.difficulty > 0.3 ? 'standard' : 'safe',
    nodeCount: q.objectiveData.target,
    threat: 'beast',
    recommendedClassTags: q.recommendedHeroTags,
    expectedProvisions: Object.fromEntries(q.recommendedProvisionIds.map((id) => [id, 1])),
    rewards: {
      gold: q.rewardPreview.gold,
      portraits: q.rewardPreview.portraits,
      crests: q.rewardPreview.crests,
      heroXp: q.rewardPreview.heroXp,
    },
    regionId: q.regionId,
    objectiveType: q.objectiveType,
    modifierIds: q.modifierIds,
  };
  ctx.emit('REGION_ROUTE_GENERATED', { regionId, questId: q.id });
}

function cmdGrantRegionExperience(
  ctx: ExpeditionContext,
  regionId: RegionId,
  amount: number,
  _commandId: string,
): void {
  void _commandId;
  if (!ctx.state.campaign) throw new Error('no campaign');
  if (amount <= 0) throw new Error('amount must be > 0');
  const progress = ensureRegionProgress(ctx.state.campaign, regionId);
  const result = grantRegionExperience(progress, amount);
  if (result.leveledUp) {
    ctx.emit('REGION_LEVEL_INCREASED', { regionId, newLevel: result.newLevel });
    for (const eid of result.unlockedEliteIds) {
      ctx.emit('REGION_ELITE_UNLOCKED', { regionId, enemyId: eid });
    }
    for (const rid of result.unlockedRareLootIds) {
      ctx.emit('REGION_RARE_LOOT_UNLOCKED', { regionId, lootId: rid });
    }
  }
  if (result.bossReady) {
    ctx.emit('REGION_BOSS_QUEST_MARKED_READY', { regionId });
  }
  ctx.emit('REGION_EXPERIENCE_GRANTED', { regionId, amount, newExperience: progress.experience });
}

function cmdDiscoverRegionContent(
  ctx: ExpeditionContext,
  regionId: RegionId,
  contentType: 'enemy' | 'curio' | 'trap' | 'disease' | 'trinket',
  contentId: string,
  _commandId: string,
): void {
  void _commandId;
  if (!ctx.state.campaign) throw new Error('no campaign');
  const discovery = ensureRegionDiscovery(ctx.state.campaign, regionId);
  const result = markDiscovered(discovery, contentType, contentId);
  if (result.newlyDiscovered.length > 0) {
    const evType = (
      contentType === 'enemy' ? 'REGION_ENEMY_DISCOVERED' :
      contentType === 'curio' ? 'REGION_CURIO_DISCOVERED' :
      contentType === 'trap' ? 'REGION_TRAP_DISCOVERED' :
      contentType === 'disease' ? 'REGION_DISEASE_DISCOVERED' :
      'REGION_TRINKET_DISCOVERED'
    );
    ctx.emit(evType, { regionId, contentId });
  }
}

function cmdMarkBossQuestReady(ctx: ExpeditionContext, regionId: RegionId, _commandId: string): void {
  void _commandId;
  if (!ctx.state.campaign) throw new Error('no campaign');
  const progress = ensureRegionProgress(ctx.state.campaign, regionId);
  progress.bossQuestReady = true;
  ctx.emit('REGION_BOSS_QUEST_MARKED_READY', { regionId });
}

function cmdDebugSetRegionLevel(
  ctx: ExpeditionContext,
  regionId: RegionId,
  level: number,
  _commandId: string,
): void {
  void _commandId;
  if (!ctx.state.campaign) throw new Error('no campaign');
  if (level < 0 || level > 4) throw new Error('level must be 0-4');
  const progress = ensureRegionProgress(ctx.state.campaign, regionId);
  progress.level = level;
  progress.experience = level * 50;
  progress.bossQuestReady = level >= 4;
}

function cmdDebugForceRegionQuest(
  ctx: ExpeditionContext,
  regionId: RegionId,
  _commandId: string,
): void {
  void _commandId;
  cmdGenerateRegionQuest(ctx, regionId, 'medium', _commandId);
}
