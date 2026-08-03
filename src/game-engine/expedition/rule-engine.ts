/**
 * 规则引擎:RuleCondition / RuleEffect 求值
 *
 * 集中实现:
 * - evalCondition(ctx, cond) -> boolean
 * - applyEffect(ctx, effect) -> void(写 ctx.state)
 * - rollOutcome(ctx, outcomes) -> WeightedOutcome
 *
 * 这是 choice-resolver / encounter-resolver / report 共享的工具。
 */

import { ExpeditionContext } from './context.js';
import type { RuleCondition, RuleEffect, WeightedOutcome, RuleEffectKind } from './types.js';
import type { ItemId } from './types.js';
import { countItem, setItemCount } from './context.js';

export function evalCondition(ctx: ExpeditionContext, cond: RuleCondition): boolean {
  switch (cond.kind) {
    case 'and':
      return (cond.conditions ?? []).every((c) => evalCondition(ctx, c));
    case 'or':
      return (cond.conditions ?? []).some((c) => evalCondition(ctx, c));
    case 'not':
      return !(cond.conditions ?? []).every((c) => evalCondition(ctx, c));

    case 'torch-lt':
      return ctx.state.expedition.torch < Number(cond.value);
    case 'torch-gte':
      return ctx.state.expedition.torch >= Number(cond.value);
    case 'torch-eq':
      return ctx.state.expedition.torch === Number(cond.value);

    case 'food-lt': {
      const v = countItem(ctx.state.inventory, 'food');
      return v < Number(cond.value);
    }
    case 'food-gte': {
      const v = countItem(ctx.state.inventory, 'food');
      return v >= Number(cond.value);
    }

    case 'time-lt':
      return ctx.state.expedition.timeElapsed < Number(cond.value);
    case 'time-gte':
      return ctx.state.expedition.timeElapsed >= Number(cond.value);

    case 'has-item':
      return countItem(ctx.state.inventory, cond.itemId as ItemId) >= 1;
    case 'lacks-item':
      return countItem(ctx.state.inventory, cond.itemId as ItemId) === 0;

    case 'tag-has': {
      if (!cond.heroId) return false;
      const hero = ctx.state.party[cond.heroId];
      if (!hero) return false;
      const tags = cond.tags ?? [];
      return tags.every((t) => hero.tags.includes(t));
    }
    case 'all-tags': {
      if (!cond.heroId) return false;
      const hero = ctx.state.party[cond.heroId];
      if (!hero) return false;
      return (cond.tags ?? []).every((t) => hero.tags.includes(t));
    }

    case 'hero-can-act': {
      if (!cond.heroId) return false;
      const hero = ctx.state.party[cond.heroId];
      return !!hero && !hero.isDead && !hero.stun;
    }
    case 'hero-is-dead': {
      if (!cond.heroId) return false;
      const hero = ctx.state.party[cond.heroId];
      return !!hero && hero.isDead;
    }

    case 'flag-eq':
      if (!cond.flagName) return false;
      return ctx.state.expedition.flags[cond.flagName] === cond.flagValue;
    case 'flag-exists':
      if (!cond.flagName) return false;
      return cond.flagName in ctx.state.expedition.flags;
    case 'flag-lt': {
      if (!cond.flagName) return false;
      const v = ctx.state.expedition.flags[cond.flagName];
      return typeof v === 'number' && v < Number(cond.value);
    }
    case 'flag-gte': {
      if (!cond.flagName) return false;
      const v = ctx.state.expedition.flags[cond.flagName];
      return typeof v === 'number' && v >= Number(cond.value);
    }

    case 'scout-gte': {
      const order = ['unknown', 'vague', 'category-known', 'fully-scouted'] as const;
      const cur = order.indexOf(ctx.state.expedition.scoutLevel);
      const need = order.indexOf(String(cond.value) as typeof order[number]);
      return cur >= need && need >= 0;
    }

    case 'in-node': {
      return ctx.state.expedition.currentNodeId === cond.value;
    }
    case 'depth-gte': {
      return ctx.state.expedition.depth >= Number(cond.value);
    }
    case 'depth-eq': {
      return ctx.state.expedition.depth === Number(cond.value);
    }

    case 'formation-broken': {
      // 简化的实现:任何非 1-2-3-4 严格顺序的站位 = 阵型混乱
      const heroes = Object.values(ctx.state.party);
      const ranks = heroes.filter((h) => !h.isDead).map((h) => h.rank).sort();
      for (let i = 0; i < ranks.length; i++) {
        if (ranks[i] !== i + 1) return true;
      }
      return false;
    }

    default:
      return false;
  }
}

export function evalAllConditions(ctx: ExpeditionContext, conds: RuleCondition[]): boolean {
  return conds.every((c) => evalCondition(ctx, c));
}

export function applyEffect(ctx: ExpeditionContext, effect: RuleEffect): void {
  const kind: RuleEffectKind = effect.kind;
  const amount = effect.amount ?? 0;
  switch (kind) {
    case 'torch-delta':
      ctx.changeTorch(amount, effect.narrativeHint ?? 'rule');
      return;
    case 'food-delta':
      ctx.changeFood(amount, effect.narrativeHint ?? 'rule');
      return;
    case 'time-delta':
      ctx.changeTime(amount, effect.narrativeHint ?? 'rule');
      return;
    case 'consume-time':
      ctx.changeTime(Math.abs(amount), effect.narrativeHint ?? 'rule');
      return;
    case 'advance-time':
      ctx.changeTime(Math.abs(amount), effect.narrativeHint ?? 'rule');
      return;
    case 'hp-delta': {
      const targets = selectHeroes(ctx, effect.heroId, effect.heroSelector);
      for (const id of targets) {
        ctx.changeHeroHp(id, amount, effect.narrativeHint ?? 'rule');
      }
      return;
    }
    case 'heal-flat': {
      const targets = selectHeroes(ctx, effect.heroId, effect.heroSelector);
      for (const id of targets) {
        ctx.changeHeroHp(id, Math.abs(amount), effect.narrativeHint ?? 'rule');
      }
      return;
    }
    case 'heal-percent': {
      const targets = selectHeroes(ctx, effect.heroId, effect.heroSelector);
      for (const id of targets) {
        const hero = ctx.state.party[id];
        if (!hero) continue;
        const heal = Math.floor((hero.maxHp * Math.abs(amount)) / 100);
        ctx.changeHeroHp(id, heal, effect.narrativeHint ?? 'rule');
      }
      return;
    }
    case 'give-item':
      ctx.addItem(effect.itemId as ItemId, effect.count ?? 1, effect.narrativeHint ?? 'rule');
      return;
    case 'take-item':
      ctx.addItem(effect.itemId as ItemId, -(effect.count ?? 1), effect.narrativeHint ?? 'rule');
      return;
    case 'item-delta': {
      const itemId = effect.itemId as ItemId;
      const cur = countItem(ctx.state.inventory, itemId);
      const next = Math.max(0, cur + amount);
      setItemCount(ctx.state.inventory, itemId, next);
      if (amount > 0) {
        ctx.emit('ITEM_GRANTED', { itemId, count: amount, source: 'rule' });
      } else if (amount < 0 && cur - next > 0) {
        ctx.emit('ITEM_DISCARDED', { itemId, count: cur - next, reason: 'manual' });
      }
      return;
    }
    case 'discard-stack':
      // 简化: 找最近的一叠
      if (effect.itemId) {
        const stack = ctx.findStackByItemId(effect.itemId as ItemId);
        if (stack) ctx.discardItem(stack.id, effect.count ?? 1, 'manual');
      }
      return;
    case 'grant-scout': {
      const order = ['unknown', 'vague', 'category-known', 'fully-scouted'] as const;
      const cur = order.indexOf(ctx.state.expedition.scoutLevel);
      const want = order.indexOf(String(effect.flagValue ?? 'vague') as typeof order[number]);
      if (want > cur) {
        const from = ctx.state.expedition.scoutLevel;
        ctx.state.expedition.scoutLevel = order[want]!;
        ctx.emit('SCOUT_GRANTED', {
          fromLevel: from,
          toLevel: order[want]!,
          source: effect.narrativeHint ?? 'rule',
        });
      }
      return;
    }
    case 'set-flag': {
      ctx.state.expedition.flags[effect.flagName ?? 'unknown'] = effect.flagValue as string | number | boolean;
      return;
    }
    case 'clear-flag': {
      delete ctx.state.expedition.flags[effect.flagName ?? 'unknown'];
      return;
    }
    case 'inc-flag': {
      const name = effect.flagName ?? 'unknown';
      const cur = ctx.state.expedition.flags[name];
      ctx.state.expedition.flags[name] = (typeof cur === 'number' ? cur : 0) + amount;
      return;
    }
    case 'start-encounter':
      // 由 dispatcher 处理
      return;
    case 'queue-event':
      // 简化:标记到 firedEventIds(后续若有需要可加)
      return;
    case 'apply-status': {
      const targets = selectHeroes(ctx, effect.heroId, effect.heroSelector);
      for (const id of targets) {
        const hero = ctx.state.party[id];
        if (!hero) continue;
        applyStatus(hero, effect.statusType!, effect.duration ?? 1, ctx);
      }
      return;
    }
    case 'remove-status': {
      const targets = selectHeroes(ctx, effect.heroId, effect.heroSelector);
      for (const id of targets) {
        const hero = ctx.state.party[id];
        if (!hero) continue;
        removeStatus(hero, effect.statusType!, ctx);
      }
      return;
    }
    case 'move-hero': {
      if (!effect.heroId) return;
      const hero = ctx.state.party[effect.heroId];
      if (!hero) return;
      const from = hero.rank;
      const to = effect.rankValue ?? hero.rank;
      ctx.state.party[effect.heroId] = { ...hero, rank: to };
      ctx.emit('HERO_RANK_CHANGED', { heroId: effect.heroId, from, to, reason: 'rule' });
      return;
    }
    case 'set-hero-rank': {
      if (!effect.heroId) return;
      const hero = ctx.state.party[effect.heroId];
      if (!hero) return;
      const from = hero.rank;
      const to = effect.rankValue ?? hero.rank;
      ctx.state.party[effect.heroId] = { ...hero, rank: to };
      ctx.emit('HERO_RANK_CHANGED', { heroId: effect.heroId, from, to, reason: 'rule' });
      return;
    }
    case 'kill-hero': {
      if (!effect.heroId) return;
      ctx.killHero(effect.heroId, effect.narrativeHint ?? 'rule');
      return;
    }
    case 'reveal-next-node':
      // 留作"显示下一个节点"用途,目前只是 flag
      ctx.state.expedition.flags['next-node-revealed'] = true;
      return;
    case 'complete-objective': {
      ctx.state.expedition.objectiveCompleted = true;
      ctx.emit('OBJECTIVE_COMPLETED', {
        objectiveId: effect.targetId ?? 'objective',
        nodeId: ctx.state.expedition.currentNodeId,
      });
      return;
    }
    case 'fail-expedition':
      ctx.state.expedition.failed = true;
      ctx.state.expedition.failReason = effect.narrativeHint ?? 'rule';
      ctx.state.mode = 'expedition-failure';
      ctx.emit('EXPEDITION_FAILED', {
        expeditionId: ctx.state.expedition.id,
        reason: ctx.state.expedition.failReason,
        fromNodeId: ctx.state.expedition.currentNodeId,
      });
      return;
    case 'succeed-expedition':
      ctx.state.expedition.objectiveCompleted = true;
      ctx.state.mode = 'expedition-success';
      ctx.emit('EXPEDITION_SUCCEEDED', {
        expeditionId: ctx.state.expedition.id,
        objectiveNodeId: ctx.state.expedition.route.objectiveNodeId,
        exitNodeId: ctx.state.expedition.currentNodeId,
      });
      return;
    case 'request-retreat':
      ctx.state.mode = 'expedition-retreat';
      ctx.emit('RETREAT_REQUESTED', {
        fromNodeId: ctx.state.expedition.currentNodeId,
        reason: effect.narrativeHint ?? 'rule',
      });
      return;
  }
}

function selectHeroes(ctx: ExpeditionContext, heroId: string | undefined, selector: RuleEffect['heroSelector']): string[] {
  const heroes = Object.values(ctx.state.party).filter((h) => !h.isDead);
  if (selector === undefined) {
    if (heroId) return [heroId];
    return heroes.map((h) => h.id);
  }
  switch (selector) {
    case 'specific':
      return heroId ? [heroId] : [];
    case 'lowest-hp':
      return heroes.length === 0 ? [] : [heroes.reduce((a, b) => (a.hp <= b.hp ? a : b)).id];
    case 'highest-hp':
      return heroes.length === 0 ? [] : [heroes.reduce((a, b) => (a.hp >= b.hp ? a : b)).id];
    case 'all-alive':
      return heroes.map((h) => h.id);
    case 'front-rank':
      return heroes.filter((h) => h.rank === 1).map((h) => h.id);
    case 'back-rank':
      return heroes.filter((h) => h.rank === 4).map((h) => h.id);
  }
}

function applyStatus(
  hero: import('./types.js').HeroInstance,
  status: 'bleed' | 'blight' | 'stun' | 'mark' | 'prot_buff',
  duration: number,
  ctx: ExpeditionContext,
): void {
  switch (status) {
    case 'bleed':
    case 'blight': {
      const dotId = `dot_${status}_${hero.id}_${Date.now().toString(36)}_${ctx.state.eventLog.length}`;
      const dot = { id: dotId, type: status, damagePerTurn: 1, remainingTurns: duration, sourceId: 'rule' };
      const next = status === 'bleed' ? [...hero.bleed, dot] : [...hero.blight, dot];
      ctx.setHero({ ...hero, [status]: next } as import('./types.js').HeroInstance);
      ctx.emit('STATUS_APPLIED', { heroId: hero.id, status, duration, source: 'rule' });
      return;
    }
    case 'stun': {
      ctx.setHero({ ...hero, stun: { remaining: duration, resistRemaining: 0 } });
      ctx.emit('STATUS_APPLIED', { heroId: hero.id, status, duration, source: 'rule' });
      return;
    }
    case 'mark': {
      ctx.setHero({ ...hero, mark: { sourceId: 'rule', remaining: duration } });
      ctx.emit('STATUS_APPLIED', { heroId: hero.id, status, duration, source: 'rule' });
      return;
    }
    case 'prot_buff': {
      ctx.setHero({ ...hero, protBuff: { amount: 20, remaining: duration, sourceId: 'rule' } });
      ctx.emit('STATUS_APPLIED', { heroId: hero.id, status, duration, source: 'rule' });
      return;
    }
  }
}

function removeStatus(
  hero: import('./types.js').HeroInstance,
  status: 'bleed' | 'blight' | 'stun' | 'mark' | 'prot_buff',
  ctx: ExpeditionContext,
): void {
  switch (status) {
    case 'bleed':
      ctx.setHero({ ...hero, bleed: [] });
      break;
    case 'blight':
      ctx.setHero({ ...hero, blight: [] });
      break;
    case 'stun':
      ctx.setHero({ ...hero, stun: null });
      break;
    case 'mark':
      ctx.setHero({ ...hero, mark: null });
      break;
    case 'prot_buff':
      ctx.setHero({ ...hero, protBuff: null });
      break;
  }
  ctx.emit('STATUS_WORE_OFF', { heroId: hero.id, status });
}

/** 按权重表抽取一个 outcome */
export function rollOutcome(ctx: ExpeditionContext, table: WeightedOutcome[]): WeightedOutcome {
  if (table.length === 0) {
    return { weight: 1, effects: [], narrativeHint: '' };
  }
  if (table.length === 1) return table[0]!;
  return ctx.weighted(table, (o) => Math.max(0, o.weight));
}

/** 一次性应用 outcome 列表(支付 costs 后) */
export function applyOutcomeTable(ctx: ExpeditionContext, table: WeightedOutcome[]): WeightedOutcome {
  const picked = rollOutcome(ctx, table);
  for (const eff of picked.effects) {
    applyEffect(ctx, eff);
  }
  return picked;
}
