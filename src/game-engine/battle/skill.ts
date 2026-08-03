/**
 * 技能释放
 *
 * 完整流程:
 * 1. 校验(actor 当前站位合法、技能不在冷却、目标合法)
 * 2. 解析目标(把 targetIds 规范为 BattleActor 列表)
 * 3. 对每个目标:
 *    a. 命中检定(自身目标跳过)
 *    b. 暴击检定
 *    c. 伤害公式
 *    d. 抗性检定(DOT / 眩晕)
 *    e. 应用伤害
 *    f. 应用效果
 *    g. 死亡检测
 * 4. 应用位移
 * 5. 写入冷却
 *
 * 不变量:所有可能改变状态的操作都通过 ctx.updateActor / ctx.emit
 */

import type { BattleContext } from './context.js';
import type {
  BattleActor,
  Rank,
  SkillDefinition,
  SkillEffect,
} from '../types.js';
import { findActorInLists, markActorDead } from './round.js';
import { liveAllies, liveEnemies } from '../invariants.js';

export interface UseSkillResult {
  hit: boolean;
  crit: boolean;
  damage: number;
  targetId: string;
}

export function useSkill(
  ctx: BattleContext,
  actorId: string,
  skillId: string,
  targetIds: string[],
): UseSkillResult[] {
  const state = ctx.state;
  if (state.phase !== 'actor-turn') {
    throw new Error(`useSkill: invalid phase ${state.phase}`);
  }
  if (state.activeActorId !== actorId) {
    throw new Error(`useSkill: actor ${actorId} is not the active actor`);
  }
  const actor = findActorInLists(state, actorId);
  if (!actor) {
    throw new Error(`useSkill: actor ${actorId} not found`);
  }
  if (actor.isDead || actor.kind === 'corpse') {
    throw new Error(`useSkill: actor ${actorId} is dead`);
  }

  // 找技能定义
  const loadout = state.loadouts[actorId];
  if (!loadout) {
    throw new Error(`useSkill: no loadout for ${actorId}`);
  }
  const equipped = loadout.find((s) => s.skillId === skillId);
  if (!equipped) {
    throw new Error(`useSkill: skill ${skillId} not in ${actorId}'s loadout`);
  }
  const skill = state.skillRegistry?.[skillId];
  if (!skill) {
    throw new Error(`useSkill: skill ${skillId} not in registry`);
  }
  // 站位合法
  if (!skill.usableFromRanks.includes(actor.rank)) {
    throw new Error(
      `useSkill: skill ${skillId} cannot be used from rank ${actor.rank} (allowed ${skill.usableFromRanks})`,
    );
  }
  // 冷却
  const cd = actor.cooldowns[skillId] ?? 0;
  if (cd > 0) {
    throw new Error(`useSkill: skill ${skillId} is on cooldown for ${cd} more turns`);
  }

  // 解析目标
  const targets = resolveTargets(state, actor, skill, targetIds);
  ctx.emit('SKILL_USED', { actorId, skillId, targetIds: targets.map((t) => t.id) });

  const results: UseSkillResult[] = [];

  for (const target of targets) {
    if (target.isDead || target.kind === 'corpse') {
      // 目标在中途死了,跳过
      continue;
    }
    const result = resolveSkillOnTarget(ctx, actor, skill, target);
    results.push(result);
  }

  // 位移
  if (skill.moveSelf && skill.moveSelf !== 0) {
    const moved = moveActorBy(ctx, actor, skill.moveSelf, 'skill-self');
    if (moved) {
      ctx.emit('ACTOR_MOVED', {
        actorId: actor.id,
        fromRank: actor.rank,
        toRank: moved.rank,
        reason: 'skill-self',
      });
    }
  }
  for (const t of targets) {
    if (skill.moveTarget && skill.moveTarget !== 0) {
      const after = findActorInLists(state, t.id);
      if (after && !after.isDead && after.kind !== 'corpse') {
        const moved = moveActorBy(ctx, after, skill.moveTarget, 'skill-target');
        if (moved) {
          ctx.emit('ACTOR_MOVED', {
            actorId: after.id,
            fromRank: t.rank,
            toRank: moved.rank,
            reason: 'skill-target',
          });
        }
      }
    }
  }

  // 写入冷却
  if (skill.cooldown > 0) {
    const fresh = findActorInLists(state, actorId)!;
    const newCooldowns = { ...fresh.cooldowns, [skillId]: skill.cooldown };
    ctx.updateActor({ ...fresh, cooldowns: newCooldowns });
  }

  ctx.commit();
  return results;
}

function resolveTargets(
  state: import('../types.js').BattleState,
  actor: BattleActor,
  skill: SkillDefinition,
  targetIds: string[],
): BattleActor[] {
  if (skill.targetMode === 'self') {
    return [actor];
  }

  // 选择目标池
  const pool =
    skill.targetSide === 'ally' ? liveAllies(state) : liveEnemies(state);
  // 过滤掉尸体(尸体在 liveEnemies/liveAllies 已排除)
  // 过滤合法站位
  const validByRank = pool.filter((a) => skill.targetRanks.includes(a.rank));

  if (skill.targetMode === 'all') {
    return validByRank;
  }

  if (skill.targetMode === 'single') {
    if (targetIds.length === 0) {
      throw new Error(`useSkill: single-target skill needs 1 targetId`);
    }
    if (targetIds.length > 1) {
      throw new Error(`useSkill: single-target skill accepts 1 targetId, got ${targetIds.length}`);
    }
    const tid = targetIds[0]!;
    const target = validByRank.find((a) => a.id === tid);
    if (!target) {
      throw new Error(`useSkill: target ${tid} not in valid ranks ${skill.targetRanks}`);
    }
    return [target];
  }

  if (skill.targetMode === 'adjacent') {
    if (targetIds.length === 0) {
      throw new Error(`useSkill: adjacent-target skill needs 1 targetId`);
    }
    const tid = targetIds[0]!;
    const center = validByRank.find((a) => a.id === tid);
    if (!center) {
      throw new Error(`useSkill: adjacent target ${tid} not in valid ranks`);
    }
    // 相邻:前一个 + 后一个(基于 rank)
    const adjRanks: Rank[] = [];
    if (center.rank > 1) adjRanks.push((center.rank - 1) as Rank);
    if (center.rank < 4) adjRanks.push((center.rank + 1) as Rank);
    adjRanks.push(center.rank);
    const seen = new Set<string>();
    return adjRanks
      .map((r) => validByRank.find((a) => a.rank === r))
      .filter((a): a is BattleActor => Boolean(a))
      .filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
  }

  throw new Error(`useSkill: unknown targetMode ${skill.targetMode}`);
}

function resolveSkillOnTarget(
  ctx: BattleContext,
  actor: BattleActor,
  skill: SkillDefinition,
  target: BattleActor,
): UseSkillResult {
  // 自身目标:不掷骰,直接结算
  const isSelf = skill.targetMode === 'self';

  // 命中
  let hit = true;
  if (!isSelf) {
    const hitChance = clamp(skill.accuracy + actor.accuracy - target.dodge, 5, 95);
    const roll = ctx.rng.nextInt(1, 100);
    hit = roll <= hitChance;
    if (!hit) {
      ctx.emit('SKILL_MISSED', {
        actorId: actor.id,
        skillId: skill.id,
        targetId: target.id,
        roll,
        needed: hitChance,
      });
      return { hit: false, crit: false, damage: 0, targetId: target.id };
    }
  }

  // 暴击
  const critChance = clamp(skill.critModifier + actor.crit, 0, 100);
  const isCrit = ctx.rng.chance(critChance / 100);
  if (isCrit) {
    ctx.emit('CRIT_ROLLED', {
      sourceId: actor.id,
      targetId: target.id,
      rolled: critChance,
      threshold: critChance,
    });
  }

  // 伤害
  let damage = 0;
  if (skill.effects.some((e) => e.type === 'damage')) {
    const baseRoll = isCrit
      ? skill.baseDamage.max
      : ctx.rng.nextInt(skill.baseDamage.min, skill.baseDamage.max);
    const modifier = 1 + skill.damageModifier;
    const protFactor = 1 - clamp(target.protection, 0, 100) / 100;
    const raw = baseRoll * modifier * protFactor;
    const preHp = target.hp;
    const postHp = Math.max(0, preHp - Math.floor(raw));
    damage = preHp - postHp;
    const refreshed = findActorInLists(ctx.state, target.id)!;
    ctx.updateActor({ ...refreshed, hp: postHp });
    ctx.emit('DAMAGE_DEALT', {
      sourceId: actor.id,
      targetId: target.id,
      amount: damage,
      preHp,
      postHp,
      crit: isCrit,
    });
    if (postHp <= 0) {
      markActorDead(ctx, { ...refreshed, hp: postHp });
    }
  }

  // 效果
  for (const effect of skill.effects) {
    applyEffect(ctx, actor, target, effect, isCrit);
  }

  // 死亡检测(DOT 致死)
  const after = findActorInLists(ctx.state, target.id);
  if (after && after.hp <= 0 && !after.isDead && after.kind !== 'corpse') {
    markActorDead(ctx, after);
  }

  return { hit: true, crit: isCrit, damage, targetId: target.id };
}

function applyEffect(
  ctx: BattleContext,
  actor: BattleActor,
  target: BattleActor,
  effect: SkillEffect,
  isCrit: boolean,
): void {
  const fresh = findActorInLists(ctx.state, target.id);
  if (!fresh || fresh.isDead || fresh.kind === 'corpse') return;

  switch (effect.type) {
    case 'damage':
      // 已在主流程处理
      return;
    case 'heal': {
      const amount = effect.flat;
      const preHp = fresh.hp;
      const postHp = Math.min(fresh.maxHp, preHp + amount);
      ctx.updateActor({ ...fresh, hp: postHp });
      ctx.emit('HEALING_APPLIED', {
        sourceId: actor.id,
        targetId: target.id,
        amount: postHp - preHp,
        preHp,
        postHp,
      });
      return;
    }
    case 'bleed': {
      const dur = effect.duration + (isCrit ? 1 : 0);
      if (ctx.rng.chance(1 - fresh.bleedResist)) {
        const dotId = `bleed_${target.id}_${actor.id}_${Date.now()}_${ctx.state.log.length}`;
        const newDot = {
          id: dotId,
          type: 'bleed' as const,
          damagePerTurn: effect.baseDamage,
          remainingTurns: dur,
          sourceId: actor.id,
        };
        ctx.updateActor({ ...fresh, bleed: [...fresh.bleed, newDot] });
        ctx.emit('BLEED_APPLIED', {
          sourceId: actor.id,
          targetId: target.id,
          damagePerTurn: effect.baseDamage,
          duration: dur,
        });
      }
      return;
    }
    case 'blight': {
      const dur = effect.duration + (isCrit ? 1 : 0);
      if (ctx.rng.chance(1 - fresh.blightResist)) {
        const dotId = `blight_${target.id}_${actor.id}_${Date.now()}_${ctx.state.log.length}`;
        const newDot = {
          id: dotId,
          type: 'blight' as const,
          damagePerTurn: effect.baseDamage,
          remainingTurns: dur,
          sourceId: actor.id,
        };
        ctx.updateActor({ ...fresh, blight: [...fresh.blight, newDot] });
        ctx.emit('BLIGHT_APPLIED', {
          sourceId: actor.id,
          targetId: target.id,
          damagePerTurn: effect.baseDamage,
          duration: dur,
        });
      }
      return;
    }
    case 'stun': {
      if (fresh.stun && fresh.stun.resistRemaining > 0) {
        // 抗性中,跳过
        return;
      }
      if (ctx.rng.chance(1 - fresh.stunResist)) {
        ctx.updateActor({ ...fresh, stun: { remaining: effect.duration, resistRemaining: 0 } });
        ctx.emit('STUN_APPLIED', {
          sourceId: actor.id,
          targetId: target.id,
          duration: effect.duration,
        });
      } else {
        ctx.emit('STUN_RESISTED', {
          sourceId: actor.id,
          targetId: target.id,
          roll: ctx.rng.nextInt(1, 100),
          resist: Math.round(fresh.stunResist * 100),
        });
      }
      return;
    }
    case 'mark': {
      ctx.updateActor({
        ...fresh,
        mark: { sourceId: actor.id, remaining: effect.duration },
      });
      ctx.emit('MARK_APPLIED', {
        sourceId: actor.id,
        targetId: target.id,
        duration: effect.duration,
      });
      return;
    }
    case 'prot_buff': {
      ctx.updateActor({
        ...fresh,
        protBuff: { amount: effect.amount, remaining: effect.duration, sourceId: actor.id },
      });
      ctx.emit('PROT_BUFF_APPLIED', {
        sourceId: actor.id,
        targetId: target.id,
        amount: effect.amount,
        duration: effect.duration,
      });
      return;
    }
  }
}

function moveActorBy(
  ctx: BattleContext,
  actor: BattleActor,
  delta: number,
  _reason: 'skill-self' | 'skill-target' | 'death-shift',
): BattleActor | null {
  if (actor.isDead || actor.kind === 'corpse') return null;
  const newRank = clamp(actor.rank + delta, 1, 4) as Rank;
  if (newRank === actor.rank) return null;
  // 目标 rank 上不能有另一个同阵营存活单位
  const sameSide = ctx.state[actor.side === 'ally' ? 'heroes' : 'enemies'];
  const blocker = sameSide.find((a) => a.rank === newRank && !a.isDead && a.id !== actor.id);
  if (blocker) {
    return null; // 不能位移
  }
  // 也不能挪到尸体上(尸体也算占据 rank)
  const corpseBlocker = ctx.state.corpses.find((c) => c.rank === newRank && c.side === actor.side);
  if (corpseBlocker) {
    return null;
  }
  const updated: BattleActor = { ...actor, rank: newRank };
  ctx.updateActor(updated);
  return updated;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
