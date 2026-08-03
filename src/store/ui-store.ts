/**
 * UI Store(Zustand)
 *
 * 持有所有 UI 状态,与游戏状态完全分离。
 * 不会写入存档。
 */

import { create } from 'zustand';

export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;
export type DebugPanelTab = 'state' | 'rng' | 'events' | 'commands' | 'controls';

export interface UiStoreState {
  // 选中的技能(等待选择目标)
  selectedSkillId: string | null;
  // 悬停/检查中的角色
  hoveredActorId: string | null;
  inspectedActorId: string | null;
  // 打开的面板
  openPanel: 'none' | 'log' | 'actor-detail' | 'settings' | 'debug';
  // 设置
  reducedMotion: boolean;
  playbackSpeed: PlaybackSpeed;
  // 调试
  debugOpen: boolean;
  debugTab: DebugPanelTab;
  // 自动 AI 暂停(用于手动控制敌人)
  autoAiPaused: boolean;
  // 移动端 log 抽屉
  logDrawerOpen: boolean;

  // Actions
  setSelectedSkill: (id: string | null) => void;
  setHoveredActor: (id: string | null) => void;
  setInspectedActor: (id: string | null) => void;
  setOpenPanel: (panel: UiStoreState['openPanel']) => void;
  setReducedMotion: (v: boolean) => void;
  setPlaybackSpeed: (s: PlaybackSpeed) => void;
  toggleDebug: () => void;
  setDebugTab: (tab: DebugPanelTab) => void;
  setAutoAiPaused: (v: boolean) => void;
  setLogDrawerOpen: (v: boolean) => void;
  reset: () => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  selectedSkillId: null,
  hoveredActorId: null,
  inspectedActorId: null,
  openPanel: 'none',
  reducedMotion: false,
  playbackSpeed: 1,
  debugOpen: false,
  debugTab: 'state',
  autoAiPaused: false,
  logDrawerOpen: false,

  setSelectedSkill: (id) => set({ selectedSkillId: id }),
  setHoveredActor: (id) => set({ hoveredActorId: id }),
  setInspectedActor: (id) => set({ inspectedActorId: id }),
  setOpenPanel: (panel) => set({ openPanel: panel }),
  setReducedMotion: (v) => set({ reducedMotion: v }),
  setPlaybackSpeed: (s) => set({ playbackSpeed: s }),
  toggleDebug: () => set((s) => ({ debugOpen: !s.debugOpen })),
  setDebugTab: (tab) => set({ debugTab: tab }),
  setAutoAiPaused: (v) => set({ autoAiPaused: v }),
  setLogDrawerOpen: (v) => set({ logDrawerOpen: v }),
  reset: () =>
    set({
      selectedSkillId: null,
      hoveredActorId: null,
      inspectedActorId: null,
      openPanel: 'none',
      autoAiPaused: false,
      logDrawerOpen: false,
    }),
}));
