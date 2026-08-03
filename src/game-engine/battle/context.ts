/**
 * 战斗上下文(BattleContext)
 *
 * 包装一个 BattleState,提供:
 * - 持有一个可复用的 RNG(基于 state.rng)
 * - 提交域事件的 emit 方法(自动写入 state.log + 推 sequence)
 * - 提交 actor 状态变更的 mutateActor 等
 * - 每步调用时记录 rngBefore / rngAfter
 *
 * 状态必须用不可变方式更新:每次修改后返回新 BattleState,旧的被丢弃。
 */

import { Mulberry32 } from '../rng/mulberry32.js';
import type { Rng } from '../rng/types.js';
import type { DomainEvent, DomainEventType } from '../domain-events.js';
import type { BattleActor, BattleState } from '../types.js';

export class BattleContext {
  private rngInstance: Rng;
  /** 每次 commit 都会自增 */
  private seq: number;

  constructor(public state: BattleState) {
    this.rngInstance = new Mulberry32(state.rng.state);
    // 从 state.log 里找最大 sequence 作为起点
    // 这样即使上一次 beginTurn / useSkill 没有 commit,新的 ctx 也不会和已写入的事件 seq 冲突
    let maxSeq = state.sequence;
    for (const e of state.log) {
      if (e.sequence > maxSeq) maxSeq = e.sequence;
    }
    this.seq = maxSeq;
  }

  get rng(): Rng {
    return this.rngInstance;
  }

  /** 提交一个域事件,返回已写入的事件 */
  emit<T extends DomainEventType>(
    type: T,
    payload: Extract<DomainEvent, { type: T }>['payload'],
  ): Extract<DomainEvent, { type: T }> {
    this.seq += 1;
    const rngBefore = this.state.rng;
    const rngAfter = this.rngInstance.state;
    const event = {
      id: `e_${this.state.id}_${this.seq}`,
      transactionId: this.state.transactionId,
      sequence: this.seq,
      type,
      payload,
      rngBefore,
      rngAfter,
      createdAt: new Date().toISOString(),
    } as Extract<DomainEvent, { type: T }>;
    this.state.log.push(event as DomainEvent);
    return event;
  }

  /** 更新一个 actor 在对应列表中的引用(不可变) */
  updateActor(updated: BattleActor): void {
    const list =
      updated.kind === 'corpse'
        ? 'corpses'
        : updated.side === 'ally'
        ? 'heroes'
        : 'enemies';
    const arr = this.state[list];
    const idx = arr.findIndex((a) => a.id === updated.id);
    if (idx < 0) {
      throw new Error(`updateActor: actor ${updated.id} not found in ${list}`);
    }
    const next = arr.slice();
    next[idx] = updated;
    this.state[list] = next;
  }

  /** 推一个 actor(尸体专用) */
  pushCorpse(corpse: BattleActor): void {
    this.state.corpses = [...this.state.corpses, corpse];
  }

  /** 移除一个 actor(corpse 清除时用) */
  removeActor(id: string): void {
    this.state.heroes = this.state.heroes.filter((a) => a.id !== id);
    this.state.enemies = this.state.enemies.filter((a) => a.id !== id);
    this.state.corpses = this.state.corpses.filter((a) => a.id !== id);
  }

  /** 推进事务:刷新 sequence 和 rng 快照到 state */
  commit(): void {
    this.state.sequence = this.seq;
    this.state.rng = this.rngInstance.state;
  }
}
