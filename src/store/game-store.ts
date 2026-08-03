/**
 * Game Store(Zustand)
 *
 * 持有 BattleState,对外提供 dispatch + 重启方法。
 * UI Store 通过 selector 读取这里的 battle state。
 *
 * 不在 store 中计算 ViewModel(那是 selectors 的事)。
 */

import { create } from 'zustand';
import { dispatchGameCommand, clearProcessedCommands } from '../game-engine/command-dispatcher.js';
import { newCommandId } from '../game-engine/commands.js';
import { createTestBattle, GOLDEN_SEED } from '../content/factories.js';
import type { GameCommand } from '../game-engine/commands.js';
import type { BattleState } from '../game-engine/types.js';

export interface GameStoreState {
  battle: BattleState | null;
  seed: string;
  isResolving: boolean;
  lastError: string | null;
  /** 初始化 / 重新开始 */
  startBattle: (seed?: string) => void;
  startBattleWithState: (state: BattleState) => void;
  restartWithSameSeed: () => void;
  restartWithNewSeed: () => void;
  /** 派发命令(包一层,处理错误) */
  dispatch: (command: GameCommand) => void;
  /** 设置种子(下次重启时用) */
  setSeed: (seed: string) => void;
  /** 清空错误 */
  clearError: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  battle: null,
  seed: GOLDEN_SEED,
  isResolving: false,
  lastError: null,

  startBattle: (seed?: string) => {
    clearProcessedCommands();
    const useSeed = seed ?? get().seed;
    const battle = createTestBattle({ seed: useSeed });
    set({ battle, seed: useSeed, lastError: null });
  },

  startBattleWithState: (state: BattleState) => {
    clearProcessedCommands();
    set({ battle: state, lastError: null });
  },

  restartWithSameSeed: () => {
    get().startBattle(get().seed);
  },

  restartWithNewSeed: () => {
    const newSeed = `${GOLDEN_SEED}-${Date.now().toString(36)}`;
    get().startBattle(newSeed);
  },

  dispatch: (command: GameCommand) => {
    const cur = get().battle;
    if (!cur) {
      set({ lastError: 'no active battle' });
      return;
    }
    try {
      set({ isResolving: true });
      const next = dispatchGameCommand(cur, command);
      set({ battle: next, lastError: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // 重复命令不视为错误,只是忽略
      if (message.includes('duplicate')) {
        set({ lastError: null });
      } else {
        set({ lastError: message });
      }
    } finally {
      set({ isResolving: false });
    }
  },

  setSeed: (seed: string) => set({ seed }),

  clearError: () => set({ lastError: null }),
}));

/** 便捷:生成下一个 commandId */
export function makeCommandId(prefix = 'ui'): string {
  return newCommandId(prefix);
}
