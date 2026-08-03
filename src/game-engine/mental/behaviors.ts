/**
 * 折磨 / 美德 行为触发器(SPEC §7 §8 §9 §10)
 *
 * 提供:
 *   - checkAfflictionBehaviors(ctx, trigger, primaryHeroId, choice?)
 *       遍历折磨行为,roll 概率,执行效果
 *   - checkVirtueBehaviors(ctx, trigger, primaryHeroId)
 *       遍历美德行为,roll 概率,执行效果
 *   - processChoiceMentalChecks(ctx, choice)
 *       choice 提交前的整合(玩家选了 X 之后,先看会不会被折磨拒绝/替换)
 *
 * 概率公式:见 stress-engine.adjustAfflictionChance / adjustVirtueChance
 */

import type { ExpeditionContext } from '../expedition/context.js';
import type {
  GeneratedChoice,
  HeroInstance,
  AfflictionTrigger,
  AfflictionBehaviorDef,
  VirtueBehaviorDef,
} from '../expedition/types.js';
import { getAfflictionDef } from './afflictions.js';
import { getVirtueDef } from './virtues.js';
import { tickBehaviorCooldowns, isBehaviorOnCooldown, setBehaviorCooldown, applyStress as engineApplyStress } from './stress-engine.js';

// =============== 公共入口 ===============

/**
 * 折磨行为触发检定。
 *
 * 返回:触发了多少个行为(给上层写日志/分支)
 */
export function checkAfflictionBehaviors(
  ctx: ExpeditionContext,
  trigger: AfflictionTrigger,
  primaryHeroId: string | undefined,
  choice?: GeneratedChoice,
): { triggered: AfflictionBehaviorDef[]; heroId: string } {
  if (!primaryHeroId) return { triggered: [], heroId: '' };
  const hero = ctx.state.party[primaryHeroId];
  if (!hero || hero.isDead || !hero.afflictionId) return { triggered: [], heroId: primaryHeroId };
  const def = getAfflictionDef(hero.afflictionId);
  if (!def) return { triggered: [], heroId: primaryHeroId };

  const triggered: AfflictionBehaviorDef[] = [];
  for (const beh of def.behaviors) {
    if (beh.trigger !== trigger) continue;
    if (isBehaviorOnCooldown(hero, beh.id)) continue;
    const chance = computeAfflictionChance(beh, hero, ctx, choice);
    if (ctx.chance(chance)) {
      triggered.push(beh);
      setBehaviorCooldown(hero, beh.id, beh.cooldownDecisions ?? 1);
      applyAfflictionBehavior(ctx, hero, beh, choice);
    }
  }
  return { triggered, heroId: primaryHeroId };
}

/**
 * 美德行为触发检定。
 */
export function checkVirtueBehaviors(
  ctx: ExpeditionContext,
  trigger: AfflictionTrigger | 'on-stress-spike' | 'on-ally-at-deaths-door' | 'on-low-torch' | 'on-choice-failed',
  primaryHeroId: string | undefined,
): { triggered: VirtueBehaviorDef[]; heroId: string } {
  if (!primaryHeroId) return { triggered: [], heroId: '' };
  const hero = ctx.state.party[primaryHeroId];
  if (!hero || hero.isDead || !hero.virtueId) return { triggered: [], heroId: primaryHeroId };
  const def = getVirtueDef(hero.virtueId);
  if (!def) return { triggered: [], heroId: primaryHeroId };

  const triggered: VirtueBehaviorDef[] = [];
  for (const beh of def.behaviors) {
    if (beh.trigger !== trigger) continue;
    if (isBehaviorOnCooldown(hero, beh.id)) continue;
    const chance = computeVirtueChance(beh, hero, ctx);
    if (ctx.chance(chance)) {
      triggered.push(beh);
      setBehaviorCooldown(hero, beh.id, beh.cooldownDecisions ?? 1);
      applyVirtueBehavior(ctx, hero, beh, trigger);
    }
  }
  return { triggered, heroId: primaryHeroId };
}

/**
 * choice 提交前/后的整合:
 *  - 折磨 pre-choice:可能拒绝(rejected)
 *  - 折磨 before-choice-confirm:replace-choice
 *  - 美德 pre-choice:不阻塞
 *  - 美德 after-choice-selected:鼓舞等
 */
export interface ChoiceMentalResult {
  /** 原始选择是否被拒绝(需要重新生成) */
  refused: boolean;
  /** 替换后的 choiceId(可能等于原 id) */
  resolvedChoiceId: string;
  /** 替换原因(对玩家可见) */
  reason: string;
}

export function processChoiceMentalChecks(
  ctx: ExpeditionContext,
  decisionId: string,
  choice: GeneratedChoice,
): ChoiceMentalResult {
  const primaryHeroId = choice.primaryHeroId;
  // 收集所有应该触发的 pre-choice trigger
  const triggersToCheck: AfflictionTrigger[] = ['before-choice-confirm'];
  if (choice.tags.includes('healing') || choice.tags.includes('heal')) {
    triggersToCheck.push('on-healing-choice');
  }
  if (choice.tags.includes('retreat')) {
    triggersToCheck.push('on-retreat-choice');
  }
  if (choice.tags.includes('route')) {
    triggersToCheck.push('on-route-choice');
  }
  if (choice.tags.includes('curio')) {
    triggersToCheck.push('on-curio-choice');
  }
  if (choice.tags.some((t) => t.startsWith('use-item') || t === 'consume')) {
    triggersToCheck.push('on-resource-use');
  }
  // 合并所有触发
  const allTriggered: AfflictionBehaviorDef[] = [];
  for (const trig of triggersToCheck) {
    const r = checkAfflictionBehaviors(ctx, trig, primaryHeroId, choice);
    allTriggered.push(...r.triggered);
  }
  const pre = { triggered: allTriggered, heroId: primaryHeroId ?? '' };

  // 找 refuse-choice / replace-choice
  const refused = pre.triggered.find((b) => b.effect === 'refuse-choice');
  if (refused) {
    ctx.emit('AFFLICTION_CHOICE_REFUSED', {
      heroId: primaryHeroId!,
      afflictionId: ctx.state.party[primaryHeroId!]?.afflictionId ?? '',
      originalChoiceId: choice.id,
      reason: refused.narrativeHint.replace('{target}', ctx.state.party[primaryHeroId!]?.name ?? ''),
    });
    return { refused: true, resolvedChoiceId: choice.id, reason: refused.narrativeHint };
  }
  const replaced = pre.triggered.find((b) => b.effect === 'replace-choice');
  if (replaced) {
    const replacement = pickAlternativeChoice(ctx, decisionId, choice);
    if (replacement && replacement.id !== choice.id) {
      ctx.emit('AFFLICTION_CHOICE_REPLACED', {
        heroId: primaryHeroId!,
        afflictionId: ctx.state.party[primaryHeroId!]?.afflictionId ?? '',
        originalChoiceId: choice.id,
        newChoiceId: replacement.id,
        reason: replaced.narrativeHint.replace('{target}', ctx.state.party[primaryHeroId!]?.name ?? ''),
      });
      return { refused: false, resolvedChoiceId: replacement.id, reason: replaced.narrativeHint };
    }
  }

  // replace-primary-actor:替换主要执行者(返回原 choiceId 但更新 primaryActor)
  const actorReplaced = pre.triggered.find((b) => b.effect === 'replace-primary-actor');
  if (actorReplaced) {
    const newActor = pickAlternativePrimaryActor(ctx, primaryHeroId);
    if (newActor) {
      choice.primaryHeroId = newActor;
    }
  }
  // 美德 on-low-torch 之类(如果有 pre-choice trigger)
  checkVirtueBehaviors(ctx, 'on-low-torch', primaryHeroId);

  return { refused: false, resolvedChoiceId: choice.id, reason: '' };
}

/**
 * 一次 choice 整体结算完成后,扫一遍所有英雄看是否有 after-choice 行为触发。
 * 包括:after-choice-selected(美德鼓舞),after-ally-damaged(美德/折磨)等。
 */
export function processPostChoiceMental(
  ctx: ExpeditionContext,
  choice: GeneratedChoice,
  results: { primaryActorDamaged: boolean; allyDamagedIds: string[]; allyDeaths: string[] },
): void {
  // tick 全部英雄的冷却(每个 choice 算 1 决策)
  for (const hero of Object.values(ctx.state.party)) {
    tickBehaviorCooldowns(hero);
  }

  // 1. after-choice-selected 美德
  for (const hero of Object.values(ctx.state.party)) {
    if (hero.isDead || !hero.virtueId) continue;
    checkVirtueBehaviors(ctx, 'after-choice-selected', hero.id);
  }
  // 2. on-ally-at-deaths-door 美德(勇猛掩护)
  const deathDoorHeroes = Object.values(ctx.state.party).filter((h) => h.atDeathsDoor && !h.isDead);
  if (deathDoorHeroes.length > 0) {
    for (const hero of Object.values(ctx.state.party)) {
      if (hero.isDead || !hero.virtueId) continue;
      checkVirtueBehaviors(ctx, 'on-ally-at-deaths-door', hero.id);
    }
  }
  // 3. after-ally-damaged 折磨(对主受击者)
  if (results.primaryActorDamaged && choice.primaryHeroId) {
    checkAfflictionBehaviors(ctx, 'after-hero-damaged', choice.primaryHeroId);
  }
  for (const allyId of results.allyDamagedIds) {
    checkAfflictionBehaviors(ctx, 'after-ally-damaged', allyId);
  }
  // 4. after-ally-death 折磨
  for (const _deadId of results.allyDeaths) {
    for (const hero of Object.values(ctx.state.party)) {
      if (hero.isDead) continue;
      checkAfflictionBehaviors(ctx, 'after-ally-death', hero.id);
    }
  }
}

// =============== 概率计算 ===============

function computeAfflictionChance(
  def: AfflictionBehaviorDef,
  hero: HeroInstance,
  ctx: ExpeditionContext,
  choice?: GeneratedChoice,
): number {
  let chance = def.baseChance;
  if (def.stressModifier) chance += def.stressModifier * hero.stress;
  if (def.torchModifier) chance += def.torchModifier * ctx.state.expedition.torch;
  if (def.hpModifier) {
    const lossPct = hero.maxHp > 0 ? 1 - hero.hp / hero.maxHp : 1;
    chance += def.hpModifier * lossPct * 100;
  }
  // 选择标签冲突:如果 choice 有 matching tag,概率 +0.15
  if (choice && choice.tags.length > 0) {
    const matches = matchTags(choice.tags, TAGS_THAT_TRIGGER_AFFLICTION);
    if (matches > 0) chance += 0.15 * matches;
  }
  if (chance < 0) chance = 0;
  if (chance > 0.95) chance = 0.95;
  return chance;
}

function computeVirtueChance(
  def: VirtueBehaviorDef,
  hero: HeroInstance,
  ctx: ExpeditionContext,
): number {
  let chance = def.baseChance;
  if (ctx.state.expedition.torch >= 76) chance += 0.1;
  if (ctx.state.expedition.torch < 26) chance -= 0.1;
  if (hero.stress < 50) chance += 0.1;
  if (hero.stress > 100) chance -= 0.1;
  if (chance < 0) chance = 0;
  if (chance > 0.95) chance = 0.95;
  return chance;
}

const TAGS_THAT_TRIGGER_AFFLICTION = new Set([
  'healing', 'heal', 'scout', 'route', 'retreat', 'tactical_assault', 'tactical_backline', 'use-item',
]);

function matchTags(choiceTags: string[], dict: Set<string>): number {
  let n = 0;
  for (const t of choiceTags) {
    if (dict.has(t)) n += 1;
  }
  return n;
}

// =============== 折磨行为应用 ===============

function applyAfflictionBehavior(
  ctx: ExpeditionContext,
  hero: HeroInstance,
  def: AfflictionBehaviorDef,
  _choice?: GeneratedChoice,
): void {
  const narrative = def.narrativeHint.replace('{target}', hero.name);
  ctx.emit('AFFLICTION_BEHAVIOR_TRIGGERED', {
    heroId: hero.id,
    afflictionId: hero.afflictionId ?? '',
    behaviorId: def.id,
    effect: def.effect,
    narrative,
  });

  switch (def.effect) {
    case 'refuse-choice':
      // 已经在外层处理:被 processChoiceMentalChecks 拦截
      return;
    case 'replace-choice':
      // 已经在外层处理
      return;
    case 'replace-primary-actor':
      // 已经在外层处理
      return;
    case 'add-party-stress': {
      const alive = Object.values(ctx.state.party).filter((h) => !h.isDead);
      for (const ally of alive) {
        engineApplyStress(ctx, { type: 'apply-stress', heroId: ally.id, amount: 4, source: `affliction:${def.id}` });
      }
      return;
    }
    case 'add-self-stress': {
      engineApplyStress(ctx, { type: 'apply-stress', heroId: hero.id, amount: 6, source: `affliction:${def.id}` });
      return;
    }
    case 'move-self': {
      // 找一个未被占用的 rank(死亡之门英雄或死英雄的 rank 视为"被占")
      const alive = Object.values(ctx.state.party).filter((h) => !h.isDead);
      const usedRanks = new Set(alive.map((h) => h.rank));
      const freeRanks: HeroInstance['rank'][] = [1, 2, 3, 4].filter((r) => !usedRanks.has(r as HeroInstance['rank'])) as HeroInstance['rank'][];
      if (freeRanks.length === 0) return; // 都满了,不动
      const newRank = freeRanks[ctx.nextInt(0, freeRanks.length - 1)]!;
      const oldRank = hero.rank;
      hero.rank = newRank;
      ctx.emit('HERO_RANK_CHANGED', { heroId: hero.id, from: oldRank, to: newRank, reason: `affliction:${def.id}` });
      return;
    }
    case 'consume-item': {
      // 拿一个非 0 物品
      const inv = ctx.state.inventory;
      for (const stack of inv.stacks) {
        if (stack.count > 0) {
          ctx.addItem(stack.itemId, -1, `affliction:${def.id}`);
          break;
        }
      }
      return;
    }
    case 'force-curio-interaction': {
      ctx.state.expedition.flags['forced-curio'] = true;
      return;
    }
    case 'block-retreat': {
      ctx.state.expedition.flags['retreat-blocked'] = true;
      return;
    }
    case 'skip-action': {
      ctx.state.expedition.flags[`skip-action-${hero.id}`] = true;
      return;
    }
    case 'change-route': {
      ctx.state.expedition.flags['route-changed-by-affliction'] = true;
      return;
    }
  }
}

// =============== 美德行为应用 ===============

function applyVirtueBehavior(
  ctx: ExpeditionContext,
  hero: HeroInstance,
  def: VirtueBehaviorDef,
  trigger: string,
): void {
  const narrative = def.narrativeHint.replace('{target}', hero.name);
  ctx.emit('VIRTUE_BEHAVIOR_TRIGGERED', {
    heroId: hero.id,
    virtueId: hero.virtueId ?? '',
    behaviorId: def.id,
    effect: def.effect,
    narrative,
  });

  switch (def.effect) {
    case 'inspire-ally': {
      const alive = Object.values(ctx.state.party).filter((h) => !h.isDead);
      for (const ally of alive) {
        engineApplyStress(ctx, { type: 'apply-stress', heroId: ally.id, amount: -5, source: `virtue:${def.id}` });
      }
      return;
    }
    case 'shield-ally': {
      // 标记:本次遭遇对死亡之门英雄的伤害 -50%
      ctx.state.expedition.flags[`shield-${hero.id}`] = true;
      return;
    }
    case 'detect-extra': {
      ctx.state.expedition.flags['extra-curio-detected'] = true;
      return;
    }
    case 'reduce-penalty': {
      ctx.state.expedition.flags['penalty-reduced'] = true;
      return;
    }
    case 'unlock-special-choice': {
      ctx.state.expedition.flags['all-in-unlocked'] = true;
      return;
    }
    case 'guarantee-success': {
      ctx.state.expedition.flags['route-locked'] = true;
      return;
    }
    case 'lower-stress-pulse': {
      const alive = Object.values(ctx.state.party).filter((h) => !h.isDead);
      for (const ally of alive) {
        engineApplyStress(ctx, { type: 'apply-stress', heroId: ally.id, amount: -3, source: `virtue:${def.id}` });
      }
      return;
    }
  }
  // 抑制 unused trigger 警告
  void trigger;
}

// =============== Helpers ===============

function pickAlternativeChoice(
  ctx: ExpeditionContext,
  decisionId: string,
  original: GeneratedChoice,
): GeneratedChoice | null {
  const decision = ctx.state.pendingDecision;
  if (!decision || decision.id !== decisionId) return null;
  for (const c of decision.generatedChoices) {
    if (c.id !== original.id && c.enabled) return c;
  }
  return null;
}

function pickAlternativePrimaryActor(ctx: ExpeditionContext, excludeHeroId: string | undefined): string | null {
  const alive = Object.values(ctx.state.party).filter((h) => !h.isDead && h.id !== excludeHeroId);
  if (alive.length === 0) return null;
  return alive[ctx.nextInt(0, alive.length - 1)]!.id;
}
