/**
 * App 入口(Phase 3)
 *
 * 根据 state.mode 路由:
 *  - expedition-*  → ExpeditionPage(远征流程)
 *  - hamlet-*      → HamletHomePage(庄园)
 *  - 其它          → ExpeditionPage(向后兼容)
 *
 * 启动时尝试恢复存档,否则进入 expedition-start 模式。
 */

import { useEffect } from 'react';
import { ExpeditionPage } from '../components/expedition/ExpeditionPage.js';
import { HamletHomePage } from '../components/hamlet/index.js';
import { tryRestoreGame } from '../store/game-store.js';
import { useGameStore } from '../store/game-store.js';

export function App() {
  const state = useGameStore((s) => s.state);

  useEffect(() => {
    // 启动时尝试恢复存档(若失败由 UI 显示开始按钮)
    tryRestoreGame();
  }, []);

  // 路由:hamlet-* → HamletHomePage
  if (state.mode.startsWith('hamlet-')) {
    return <HamletHomePage />;
  }
  return <ExpeditionPage />;
}
