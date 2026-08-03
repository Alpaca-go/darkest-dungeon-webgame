/**
 * 选择生成器(SPEC §24)
 *
 * 输入:ChoiceGenerationContext (state + expedition + node + party + inventory + encounter)
 * 输出:2-4 个 GeneratedChoice
 *
 * 流程(SPEC §24.1):
 *   1. 收集候选
 *   2. 过滤条件
 *   3. 注入职业方案
 *   4. 注入补给方案
 *   5. 注入撤退方案
 *   6. 排序
 *   7. 输出
 */

import { ExpeditionContext, countItem } from './context.js';
import { evalCondition } from './rule-engine.js';
import { STANDARD_TACTICAL_CHOICE_IDS, getEventDef } from '../../content/events.js';
import { getEncounterDef } from '../../content/encounters.js';
import type {
  DecisionType,
  GeneratedChoice,
  PendingDecision,
  RouteEdge,
  ForkOption,
  CostPreview,
  RiskPreview,
  RiskLevel,
  ScoutLevel,
  MentalRiskPreview,
  ObedienceRiskPreview,
  DeathRiskPreview,
  HeroInstance,
} from './types.js';

let decisionCounter = 0;
function nextDecisionId(): string {
  decisionCounter += 1;
  return `dec_${Date.now().toString(36)}_${decisionCounter.toString(36)}`;
}

const RISK_LABEL: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中等风险',
  high: '高风险',
  extreme: '极高风险',
  unknown: '未知风险',
};

const REWARD_LABEL: Record<string, string> = {
  low: '低收益',
  medium: '中等收益',
  high: '高收益',
  extreme: '极高收益',
  stable: '稳定收益',
  delayed: '延迟收益',
  unknown: '未知结果',
};

/** 给一个 source event 创建一个 GeneratedChoice */
function eventChoiceToGenerated(
  decisionId: string,
  eventId: string,
  choice: import('./types.js').EventChoiceDef,
): GeneratedChoice {
  const visibleCosts: CostPreview[] = (choice.costs ?? []).map((c) => ruleEffectToCost(c));
  const visibleRisks: RiskPreview[] = (choice.riskPreview ?? []).map((r) => ({ ...r }));
  return {
    id: `${decisionId}::${eventId}::${choice.id}`,
    sourceDefinitionId: choice.id,
    title: choice.title,
    description: choice.description,
    enabled: true,
    visibleCosts,
    visibleRisks,
    tags: [eventId, 'event-choice'],
    reason: `event:${eventId} choice:${choice.id}`,
  };
}

function ruleEffectToCost(effect: import('./types.js').RuleEffect): CostPreview {
  const desc = effect.narrativeHint ?? `${effect.kind}`;
  switch (effect.kind) {
    case 'torch-delta':
      return { kind: 'torch', amount: effect.amount, description: `火把 ${(effect.amount ?? 0) > 0 ? '+' : ''}${effect.amount}` };
    case 'food-delta':
      return { kind: 'food', amount: effect.amount, description: `食物 ${(effect.amount ?? 0) > 0 ? '+' : ''}${effect.amount}` };
    case 'time-delta':
    case 'consume-time':
    case 'advance-time':
      return { kind: 'time', amount: effect.amount, description: `时间 ${(effect.amount ?? 0) > 0 ? '+' : ''}${effect.amount}` };
    case 'hp-delta':
      return { kind: 'hp', amount: effect.amount, description: `HP ${(effect.amount ?? 0) > 0 ? '+' : ''}${effect.amount}` };
    case 'take-item':
    case 'give-item':
    case 'item-delta':
      return {
        kind: 'item',
        amount: effect.count ?? effect.amount,
        itemId: effect.itemId,
        description: `${effect.itemId} ${(effect.count ?? effect.amount ?? 0) > 0 ? '+' : ''}${effect.count ?? effect.amount ?? 0}`,
      };
    default:
      return { kind: 'flag', description: desc };
  }
}

function routeEdgeToChoice(
  ctx: ExpeditionContext,
  decisionId: string,
  edge: RouteEdge,
  forkOption: ForkOption | undefined,
): GeneratedChoice {
  const torchAtTarget = ctx.state.expedition.torch - edge.baseTorchCost;
  const risk: RiskLevel = edge.riskTag;
  const tags: string[] = ['route', `risk:${risk}`];
  if (edge.isHighReward) tags.push('high-reward');
  return {
    id: `${decisionId}::route::${edge.id}`,
    sourceDefinitionId: edge.id,
    title: forkOption?.title ?? edge.description,
    description: forkOption?.description ?? edge.description,
    enabled: true,
    visibleCosts: [
      { kind: 'time', amount: edge.timeCost, description: `时间 +${edge.timeCost}` },
      { kind: 'torch', amount: -edge.baseTorchCost, description: `火把 -${edge.baseTorchCost}(剩余 ${torchAtTarget})` },
    ],
    visibleRisks: [
      { kind: edge.riskTag === 'low' ? 'lost-time' : edge.riskTag === 'high' ? 'trap' : 'ambush', severity: risk, description: `该路线:${RISK_LABEL[risk]}` },
    ],
    tags,
    reason: `edge:${edge.id}`,
  };
}

function encounterChoiceToGenerated(
  decisionId: string,
  eventId: string,
  choice: import('./types.js').EventChoiceDef,
  primaryHeroId?: string,
): GeneratedChoice {
  const visibleCosts: CostPreview[] = (choice.costs ?? []).map((c) => ruleEffectToCost(c));
  const visibleRisks: RiskPreview[] = (choice.riskPreview ?? []).map((r) => ({ ...r }));
  return {
    id: `${decisionId}::${eventId}::${choice.id}`,
    sourceDefinitionId: choice.id,
    title: choice.title,
    description: choice.description,
    primaryHeroId,
    enabled: true,
    visibleCosts,
    visibleRisks,
    tags: [eventId, 'encounter-choice', choice.id],
    reason: `tactical:${choice.id}`,
  };
}

// =============== Phase 2 风险预览 ===============

/** 给一个 choice 计算精神 / 服从 / 死亡风险预览 */
export function computeChoiceRiskPreviews(
  ctx: ExpeditionContext,
  primaryHeroId: string | undefined,
  tags: string[],
): { mentalRisk?: MentalRiskPreview; obedienceRisk?: ObedienceRiskPreview; deathRisk?: DeathRiskPreview } {
  if (!primaryHeroId) return {};
  const hero = ctx.state.party[primaryHeroId];
  if (!hero || hero.isDead) return {};

  const out: { mentalRisk?: MentalRiskPreview; obedienceRisk?: ObedienceRiskPreview; deathRisk?: DeathRiskPreview } = {};

  // 精神风险:根据 hero stress / torch / 选择标签
  if (hero.stress >= 100) {
    out.mentalRisk = { level: 'may-resolve-check', heroId: hero.id, description: '精神临界,可能进入折磨或美德' };
  } else if (hero.stress >= 75) {
    out.mentalRisk = { level: 'high-stress', heroId: hero.id, description: '精神高度紧张' };
  } else if (hero.stress >= 40) {
    out.mentalRisk = { level: 'may-stress', heroId: hero.id, description: '可能产生压力' };
  } else {
    out.mentalRisk = { level: 'stable', heroId: hero.id, description: '精神稳定' };
  }

  // 服从风险:折磨
  if (hero.afflictionId) {
    const conflict = hasAfflictionConflict(hero, tags);
    if (conflict) {
      out.obedienceRisk = {
        level: 'conflicts',
        heroId: hero.id,
        afflictionId: hero.afflictionId,
        description: `当前折磨(${hero.afflictionId})与该选择冲突`,
      };
    } else {
      out.obedienceRisk = {
        level: 'may-replace',
        heroId: hero.id,
        afflictionId: hero.afflictionId,
        description: '折磨英雄可能替换或拒绝',
      };
    }
  } else {
    out.obedienceRisk = { level: 'stable', heroId: hero.id, description: '精神稳定,会服从' };
  }

  // 死亡风险
  if (hero.atDeathsDoor) {
    out.deathRisk = {
      level: 'door-may-deathblow',
      heroId: hero.id,
      description: '该英雄处于死亡之门,任何伤害都可能致死',
    };
  } else if (hero.hp > 0 && hero.hp < hero.maxHp * 0.25) {
    out.deathRisk = {
      level: 'may-entered-door',
      heroId: hero.id,
      description: '该英雄生命垂危,可能进入死亡之门',
    };
  } else {
    out.deathRisk = { level: 'safe', heroId: hero.id, description: '安全' };
  }
  return out;
}

function hasAfflictionConflict(hero: HeroInstance, tags: string[]): boolean {
  // 简化:不同折磨与不同 tag 冲突
  if (tags.includes('healing') || tags.includes('heal')) {
    if (hero.afflictionId === 'affliction_paranoia') return true;
    if (hero.afflictionId === 'affliction_masochism') return true;
  }
  if (tags.includes('route') && hero.afflictionId === 'affliction_fear') return true;
  if (tags.includes('retreat') && hero.afflictionId === 'affliction_masochism') return true;
  return false;
}

/** 给一个 encounters 注入死亡之门紧急选择 */
export function injectEmergencyChoices(ctx: ExpeditionContext, choices: GeneratedChoice[]): GeneratedChoice[] {
  const deathsDoor = Object.values(ctx.state.party).filter((h) => h.atDeathsDoor && !h.isDead);
  if (deathsDoor.length === 0) return choices;
  const out: GeneratedChoice[] = [...choices];
  for (const hero of deathsDoor) {
    out.unshift({
      id: `emergency-care-${hero.id}`,
      sourceDefinitionId: 'emergency.care',
      title: `紧急救治 ${hero.name}`,
      description: `${hero.name} 已倒下。任何治疗都可能被敌方打断。`,
      enabled: true,
      primaryHeroId: hero.id,
      visibleCosts: [],
      visibleRisks: [{ kind: 'enemy-react', severity: 'high', description: '敌人获得较完整行动' }],
      tags: ['emergency', 'care', `hero:${hero.id}`],
      reason: `deaths-door:${hero.id}`,
    });
    out.unshift({
      id: `emergency-cover-${hero.id}`,
      sourceDefinitionId: 'emergency.cover',
      title: `掩护 ${hero.name}`,
      description: '有人会吸引火力,降低伤员被攻击概率。',
      enabled: true,
      primaryHeroId: hero.id,
      visibleCosts: [],
      visibleRisks: [{ kind: 'injury', severity: 'high', description: '掩护者承受更多风险' }],
      tags: ['emergency', 'cover', `hero:${hero.id}`],
      reason: `deaths-door:${hero.id}`,
    });
  }
  return out;
}

// =============== 公共入口 ===============

/** 给定 GameState 和当前节点,生成 PendingDecision */
export function generateDecision(ctx: ExpeditionContext, type: DecisionType, contextId: string): PendingDecision {
  switch (type) {
    case 'route':
      return generateRouteChoice(ctx, contextId);
    case 'travel':
      return generateTravelChoice(ctx, contextId);
    case 'event':
      return generateEventChoice(ctx, contextId);
    case 'encounter':
      return generateEncounterChoice(ctx, contextId);
    case 'inventory':
      return generateInventoryChoice(ctx, contextId);
    case 'retreat':
      return generateRetreatChoice(ctx, contextId);
  }
}

function baseDecision(type: DecisionType, contextId: string, choices: GeneratedChoice[]): PendingDecision {
  return {
    id: nextDecisionId(),
    type,
    contextId,
    generatedChoices: choices,
    selectedChoiceId: null,
    transactionId: null,
    createdAtStepId: `step_${Date.now().toString(36)}`,
  };
}

function limitAndSort(choices: GeneratedChoice[]): GeneratedChoice[] {
  // 排序: 标准在前, 注入的次之, 撤退放最后
  const rank = (c: GeneratedChoice): number => {
    if (c.tags.includes('retreat')) return 100;
    if (c.tags.includes('tactical') || c.tags.includes('encounter-choice')) return 10;
    if (c.tags.includes('inventory-decision')) return 5;
    if (c.tags.includes('event-choice')) return 1;
    return 0;
  };
  const sorted = [...choices].sort((a, b) => rank(a) - rank(b));
  // 截断到 2-4
  if (sorted.length < 2) {
    // 不足 2: 不截断,允许少(2 是最小)
    return sorted;
  }
  if (sorted.length > 4) return sorted.slice(0, 4);
  return sorted;
}

// =============== Route Choice ===============

function generateRouteChoice(ctx: ExpeditionContext, forkId: string): PendingDecision {
  const node = ctx.state.expedition.route.nodes[ctx.state.expedition.currentNodeId];
  if (!node) return baseDecision('route', forkId, []);

  const fork = ctx.state.expedition.route.forks.find((f) => f.id === forkId);
  if (!fork) return baseDecision('route', forkId, []);

  const choices: GeneratedChoice[] = [];
  for (const opt of fork.options) {
    const edge = ctx.state.expedition.route.edges.find((e) => e.id === opt.edgeId);
    if (!edge) continue;
    // 检查侦察
    const scoutOrder: ScoutLevel[] = ['unknown', 'vague', 'category-known', 'fully-scouted'];
    const cur = scoutOrder.indexOf(ctx.state.expedition.scoutLevel);
    const need = scoutOrder.indexOf(edge.revealLevel);
    if (cur < need) continue;

    const gen = routeEdgeToChoice(ctx, fork.id, edge, opt);
    // 隐藏信息:未 fully-scouted 时只显示风险,fully-scouted 显示完整描述
    if (ctx.state.expedition.scoutLevel !== 'fully-scouted') {
      gen.description = `[${RISK_LABEL[opt.riskTag]} / ${REWARD_LABEL[opt.rewardTag] ?? opt.rewardTag}]`;
    }
    // Phase 2 风险预览
    const primary = pickAlivePrimaryActor(ctx);
    if (primary) {
      gen.primaryHeroId = primary;
      const previews = computeChoiceRiskPreviews(ctx, primary, gen.tags);
      if (previews.mentalRisk) gen.mentalRisk = previews.mentalRisk;
      if (previews.obedienceRisk) gen.obedienceRisk = previews.obedienceRisk;
      if (previews.deathRisk) gen.deathRisk = previews.deathRisk;
    }
    choices.push(gen);
  }

  // 注入撤退选项(永远在 route fork 出现)
  choices.push(makeRetreatChoice(fork.id, ctx));

  return baseDecision('route', forkId, limitAndSort(choices));
}

// =============== Travel Choice ===============

/** 进入一个新节点前,先询问行进方式(只对部分节点提供) */
function generateTravelChoice(ctx: ExpeditionContext, _edgeId: string): PendingDecision {
  const choices: GeneratedChoice[] = [
    {
      id: `travel::normal`,
      sourceDefinitionId: 'travel.normal',
      title: '正常前进',
      description: '标准消耗,标准风险。',
      enabled: true,
      visibleCosts: [
        { kind: 'time', amount: 1, description: '时间 +1' },
        { kind: 'torch', amount: -6, description: '火把 -6' },
      ],
      visibleRisks: [],
      tags: ['travel', 'pace:normal'],
      reason: 'travel:normal',
    },
    {
      id: `travel::careful`,
      sourceDefinitionId: 'travel.careful',
      title: '谨慎前进',
      description: '时间增加,火把消耗增加,但陷阱发现率提高、伏击率降低。',
      enabled: ctx.state.expedition.torch >= 10,
      disabledReason: '火把不足 10。',
      visibleCosts: [
        { kind: 'time', amount: 2, description: '时间 +2' },
        { kind: 'torch', amount: -10, description: '火把 -10' },
      ],
      visibleRisks: [{ kind: 'lost-time', severity: 'low', description: '消耗更多时间' }],
      tags: ['travel', 'pace:careful'],
      reason: 'travel:careful',
    },
    {
      id: `travel::rush`,
      sourceDefinitionId: 'travel.rush',
      title: '快速推进',
      description: '火把消耗较低,但陷阱与伏击率提高。',
      enabled: ctx.state.expedition.torch >= 6,
      disabledReason: '火把不足 6。',
      visibleCosts: [
        { kind: 'time', amount: 1, description: '时间 +1' },
        { kind: 'torch', amount: -3, description: '火把 -3' },
      ],
      visibleRisks: [
        { kind: 'trap', severity: 'medium', description: '陷阱风险提高' },
        { kind: 'ambush', severity: 'medium', description: '伏击风险提高' },
      ],
      tags: ['travel', 'pace:rush'],
      reason: 'travel:rush',
    },
  ];
  return baseDecision('travel', 'travel', limitAndSort(choices));
}

// =============== Event Choice ===============

function generateEventChoice(ctx: ExpeditionContext, eventId: string): PendingDecision {
  const def = getEventDef(eventId);
  if (!def) return baseDecision('event', eventId, []);
  // 触发过的 oncePerExpedition
  if (def.oncePerExpedition && ctx.state.expedition.firedEventIds.includes(eventId)) {
    return baseDecision('event', eventId, []);
  }
  const choices: GeneratedChoice[] = def.choices.map((c) => {
    const gen = eventChoiceToGenerated(eventId, eventId, c);
    // 评估条件:disabled + 原因
    const ok = (c.conditions ?? []).every((cond) => evalCondition(ctx, cond));
    if (!ok) {
      gen.enabled = false;
      gen.disabledReason = '不满足条件';
    }
    // Phase 2 风险预览:事件选择用最低 HP 英雄作主代理
    const primary = Object.values(ctx.state.party)
      .filter((h) => !h.isDead)
      .sort((a, b) => a.hp - b.hp)[0]?.id;
    if (primary) {
      const previews = computeChoiceRiskPreviews(ctx, primary, gen.tags);
      if (previews.mentalRisk) gen.mentalRisk = previews.mentalRisk;
      if (previews.obedienceRisk) gen.obedienceRisk = previews.obedienceRisk;
      if (previews.deathRisk) gen.deathRisk = previews.deathRisk;
      gen.primaryHeroId = primary;
    }
    return gen;
  });
  return baseDecision('event', eventId, limitAndSort(choices));
}

// =============== Encounter Choice ===============

function generateEncounterChoice(ctx: ExpeditionContext, encounterId: string): PendingDecision {
  const enc = ctx.state.encounter;
  if (!enc) return baseDecision('encounter', encounterId, []);
  const def = getEncounterDef(enc.encounterDefId);
  if (!def) return baseDecision('encounter', encounterId, []);

  const allTacticalIds = [...STANDARD_TACTICAL_CHOICE_IDS];
  // 条件性注入
  if (ctx.state.expedition.flags['formation-broken']) {
    allTacticalIds.push('tactical_reform');
  }
  if (countItem(ctx.state.inventory, 'bandage') > 0 || countItem(ctx.state.inventory, 'antivenom') > 0) {
    allTacticalIds.push('tactical_use_item');
  }
  allTacticalIds.push('tactical_retreat');

  const choices: GeneratedChoice[] = [];
  for (const id of allTacticalIds) {
    const ev = getEventDef(id);
    if (!ev) continue;
    for (const c of ev.choices) {
      // Phase 2:选择主要执行者(选 alive,非 deaths door 的最高 rank 英雄)
      const primary = pickAlivePrimaryActor(ctx);
      const gen = encounterChoiceToGenerated(encounterId, id, c, primary);
      // 检查条件
      const ok = (c.conditions ?? []).every((cond) => evalCondition(ctx, cond));
      if (!ok) {
        gen.enabled = false;
        gen.disabledReason = '不满足条件';
      }
      // Phase 2 风险预览
      const previews = computeChoiceRiskPreviews(ctx, primary, gen.tags);
      if (previews.mentalRisk) gen.mentalRisk = previews.mentalRisk;
      if (previews.obedienceRisk) gen.obedienceRisk = previews.obedienceRisk;
      if (previews.deathRisk) gen.deathRisk = previews.deathRisk;
      choices.push(gen);
    }
  }

  // Phase 2:注入死亡之门紧急选择
  const withEmergency = injectEmergencyChoices(ctx, choices);

  return baseDecision('encounter', encounterId, limitAndSort(withEmergency));
}

/** 选一个还活着的、不是死亡之门的最高 rank 英雄作为主要执行者 */
function pickAlivePrimaryActor(ctx: ExpeditionContext): string | undefined {
  const alive = Object.values(ctx.state.party)
    .filter((h) => !h.isDead && !h.atDeathsDoor)
    .sort((a, b) => a.rank - b.rank);
  if (alive.length === 0) {
    // 退而求其次:含死亡之门英雄
    const any = Object.values(ctx.state.party).filter((h) => !h.isDead);
    return any[0]?.id;
  }
  return alive[0]?.id;
}

// =============== Inventory Choice ===============

function generateInventoryChoice(ctx: ExpeditionContext, reason: string): PendingDecision {
  // 简化:背包满时让玩家丢东西
  const inv = ctx.state.inventory;
  const choices: GeneratedChoice[] = [];
  if (inv.stacks.length >= inv.capacity) {
    choices.push({
      id: 'inv.full.drop-lowest',
      sourceDefinitionId: 'inv.drop',
      title: '丢弃最不重要的物品',
      description: '自动丢弃最不重要的物品腾出空间。',
      enabled: true,
      visibleCosts: [],
      visibleRisks: [],
      tags: ['inventory-decision'],
      reason: 'inv:full',
    });
  }
  if (ctx.hasItem('bandage')) {
    choices.push({
      id: 'inv.use.bandage',
      sourceDefinitionId: 'inv.use.bandage',
      title: '使用绷带',
      description: '消耗 1 绷带,治疗 20% HP(选英雄)。',
      enabled: true,
      visibleCosts: [{ kind: 'item', itemId: 'bandage', amount: 1, description: '绷带 -1' }],
      visibleRisks: [],
      tags: ['inventory-decision'],
      reason: 'inv:use.bandage',
    });
  }
  if (choices.length === 0) {
    choices.push({
      id: 'inv.noop',
      sourceDefinitionId: 'inv.noop',
      title: '继续前进',
      description: '没有需要处理的物品。',
      enabled: true,
      visibleCosts: [],
      visibleRisks: [],
      tags: ['inventory-decision'],
      reason: 'inv:noop',
    });
  }
  return baseDecision('inventory', reason, limitAndSort(choices));
}

// =============== Retreat Choice ===============

function generateRetreatChoice(_ctx: ExpeditionContext, _reason: string): PendingDecision {
  const choices: GeneratedChoice[] = [
    {
      id: 'retreat.confirm',
      sourceDefinitionId: 'retreat.yes',
      title: '确认撤退',
      description: '返回地表,任务失败但队伍安全。',
      enabled: true,
      visibleCosts: [],
      visibleRisks: [],
      tags: ['retreat'],
      reason: 'retreat:confirm',
    },
    {
      id: 'retreat.cancel',
      sourceDefinitionId: 'retreat.no',
      title: '继续前进',
      description: '不撤退。',
      enabled: true,
      visibleCosts: [],
      visibleRisks: [],
      tags: ['retreat'],
      reason: 'retreat:cancel',
    },
  ];
  return baseDecision('retreat', 'retreat', choices);
}

function makeRetreatChoice(decisionId: string, _ctx: ExpeditionContext): GeneratedChoice {
  return {
    id: `${decisionId}::retreat::cancel`,
    sourceDefinitionId: 'retreat.confirm',
    title: '尝试撤退',
    description: '放弃任务,带着队伍返回地表。',
    enabled: true,
    visibleCosts: [],
    visibleRisks: [{ kind: 'lost-time', severity: 'medium', description: '任务将被放弃' }],
    tags: ['retreat'],
    reason: 'route:retreat-injected',
  };
}
