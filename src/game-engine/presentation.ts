/**
 * Presentation Effect
 *
 * 从 Domain Event 派生出来的"展示层效果"。
 * BattleEffectLayer 消费这些 effect 播放动画/数字。
 *
 * 关键点:
 * - 不修改 state
 * - 不直接调用规则
 * - 同一 DomainEvent 可以派生多个 Effect
 */

import type { DomainEvent } from './domain-events.js';
import type { BattleState } from './types.js';

export type PresentationEffectType =
  | 'damage-number'
  | 'heal-number'
  | 'crit-flash'
  | 'miss-text'
  | 'dodge-text'
  | 'bleed-icon'
  | 'blight-icon'
  | 'stun-icon'
  | 'mark-icon'
  | 'prot-buff-icon'
  | 'move-trail'
  | 'death-fade'
  | 'corpse-spawn'
  | 'round-banner'
  | 'turn-banner'
  | 'battle-end';

export interface PresentationEffect {
  id: string;
  domainEventId: string;
  type: PresentationEffectType;
  actorIds: string[];
  durationMs: number;
  payload: unknown;
}

const DEFAULT_DURATION = 600;

export function mapDomainEventToEffects(
  event: DomainEvent,
  state: BattleState,
): PresentationEffect[] {
  const base = {
    id: `pe_${event.id}`,
    domainEventId: event.id,
    durationMs: DEFAULT_DURATION,
  };
  switch (event.type) {
    case 'DAMAGE_DEALT':
      return [
        {
          ...base,
          type: 'damage-number',
          actorIds: [event.payload.targetId],
          payload: { amount: event.payload.amount, crit: event.payload.crit },
        },
        ...(event.payload.crit
          ? [
              {
                ...base,
                type: 'crit-flash' as const,
                actorIds: [event.payload.sourceId, event.payload.targetId],
                durationMs: 300,
                payload: null,
              },
            ]
          : []),
      ];
    case 'SKILL_MISSED':
      return [
        {
          ...base,
          type: 'dodge-text',
          actorIds: [event.payload.targetId],
          payload: null,
        },
      ];
    case 'HEALING_APPLIED':
      return [
        {
          ...base,
          type: 'heal-number',
          actorIds: [event.payload.targetId],
          payload: { amount: event.payload.amount },
        },
      ];
    case 'CRIT_ROLLED':
      return [
        {
          ...base,
          type: 'crit-flash',
          actorIds: [event.payload.sourceId, event.payload.targetId],
          durationMs: 300,
          payload: null,
        },
      ];
    case 'BLEED_APPLIED':
      return [
        {
          ...base,
          type: 'bleed-icon',
          actorIds: [event.payload.targetId],
          payload: { damage: event.payload.damagePerTurn, duration: event.payload.duration },
        },
      ];
    case 'BLIGHT_APPLIED':
      return [
        {
          ...base,
          type: 'blight-icon',
          actorIds: [event.payload.targetId],
          payload: { damage: event.payload.damagePerTurn, duration: event.payload.duration },
        },
      ];
    case 'STUN_APPLIED':
      return [
        {
          ...base,
          type: 'stun-icon',
          actorIds: [event.payload.targetId],
          payload: { duration: event.payload.duration },
        },
      ];
    case 'STUN_RESISTED':
      return [];
    case 'STUN_WORE_OFF':
      return [
        {
          ...base,
          type: 'stun-icon',
          actorIds: [event.payload.targetId],
          payload: { wearing: true },
        },
      ];
    case 'MARK_APPLIED':
      return [
        {
          ...base,
          type: 'mark-icon',
          actorIds: [event.payload.targetId],
          payload: { duration: event.payload.duration },
        },
      ];
    case 'PROT_BUFF_APPLIED':
      return [
        {
          ...base,
          type: 'prot-buff-icon',
          actorIds: [event.payload.targetId],
          payload: { amount: event.payload.amount, duration: event.payload.duration },
        },
      ];
    case 'DOT_TICKED':
      return [
        {
          ...base,
          type: event.payload.type === 'bleed' ? 'damage-number' : 'damage-number',
          actorIds: [event.payload.targetId],
          payload: { amount: event.payload.damage, dot: true, type: event.payload.type },
        },
      ];
    case 'ACTOR_DIED':
      return [
        {
          ...base,
          type: 'death-fade',
          actorIds: [event.payload.actorId],
          durationMs: 1000,
          payload: { side: event.payload.side },
        },
      ];
    case 'CORPSE_SPAWNED':
      return [
        {
          ...base,
          type: 'corpse-spawn',
          actorIds: [event.payload.fromActorId],
          durationMs: 400,
          payload: { rank: event.payload.rank },
        },
      ];
    case 'ACTOR_MOVED': {
      void state;
      return [
        {
          ...base,
          type: 'move-trail',
          actorIds: [event.payload.actorId],
          durationMs: 400,
          payload: { from: event.payload.fromRank, to: event.payload.toRank },
        },
      ];
    }
    case 'ROUND_STARTED':
      return [
        {
          ...base,
          type: 'round-banner',
          actorIds: [],
          durationMs: 500,
          payload: { round: event.payload.round },
        },
      ];
    case 'TURN_STARTED':
      return [
        {
          ...base,
          type: 'turn-banner',
          actorIds: [event.payload.actorId],
          durationMs: 200,
          payload: { side: event.payload.side, rank: event.payload.rank },
        },
      ];
    case 'BATTLE_ENDED':
      return [
        {
          ...base,
          type: 'battle-end',
          actorIds: [],
          durationMs: 1500,
          payload: { outcome: event.payload.outcome },
        },
      ];
    default:
      return [];
  }
}

/** 把 state.log 末尾的 N 个事件转换为效果队列(增量) */
export function mapEventsToEffects(
  state: BattleState,
  lastProcessedEventId: string | null,
): PresentationEffect[] {
  let events: DomainEvent[];
  if (lastProcessedEventId === null) {
    events = state.log;
  } else {
    const idx = state.log.findIndex((e) => e.id === lastProcessedEventId);
    if (idx < 0) {
      events = state.log;
    } else {
      events = state.log.slice(idx + 1);
    }
  }
  const out: PresentationEffect[] = [];
  for (const e of events) {
    out.push(...mapDomainEventToEffects(e, state));
  }
  return out;
}
