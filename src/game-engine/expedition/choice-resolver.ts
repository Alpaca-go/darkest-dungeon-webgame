/**
 * 选择解析器(SPEC §29)
 *
 * 给定一个 PendingDecision + selected choice,执行:
 *   1. 校验 choice
 *   2. 支付代价
 *   3. 解析 choice plan / outcome
 *   4. 写 domain event
 *   5. 触发下一轮决策 / 移动到下一节点 / 完成任务 / 失败 / 撤退
 */

import { ExpeditionContext } from './context.js';
import { applyEffect, applyOutcomeTable } from './rule-engine.js';
import { getEventDef } from '../../content/events.js';
import { getEncounterDef } from '../../content/encounters.js';
import { runTacticalRound, syncPartyFromEncounter, startEncounter } from './encounter-resolver.js';
import { generateDecision } from './choice-generator.js';
import type { GeneratedChoice, RouteNode } from './types.js';
import type { DomainEvent as BattleDomainEvent } from '../domain-events.js';

export class ChoiceError extends Error {
  constructor(message: string) {
    super(`[choice] ${message}`);
    this.name = 'ChoiceError';
  }
}

/** 解析选中的 choice */
export function resolveChosen(
  ctx: ExpeditionContext,
  decisionId: string,
  choiceId: string,
): void {
  const decision = ctx.state.pendingDecision;
  if (!decision) throw new ChoiceError('no pending decision');
  if (decision.id !== decisionId) throw new ChoiceError(`decision mismatch ${decisionId} != ${decision.id}`);
  const choice = decision.generatedChoices.find((c) => c.id === choiceId);
  if (!choice) throw new ChoiceError(`choice ${choiceId} not in decision`);
  if (!choice.enabled) throw new ChoiceError(`choice ${choiceId} disabled: ${choice.disabledReason}`);

  // 标记选中
  decision.selectedChoiceId = choiceId;
  ctx.emit('CHOICE_SELECTED', {
    decisionId,
    choiceId,
    sourceDefinitionId: choice.sourceDefinitionId,
  });

  // 派发到具体决策类型的处理
  switch (decision.type) {
    case 'route':
      resolveRouteChoice(ctx, decisionId, choice);
      return;
    case 'travel':
      resolveTravelChoice(ctx, decisionId, choice);
      return;
    case 'event':
      resolveEventChoice(ctx, decisionId, choice);
      return;
    case 'encounter':
      resolveEncounterChoice(ctx, decisionId, choice);
      return;
    case 'inventory':
      resolveInventoryChoice(ctx, decisionId, choice);
      return;
    case 'retreat':
      resolveRetreatChoice(ctx, decisionId, choice);
      return;
  }
}

// =============== Route Choice ===============

function resolveRouteChoice(ctx: ExpeditionContext, _decisionId: string, choice: GeneratedChoice): void {
  // choice.sourceDefinitionId = edge id
  const edgeId = choice.sourceDefinitionId;
  const edge = ctx.state.expedition.route.edges.find((e) => e.id === edgeId);
  if (!edge) throw new ChoiceError(`edge ${edgeId} not found`);

  // 应用 edge 消耗
  ctx.changeTime(edge.timeCost, `route ${edgeId}`);
  ctx.changeTorch(-edge.baseTorchCost, `route ${edgeId}`);

  ctx.emit('ROUTE_SELECTED', {
    edgeId,
    fromNodeId: edge.from,
    toNodeId: edge.to,
    riskTag: edge.riskTag,
  });
  ctx.emit('TRAVEL_COMPLETED', {
    edgeId,
    actualTime: edge.timeCost,
    actualTorch: -edge.baseTorchCost,
    ambushed: false,
    trapTriggered: false,
  });

  // 推进深度
  ctx.state.expedition.depth += 1;
  ctx.state.expedition.stats.deepestNodeReached = Math.max(
    ctx.state.expedition.stats.deepestNodeReached,
    ctx.state.expedition.depth,
  );
  ctx.state.expedition.stats.nodesVisited += 1;
  ctx.state.expedition.stats.torchUsed += edge.baseTorchCost;

  // 记录关键选择
  ctx.state.expedition.keyChoices.push({
    nodeId: ctx.state.expedition.currentNodeId,
    choiceTitle: choice.title,
    risk: edge.riskTag,
  });

  // 移动到目标节点
  moveToNode(ctx, edge.to);
}

// =============== Travel Choice (Pace) ===============

function resolveTravelChoice(ctx: ExpeditionContext, _decisionId: string, choice: GeneratedChoice): void {
  // 简化:travel 的代价已经在 choice 的 visibleCosts 里,这里直接应用
  for (const cost of choice.visibleCosts) {
    if (cost.kind === 'time') ctx.changeTime(cost.amount ?? 0, `pace ${choice.id}`);
    if (cost.kind === 'torch') ctx.changeTorch(cost.amount ?? 0, `pace ${choice.id}`);
  }
  // 直接推进到下一节点(无新选择)
  moveToNode(ctx, ctx.state.expedition.currentNodeId);
  // 重新生成下一个节点的决策
  regenerateDecisionAfterTravel(ctx);
}

// =============== Event Choice ===============

function resolveEventChoice(ctx: ExpeditionContext, _decisionId: string, choice: GeneratedChoice): void {
  // 找到 source event
  // choice.sourceDefinitionId 可能是 "trap.disarm" 之类的,事件 id 在 tags 里
  const eventId = choice.tags.find((t) => t.includes('.'))?.split('::')[1] ?? choice.tags[0];
  if (!eventId) throw new ChoiceError('cannot determine event id from choice');
  const def = getEventDef(eventId);
  if (!def) throw new ChoiceError(`event ${eventId} not found`);

  const eventChoice = def.choices.find((c) => c.id === choice.sourceDefinitionId);
  if (!eventChoice) throw new ChoiceError(`choice ${choice.sourceDefinitionId} not in event ${eventId}`);

  // 触发事件(若没触发)
  if (!ctx.state.expedition.firedEventIds.includes(eventId)) {
    ctx.state.expedition.firedEventIds.push(eventId);
    ctx.emit('EVENT_STARTED', { eventId, nodeId: ctx.state.expedition.currentNodeId, trigger: def.trigger });
  }

  // 支付 costs
  for (const cost of (eventChoice.costs ?? [])) {
    applyEffect(ctx, cost);
  }

  // 抽 outcome
  const outcome = applyOutcomeTable(ctx, eventChoice.outcomeTable);
  ctx.emit('CHOICE_RESOLVED', {
    decisionId: _decisionId,
    choiceId: choice.id,
    outcomes: [{ narrativeHint: outcome.narrativeHint, status: 'success' }],
  });

  // 记录 keyEvents
  ctx.state.expedition.keyEvents.push({
    eventId,
    nodeId: ctx.state.expedition.currentNodeId,
    outcome: outcome.narrativeHint ?? '',
  });

  // 特殊:饥饿/陷阱计数
  if (eventId.startsWith('hunger_')) ctx.state.expedition.stats.hungerCount += 1;
  if (eventId.startsWith('trap_')) ctx.state.expedition.stats.trapCount += 1;
  if (eventId.startsWith('curio_')) ctx.emit('CURIO_INTERACTED', { curioId: eventId, nodeId: ctx.state.expedition.currentNodeId, choiceId: choice.id, outcome: 'mixed' });
  if (eventId.startsWith('obstacle_')) ctx.emit('OBSTACLE_RESOLVED', { obstacleId: eventId, nodeId: ctx.state.expedition.currentNodeId, method: choice.title, cost: 'normal' });

  // 状态机推进
  advanceAfterEvent(ctx, eventId);
}

// =============== Encounter Choice ===============

function resolveEncounterChoice(ctx: ExpeditionContext, _decisionId: string, choice: GeneratedChoice): void {
  if (!ctx.state.encounter) throw new ChoiceError('no active encounter');
  const enc = ctx.state.encounter;
  const def = getEncounterDef(enc.encounterDefId);
  if (!def) throw new ChoiceError(`encounter def not found`);

  // 找 plan:从 tags 里找 tactical_xxx
  const tacticalId = choice.tags.find((t) => t.startsWith('tactical_'));
  if (!tacticalId) throw new ChoiceError('encounter choice must be tactical');
  const ev = getEventDef(tacticalId);
  if (!ev) throw new ChoiceError(`tactical event ${tacticalId} not found`);
  const tacticalChoice = ev.choices.find((c) => c.id === choice.sourceDefinitionId);
  if (!tacticalChoice) throw new ChoiceError(`tactical choice ${choice.sourceDefinitionId} not found`);

  // 支付 costs
  for (const cost of (tacticalChoice.costs ?? [])) {
    applyEffect(ctx, cost);
  }

  // 找 plan(从 tactical event choices 的 first choice 关联)
  const plan = makePlanForTactical(tacticalId);

  // 应用战术方案(跑 1 轮)
  // retreat / use-item 走特殊路径
  let result: { encounter: typeof enc; summary: string[]; victory: boolean; defeat: boolean; newBattleEvents: BattleDomainEvent[] };
  if (plan.planType === 'retreat') {
    // 撤退:概率判定(简化 60% 成功)
    const escaped = ctx.chance(0.6);
    if (escaped) {
      enc.status = 'escaped';
      result = { encounter: enc, summary: ['撤离成功。'], victory: false, defeat: false, newBattleEvents: [] };
    } else {
      // 失败,跑 1 轮
      result = runTacticalRound(ctx.state, enc, { planType: 'assault', maxRounds: 1, parameters: {} });
    }
  } else if (plan.planType === 'use-item') {
    // use-item 已经在 tacticalChoice.costs 里支付了;跑 1 轮但用 assault plan
    result = runTacticalRound(ctx.state, enc, { planType: 'assault', maxRounds: 1, parameters: {} });
  } else {
    result = runTacticalRound(ctx.state, enc, plan);
  }

  // 同步 hero 状态
  syncPartyFromEncounter(ctx.state, enc);
  // 同步 expedition 统计
  ctx.state.expedition.stats.encounterCount += 1;

  // 检查胜败
  if (result.victory) {
    enc.status = 'victory';
    ctx.emit('ENCOUNTER_WON', {
      encounterId: enc.id,
      encounterDefId: enc.encounterDefId,
      rounds: enc.round,
    });
    // 同步 hero 状态(已 syncPartyFromEncounter)
    // 把 encounter 清空,推进到下一节点
    ctx.state.encounter = null;
    ctx.state.expedition.keyEvents.push({
      eventId: enc.encounterDefId,
      nodeId: ctx.state.expedition.currentNodeId,
      outcome: 'victory',
    });
    advanceAfterEncounter(ctx);
    return;
  }
  if (result.defeat) {
    enc.status = 'defeat';
    ctx.emit('ENCOUNTER_ESCAPED', {
      encounterId: enc.id,
      encounterDefId: enc.encounterDefId,
      rounds: enc.round,
    });
    // 同步 hero
    syncPartyFromEncounter(ctx.state, enc);
    ctx.state.encounter = null;
    ctx.state.expedition.keyEvents.push({
      eventId: enc.encounterDefId,
      nodeId: ctx.state.expedition.currentNodeId,
      outcome: 'defeat',
    });
    // 全队阵亡 -> 失败
    const aliveHeroes = Object.values(ctx.state.party).filter((h) => !h.isDead);
    if (aliveHeroes.length === 0) {
      ctx.state.expedition.failed = true;
      ctx.state.expedition.failReason = '队伍全灭';
      ctx.state.mode = 'expedition-failure';
      ctx.emit('EXPEDITION_FAILED', {
        expeditionId: ctx.state.expedition.id,
        reason: '队伍全灭',
        fromNodeId: ctx.state.expedition.currentNodeId,
      });
      return;
    }
    // 还有活人 -> 强制撤退
    ctx.state.expedition.stats.retreatPosition = {
      nodeId: ctx.state.expedition.currentNodeId,
      depth: ctx.state.expedition.depth,
    };
    ctx.state.mode = 'expedition-retreat';
    return;
  }
  // 还在进行中 -> 保留 encounter,生成下一轮决策
  // decision 保留,encounter 状态保留,只需要重新生成 encounter-choice
  // 留给 dispatcher 在 commit 后做
}

function makePlanForTactical(id: string): import('./types.js').TacticalPlan {
  switch (id) {
    case 'tactical_assault':
      return { planType: 'assault', maxRounds: 1, parameters: {} };
    case 'tactical_backline':
      return { planType: 'backline', maxRounds: 1, parameters: {} };
    case 'tactical_control':
      return { planType: 'control', maxRounds: 1, parameters: {} };
    case 'tactical_stabilize':
      return { planType: 'stabilize', maxRounds: 1, parameters: {} };
    case 'tactical_reform':
      return { planType: 'reform', maxRounds: 1, parameters: {} };
    case 'tactical_use_item':
      return { planType: 'use-item', maxRounds: 1, parameters: {} };
    case 'tactical_retreat':
      return { planType: 'retreat', maxRounds: 1, parameters: {} };
  }
  return { planType: 'assault', maxRounds: 1, parameters: {} };
}

// =============== Inventory Choice ===============

function resolveInventoryChoice(ctx: ExpeditionContext, _decisionId: string, choice: GeneratedChoice): void {
  switch (choice.sourceDefinitionId) {
    case 'inv.use.bandage': {
      ctx.addItem('bandage', -1, 'inventory-use');
      // 找最低 HP 英雄
      const heroes = Object.values(ctx.state.party).filter((h) => !h.isDead);
      if (heroes.length > 0) {
        const lowest = heroes.reduce((a, b) => (a.hp <= b.hp ? a : b));
        ctx.changeHeroHp(lowest.id, Math.floor((lowest.maxHp * 20) / 100), 'bandage');
      }
      break;
    }
    case 'inv.drop': {
      // 丢一叠 gold 或 food
      const goldStack = ctx.state.inventory.stacks.find((s) => s.itemId === 'gold');
      if (goldStack) {
        ctx.discardItem(goldStack.id, 1, 'manual');
      } else {
        const foodStack = ctx.state.inventory.stacks.find((s) => s.itemId === 'food');
        if (foodStack) ctx.discardItem(foodStack.id, 1, 'manual');
      }
      break;
    }
    default:
      // noop
      break;
  }
  // 推进到下一节点
  advanceAfterEvent(ctx, '');
}

// =============== Retreat Choice ===============

function resolveRetreatChoice(ctx: ExpeditionContext, _decisionId: string, choice: GeneratedChoice): void {
  if (choice.sourceDefinitionId === 'retreat.yes' || choice.sourceDefinitionId === 'retreat.confirm') {
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
  } else {
    // 不撤退,继续
    advanceAfterEvent(ctx, '');
  }
}

// =============== 状态机推进 ===============

/** 移动到指定节点,触发该节点的决策 */
function moveToNode(ctx: ExpeditionContext, nodeId: string): void {
  const node = ctx.state.expedition.route.nodes[nodeId];
  if (!node) throw new ChoiceError(`node ${nodeId} not found`);
  ctx.state.expedition.currentNodeId = nodeId;
  ctx.state.expedition.scoutLevel = node.baseScoutLevel;
  ctx.emit('NODE_ENTERED', { nodeId, nodeType: node.type, depth: ctx.state.expedition.depth });

  // 根据节点类型生成决策
  switch (node.type) {
    case 'route-fork':
      regenerateForkDecision(ctx, node.forkId!);
      return;
    case 'encounter':
      startEncounterNode(ctx, node);
      return;
    case 'trap':
      regenerateEventDecision(ctx, node.trapId!);
      return;
    case 'curio':
      regenerateEventDecision(ctx, node.curioId!);
      return;
    case 'obstacle':
      regenerateEventDecision(ctx, node.obstacleId!);
      return;
    case 'hunger':
      regenerateEventDecision(ctx, ctx.state.expedition.firedEventIds.length > 0 ? 'hunger_full_meal' : 'hunger_full_meal');
      return;
    case 'objective':
      regenerateEventDecision(ctx, node.objectiveId!);
      return;
    case 'exit':
      onExitNode(ctx);
      return;
    case 'empty-room':
    case 'corridor':
    case 'treasure':
      // 简化:直接 move to next,等下次
      // 但不能让游戏卡住,我们找下一节点继续
      advanceAfterEvent(ctx, '');
      return;
  }
}

function regenerateForkDecision(ctx: ExpeditionContext, forkId: string): void {
  const decision = generateDecision(ctx, 'route', forkId);
  ctx.state.pendingDecision = decision;
  ctx.state.mode = 'route-choice';
}

function regenerateEventDecision(ctx: ExpeditionContext, eventId: string): void {
  const decision = generateDecision(ctx, 'event', eventId);
  ctx.state.pendingDecision = decision;
  ctx.state.mode = 'event-choice';
}

function startEncounterNode(ctx: ExpeditionContext, node: RouteNode): void {
  const def = getEncounterDef(node.encounterDefId!);
  if (!def) throw new ChoiceError(`encounter def ${node.encounterDefId} not found`);
  const enc = startEncounter(ctx.state, def, ctx.state.seed + ':' + node.id);
  enc.status = 'awaiting-choice';
  ctx.state.encounter = enc;
  ctx.emit('ENCOUNTER_STARTED', {
    encounterId: enc.id,
    encounterDefId: enc.encounterDefId,
    nodeId: node.id,
    heroIds: enc.heroActorIds,
    enemyIds: enc.enemyActorIds,
  });
  const decision = generateDecision(ctx, 'encounter', enc.id);
  ctx.state.pendingDecision = decision;
  ctx.state.mode = 'encounter-choice';
}

function onExitNode(ctx: ExpeditionContext): void {
  // 任务是否完成
  if (ctx.state.expedition.objectiveCompleted) {
    ctx.state.mode = 'expedition-success';
    ctx.emit('EXPEDITION_SUCCEEDED', {
      expeditionId: ctx.state.expedition.id,
      objectiveNodeId: ctx.state.expedition.route.objectiveNodeId,
      exitNodeId: ctx.state.expedition.currentNodeId,
    });
  } else {
    // 没完成就走撤退
    ctx.state.expedition.stats.retreatPosition = {
      nodeId: ctx.state.expedition.currentNodeId,
      depth: ctx.state.expedition.depth,
    };
    ctx.state.mode = 'expedition-retreat';
  }
}

function advanceAfterEvent(ctx: ExpeditionContext, _eventId: string): void {
  // 找当前节点的下一个 edge
  const node = ctx.state.expedition.route.nodes[ctx.state.expedition.currentNodeId];
  if (!node) return;
  const nextEdges = ctx.state.expedition.route.edges.filter((e) => e.from === node.id);
  if (nextEdges.length === 0) {
    onExitNode(ctx);
    return;
  }
  // 简化:如果有分叉节点 fork 仍然有效,生成 fork 决策;否则直接选第一个
  // 这里我们直接选第一个 edge 继续(避免死循环)
  const next = nextEdges[0]!;
  ctx.changeTime(next.timeCost, `auto-advance ${next.id}`);
  ctx.changeTorch(-next.baseTorchCost, `auto-advance ${next.id}`);
  ctx.state.expedition.depth += 1;
  ctx.state.expedition.stats.nodesVisited += 1;
  ctx.state.expedition.stats.torchUsed += next.baseTorchCost;
  moveToNode(ctx, next.to);
}

function advanceAfterEncounter(ctx: ExpeditionContext): void {
  const node = ctx.state.expedition.route.nodes[ctx.state.expedition.currentNodeId];
  if (!node) return;
  const nextEdges = ctx.state.expedition.route.edges.filter((e) => e.from === node.id);
  if (nextEdges.length === 0) {
    onExitNode(ctx);
    return;
  }
  const next = nextEdges[0]!;
  ctx.changeTime(next.timeCost, `after-encounter ${next.id}`);
  ctx.changeTorch(-next.baseTorchCost, `after-encounter ${next.id}`);
  ctx.state.expedition.depth += 1;
  ctx.state.expedition.stats.nodesVisited += 1;
  ctx.state.expedition.stats.torchUsed += next.baseTorchCost;
  moveToNode(ctx, next.to);
}

function regenerateDecisionAfterTravel(_ctx: ExpeditionContext): void {
  // 占位:travel 后通常是 route-fork
  // 实际由 moveToNode 触发
}
