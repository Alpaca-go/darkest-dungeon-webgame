/**
 * 域事件(Domain Event)
 *
 * 所有数值变化都通过事件记录,实现:
 * - 刷新不重抽
 * - 存档可恢复
 * - Bug 可复现
 * - 失败报告可生成
 */

import type { RngState } from './rng/types.js';
import type { Rank, Side } from './types.js';

/** 事件类型枚举 */
export type DomainEventType =
  | 'BATTLE_STARTED'
  | 'BATTLE_ENDED'
  | 'ROUND_STARTED'
  | 'ROUND_ENDED'
  | 'TURN_STARTED'
  | 'TURN_ENDED'
  | 'SKILL_USED'
  | 'SKILL_MISSED'
  | 'DAMAGE_DEALT'
  | 'HEALING_APPLIED'
  | 'CRIT_ROLLED'
  | 'BLEED_APPLIED'
  | 'BLIGHT_APPLIED'
  | 'STUN_APPLIED'
  | 'STUN_RESISTED'
  | 'STUN_WORE_OFF'
  | 'MARK_APPLIED'
  | 'MARK_WORE_OFF'
  | 'PROT_BUFF_APPLIED'
  | 'PROT_BUFF_WORE_OFF'
  | 'DOT_TICKED'
  | 'DOT_WORE_OFF'
  | 'ACTOR_DIED'
  | 'CORPSE_SPAWNED'
  | 'CORPSE_CLEARED'
  | 'ACTOR_MOVED'
  | 'INITIATIVE_ROLLED'
  | 'NO_VALID_TARGET'
  | 'AI_DECISION';

export interface BaseDomainEvent<T extends DomainEventType, P> {
  id: string;
  transactionId: string;
  sequence: number;
  type: T;
  payload: P;
  rngBefore: RngState;
  rngAfter: RngState;
  createdAt: string;
}

export type BattleStartedPayload = {
  battleId: string;
  heroIds: string[];
  enemyIds: string[];
};
export type BattleEndedPayload = {
  battleId: string;
  outcome: 'victory' | 'defeat';
  rounds: number;
};
export type RoundStartedPayload = { round: number };
export type RoundEndedPayload = { round: number };
export type TurnStartedPayload = { actorId: string; side: Side; rank: Rank };
export type TurnEndedPayload = { actorId: string };
export type SkillUsedPayload = {
  actorId: string;
  skillId: string;
  targetIds: string[];
};
export type SkillMissedPayload = {
  actorId: string;
  skillId: string;
  targetId: string;
  roll: number;
  needed: number;
};
export type DamageDealtPayload = {
  sourceId: string;
  targetId: string;
  amount: number;
  preHp: number;
  postHp: number;
  crit: boolean;
};
export type HealingAppliedPayload = {
  sourceId: string;
  targetId: string;
  amount: number;
  preHp: number;
  postHp: number;
};
export type CritRolledPayload = {
  sourceId: string;
  targetId: string;
  rolled: number;
  threshold: number;
};
export type BleedAppliedPayload = {
  sourceId: string;
  targetId: string;
  damagePerTurn: number;
  duration: number;
};
export type BlightAppliedPayload = {
  sourceId: string;
  targetId: string;
  damagePerTurn: number;
  duration: number;
};
export type StunAppliedPayload = {
  sourceId: string;
  targetId: string;
  duration: number;
};
export type StunResistedPayload = {
  sourceId: string;
  targetId: string;
  roll: number;
  resist: number;
};
export type StunWoreOffPayload = { targetId: string };
export type MarkAppliedPayload = {
  sourceId: string;
  targetId: string;
  duration: number;
};
export type MarkWoreOffPayload = { targetId: string };
export type ProtBuffAppliedPayload = {
  sourceId: string;
  targetId: string;
  amount: number;
  duration: number;
};
export type ProtBuffWoreOffPayload = { targetId: string };
export type DotTickedPayload = {
  targetId: string;
  sourceId: string;
  dotId: string;
  type: 'bleed' | 'blight';
  damage: number;
  preHp: number;
  postHp: number;
};
export type DotWoreOffPayload = { targetId: string; dotId: string; type: 'bleed' | 'blight' };
export type ActorDiedPayload = { actorId: string; side: Side; rank: Rank };
export type CorpseSpawnedPayload = { corpseId: string; fromActorId: string; rank: Rank };
export type CorpseClearedPayload = { corpseId: string; reason: 'cleared' | 'all-enemies-dead' };
export type ActorMovedPayload = {
  actorId: string;
  fromRank: Rank;
  toRank: Rank;
  reason: 'skill-self' | 'skill-target' | 'death-shift';
};
export type InitiativeRolledPayload = { rolls: { actorId: string; roll: number }[] };
export type NoValidTargetPayload = { actorId: string; skillId: string };
export type AiDecisionPayload = { actorId: string; skillId: string; targetId: string };

export type DomainEvent =
  | BaseDomainEvent<'BATTLE_STARTED', BattleStartedPayload>
  | BaseDomainEvent<'BATTLE_ENDED', BattleEndedPayload>
  | BaseDomainEvent<'ROUND_STARTED', RoundStartedPayload>
  | BaseDomainEvent<'ROUND_ENDED', RoundEndedPayload>
  | BaseDomainEvent<'TURN_STARTED', TurnStartedPayload>
  | BaseDomainEvent<'TURN_ENDED', TurnEndedPayload>
  | BaseDomainEvent<'SKILL_USED', SkillUsedPayload>
  | BaseDomainEvent<'SKILL_MISSED', SkillMissedPayload>
  | BaseDomainEvent<'DAMAGE_DEALT', DamageDealtPayload>
  | BaseDomainEvent<'HEALING_APPLIED', HealingAppliedPayload>
  | BaseDomainEvent<'CRIT_ROLLED', CritRolledPayload>
  | BaseDomainEvent<'BLEED_APPLIED', BleedAppliedPayload>
  | BaseDomainEvent<'BLIGHT_APPLIED', BlightAppliedPayload>
  | BaseDomainEvent<'STUN_APPLIED', StunAppliedPayload>
  | BaseDomainEvent<'STUN_RESISTED', StunResistedPayload>
  | BaseDomainEvent<'STUN_WORE_OFF', StunWoreOffPayload>
  | BaseDomainEvent<'MARK_APPLIED', MarkAppliedPayload>
  | BaseDomainEvent<'MARK_WORE_OFF', MarkWoreOffPayload>
  | BaseDomainEvent<'PROT_BUFF_APPLIED', ProtBuffAppliedPayload>
  | BaseDomainEvent<'PROT_BUFF_WORE_OFF', ProtBuffWoreOffPayload>
  | BaseDomainEvent<'DOT_TICKED', DotTickedPayload>
  | BaseDomainEvent<'DOT_WORE_OFF', DotWoreOffPayload>
  | BaseDomainEvent<'ACTOR_DIED', ActorDiedPayload>
  | BaseDomainEvent<'CORPSE_SPAWNED', CorpseSpawnedPayload>
  | BaseDomainEvent<'CORPSE_CLEARED', CorpseClearedPayload>
  | BaseDomainEvent<'ACTOR_MOVED', ActorMovedPayload>
  | BaseDomainEvent<'INITIATIVE_ROLLED', InitiativeRolledPayload>
  | BaseDomainEvent<'NO_VALID_TARGET', NoValidTargetPayload>
  | BaseDomainEvent<'AI_DECISION', AiDecisionPayload>;
