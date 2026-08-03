/**
 * UI Store(Zustand)
 *
 * 持有 UI 状态(不存档,不参与规则):
 * - debugOpen: 调试面板是否打开
 * - selectedHeroId: 详情抽屉选中的英雄
 * - logOpen: 远征日志抽屉
 * - inventoryOpen: 背包抽屉
 * - routePreviewOpen: 路线预览抽屉
 * - reducedMotion: 减弱动效
 */

import { create } from 'zustand';

export interface UiStoreState {
  debugOpen: boolean;
  selectedHeroId: string | null;
  logOpen: boolean;
  inventoryOpen: boolean;
  routePreviewOpen: boolean;
  reducedMotion: boolean;
  setDebugOpen: (open: boolean) => void;
  setSelectedHeroId: (id: string | null) => void;
  setLogOpen: (open: boolean) => void;
  setInventoryOpen: (open: boolean) => void;
  setRoutePreviewOpen: (open: boolean) => void;
  setReducedMotion: (rm: boolean) => void;
  toggleDebug: () => void;
}

export const useUiStore = create<UiStoreState>((set, get) => ({
  debugOpen: false,
  selectedHeroId: null,
  logOpen: false,
  inventoryOpen: false,
  routePreviewOpen: false,
  reducedMotion: false,
  setDebugOpen: (open) => set({ debugOpen: open }),
  setSelectedHeroId: (id) => set({ selectedHeroId: id }),
  setLogOpen: (open) => set({ logOpen: open }),
  setInventoryOpen: (open) => set({ inventoryOpen: open }),
  setRoutePreviewOpen: (open) => set({ routePreviewOpen: open }),
  setReducedMotion: (rm) => set({ reducedMotion: rm }),
  toggleDebug: () => set({ debugOpen: !get().debugOpen }),
}));
