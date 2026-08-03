/**
 * 遭遇自动结算器(SPEC §16 §20)
 *
 * 选择式遭遇内部执行:
 *   1. 选择主要执行者(基于战术方案)
 *   2. 生成英雄行动计划(AI 选技能 + 选目标)
 *   3. 命中/伤害/状态结算(走底层 BattleContext)
 *   4. 敌方反应(走 decideAiAction)
 *   5. 死亡/位移结算
 *   6. 生成摘要
 */

import { BattleContext } from '../battle/context.js';
import { startRound, beginTurn, endTurn, findActorInLists } from '../battle/round.js';
import { useSkill } from '../battle/skill.js';
import { decideAiAction } from '../battle/ai.js';
import { liveAllies, liveEnemies } from '../invariants.js';
import { createBattle } from '../battle/create.js';
import { ENEMY_LINEUP } from '../../content/enemies/lineup.js';
import { PARTY_LINEUP } from '../../content/heroes/lineup.js';
import { ALL_SKILLS } from '../../content/skills/index.js';
import { nextTransactionId } from '../transaction.js';
import type { EncounterDef, EncounterState, GameState, HeroInstance, TacticalPlan } from './types.js';
import type { SkillDefinition } from '../types.js';
import { ExpeditionContext } from './context.js';
import type { BattleState as OldBattleState, BattleActor as OldBattleActor } from '../types.js';
import type { DomainEvent as BattleDomainEvent } from '../domain-events.js';
import { enterDeathsDoor, leaveDeathsDoor, checkDeathblow, applyStress } from '../mental/index.js';

const MAX_AI_DECISION_RETRIES = 5;

/** 启动遭遇:创建 BattleState 并挂到 ctx.state.encounter */
export function startEncounter(
  state: GameState,
  def: EncounterDef,
  seed: string,
): EncounterState {
  const heroes: OldBattleActor[] = [];
  const heroLoadout: Record<string, { skillId: string }[]> = {};
  for (const id of ['hero.crusader', 'hero.highwayman', 'hero.vestal', 'hero.plague_doctor']) {
    const party = state.party[id];
    if (!party) continue; // 缺失英雄跳过
    if (party.isDead) {
      // Phase 2:永久死亡英雄在下次遭遇作为 corpse 占位
      continue;
    }
    heroes.push(heroToBattleActor(party));
    heroLoadout[id] = party.skills.map((s) => ({ skillId: s }));
  }
  heroes.sort((a, b) => a.rank - b.rank);

  const enemies: OldBattleActor[] = [];
  const enemyLoadout: Record<string, { skillId: string }[]> = {};
  for (const enemyId of def.enemyFormation) {
    const defn = ENEMY_LINEUP.find((e) => e.actor.id === enemyId);
    if (!defn) throw new Error(`unknown enemy ${enemyId}`);
    const actor = buildEnemyActor(defn);
    enemies.push(actor);
    enemyLoadout[actor.id] = (defn.skills ?? []).map((s) => ({ skillId: s.skillId }));
  }

  const skillRegistry: Record<string, SkillDefinition> = {};
  for (const slot of Object.values(heroLoadout)) {
    for (const s of slot) {
      const sd = ALL_SKILLS.find((x) => x.id === s.skillId);
      if (sd) skillRegistry[s.skillId] = sd;
    }
  }
  for (const slot of Object.values(enemyLoadout)) {
    for (const s of slot) {
      const sd = ALL_SKILLS.find((x) => x.id === s.skillId);
      if (sd) skillRegistry[s.skillId] = sd;
    }
  }

  const battle = createBattle({
    battleId: `battle_${Date.now().toString(36)}`,
    heroes,
    enemies,
    loadouts: { ...heroLoadout, ...enemyLoadout },
    skillRegistry,
    seed,
  });

  const encounter: EncounterState = {
    id: `enc_${Date.now().toString(36)}`,
    encounterDefId: def.id,
    sceneId: def.sceneId,
    round: 0,
    heroActorIds: heroes.map((h) => h.id),
    enemyActorIds: enemies.map((e) => e.id),
    actors: {},
    skillRegistry,
    status: 'intro',
    availableChoiceIds: [],
    selectedChoiceId: null,
    events: [],
    rng: battle.rng,
    maxRounds: def.maxRounds,
  };
  for (const a of [...battle.heroes, ...battle.enemies]) {
    encounter.actors[a.id] = a;
  }
  return encounter;
}

function heroToBattleActor(h: HeroInstance): OldBattleActor {
  return {
    id: h.id,
    kind: 'hero',
    side: 'ally',
    rank: h.rank,
    name: h.name,
    archetype: h.archetype,
    hp: h.hp,
    maxHp: h.maxHp,
    dodge: h.dodge,
    protection: h.protection,
    speed: h.speed,
    accuracy: h.accuracy,
    crit: h.crit,
    bleedResist: h.bleedResist,
    blightResist: h.blightResist,
    stunResist: h.stunResist,
    moveResist: h.moveResist,
    deathblowResist: 0.67,
    bleed: h.bleed,
    blight: h.blight,
    stun: h.stun,
    mark: h.mark,
    protBuff: h.protBuff,
    cooldowns: h.cooldowns,
    isDead: h.isDead,
  };
}

function buildEnemyActor(defn: typeof ENEMY_LINEUP[number]): OldBattleActor {
  const a = defn.actor;
  return {
    id: a.id,
    kind: 'enemy',
    side: 'enemy',
    rank: a.rank,
    name: a.name,
    archetype: a.archetype,
    hp: a.maxHp,
    maxHp: a.maxHp,
    dodge: a.dodge,
    protection: a.protection,
    speed: a.speed,
    accuracy: a.accuracy,
    crit: a.crit,
    bleedResist: a.bleedResist,
    blightResist: a.blightResist,
    stunResist: a.stunResist,
    moveResist: a.moveResist,
    deathblowResist: 0.67,
    bleed: [],
    blight: [],
    stun: null,
    mark: null,
    protBuff: null,
    cooldowns: {},
    isDead: false,
  };
}

function encounter_hero_skill_ids(_enc: EncounterState, heroId: string): string[] | null {
  const party = PARTY_LINEUP.find((p) => p.actor.id === heroId);
  if (!party) return null;
  return party.skills.map((s) => s.skillId);
}

function encounter_enemy_skill_ids(_enc: EncounterState, enemyId: string): string[] | null {
  const enemy = ENEMY_LINEUP.find((e) => e.actor.id === enemyId);
  if (!enemy) return null;
  return enemy.skills.map((s) => s.skillId);
}

/** 把 encounter.actors 还原为 BattleState */
function encounterToBattleState(enc: EncounterState, transactionId: string): OldBattleState {
  const heroes: OldBattleActor[] = [];
  const enemies: OldBattleActor[] = [];
  const corpses: OldBattleActor[] = [];
  for (const id of enc.heroActorIds) {
    const a = enc.actors[id];
    if (!a) continue;
    if (a.kind === 'corpse') corpses.push(a);
    else heroes.push(a);
  }
  for (const id of enc.enemyActorIds) {
    const a = enc.actors[id];
    if (!a) continue;
    if (a.kind === 'corpse') corpses.push(a);
    else enemies.push(a);
  }
  const loadouts: Record<string, { skillId: string }[]> = {};
  for (const h of heroes) {
    const ids = encounter_hero_skill_ids(enc, h.id);
    if (ids) loadouts[h.id] = ids.map((s) => ({ skillId: s }));
  }
  for (const e of enemies) {
    const ids = encounter_enemy_skill_ids(enc, e.id);
    if (ids) loadouts[e.id] = ids.map((s) => ({ skillId: s }));
  }
  return {
    id: enc.id,
    round: enc.round,
    phase: 'setup',
    heroes,
    enemies,
    corpses,
    initiativeQueue: [],
    activeActorId: null,
    loadouts,
    skillRegistry: enc.skillRegistry,
    transactionId,
    sequence: 0,
    rng: enc.rng,
    log: [],
  };
}

function syncEncounterFromBattle(enc: EncounterState, battle: OldBattleState): void {
  enc.actors = {};
  for (const a of [...battle.heroes, ...battle.enemies, ...battle.corpses]) {
    enc.actors[a.id] = a;
  }
  enc.round = battle.round;
  enc.rng = battle.rng;
}

export interface RunRoundResult {
  encounter: EncounterState;
  summary: string[];
  victory: boolean;
  defeat: boolean;
  newBattleEvents: BattleDomainEvent[];
}

/** 应用战术方案跑 1 轮 */
export function runTacticalRound(
  state: GameState,
  encounter: EncounterState,
  plan: TacticalPlan,
): RunRoundResult {
  let battle = encounterToBattleState(encounter, state.lastTransactionId ?? nextTransactionId());

  if (battle.phase === 'setup' || battle.phase === 'round-end') {
    const ctx = new BattleContext(battle);
    startRound(ctx);
    battle = ctx.state;
  }

  const summary: string[] = [];
  const newBattleEvents: BattleDomainEvent[] = [];
  const seenEventIds = new Set<string>();

  const collectEvents = (state: OldBattleState) => {
    for (const e of state.log) {
      if (!seenEventIds.has(e.id)) {
        seenEventIds.add(e.id);
        newBattleEvents.push(e);
      }
    }
  };

  let safety = 0;
  while (battle.initiativeQueue.length > 0) {
    safety += 1;
    if (safety > 1000) break;

    if (liveAllies(battle).length === 0) {
      battle.phase = 'defeat';
      break;
    }
    if (liveEnemies(battle).length === 0) {
      battle.phase = 'victory';
      break;
    }

    const actorId = battle.initiativeQueue[0]!;
    const actor = findActorInLists(battle, actorId);
    if (!actor || actor.isDead || actor.kind === 'corpse') {
      const ctx = new BattleContext(battle);
      ctx.state.initiativeQueue = ctx.state.initiativeQueue.slice(1);
      ctx.commit();
      battle = ctx.state;
      collectEvents(battle);
      continue;
    }

    {
      const ctx = new BattleContext(battle);
      const result = beginTurn(ctx, actorId);
      battle = ctx.state;
      collectEvents(battle);
      if (!result.canAct) continue;
    }

    const action = actor.side === 'ally'
      ? pickHeroAction(battle, actor, plan)
      : pickEnemyAction(battle, actor);

    if (action) {
      const ctx = new BattleContext(battle);
      useSkill(ctx, actor.id, action.skillId, action.targetIds);
      battle = ctx.state;
      collectEvents(battle);
      battle.initiativeQueue = battle.initiativeQueue.filter((id) => {
        const a = findActorInLists(battle, id);
        return a && !a.isDead && a.kind !== 'corpse';
      });
      const sk = battle.skillRegistry[action.skillId];
      const target = action.targetIds[0] ? findActorInLists(battle, action.targetIds[0]) : null;
      if (sk) {
        summary.push(`${actor.name} 使用 ${sk.name}` + (target ? ` → ${target.name}` : '') + '.');
      }
    } else {
      const ctx = new BattleContext(battle);
      ctx.emit('NO_VALID_TARGET', { actorId, skillId: '' });
      battle = ctx.state;
      collectEvents(battle);
      summary.push(`${actor.name} 找不到合法目标。`);
    }

    {
      const ctx = new BattleContext(battle);
      endTurn(ctx);
      battle = ctx.state;
    }
  }

  let victory = false;
  let defeat = false;
  if (liveEnemies(battle).length === 0) {
    victory = true;
    battle.phase = 'victory';
  } else if (liveAllies(battle).length === 0) {
    defeat = true;
    battle.phase = 'defeat';
  } else if (battle.round >= encounter.maxRounds) {
    defeat = true;
    battle.phase = 'defeat';
  }

  syncEncounterFromBattle(encounter, battle);
  encounter.events.push(...newBattleEvents);

  return { encounter, summary, victory, defeat, newBattleEvents };
}

function pickHeroAction(
  state: OldBattleState,
  actor: OldBattleActor,
  plan: TacticalPlan,
): { skillId: string; targetIds: string[] } | null {
  const loadout = state.loadouts[actor.id] ?? [];
  const skills = loadout
    .map((s) => state.skillRegistry[s.skillId])
    .filter((s): s is SkillDefinition => !!s);

  let candidates = skills.filter(
    (s) => s.usableFromRanks.includes(actor.rank) && (actor.cooldowns[s.id] ?? 0) <= 0,
  );

  switch (plan.planType) {
    case 'assault':
      candidates = candidates.filter((s) => s.targetSide === 'enemy' && (s.effects.some((e: { type: string }) => e.type === 'damage') || s.effects.length === 0));
      break;
    case 'backline':
      candidates = candidates.filter((s) => s.targetSide === 'enemy' && (s.targetRanks.includes(4 as any) || s.targetMode === 'all'));
      break;
    case 'control':
      candidates = candidates.filter((s) =>
        s.effects.some((e: { type: string }) => e.type === 'bleed' || e.type === 'blight' || e.type === 'stun' || e.type === 'mark'),
      );
      break;
    case 'stabilize':
      candidates = candidates.filter((s) => s.effects.some((e: { type: string }) => e.type === 'heal') || s.targetSide === 'self');
      break;
    case 'reform':
      candidates = candidates.filter((s) => s.moveSelf !== undefined);
      break;
    case 'use-item':
      return null;
    case 'retreat':
      return null;
  }

  if (candidates.length === 0) {
    candidates = skills.filter((s) => s.targetSide === 'enemy' && s.usableFromRanks.includes(actor.rank) && (actor.cooldowns[s.id] ?? 0) <= 0);
  }
  if (candidates.length === 0) return null;

  const skill = candidates[0]!;
  const targets: OldBattleActor[] = skill.targetSide === 'enemy'
    ? liveEnemies(state).filter((e) => skill.targetRanks.includes(e.rank))
    : skill.targetSide === 'ally'
      ? liveAllies(state).filter((e) => skill.targetRanks.includes(e.rank))
      : [actor];

  if (skill.targetMode === 'all') {
    if (targets.length === 0) return null;
    return { skillId: skill.id, targetIds: targets.map((t) => t.id) };
  }
  if (skill.targetMode === 'self') {
    return { skillId: skill.id, targetIds: [actor.id] };
  }
  if (targets.length === 0) {
    const pool = skill.targetSide === 'enemy' ? liveEnemies(state) : liveAllies(state);
    if (pool.length === 0) return null;
    return { skillId: skill.id, targetIds: [pool[0]!.id] };
  }
  return { skillId: skill.id, targetIds: [targets[0]!.id] };
}

function pickEnemyAction(
  state: OldBattleState,
  actor: OldBattleActor,
): { skillId: string; targetIds: string[] } | null {
  for (let i = 0; i < MAX_AI_DECISION_RETRIES; i++) {
    const ctx = new BattleContext(state);
    const decision = decideAiAction(ctx, actor.id);
    if (decision) {
      return { skillId: decision.skillId, targetIds: decision.targetId ? [decision.targetId] : [] };
    }
  }
  return null;
}

export function syncPartyFromEncounter(state: GameState, encounter: EncounterState, ctx?: ExpeditionContext): void {
  for (const id of encounter.heroActorIds) {
    const ba = encounter.actors[id];
    if (!ba) continue;
    const party = state.party[id];
    if (!party) continue;
    // Phase 2:HP 转换(死亡之门 / 致死打击 / 离开死亡之门)
    let nextHp = ba.hp;
    let nextIsDead = ba.isDead;
    if (ctx && !party.isDead) {
      const prevHp = party.hp;
      const prevAtDeathsDoor = party.atDeathsDoor;
      // battle 层认为死了 → Phase 2 视角下要么进死亡之门要么致死打击
      if (nextHp <= 0) {
        if (prevAtDeathsDoor) {
          // 已在死亡之门:进死亡之门(若还没)+ 致死打击检定
          if (!party.atDeathsDoor) {
            enterDeathsDoor(ctx, party, 'encounter-damage', prevHp);
          }
          nextHp = 0;
          nextIsDead = false; // 让 Phase 2 决定
          checkDeathblow(ctx, party, 'encounter');
          // checkDeathblow 可能把 isDead 变成 true
          nextIsDead = party.isDead;
        } else {
          // 第一次归零:进死亡之门
          enterDeathsDoor(ctx, party, 'encounter-damage', prevHp);
          nextHp = 0;
          nextIsDead = false;
        }
      } else if (prevAtDeathsDoor && prevHp === 0) {
        // 死亡之门被治愈
        leaveDeathsDoor(ctx, party, nextHp);
      }
      // 同步 stress(来自 battle damage)
      // ally damage:被攻击时 +3 stress
      if (ba.hp < prevHp) {
        const lost = prevHp - ba.hp;
        if (lost > 0 && !party.isDead) {
          applyStress(ctx, { type: 'apply-stress', heroId: party.id, amount: 3, source: 'encounter-damage' });
        }
      }
    }
    state.party[id] = {
      ...party,
      hp: nextHp,
      bleed: ba.bleed,
      blight: ba.blight,
      stun: ba.stun,
      mark: ba.mark,
      protBuff: ba.protBuff,
      cooldowns: ba.cooldowns,
      isDead: nextIsDead,
    };
  }
}

// 解决 "unused" 警告
void ExpeditionContext;
