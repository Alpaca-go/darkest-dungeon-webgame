/**
 * App 入口(Phase 1 v2.0)
 *
 * 只渲染 ExpeditionPage。
 * 启动时尝试恢复存档,否则进入 expedition-start 模式。
 */

import { useEffect } from 'react';
import { ExpeditionPage } from '../components/expedition/ExpeditionPage.js';
import { tryRestoreGame } from '../store/game-store.js';

export function App() {
  useEffect(() => {
    // 启动时尝试恢复存档(若失败由 UI 显示开始按钮)
    tryRestoreGame();
  }, []);

  return <ExpeditionPage />;
}
