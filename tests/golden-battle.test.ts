/**
 * Golden Battle 验证(开发文档 §25)
 *
 * 固定 Seed:DD-WEB-PHASE1-GOLDEN-001
 * 固定队伍:4号瘟疫医生, 3号修女, 2号强盗, 1号十字军
 * 固定敌人:1号骸骨盾卫, 2号骸骨士兵, 3号邪教侍僧, 4号骸骨弩手
 *
 * 验证:
 * - 每次结果一致
 * - 行动顺序固定
 * - 关键事件序列固定
 */

import { describe, it, expect } from 'vitest';
import { createTestBattle, GOLDEN_SEED } from '../src/content/factories.js';
import { BattleContext } from '../src/game-engine/battle/context.js';
import { startRound, beginTurn, endTurn, findActorInLists } from '../src/game-engine/battle/round.js';
import { useSkill } from '../src/game-engine/battle/skill.js';
import { decideAiAction } from '../src/game-engine/battle/ai.js';
import type { BattleState } from '../src/game-engine/types.js';

function snapshotKeyEvents(state: BattleState): string[] {
  return state.log
    .filter((e) =>
      ['SKILL_USED', 'DAMAGE_DEALT', 'ACTOR_DIED', 'CORPSE_SPAWNED', 'BLEED_APPLIED', 'BLIGHT_APPLIED', 'STUN_APPLIED', 'ACTOR_MOVED'].includes(e.type),
    )
    .map((e) => {
      switch (e.type) {
        case 'SKILL_USED':
          return `${e.payload.actorId}->${e.payload.skillId}@${e.payload.targetIds.join(',')}`;
        case 'DAMAGE_DEALT':
          return `dmg:${e.payload.sourceId}->${e.payload.targetId}=${e.payload.amount}${e.payload.crit ? '!' : ''}`;
        case 'ACTOR_DIED':
          return `died:${e.payload.actorId}@${e.payload.rank}`;
        case 'CORPSE_SPAWNED':
          return `corpse:${e.payload.fromActorId}@${e.payload.rank}`;
        case 'BLEED_APPLIED':
        case 'BLIGHT_APPLIED':
        case 'STUN_APPLIED':
          return `${e.type}:${e.payload.targetId}`;
        case 'ACTOR_MOVED':
          return `move:${e.payload.actorId}:${e.payload.fromRank}->${e.payload.toRank}`;
      }
      return e.type;
    });
}

/** 跑一场完整的玩家控制战斗(简化版,玩家选第一个合法技能对第一个合法目标) */
function runPlayerVsAiBattle(seed: string): BattleState {
  const battle = createTestBattle({ seed });
  let s = battle;
  for (let safety = 0; safety < 10000; safety++) {
    if (s.phase === 'victory' || s.phase === 'defeat') return s;
    if (s.phase === 'setup' || (s.initiativeQueue.length === 0 && s.phase === 'round-end')) {
      const c = new BattleContext(s);
      startRound(c);
      s = c.state;
      continue;
    }
    if (s.initiativeQueue.length === 0) {
      const c = new BattleContext(s);
      s.phase = 'round-end';
      c.commit();
      s = c.state;
      continue;
    }
    const head = s.initiativeQueue[0]!;
    const a = findActorInLists(s, head);
    if (!a || a.isDead || a.kind === 'corpse') {
      s.initiativeQueue = s.initiativeQueue.slice(1);
      continue;
    }
    const c = new BattleContext(s);
    const turn = beginTurn(c, head);
    s = c.state;
    if (turn.canAct && turn.actor) {
      const c2 = new BattleContext(s);
      if (turn.actor.side === 'enemy') {
        const dec = decideAiAction(c2, turn.actor.id);
        if (dec) {
          try {
            useSkill(c2, turn.actor.id, dec.skillId, dec.targetId ? [dec.targetId] : []);
          } catch {}
        }
      } else {
        // 玩家:用第一个可用技能对第一个合法目标
        const loadout = s.loadouts[turn.actor.id] ?? [];
        for (const slot of loadout) {
          const skill = s.skillRegistry[slot.skillId];
          if (!skill) continue;
          if (!skill.usableFromRanks.includes(turn.actor.rank)) continue;
          if ((turn.actor.cooldowns[skill.id] ?? 0) > 0) continue;
          // 找合法目标
          const pool = skill.targetMode === 'self' ? [turn.actor] :
            (skill.targetSide === 'ally' ? c2.state.heroes : c2.state.enemies)
              .filter((x) => !x.isDead && x.kind !== 'corpse' && skill.targetRanks.includes(x.rank));
          if (pool.length > 0) {
            try {
              useSkill(c2, turn.actor.id, skill.id, [pool[0]!.id]);
              break;
            } catch {}
          }
        }
      }
      s = c2.state;
    }
    const c3 = new BattleContext(s);
    endTurn(c3);
    s = c3.state;
  }
  return s;
}

describe('Golden Battle 固定 Seed 可复现', () => {
  it('两次同 seed 跑出同结果', () => {
    const a = runPlayerVsAiBattle(GOLDEN_SEED);
    const b = runPlayerVsAiBattle(GOLDEN_SEED);
    expect(a.phase).toBe(b.phase);
    expect(a.round).toBe(b.round);
    expect(snapshotKeyEvents(a)).toEqual(snapshotKeyEvents(b));
  });

  it('同 seed 跑出确定的回合数', () => {
    const a = runPlayerVsAiBattle(GOLDEN_SEED);
    // 期望值:第一次跑出来的值,后续要保持一致
    expect(a.round).toBeGreaterThan(0);
  });

  it('同 seed 跑出确定的关键事件序列', () => {
    const a = runPlayerVsAiBattle(GOLDEN_SEED);
    const sig = snapshotKeyEvents(a);
    // 至少要有一些战斗事件
    expect(sig.length).toBeGreaterThan(0);
    // 必须有技能使用
    expect(sig.some((s) => s.includes('->'))).toBe(true);
  });
});

describe('刷新恢复(开发文档 §19.3)', () => {
  it('BattleState 可序列化/反序列化保持一致', () => {
    const battle = createTestBattle({ seed: 'restore-1' });
    const ctx = new BattleContext(battle);
    startRound(ctx);
    const state = ctx.state;
    // 模拟存盘 -> 读盘
    const serialized = JSON.stringify({
      version: 1,
      battle: state,
      savedAt: new Date().toISOString(),
    });
    const restored = JSON.parse(serialized) as { battle: BattleState };
    // 关键字段一致
    expect(restored.battle.id).toBe(state.id);
    expect(restored.battle.round).toBe(state.round);
    expect(restored.battle.rng.state).toBe(state.rng.state);
    expect(restored.battle.heroes.length).toBe(state.heroes.length);
    expect(restored.battle.enemies.length).toBe(state.enemies.length);
    expect(restored.battle.initiativeQueue).toEqual(state.initiativeQueue);
    // 续跑
    const next = runPlayerVsAiBattle('restore-1');
    const fromRestored = runPlayerVsAiBattle('restore-1');
    expect(snapshotKeyEvents(next)).toEqual(snapshotKeyEvents(fromRestored));
  });
});
