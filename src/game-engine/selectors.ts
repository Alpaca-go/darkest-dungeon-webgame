/**
 * ViewModel / Selectors
 *
 * 纯函数:BattleState + UI 上下文 → ViewModel
 * 不修改 state,只做计算和投影。
 *
 * ViewModel 是给 UI 层用的"扁平/聚合/可观察"的数据形态。
 */

import type {
  BattleActor,
  BattleState,
  Rank,
  Side,
  SkillDefinition,
} from './types.js';
import { findActorInLists } from './battle/round.js';
import { liveAllies, liveEnemies } from './invariants.js';

// ===== ViewModel 类型定义 =====

export interface ActorViewModel {
  id: string;
  name: string;
  archetype: string;
  side: Side;
  rank: Rank;
  hp: number;
  maxHp: number;
  hpPercent: number;
  bleed: { id: string; damagePerTurn: number; remainingTurns: number; sourceId: string }[];
  blight: { id: string; damagePerTurn: number; remainingTurns: number; sourceId: string }[];
  stun: { remaining: number; resistRemaining: number } | null;
  mark: { remaining: number; sourceId: string } | null;
  protBuff: { amount: number; remaining: number; sourceId: string } | null;
  isDead: boolean;
  isCorpse: boolean;
  isActive: boolean;
}

export interface SkillButtonViewModel {
  id: string;
  name: string;
  targetSide: Side | 'self';
  targetMode: 'single' | 'all' | 'adjacent' | 'self';
  enabled: boolean;
  disabledReason?: string;
  usableFromRanks: Rank[];
  targetRanks: Rank[];
  /** 伤害预览(对单个目标的预估,非确定性) */
  damagePreview?: string;
  /** 暴击预览 */
  critChance: number;
  /** 命中预览(actor.acc + skill.acc - target.dodge,钳制后) */
  accuracyPreview?: number;
  /** 效果摘要(中文) */
  statusSummary: string[];
  /** 冷却剩余 */
  cooldown: number;
}

export interface InitiativeItemViewModel {
  actorId: string;
  side: Side;
  name: string;
  /** true = 已经行动过(不在队列里) */
  acted: boolean;
  /** true = 当前正在行动 */
  active: boolean;
}

export interface BattleLogItemViewModel {
  id: string;
  sequence: number;
  type: string;
  /** 面向玩家的中文描述 */
  message: string;
  /** 调试细节 */
  detail?: string;
  /** 时间戳(派生:从 createdAt) */
  createdAt: string;
}

export interface BattleResultViewModel {
  outcome: 'victory' | 'defeat';
  seed: string;
  rounds: number;
  totalEvents: number;
  /** 详细的统计 */
  stats: BattleResultStats;
}

export interface BattleResultStats {
  totalDamageDealt: number;
  totalDamageTaken: number;
  critCount: number;
  missCount: number;
  bleedDamage: number;
  blightDamage: number;
  stunCount: number;
  moveCount: number;
  deaths: { actorId: string; name: string; side: Side }[];
  /** 英雄剩余 HP */
  heroesHp: { id: string; name: string; hp: number; maxHp: number }[];
  /** 敌人在每场战斗中的死亡数 */
  enemiesKilled: number;
}

export interface BattleScreenViewModel {
  round: number;
  phase: string;
  activeActor: ActorViewModel | null;
  heroes: ActorViewModel[];
  enemies: ActorViewModel[];
  corpses: ActorViewModel[];
  initiative: InitiativeItemViewModel[];
  skills: SkillButtonViewModel[];
  validTargetIds: string[];
  invalidTargetReasons: Record<string, string>;
  recentEvents: BattleLogItemViewModel[];
  result: BattleResultViewModel | null;
  canPlayerInteract: boolean;
}

// ===== Actor ViewModel =====

export function actorToViewModel(actor: BattleActor, isActive: boolean): ActorViewModel {
  return {
    id: actor.id,
    name: actor.name,
    archetype: actor.archetype,
    side: actor.side,
    rank: actor.rank,
    hp: actor.hp,
    maxHp: actor.maxHp,
    hpPercent: actor.maxHp > 0 ? actor.hp / actor.maxHp : 0,
    bleed: actor.bleed.map((d) => ({
      id: d.id,
      damagePerTurn: d.damagePerTurn,
      remainingTurns: d.remainingTurns,
      sourceId: d.sourceId,
    })),
    blight: actor.blight.map((d) => ({
      id: d.id,
      damagePerTurn: d.damagePerTurn,
      remainingTurns: d.remainingTurns,
      sourceId: d.sourceId,
    })),
    stun: actor.stun
      ? { remaining: actor.stun.remaining, resistRemaining: actor.stun.resistRemaining }
      : null,
    mark: actor.mark ? { remaining: actor.mark.remaining, sourceId: actor.mark.sourceId } : null,
    protBuff: actor.protBuff
      ? {
          amount: actor.protBuff.amount,
          remaining: actor.protBuff.remaining,
          sourceId: actor.protBuff.sourceId,
        }
      : null,
    isDead: actor.isDead,
    isCorpse: actor.kind === 'corpse',
    isActive,
  };
}

// ===== Skill Button ViewModel =====

export function skillToButtonViewModel(
  skill: SkillDefinition,
  actor: BattleActor,
  state: BattleState,
): SkillButtonViewModel {
  const cooldown = actor.cooldowns[skill.id] ?? 0;

  // 站位合法?
  if (!skill.usableFromRanks.includes(actor.rank)) {
    return makeButton(skill, actor, false, `当前技能不能从 ${actor.rank} 号位使用`, cooldown);
  }

  // 冷却?
  if (cooldown > 0) {
    return makeButton(skill, actor, false, `冷却中,还需 ${cooldown} 回合`, cooldown);
  }

  // 合法目标?
  const validTargets = getValidTargetsForSkill(state, actor, skill);
  if (validTargets.length === 0) {
    let reason = '当前没有合法目标';
    if (skill.targetSide === 'ally') reason = '当前没有存活的友军可治疗';
    else if (skill.targetSide === 'self' && actor.isDead) reason = '无法对自己使用';
    else if (skill.targetMode !== 'self') reason = '该技能没有合法目标';
    return makeButton(skill, actor, false, reason, cooldown);
  }

  // 计算预览(对第一个目标)
  const sample = validTargets[0]!;
  const accuracyPreview = clamp(skill.accuracy + actor.accuracy - sample.dodge, 5, 95);
  const dmgPreview = skill.effects.some((e) => e.type === 'damage')
    ? `${skill.baseDamage.min}-${skill.baseDamage.max}${
        skill.damageModifier !== 0
          ? skill.damageModifier > 0
            ? `(+${Math.round(skill.damageModifier * 100)}%)`
            : `(${Math.round(skill.damageModifier * 100)}%)`
          : ''
      }`
    : undefined;

  return {
    ...makeButton(skill, actor, true, undefined, cooldown),
    damagePreview: dmgPreview,
    accuracyPreview,
    critChance: clamp(skill.critModifier + actor.crit, 0, 100),
    statusSummary: buildStatusSummary(skill),
  };
}

function makeButton(
  skill: SkillDefinition,
  _actor: BattleActor,
  enabled: boolean,
  disabledReason: string | undefined,
  cooldown: number,
): SkillButtonViewModel {
  return {
    id: skill.id,
    name: skill.name,
    targetSide: skill.targetSide,
    targetMode: skill.targetMode,
    enabled,
    disabledReason,
    usableFromRanks: skill.usableFromRanks,
    targetRanks: skill.targetRanks,
    critChance: 0,
    statusSummary: buildStatusSummary(skill),
    cooldown,
  };
}

function buildStatusSummary(skill: SkillDefinition): string[] {
  const out: string[] = [];
  for (const e of skill.effects) {
    switch (e.type) {
      case 'damage':
        break;
      case 'heal':
        out.push(`治疗 +${e.flat}`);
        break;
      case 'bleed':
        out.push(`流血 ${e.baseDamage}/回合 × ${e.duration}`);
        break;
      case 'blight':
        out.push(`腐蚀 ${e.baseDamage}/回合 × ${e.duration}`);
        break;
      case 'stun':
        out.push(`眩晕 ${e.duration} 回合`);
        break;
      case 'mark':
        out.push(`标记 ${e.duration} 回合`);
        break;
      case 'prot_buff':
        out.push(`PROT +${e.amount}% ${e.duration} 回合`);
        break;
    }
  }
  if (skill.moveSelf !== undefined && skill.moveSelf !== 0) {
    out.push(`自身位移 ${skill.moveSelf > 0 ? '+' : ''}${skill.moveSelf}`);
  }
  if (skill.moveTarget !== undefined && skill.moveTarget !== 0) {
    out.push(`目标位移 ${skill.moveTarget > 0 ? '+' : ''}${skill.moveTarget}`);
  }
  return out;
}

// ===== Valid Targets =====

/**
 * 返回一个技能的所有合法目标(actor 列表)
 */
export function getValidTargetsForSkill(
  state: BattleState,
  actor: BattleActor,
  skill: SkillDefinition,
): BattleActor[] {
  if (!skill.usableFromRanks.includes(actor.rank)) return [];
  const cd = actor.cooldowns[skill.id] ?? 0;
  if (cd > 0) return [];

  if (skill.targetMode === 'self') {
    return [actor];
  }

  const pool =
    skill.targetSide === 'ally'
      ? liveAllies(state).filter((a) => a.id !== actor.id || skill.targetSide !== 'ally' || skill.targetMode !== 'single')
      : liveEnemies(state);

  const validByRank = pool.filter((a) => skill.targetRanks.includes(a.rank));

  if (skill.targetMode === 'all') {
    return validByRank;
  }

  if (skill.targetMode === 'single' || skill.targetMode === 'adjacent') {
    return validByRank;
  }

  return [];
}

/**
 * 给出 targetId 在当前技能下的合法性
 */
export function checkTargetValidity(
  state: BattleState,
  actor: BattleActor,
  skill: SkillDefinition,
  targetId: string,
): { valid: boolean; reason?: string } {
  if (!skill.usableFromRanks.includes(actor.rank)) {
    return { valid: false, reason: `当前技能不能从 ${actor.rank} 号位使用` };
  }
  const cd = actor.cooldowns[skill.id] ?? 0;
  if (cd > 0) {
    return { valid: false, reason: `冷却中,还需 ${cd} 回合` };
  }

  if (skill.targetMode === 'self') {
    if (targetId !== actor.id) {
      return { valid: false, reason: '该技能只能选择自身' };
    }
    return { valid: true };
  }

  const target = findActorInLists(state, targetId);
  if (!target) {
    return { valid: false, reason: '目标不存在' };
  }
  if (target.isDead) {
    return { valid: false, reason: '该目标已经死亡' };
  }
  if (target.kind === 'corpse' && !canTargetCorpse(skill)) {
    return { valid: false, reason: '该技能不能攻击尸体' };
  }
  if (skill.targetSide === 'ally' && target.side !== 'ally') {
    return { valid: false, reason: '该技能只能选择友军' };
  }
  if (skill.targetSide === 'enemy' && target.side !== 'enemy') {
    return { valid: false, reason: '该技能只能选择敌人' };
  }
  if (!skill.targetRanks.includes(target.rank)) {
    return {
      valid: false,
      reason: `该技能只能攻击 ${formatRanks(skill.targetRanks)} 号位`,
    };
  }
  return { valid: true };
}

function canTargetCorpse(_skill: SkillDefinition): boolean {
  // MVP: 不能选择尸体为目标
  return false;
}

function formatRanks(ranks: Rank[]): string {
  const sorted = [...ranks].sort();
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return `${sorted[0]}`;
  if (sorted[sorted.length - 1]! - sorted[0]! === sorted.length - 1) {
    return `${sorted[0]}-${sorted[sorted.length - 1]}`;
  }
  return sorted.join('、');
}

// ===== Initiative =====

export function buildInitiativeViewModel(state: BattleState): InitiativeItemViewModel[] {
  const acted = new Set<string>();
  // 当前轮已经行动过的:从 state.log 里找 TURN_ENDED
  // 简化:列出所有活着的(非尸体)单位,active = activeActorId,acted = 已经不在队列里
  for (const a of [...state.heroes, ...state.enemies]) {
    if (a.isDead || a.kind === 'corpse') continue;
    if (state.activeActorId === a.id) continue;
    if (!state.initiativeQueue.includes(a.id)) {
      acted.add(a.id);
    }
  }
  const out: InitiativeItemViewModel[] = [];
  for (const a of [...state.heroes, ...state.enemies]) {
    if (a.isDead || a.kind === 'corpse') continue;
    out.push({
      actorId: a.id,
      side: a.side,
      name: a.name,
      active: state.activeActorId === a.id,
      acted: acted.has(a.id),
    });
  }
  return out;
}

// ===== Battle Log =====

/** 把单个 DomainEvent 翻译成中文日志 */
export function eventToLogItem(event: import('./domain-events.js').DomainEvent): BattleLogItemViewModel {
  const base = {
    id: event.id,
    sequence: event.sequence,
    type: event.type,
    createdAt: event.createdAt,
  };
  switch (event.type) {
    case 'BATTLE_STARTED':
      return { ...base, type: event.type, message: '战斗开始', createdAt: event.createdAt };
    case 'BATTLE_ENDED':
      return {
        ...base,
        type: event.type,
        message: event.payload.outcome === 'victory' ? '战斗胜利' : '战斗失败',
        createdAt: event.createdAt,
      };
    case 'ROUND_STARTED':
      return { ...base, type: event.type, message: `第 ${event.payload.round} 回合开始`, createdAt: event.createdAt };
    case 'ROUND_ENDED':
      return { ...base, type: event.type, message: `第 ${event.payload.round} 回合结束`, createdAt: event.createdAt };
    case 'TURN_STARTED':
      return { ...base, type: event.type, message: `${actorName(stateByEventId(event), event.payload.actorId)} 开始行动`, createdAt: event.createdAt };
    case 'TURN_ENDED':
      return { ...base, type: event.type, message: `${actorName(stateByEventId(event), event.payload.actorId)} 行动结束`, createdAt: event.createdAt };
    case 'SKILL_USED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.actorId)} 使用技能 ${event.payload.skillId}`,
        createdAt: event.createdAt,
      };
    case 'SKILL_MISSED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.actorId)} 攻击未命中`,
        createdAt: event.createdAt,
      };
    case 'DAMAGE_DEALT':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 受到 ${event.payload.amount} 伤害${
          event.payload.crit ? '(暴击!)' : ''
        }`,
        createdAt: event.createdAt,
      };
    case 'HEALING_APPLIED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 恢复 ${event.payload.amount} HP`,
        createdAt: event.createdAt,
      };
    case 'CRIT_ROLLED':
      return {
        ...base,
        type: event.type,
        message: '暴击!',
        createdAt: event.createdAt,
      };
    case 'BLEED_APPLIED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 被施加流血`,
        createdAt: event.createdAt,
      };
    case 'BLIGHT_APPLIED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 被施加腐蚀`,
        createdAt: event.createdAt,
      };
    case 'STUN_APPLIED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 被眩晕`,
        createdAt: event.createdAt,
      };
    case 'STUN_RESISTED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 抵抗了眩晕`,
        createdAt: event.createdAt,
      };
    case 'STUN_WORE_OFF':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 眩晕解除`,
        createdAt: event.createdAt,
      };
    case 'MARK_APPLIED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 被标记`,
        createdAt: event.createdAt,
      };
    case 'MARK_WORE_OFF':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 标记消失`,
        createdAt: event.createdAt,
      };
    case 'PROT_BUFF_APPLIED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 获得 PROT +${event.payload.amount}%`,
        createdAt: event.createdAt,
      };
    case 'PROT_BUFF_WORE_OFF':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} PROT 增益消失`,
        createdAt: event.createdAt,
      };
    case 'DOT_TICKED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 受到 ${event.payload.damage} 点 ${event.payload.type === 'bleed' ? '流血' : '腐蚀'} 伤害`,
        createdAt: event.createdAt,
      };
    case 'DOT_WORE_OFF':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.targetId)} 的 ${event.payload.type === 'bleed' ? '流血' : '腐蚀'} 已消失`,
        createdAt: event.createdAt,
      };
    case 'ACTOR_DIED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.actorId)} 阵亡`,
        createdAt: event.createdAt,
      };
    case 'CORPSE_SPAWNED':
      return {
        ...base,
        type: event.type,
        message: `在 ${event.payload.rank} 号位生成尸体`,
        createdAt: event.createdAt,
      };
    case 'CORPSE_CLEARED':
      return {
        ...base,
        type: event.type,
        message: '尸体已清除',
        createdAt: event.createdAt,
      };
    case 'ACTOR_MOVED':
      return {
        ...base,
        type: event.type,
        message: `${actorName(stateByEventId(event), event.payload.actorId)} 从 ${event.payload.fromRank} 号位移到 ${event.payload.toRank} 号位`,
        createdAt: event.createdAt,
      };
    case 'INITIATIVE_ROLLED':
      return {
        ...base,
        type: event.type,
        message: '本轮行动顺序已确定',
        createdAt: event.createdAt,
      };
    case 'NO_VALID_TARGET':
      return {
        ...base,
        type: event.type,
        message: '没有合法目标',
        createdAt: event.createdAt,
      };
    case 'AI_DECISION':
      return {
        ...base,
        type: event.type,
        message: '敌人选择行动',
        createdAt: event.createdAt,
      };
  }
}

function actorName(state: BattleState | undefined, id: string): string {
  if (!state) return id;
  const a = findActorInLists(state, id);
  return a ? a.name : id;
}

/** 内部辅助:从 event 反推 state(在 selectors 上下文里) */
function stateByEventId(_event: import('./domain-events.js').DomainEvent): BattleState | undefined {
  // 简化:由调用方注入。返回 undefined 时退化为 id 显示
  return undefined;
}

// ===== Battle Result =====

export function buildBattleResultViewModel(state: BattleState, seed: string): BattleResultViewModel {
  const stats = computeStats(state);
  return {
    outcome: state.phase === 'victory' ? 'victory' : 'defeat',
    seed,
    rounds: state.round,
    totalEvents: state.log.length,
    stats,
  };
}

function computeStats(state: BattleState): BattleResultStats {
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let critCount = 0;
  let missCount = 0;
  let bleedDamage = 0;
  let blightDamage = 0;
  let stunCount = 0;
  let moveCount = 0;
  const deaths: BattleResultStats['deaths'] = [];

  for (const e of state.log) {
    switch (e.type) {
      case 'DAMAGE_DEALT': {
        if (e.payload.sourceId.startsWith('hero.')) {
          totalDamageDealt += e.payload.amount;
        } else {
          totalDamageTaken += e.payload.amount;
        }
        if (e.payload.crit) critCount++;
        break;
      }
      case 'SKILL_MISSED':
        missCount++;
        break;
      case 'DOT_TICKED':
        if (e.payload.type === 'bleed') bleedDamage += e.payload.damage;
        else blightDamage += e.payload.damage;
        break;
      case 'STUN_APPLIED':
        stunCount++;
        break;
      case 'ACTOR_MOVED':
        moveCount++;
        break;
      case 'ACTOR_DIED': {
        const a = findActorInLists(state, e.payload.actorId);
        deaths.push({
          actorId: e.payload.actorId,
          name: a?.name ?? e.payload.actorId,
          side: e.payload.side,
        });
        break;
      }
    }
  }

  const heroesHp = state.heroes.map((h) => ({
    id: h.id,
    name: h.name,
    hp: h.hp,
    maxHp: h.maxHp,
  }));

  const enemiesKilled = deaths.filter((d) => d.side === 'enemy').length;

  return {
    totalDamageDealt,
    totalDamageTaken,
    critCount,
    missCount,
    bleedDamage,
    blightDamage,
    stunCount,
    moveCount,
    deaths,
    heroesHp,
    enemiesKilled,
  };
}

// ===== Master ViewModel =====

export interface BuildViewModelInput {
  state: BattleState;
  selectedSkillId: string | null;
  seed: string;
}

export function buildBattleScreenViewModel(input: BuildViewModelInput): BattleScreenViewModel {
  const { state, selectedSkillId, seed } = input;
  const activeActor = state.activeActorId
    ? findActorInLists(state, state.activeActorId) ?? null
    : null;
  const isPlayerTurn = activeActor?.side === 'ally' && state.phase === 'actor-turn';
  const isVictoryOrDefeat = state.phase === 'victory' || state.phase === 'defeat';

  // 技能按钮
  let skills: SkillButtonViewModel[] = [];
  if (activeActor && !isVictoryOrDefeat) {
    const loadout = state.loadouts[activeActor.id] ?? [];
    const skillReg = state.skillRegistry;
    for (const slot of loadout) {
      const skill = skillReg[slot.skillId];
      if (!skill) continue;
      skills.push(skillToButtonViewModel(skill, activeActor, state));
    }
  }

  // 合法目标
  let validTargetIds: string[] = [];
  const invalidTargetReasons: Record<string, string> = {};
  if (activeActor && selectedSkillId && isPlayerTurn) {
    const skill = state.skillRegistry[selectedSkillId];
    if (skill) {
      const allActorsList = [...state.heroes, ...state.enemies];
      for (const a of allActorsList) {
        const result = checkTargetValidity(state, activeActor, skill, a.id);
        if (result.valid) {
          validTargetIds.push(a.id);
        } else if (result.reason) {
          invalidTargetReasons[a.id] = result.reason;
        }
      }
    }
  }

  return {
    round: state.round,
    phase: state.phase,
    activeActor: activeActor ? actorToViewModel(activeActor, true) : null,
    heroes: state.heroes.map((a) => actorToViewModel(a, state.activeActorId === a.id)),
    enemies: state.enemies.map((a) => actorToViewModel(a, state.activeActorId === a.id)),
    corpses: state.corpses.map((a) => actorToViewModel(a, false)),
    initiative: buildInitiativeViewModel(state),
    skills,
    validTargetIds,
    invalidTargetReasons,
    recentEvents: state.log.slice(-50).map(eventToLogItem),
    result: isVictoryOrDefeat ? buildBattleResultViewModel(state, seed) : null,
    canPlayerInteract: isPlayerTurn,
  };
}

// ===== helpers =====

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
