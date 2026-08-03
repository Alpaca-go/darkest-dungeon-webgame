/**
 * Game Store(Zustand)
 *
 * 持有 GameState,对外提供 dispatch + 重启方法。
 * UI Store 通过 selector 读取这里的 state。
 *
 * 自动持久化:每次 state 变化后写 localStorage。
 *
 * 不在 store 中计算 ViewModel(那是 selectors 的事)。
 */

import { create } from 'zustand';
import {
  dispatchGameCommand,
  clearProcessedCommands,
} from '../game-engine/expedition/dispatcher.js';
import { newCommandId } from '../game-engine/expedition/commands.js';
import { saveGame, loadGame, clearGame } from '../persistence/save.js';
import { GAME_STATE_VERSION, type GameState, type TorchState } from '../game-engine/expedition/types.js';
import { torchLevel } from '../game-engine/expedition/types.js';
import type { GameCommand } from '../game-engine/expedition/commands.js';
import { Mulberry32 } from '../game-engine/rng/index.js';

export const PHASE1_EXPEDITION_GOLDEN_SEED = 'DD-WEB-PHASE1-EXPEDITION-001';

function emptyGameState(seed: string): GameState {
  const rng = new Mulberry32(seed);
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
      stats: {
        deepestNodeReached: 0,
        nodesVisited: 0,
        encounterCount: 0,
        trapCount: 0,
        hungerCount: 0,
        torchUsed: 0,
        foodUsed: 0,
        lowestTorch: 100,
        lootGained: [],
        itemsDiscarded: [],
        heroLowestHp: [],
      },
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
    rng: rng.state,
    lastTransactionId: null,
  };
}

export interface GameStoreState {
  state: GameState;
  isResolving: boolean;
  lastError: string | null;
  /** 启动一次新远征(默认 Golden seed) */
  startExpedition: (seed?: string) => void;
  /** 重新开始(同 seed) */
  restartWithSameSeed: () => void;
  /** 重新开始(新 seed) */
  restartWithNewSeed: () => void;
  /** 派发命令(包一层,处理错误) */
  dispatch: (command: GameCommand) => void;
  /** 设置种子 */
  setSeed: (seed: string) => void;
  /** 清空错误 */
  clearError: () => void;
  /** 清空存档(从 localStorage) */
  wipeSave: () => void;
  /** 同步 torch(level) */
  syncTorch: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  state: emptyGameState(PHASE1_EXPEDITION_GOLDEN_SEED),
  isResolving: false,
  lastError: null,

  startExpedition: (seed?: string) => {
    clearProcessedCommands();
    const useSeed = seed ?? get().state.seed;
    const initial = emptyGameState(useSeed);
    set({ state: initial, lastError: null });
    // 派发 START_EXPEDITION
    try {
      get().dispatch({
        type: 'START_EXPEDITION',
        loadoutId: 'loadout.default.ruins',
        commandId: newCommandId('start'),
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      set({ lastError: m });
    }
  },

  restartWithSameSeed: () => {
    get().startExpedition(get().state.seed);
  },

  restartWithNewSeed: () => {
    const newSeed = `${PHASE1_EXPEDITION_GOLDEN_SEED}-${Date.now().toString(36)}`;
    get().startExpedition(newSeed);
  },

  dispatch: (command: GameCommand) => {
    const cur = get().state;
    try {
      set({ isResolving: true });
      const next = dispatchGameCommand(cur, command);
      // 同步 torch
      if (next.expedition.torch !== cur.expedition.torch) {
        next.torch = { value: next.expedition.torch, level: torchLevel(next.expedition.torch) };
      }
      set({ state: next, lastError: null });
      // 自动存档
      saveGame(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('duplicate')) {
        set({ lastError: null });
      } else {
        set({ lastError: message });
      }
    } finally {
      set({ isResolving: false });
    }
  },

  setSeed: (seed: string) => {
    set({ state: { ...get().state, seed } });
  },

  clearError: () => set({ lastError: null }),

  wipeSave: () => {
    clearGame();
    clearProcessedCommands();
    set({ state: emptyGameState(get().state.seed), lastError: null });
  },

  syncTorch: () => {
    const cur = get().state;
    const newLevel: TorchState = { value: cur.expedition.torch, level: torchLevel(cur.expedition.torch) };
    if (newLevel.value !== cur.torch.value || newLevel.level !== cur.torch.level) {
      set({ state: { ...cur, torch: newLevel } });
    }
  },
}));

/** 便捷:生成下一个 commandId */
export function makeCommandId(prefix = 'ui'): string {
  return newCommandId(prefix);
}

/** 启动时尝试恢复存档 */
export function tryRestoreGame(): boolean {
  const save = loadGame();
  if (save) {
    useGameStore.setState({ state: save.state, lastError: null });
    return true;
  }
  return false;
}
