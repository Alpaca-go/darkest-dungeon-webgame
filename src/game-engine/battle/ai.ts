/**
 * 敌方 AI(Phase 0 简化版)
 *
 * 评分因素:
 * - 是否能击杀目标(最高优先级)
 * - 目标 HP 比例
 * - 目标是否被标记
 * - 目标抗性(高抗的优先级低)
 * - 技能是否能命中(skill.accuracy - target.dodge)
 * - 轻微随机扰动
 */

import { findActorInLists } from './round.js';
import { liveAllies, liveEnemies } from '../invariants.js';
import type { BattleContext } from './context.js';
import type { BattleActor, SkillDefinition } from '../types.js';

export interface AiDecision {
  skillId: string;
  targetId: string | null;
}

export function decideAiAction(ctx: BattleContext, actorId: string): AiDecision | null {
  const state = ctx.state;
  const actor = findActorInLists(state, actorId);
  if (!actor || actor.isDead || actor.kind === 'corpse') return null;

  const loadout = state.loadouts[actorId] ?? [];
  const candidates: { skill: SkillDefinition; target: BattleActor | null; score: number }[] = [];

  for (const slot of loadout) {
    const skill = state.skillRegistry[slot.skillId];
    if (!skill) continue;
    if (!skill.usableFromRanks.includes(actor.rank)) continue;
    const cd = actor.cooldowns[skill.id] ?? 0;
    if (cd > 0) continue;

    if (skill.targetMode === 'self') {
      candidates.push({ skill, target: actor, score: scoreSkill(actor, skill, actor) });
      continue;
    }

    const pool = skill.targetSide === 'ally' ? liveAllies(state) : liveEnemies(state);
    const inRange = pool.filter((a) => skill.targetRanks.includes(a.rank));
    if (inRange.length === 0) continue;

    if (skill.targetMode === 'all') {
      // 整体评一个分
      const sample = inRange[0]!;
      candidates.push({
        skill,
        target: null,
        score: scoreSkill(actor, skill, sample) + inRange.length * 0.5,
      });
      continue;
    }

    for (const t of inRange) {
      candidates.push({ skill, target: t, score: scoreSkill(actor, skill, t) });
    }
  }

  if (candidates.length === 0) {
    ctx.emit('NO_VALID_TARGET', { actorId, skillId: '' });
    return null;
  }

  // 加随机扰动
  for (const c of candidates) {
    c.score += ctx.rng.nextFloat() * 0.5;
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0]!;
  ctx.emit('AI_DECISION', { actorId, skillId: top.skill.id, targetId: top.target?.id ?? '' });
  return { skillId: top.skill.id, targetId: top.target?.id ?? null };
}

function scoreSkill(
  actor: BattleActor,
  skill: SkillDefinition,
  target: BattleActor,
): number {
  let score = 0;

  // 击杀潜力(暴击 + 高伤)
  const critChance = clamp((skill.critModifier + actor.crit) / 100, 0, 1);
  const hitChance = clamp((skill.accuracy + actor.accuracy - target.dodge) / 100, 0, 1);
  const avgDmg =
    (skill.baseDamage.min + skill.baseDamage.max) / 2 *
    (1 + skill.damageModifier) *
    (1 - target.protection / 100);

  // 击杀可能
  if (avgDmg * 1.5 * hitChance >= target.hp) {
    score += 50;
  }
  // 命中概率
  score += hitChance * 20;
  // 暴击概率
  score += critChance * 10;
  // 目标 HP 比例(越低越好,但不要给已经死的人)
  score += (1 - target.hp / target.maxHp) * 8;
  // 标记目标有加成
  if (target.mark) score += 6;
  // DOT 抗性
  for (const e of skill.effects) {
    if (e.type === 'bleed') {
      score += (1 - target.bleedResist) * 4;
    }
    if (e.type === 'blight') {
      score += (1 - target.blightResist) * 4;
    }
  }
  // 自身有 prot buff 的少用单体攻击
  if (actor.protBuff && skill.targetSide !== 'self') {
    score -= 2;
  }
  return score;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
