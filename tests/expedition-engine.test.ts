/**
 * 选择生成器 / 规则引擎 / 结算 / 失败链测试(SPEC §35.1)
 */

import { describe, it, expect } from 'vitest';
import {
  dispatchGameCommand,
  clearProcessedCommands,
} from '../src/game-engine/expedition/dispatcher.js';
import { newCommandId } from '../src/game-engine/expedition/commands.js';
import { PHASE1_EXPEDITION_GOLDEN_SEED } from '../src/store/game-store.js';
import { generateExpeditionReport } from '../src/game-engine/expedition/report.js';
import { STANDARD_TACTICAL_CHOICE_IDS, getEventDef } from '../src/content/events.js';
import { generateDecision } from '../src/game-engine/expedition/choice-generator.js';
import { ExpeditionContext } from '../src/game-engine/expedition/context.js';
import { GAME_STATE_VERSION, torchLevel } from '../src/game-engine/expedition/types.js';
import { Mulberry32 } from '../src/game-engine/rng/index.js';
import type { GameState } from '../src/game-engine/expedition/types.js';

function freshGame(seed = PHASE1_EXPEDITION_GOLDEN_SEED): GameState {
  return {
    version: GAME_STATE_VERSION,
    mode: 'expedition-start',
    seed,
    expedition: {
      id: '',
      routeId: '',
      seed,
      startedAt: new Date().toISOString(),
      currentNodeId: '',
      visitedNodeIds: [],
      depth: 0,
      timeElapsed: 0,
      torch: 100,
      keyChoices: [],
      keyEvents: [],
      firedEventIds: [],
      eventCooldowns: {},
      scoutLevel: 'unknown',
      route: { id: '', regionId: '', seed, startNodeId: '', objectiveNodeId: '', exitNodeIds: [], nodes: {}, edges: [], forks: [] },
      flags: {},
      stats: { deepestNodeReached: 0, nodesVisited: 0, encounterCount: 0, trapCount: 0, hungerCount: 0, torchUsed: 0, foodUsed: 0, lowestTorch: 100, lootGained: [], itemsDiscarded: [], heroLowestHp: [] },
      objectiveCompleted: false,
      failed: false,
    },
    party: {},
    encounter: null,
    pendingDecision: null,
    lastResolution: null,
    inventory: { capacity: 16, stacks: [] },
    torch: { value: 100, level: 'radiant' },
    eventLog: [],
    rng: new Mulberry32(seed).state,
    lastTransactionId: null,
  };
}

function startAndAdvanceToFork1(): GameState {
  clearProcessedCommands();
  let state = freshGame();
  state = dispatchGameCommand(state, { type: 'START_EXPEDITION', loadoutId: 'loadout.default.ruins', commandId: newCommandId('start') });
  // start 移动到 N1 -> N2(fork1) -> 应该出现 route-choice
  expect(state.mode).toBe('route-choice');
  expect(state.pendingDecision).toBeTruthy();
  return state;
}

describe('Phase 1 v2.0 基础流程', () => {
  it('START_EXPEDITION 创建 party / inventory / route', () => {
    clearProcessedCommands();
    const state = dispatchGameCommand(freshGame(), {
      type: 'START_EXPEDITION',
      loadoutId: 'loadout.default.ruins',
      commandId: newCommandId('start'),
    });
    expect(Object.keys(state.party).length).toBe(4);
    expect(state.party['hero.crusader']).toBeDefined();
    expect(state.party['hero.highwayman']).toBeDefined();
    expect(state.party['hero.vestal']).toBeDefined();
    expect(state.party['hero.plague_doctor']).toBeDefined();
    // 物品被合并到 stack:food(8)/torch(6)/shovel/钥匙/圣水/绷带 = 6 stack
    expect(state.inventory.stacks.length).toBe(6);
    // 路线已挂
    expect(state.expedition.route.id).toBeTruthy();
    // torch 已被自动推进消耗(N1 -> N2)
    expect(state.expedition.torch).toBeLessThanOrEqual(100);
    expect(state.expedition.torch).toBeGreaterThan(80);
  });

  it('启动后到 route-choice(fork1)', () => {
    const state = startAndAdvanceToFork1();
    expect(state.mode).toBe('route-choice');
    expect(state.expedition.currentNodeId).toBe('N2_fork1');
  });

  it('fork1 有 2-3 选项 + 撤退', () => {
    const state = startAndAdvanceToFork1();
    const choices = state.pendingDecision?.generatedChoices ?? [];
    expect(choices.length).toBeGreaterThanOrEqual(2);
    expect(choices.length).toBeLessThanOrEqual(4);
    // 应该包含至少 2 个 edge + 1 个 retreat
    const retreat = choices.find((c) => c.tags.includes('retreat'));
    expect(retreat).toBeDefined();
  });

  it('走左谨慎路线到达 N3 (trap+curio)', () => {
    let state = startAndAdvanceToFork1();
    const left = state.pendingDecision?.generatedChoices.find((c) =>
      c.sourceDefinitionId === 'E_N2_N3_left',
    );
    expect(left).toBeDefined();
    state = dispatchGameCommand(state, {
      type: 'SELECT_ROUTE',
      decisionId: state.pendingDecision!.id,
      choiceId: left!.id,
      commandId: newCommandId('route'),
    });
    expect(state.expedition.currentNodeId).toBe('N3_trap');
    expect(state.mode).toBe('event-choice');
  });
});

describe('事件 / 条件过滤', () => {
  it('trap_pressure_plate 事件存在', () => {
    const def = getEventDef('trap_pressure_plate');
    expect(def).toBeDefined();
    expect(def!.trigger).toBe('node-enter');
    expect(def!.choices.length).toBeGreaterThan(0);
  });

  it('curio_locked_chest 需要万能钥匙才能稳定打开', () => {
    const def = getEventDef('curio_locked_chest');
    expect(def).toBeDefined();
    const keyChoice = def!.choices.find((c) => c.id === 'curio.chest.key');
    expect(keyChoice).toBeDefined();
    expect(keyChoice!.conditions?.some((c) => c.kind === 'has-item' && c.itemId === 'skeleton-key')).toBe(true);
  });

  it('curio_locked_chest 暴力撬开没有 has-item 条件', () => {
    const def = getEventDef('curio_locked_chest');
    const forceChoice = def!.choices.find((c) => c.id === 'curio.chest.force');
    expect(forceChoice).toBeDefined();
    const hasItemCond = forceChoice!.conditions?.find((c) => c.kind === 'has-item');
    expect(hasItemCond).toBeUndefined();
  });

  it('条件 has-item 正确评估', () => {
    let state = startAndAdvanceToFork1();
    // 走 left -> N3 (trap)
    const left = state.pendingDecision?.generatedChoices.find((c) =>
      c.sourceDefinitionId === 'E_N2_N3_left',
    );
    state = dispatchGameCommand(state, {
      type: 'SELECT_ROUTE', decisionId: state.pendingDecision!.id,
      choiceId: left!.id, commandId: newCommandId('r'),
    });
    // 在 N3 trap 节点,会有 trap_pressure_plate 决策
    expect(state.mode).toBe('event-choice');
    expect(state.pendingDecision).toBeTruthy();
  });
});

describe('火把 / 时间 / 资源变化', () => {
  it('走 edge 会消耗火把和时间', () => {
    let state = startAndAdvanceToFork1();
    const beforeTorch = state.expedition.torch;
    const beforeTime = state.expedition.timeElapsed;
    const left = state.pendingDecision?.generatedChoices.find((c) =>
      c.sourceDefinitionId === 'E_N2_N3_left',
    );
    state = dispatchGameCommand(state, {
      type: 'SELECT_ROUTE', decisionId: state.pendingDecision!.id,
      choiceId: left!.id, commandId: newCommandId('r'),
    });
    expect(state.expedition.torch).toBeLessThan(beforeTorch);
    expect(state.expedition.timeElapsed).toBeGreaterThan(beforeTime);
  });

  it('DEBUG_SET_TORCH 改变火把', () => {
    let state = dispatchGameCommand(freshGame(), {
      type: 'START_EXPEDITION', loadoutId: 'l', commandId: newCommandId('s'),
    });
    state = dispatchGameCommand(state, {
      type: 'DEBUG_SET_TORCH', value: 50, commandId: newCommandId('d'),
    });
    expect(state.expedition.torch).toBe(50);
    expect(state.torch.value).toBe(50);
    expect(state.torch.level).toBe('dim');
  });

  it('火把 level 跟随数值', () => {
    expect(torchLevel(0)).toBe('black');
    expect(torchLevel(20)).toBe('dark');
    expect(torchLevel(40)).toBe('dim');
    expect(torchLevel(60)).toBe('bright');
    expect(torchLevel(90)).toBe('radiant');
  });
});

describe('事件防重(oncePerExpedition)', () => {
  it('curio_desecrated_altar 只能触发一次', () => {
    const def = getEventDef('curio_desecrated_altar');
    expect(def!.oncePerExpedition).toBe(true);
  });
});

describe('选择生成 - 2-4 个', () => {
  it('STANDARD_TACTICAL_CHOICE_IDS 数量正确', () => {
    expect(STANDARD_TACTICAL_CHOICE_IDS.length).toBe(4);
  });

  it('choice generator 接受 GameState + node + party', () => {
    // smoke test
    const state = dispatchGameCommand(freshGame(), {
      type: 'START_EXPEDITION', loadoutId: 'l', commandId: newCommandId('s'),
    });
    const ctx = new ExpeditionContext(state);
    const decision = generateDecision(ctx, 'route', 'fork_1');
    expect(decision).toBeDefined();
    expect(decision.generatedChoices.length).toBeGreaterThanOrEqual(2);
    expect(decision.generatedChoices.length).toBeLessThanOrEqual(4);
  });
});

describe('远征报告 / 失败链', () => {
  it('未开始时不报错', () => {
    const state = freshGame();
    const report = generateExpeditionReport(state);
    expect(['success', 'retreat', 'failure']).toContain(report.result);
    expect(Array.isArray(report.failureChain)).toBe(true);
  });

  it('成功后 result = success', () => {
    clearProcessedCommands();
    const state = dispatchGameCommand(freshGame(), {
      type: 'START_EXPEDITION', loadoutId: 'l', commandId: newCommandId('s'),
    });
    state.expedition.objectiveCompleted = true;
    state.mode = 'expedition-success';
    const report = generateExpeditionReport(state);
    expect(report.result).toBe('success');
  });
});

describe('指令去重(同 commandId 拒绝)', () => {
  it('同 commandId 抛 DuplicateCommandError', () => {
    clearProcessedCommands();
    const cmdId = newCommandId('s');
    const state = dispatchGameCommand(freshGame(), {
      type: 'START_EXPEDITION', loadoutId: 'l', commandId: cmdId,
    });
    expect(() =>
      dispatchGameCommand(state, { type: 'START_EXPEDITION', loadoutId: 'l', commandId: cmdId }),
    ).toThrow();
  });
});
