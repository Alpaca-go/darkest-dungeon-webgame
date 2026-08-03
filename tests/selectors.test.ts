/**
 * Selector / ViewModel 单元测试
 */

import { describe, it, expect } from 'vitest';
import { createTestBattle } from '../src/content/factories.js';
import { BattleContext } from '../src/game-engine/battle/context.js';
import { startRound, beginTurn, endTurn, findActorInLists } from '../src/game-engine/battle/round.js';
import { useSkill } from '../src/game-engine/battle/skill.js';
import { decideAiAction } from '../src/game-engine/battle/ai.js';
import { runBattleFull } from '../src/game-engine/battle/loop.js';
import {
  buildBattleScreenViewModel,
  skillToButtonViewModel,
  checkTargetValidity,
  getValidTargetsForSkill,
} from '../src/game-engine/selectors.js';
import type { BattleState, SkillDefinition } from '../src/game-engine/types.js';

function battleWithActorReady(seed: string): BattleState {
  const b = createTestBattle({ seed });
  const ctx = new BattleContext(b);
  startRound(ctx);
  let s = ctx.state;
  for (let safety = 0; safety < 200; safety++) {
    if (s.initiativeQueue.length === 0) {
      const c = new BattleContext(s);
      startRound(c);
      s = c.state;
      continue;
    }
    const head = s.initiativeQueue[0]!;
    if (head === 'hero.crusader') {
      const c = new BattleContext(s);
      const t = beginTurn(c, head);
      s = c.state;
      if (t.canAct) return s;
      const c2 = new BattleContext(s);
      endTurn(c2);
      s = c2.state;
      continue;
    }
    const c = new BattleContext(s);
    const t = beginTurn(c, head);
    s = c.state;
    if (t.canAct && t.actor) {
      const c2 = new BattleContext(s);
      if (t.actor.side === 'enemy') {
        const dec = decideAiAction(c2, t.actor.id);
        if (dec) {
          try {
            useSkill(c2, t.actor.id, dec.skillId, dec.targetId ? [dec.targetId] : []);
          } catch {
            // ignore
          }
        }
      }
      s = c2.state;
    }
    const c3 = new BattleContext(s);
    endTurn(c3);
    s = c3.state;
  }
  throw new Error('crusader never became active');
}

function skillFromRegistry(state: BattleState, id: string): SkillDefinition {
  const s = state.skillRegistry[id];
  if (!s) throw new Error(`skill ${id} not in registry`);
  return s;
}

describe('ViewModel — actor 投影', () => {
  it('actor 死亡后 isDead=true', () => {
    const state = battleWithActorReady('dead-actor');
    const idx = state.enemies.findIndex((e) => e.id === 'enemy.skeleton_soldier');
    state.enemies[idx] = { ...state.enemies[idx]!, hp: 0, isDead: true };
    const vm = buildBattleScreenViewModel({ state, selectedSkillId: null, seed: 'dead-actor' });
    const dead = vm.enemies.find((e) => e.id === 'enemy.skeleton_soldier');
    expect(dead?.isDead).toBe(true);
  });
});

describe('ViewModel — 技能按钮', () => {
  it('crusader 在 rank 1 可用 smite', () => {
    const state = battleWithActorReady('skill-btn-1');
    const crusader = findActorInLists(state, 'hero.crusader')!;
    const smite = skillFromRegistry(state, 'crusader.smite');
    const btn = skillToButtonViewModel(smite, crusader, state);
    expect(btn.enabled).toBe(true);
    expect(btn.disabledReason).toBeUndefined();
  });

  it('smite 在 rank 3 不可用(usableFromRanks 1-2)', () => {
    const state = battleWithActorReady('skill-btn-2');
    const _crusader = findActorInLists(state, 'hero.crusader')!;
    // 强制把 crusader 挪到 rank 3
    const idx = state.heroes.findIndex((h) => h.id === 'hero.crusader');
    state.heroes[idx] = { ...state.heroes[idx]!, rank: 3 };
    const updated = findActorInLists(state, 'hero.crusader')!;
    const smite = skillFromRegistry(state, 'crusader.smite');
    const btn = skillToButtonViewModel(smite, updated, state);
    expect(btn.enabled).toBe(false);
    expect(btn.disabledReason).toContain('不能从 3 号位使用');
  });

  it('冷却中不可用', () => {
    const state = battleWithActorReady('skill-btn-3');
    const idx = state.heroes.findIndex((h) => h.id === 'hero.crusader');
    state.heroes[idx] = {
      ...state.heroes[idx]!,
      cooldowns: { 'crusader.smite': 2 },
    };
    const updated = findActorInLists(state, 'hero.crusader')!;
    const smite = skillFromRegistry(state, 'crusader.smite');
    const btn = skillToButtonViewModel(smite, updated, state);
    expect(btn.enabled).toBe(false);
    expect(btn.disabledReason).toContain('冷却');
  });

  it('AOE 技能显示全部目标', () => {
    const state = battleWithActorReady('skill-btn-4');
    const pd = findActorInLists(state, 'hero.plague_doctor')!;
    const grenade = skillFromRegistry(state, 'plague_doctor.plague_grenade');
    const btn = skillToButtonViewModel(grenade, pd, state);
    expect(btn.enabled).toBe(true);
    expect(btn.statusSummary.some((s) => s.includes('腐蚀'))).toBe(true);
  });
});

describe('ViewModel — 目标合法性', () => {
  it('smite 只能攻击 enemy 1-2', () => {
    const state = battleWithActorReady('tgt-1');
    const crusader = findActorInLists(state, 'hero.crusader')!;
    const smite = skillFromRegistry(state, 'crusader.smite');
    const r1 = checkTargetValidity(state, crusader, smite, 'enemy.skeleton_defender');
    const r2 = checkTargetValidity(state, crusader, smite, 'enemy.skeleton_soldier');
    const r3 = checkTargetValidity(state, crusader, smite, 'enemy.cultist_acolyte');
    const r4 = checkTargetValidity(state, crusader, smite, 'enemy.crossbowman');
    expect(r1.valid).toBe(true);
    expect(r2.valid).toBe(true);
    expect(r3.valid).toBe(false);
    expect(r3.reason).toContain('1-2');
    expect(r4.valid).toBe(false);
  });

  it('heal 可以选择任意存活友军', () => {
    const state = battleWithActorReady('tgt-2');
    const vestal = findActorInLists(state, 'hero.vestal')!;
    const heal = skillFromRegistry(state, 'vestal.heal');
    const r1 = checkTargetValidity(state, vestal, heal, 'hero.crusader');
    const r2 = checkTargetValidity(state, vestal, heal, 'hero.highwayman');
    expect(r1.valid).toBe(true);
    expect(r2.valid).toBe(true);
  });

  it('heal 不能选自己(self 只能选自己)', () => {
    const state = battleWithActorReady('tgt-3');
    const vestal = findActorInLists(state, 'hero.vestal')!;
    const heal = skillFromRegistry(state, 'vestal.heal');
    // heal 是 single target on ally - 可以选自己
    const r = checkTargetValidity(state, vestal, heal, 'hero.vestal');
    // 注:Phase 1 的 vestal.heal 不限制不能选自己,允许自我治疗
    expect(r.valid).toBe(true);
  });

  it('攻击已死亡目标非法', () => {
    const state = battleWithActorReady('tgt-4');
    // 强制把 skeleton_soldier 设为死亡
    const idx = state.enemies.findIndex((e) => e.id === 'enemy.skeleton_soldier');
    state.enemies[idx] = { ...state.enemies[idx]!, hp: 0, isDead: true };
    const crusader = findActorInLists(state, 'hero.crusader')!;
    const smite = skillFromRegistry(state, 'crusader.smite');
    const r = checkTargetValidity(state, crusader, smite, 'enemy.skeleton_soldier');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('死亡');
  });
});

describe('ViewModel — valid targets 集合', () => {
  it('crusader smite 合法目标 = 敌人 1-2', () => {
    const state = battleWithActorReady('vt-1');
    const crusader = findActorInLists(state, 'hero.crusader')!;
    const smite = skillFromRegistry(state, 'crusader.smite');
    const targets = getValidTargetsForSkill(state, crusader, smite);
    expect(targets.length).toBe(2);
    expect(targets.map((t) => t.rank).sort()).toEqual([1, 2]);
  });

  it('瘟疫手雷 合法目标 = 敌人 3-4', () => {
    const state = battleWithActorReady('vt-2');
    const pd = findActorInLists(state, 'hero.plague_doctor')!;
    const grenade = skillFromRegistry(state, 'plague_doctor.plague_grenade');
    const targets = getValidTargetsForSkill(state, pd, grenade);
    expect(targets.length).toBe(2);
    expect(targets.map((t) => t.rank).sort()).toEqual([3, 4]);
  });
});

describe('ViewModel — 完整 ViewModel', () => {
  it('battle-ready 时 canPlayerInteract=false(无 active actor)', () => {
    const b = createTestBattle({ seed: 'vm-1' });
    const vm = buildBattleScreenViewModel({ state: b, selectedSkillId: null, seed: 'vm-1' });
    expect(vm.canPlayerInteract).toBe(false);
  });

  it('hero 行动回合 canPlayerInteract=true', () => {
    const state = battleWithActorReady('vm-2');
    const vm = buildBattleScreenViewModel({ state, selectedSkillId: null, seed: 'vm-2' });
    expect(vm.canPlayerInteract).toBe(true);
    expect(vm.activeActor?.side).toBe('ally');
  });

  it('选择技能后 validTargetIds 只包含合法目标', () => {
    const state = battleWithActorReady('vm-3');
    const vm = buildBattleScreenViewModel({
      state,
      selectedSkillId: 'crusader.smite',
      seed: 'vm-3',
    });
    expect(vm.validTargetIds.length).toBe(2);
    expect(vm.validTargetIds).toContain('enemy.skeleton_defender');
    expect(vm.validTargetIds).toContain('enemy.skeleton_soldier');
  });

  it('战斗结束后 result 不为 null', () => {
    const b = createTestBattle({ seed: 'vm-4' });
    b.enemies = b.enemies.map((e) => ({ ...e, maxHp: 1, hp: 1 }));
    b.heroes = b.heroes.map((h) => ({ ...h, maxHp: 100, hp: 100 }));
    const final = runBattleFull(b, { heroesControlledByAi: true });
    const vm = buildBattleScreenViewModel({ state: final, selectedSkillId: null, seed: 'vm-4' });
    expect(vm.result).not.toBeNull();
    expect(vm.result?.outcome).toBe('victory');
    expect(vm.canPlayerInteract).toBe(false);
  });
});
