/**
 * 远征上下文(ExpeditionContext)
 *
 * 一个事务(transaction)期间的状态容器:
 * - 持有当前的 GameState
 * - 提供事件 emit
 * - 提供 RNG(每 draw 一次自动更新 state.rng)
 * - 提供常用助手:torch / food / time delta、party 修改、inventory 修改
 *
 * commit() 把累积的事件提交到 state.eventLog 并推进 transactionId。
 *
 * 重要:不允许业务代码直接修改 state;所有变化通过 emit + apply helper。
 */

import type { Rng } from '../rng/types.js';
import { Mulberry32 } from '../rng/index.js';
import { nextTransactionId } from '../transaction.js';
import type {
  ExpeditionDomainEvent,
  ExpeditionDomainEventType,
} from './domain-events.js';
import type { DomainEvent as BattleDomainEvent } from '../domain-events.js';
import type {
  GameState,
  HeroInstance,
  ItemId,
  InventoryStack,
  InventoryState,
  TorchLevel,
} from './types.js';
import { torchLevel } from './types.js';

let eventCounter = 0;
function nextEventId(): string {
  eventCounter += 1;
  return `evt_${Date.now().toString(36)}_${eventCounter.toString(36)}`;
}

export class ExpeditionContext {
  state: GameState;
  /** 事务内累积的远征事件(未 commit) */
  private pendingExpeditionEvents: ExpeditionDomainEvent[] = [];
  /** 事务内累积的 battle 事件(从底层引擎来的,日志追加) */
  private pendingBattleEvents: BattleDomainEvent[] = [];
  private rngInstance: Rng;
  private eventSequence = 0;

  constructor(state: GameState) {
    this.state = state;
    this.rngInstance = new Mulberry32(state.rng.state);
  }

  // ------------------ RNG ------------------

  get rng(): Rng {
    return this.rngInstance;
  }

  /** 同步 state.rng 到当前 RNG 状态(每次 commit 前会调用) */
  private syncRng(): void {
    this.state.rng = this.rngInstance.state;
  }

  /** 让 RNG 推进一步并返回浮点(也更新 state.rng) */
  nextFloat(): number {
    const v = this.rngInstance.nextFloat();
    this.syncRng();
    return v;
  }

  nextInt(min: number, max: number): number {
    const v = this.rngInstance.nextInt(min, max);
    this.syncRng();
    return v;
  }

  chance(p: number): boolean {
    const v = this.rngInstance.chance(p);
    this.syncRng();
    return v;
  }

  pick<T>(items: readonly T[]): T {
    const v = this.rngInstance.pick(items);
    this.syncRng();
    return v;
  }

  weighted<T>(items: T[], weight: (item: T) => number): T {
    const v = this.rngInstance.weighted(items, weight);
    this.syncRng();
    return v;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const v = this.rngInstance.shuffle(items);
    this.syncRng();
    return v;
  }

  // ------------------ Events ------------------

  /** 发射远征层事件 */
  emit<T extends ExpeditionDomainEventType>(
    type: T,
    payload: Extract<ExpeditionDomainEvent, { type: T }>['payload'],
  ): Extract<ExpeditionDomainEvent, { type: T }> {
    const rngBefore = this.state.rng;
    this.eventSequence += 1;
    const evt: ExpeditionDomainEvent = {
      id: nextEventId(),
      transactionId: this.state.lastTransactionId ?? 'no-tx',
      sequence: this.eventSequence,
      type,
      payload,
      rngBefore,
      rngAfter: this.state.rng,
      createdAt: new Date().toISOString(),
    } as ExpeditionDomainEvent;
    this.pendingExpeditionEvents.push(evt);
    return evt as Extract<ExpeditionDomainEvent, { type: T }>;
  }

  /** 追加 battle 子事件(选择式遭遇自动结算时由 encounter-resolver 灌入) */
  appendBattleEvents(events: BattleDomainEvent[]): void {
    this.pendingBattleEvents.push(...events);
  }

  // ------------------ Commit ------------------

  /** 把累积事件写入日志,推进 transactionId */
  commit(): void {
    this.syncRng();
    this.state.eventLog.push(...this.pendingExpeditionEvents);
    this.state.eventLog.push(...this.pendingBattleEvents);
    this.pendingExpeditionEvents = [];
    this.pendingBattleEvents = [];
    this.state.lastTransactionId = nextTransactionId();
    this.eventSequence = 0;
  }

  // ------------------ Party / Inventory / Torch helpers ------------------

  getParty(): HeroInstance[] {
    return Object.values(this.state.party);
  }

  getHero(id: string): HeroInstance | undefined {
    return this.state.party[id];
  }

  /** 直接改写一个英雄(只用于 dispatcher,通常不直接调用) */
  setHero(hero: HeroInstance): void {
    this.state.party[hero.id] = hero;
  }

  /** 给英雄 HP 加 delta,clamp 到 [0, maxHp],返回实际 delta */
  changeHeroHp(heroId: string, delta: number, source: string): number {
    const hero = this.state.party[heroId];
    if (!hero) throw new Error(`changeHeroHp: hero ${heroId} not found`);
    if (hero.isDead && delta < 0) return 0;
    const from = this.state.party[heroId]!.hp;
    const to = Math.max(0, Math.min(hero.maxHp, from + delta));
    const actual = to - from;
    if (actual === 0) return 0;
    this.state.party[heroId] = { ...hero, hp: to };
    this.emit('HERO_HP_CHANGED', { heroId, from, to, source });
    // Phase 2:HP 转换
    if (to === 0 && !hero.isDead) {
      // HP 从 >0 跌到 0:进死亡之门
      // (不再直接 killHero;永久死亡走 triggerPermanentDeath)
      this.state.party[heroId]!.atDeathsDoor = true;
      this.state.party[heroId]!.stress = Math.min(200, this.state.party[heroId]!.stress + 10);
      this.emit('DEATHS_DOOR_ENTERED', { heroId, fromHp: from, source });
      this.emit('PARTY_STRESS_PULSE_CREATED', {
        sourceHeroId: heroId,
        sourceEventId: 'deaths-door',
        deltas: Object.values(this.state.party)
          .filter((h) => h.id !== heroId && !h.isDead)
          .map((h) => ({ heroId: h.id, amount: 7 })),
        reason: `${this.state.party[heroId]!.name} 进入死亡之门`,
      });
      this.state.pendingMentalFlags.push({ type: 'needs-emergency-care', heroId, createdAt: Date.now() });
      this.state.pendingMentalFlags.push({ type: 'needs-cover', heroId, createdAt: Date.now() });
    } else if (to > 0 && hero.atDeathsDoor) {
      // 死亡之门被治愈
      const h = this.state.party[heroId]!;
      h.atDeathsDoor = false;
      h.deathsDoorRecoveryStacks += 1;
      const maxHpPenalty = -Math.floor(h.maxHp * 0.1);
      h.maxHp = Math.max(1, h.maxHp + maxHpPenalty);
      h.dodge = Math.max(0, h.dodge - 2);
      h.protection = Math.max(0, h.protection - 5);
      h.deathblowPenalty += 0.05;
      this.emit('DEATHS_DOOR_RECOVERY_APPLIED', {
        heroId, maxHpDelta: maxHpPenalty, dodgeDelta: -2, protDelta: -5, deathResistDelta: -0.05,
      });
      this.emit('DEATHS_DOOR_EXITED', { heroId, newHp: to, recoveryStacks: h.deathsDoorRecoveryStacks });
    }
    return actual;
  }

  killHero(heroId: string, cause: string): void {
    const hero = this.state.party[heroId];
    if (!hero || hero.isDead) return;
    this.state.party[heroId] = { ...hero, isDead: true, hp: 0 };
    this.emit('HERO_DIED', { heroId, cause });
  }

  changeTorch(delta: number, reason: string): void {
    const from = this.state.expedition.torch;
    const to = Math.max(0, Math.min(100, from + delta));
    if (to === from) return;
    this.state.expedition.torch = to;
    const level: TorchLevel = torchLevel(to);
    this.state.torch = { value: to, level };
    this.emit('TORCH_CHANGED', { from, to, level, reason });
    if (to < this.state.expedition.stats.lowestTorch || this.state.expedition.stats.lowestTorch === 0) {
      this.state.expedition.stats.lowestTorch = to;
    }
  }

  setTorch(value: number, reason: string): void {
    const v = Math.max(0, Math.min(100, value));
    this.changeTorch(v - this.state.expedition.torch, reason);
  }

  changeFood(delta: number, reason: string): void {
    const from = countItem(this.state.inventory, 'food');
    const to = Math.max(0, from + delta);
    if (to === from) return;
    setItemCount(this.state.inventory, 'food', to);
    this.state.expedition.stats.foodUsed += Math.max(0, from - to);
    this.emit('FOOD_CHANGED', { from, to, reason });
  }

  changeTime(delta: number, reason: string): void {
    const from = this.state.expedition.timeElapsed;
    const to = Math.max(0, from + delta);
    this.state.expedition.timeElapsed = to;
    this.emit('TIME_ADVANCED', { from, to, reason });
  }

  // ------------------ Inventory helpers ------------------

  /** 给指定物品增加 count(可以负数) */
  addItem(itemId: ItemId, count: number, source: string): void {
    if (count === 0) return;
    const inv = this.state.inventory;
    const existing = inv.stacks.find((s) => s.itemId === itemId);
    if (existing) {
      const before = existing.count;
      const after = Math.max(0, before + count);
      existing.count = after;
      if (after === 0) {
        inv.stacks = inv.stacks.filter((s) => s.id !== existing.id);
      }
      if (count > 0) this.emit('ITEM_GRANTED', { itemId, count, source });
      else if (count < 0 && before - after > 0) this.emit('ITEM_CONSUMED', { itemId, count: before - after, source });
      return;
    }
    if (count > 0) {
      if (inv.stacks.length >= inv.capacity) {
        // 容量已满
        this.emit('INVENTORY_FULL', { capacity: inv.capacity, stacks: inv.stacks.length });
        return;
      }
      inv.stacks.push({ id: `stk_${itemId}_${Date.now().toString(36)}`, itemId, count });
      this.emit('ITEM_GRANTED', { itemId, count, source });
    }
  }

  /** 丢弃物品(对背包已满的处理) */
  discardItem(stackId: string, count: number, reason: 'inventory-full' | 'manual' | 'abandoned' = 'manual'): void {
    const inv = this.state.inventory;
    const idx = inv.stacks.findIndex((s) => s.id === stackId);
    if (idx < 0) return;
    const stack = inv.stacks[idx]!;
    const actual = Math.min(count, stack.count);
    if (actual <= 0) return;
    const remaining = stack.count - actual;
    if (remaining <= 0) {
      inv.stacks.splice(idx, 1);
    } else {
      stack.count = remaining;
    }
    this.emit('ITEM_DISCARDED', { itemId: stack.itemId, count: actual, reason });
  }

  /** 是否有指定物品 >= count */
  hasItem(itemId: ItemId, count = 1): boolean {
    return countItem(this.state.inventory, itemId) >= count;
  }

  /** 找出一个 stackId(用于 USE_INVENTORY_ITEM 等命令) */
  findStackByItemId(itemId: ItemId): InventoryStack | undefined {
    return this.state.inventory.stacks.find((s) => s.itemId === itemId);
  }
}

// =============== inventory 纯函数 ===============

export function countItem(inv: InventoryState, itemId: ItemId): number {
  return inv.stacks.reduce((acc, s) => (s.itemId === itemId ? acc + s.count : acc), 0);
}

export function setItemCount(inv: InventoryState, itemId: ItemId, count: number): void {
  const existing = inv.stacks.find((s) => s.itemId === itemId);
  if (existing) {
    if (count <= 0) {
      inv.stacks = inv.stacks.filter((s) => s.itemId !== itemId);
    } else {
      existing.count = count;
    }
  } else if (count > 0) {
    inv.stacks.push({ id: `stk_${itemId}_init`, itemId, count });
  }
}

export function totalSlotsUsed(inv: InventoryState): number {
  return inv.stacks.length;
}
