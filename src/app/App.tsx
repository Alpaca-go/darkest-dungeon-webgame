import { useEffect } from 'react';
import { BattlePage } from '../components/battle/BattlePage.js';
import { useGameStore } from '../store/game-store.js';
import { useUiStore } from '../store/ui-store.js';
import { loadBattle, loadSettings } from '../persistence/save.js';
import '../styles/battle.css';

/** 加载 DD 风格字体:Cinzel(标题)+ EB Garamond(正文)*/
function injectFonts() {
  if (document.getElementById('dd-fonts')) return;
  const link = document.createElement('link');
  link.id = 'dd-fonts';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap';
  document.head.appendChild(link);
}

export function App() {
  const startBattle = useGameStore((s) => s.startBattle);
  const startBattleWithState = useGameStore((s) => s.startBattleWithState);
  const debugOpen = useUiStore((s) => s.debugOpen);
  const toggleDebug = useUiStore((s) => s.toggleDebug);
  const setReducedMotion = useUiStore((s) => s.setReducedMotion);
  const setPlaybackSpeed = useUiStore((s) => s.setPlaybackSpeed);

  useEffect(() => {
    // 注入字体
    injectFonts();

    // 恢复设置
    const settings = loadSettings();
    if (settings) {
      setReducedMotion(settings.reducedMotion);
      setPlaybackSpeed(settings.playbackSpeed as 0.5 | 1 | 1.5 | 2);
      // debug 状态不恢复(避免意外开启)
    }

    // 系统级 reduced motion 偏好
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReducedMotion(true);
    }

    // 恢复战斗或开始新战斗
    const saved = loadBattle();
    if (saved && saved.battle) {
      startBattleWithState(saved.battle);
    } else {
      startBattle();
    }

    // URL 参数 ?debug=1
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1') {
        toggleDebug();
      }
    }

    // Ctrl+Shift+D 全局快捷键
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        toggleDebug();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startBattle, startBattleWithState, toggleDebug, setReducedMotion, setPlaybackSpeed]);

  // URL 中的 debug 参数变化时同步
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (debugOpen && !url.searchParams.has('debug')) {
      url.searchParams.set('debug', '1');
      window.history.replaceState({}, '', url.toString());
    } else if (!debugOpen && url.searchParams.has('debug')) {
      url.searchParams.delete('debug');
      window.history.replaceState({}, '', url.toString());
    }
  }, [debugOpen]);

  return <BattlePage />;
}
