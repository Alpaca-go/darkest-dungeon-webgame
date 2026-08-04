/**
 * ExpeditionPage
 *
 * 主页面:根据 GameState.mode 路由到不同视图。
 *
 * 视图:
 * - expedition-start: 准备页面
 * - node-introduction: 进入节点的过渡
 * - route-choice / event-choice / encounter-choice / inventory-decision: 主游戏(选 ChoicePanel)
 * - resolution: 结算反馈
 * - expedition-success / expedition-retreat / expedition-failure: 终局(ExpeditionResultModal)
 * - game-error: 错误
 */

import { useEffect } from 'react';
import { useGameStore, PHASE1_EXPEDITION_GOLDEN_SEED, tryRestoreGame } from '../../store/game-store.js';
import { useUiStore } from '../../store/ui-store.js';
import { newCommandId } from '../../game-engine/expedition/commands.js';
import { ExpeditionTopBar } from './ExpeditionTopBar.js';
import { ScenePanel } from './ScenePanel.js';
import { PartyStatusStrip } from './PartyStatusStrip.js';
import { SituationPanel } from './SituationPanel.js';
import { ChoicePanel } from './ChoicePanel.js';
import { ResolutionPanel } from './ResolutionPanel.js';
import { ExpeditionResultModal } from './ExpeditionResultModal.js';
import { DebugPanel } from './DebugPanel.js';
import { InventoryDrawer } from './InventoryDrawer.js';
import { HeroDetailDrawer } from './HeroDetailDrawer.js';
import { ExpeditionLogDrawer } from './ExpeditionLogDrawer.js';
import { RoutePreviewDrawer } from './RoutePreviewDrawer.js';
import { MentalOverlayHost } from './MentalOverlay.js';

export function ExpeditionPage() {
  const state = useGameStore((s) => s.state);
  const startExpedition = useGameStore((s) => s.startExpedition);
  const dispatch = useGameStore((s) => s.dispatch);
  const lastError = useGameStore((s) => s.lastError);
  const clearError = useGameStore((s) => s.clearError);
  const debugOpen = useUiStore((s) => s.debugOpen);
  const toggleDebug = useUiStore((s) => s.toggleDebug);
  const inventoryOpen = useUiStore((s) => s.inventoryOpen);
  const setInventoryOpen = useUiStore((s) => s.setInventoryOpen);
  const selectedHeroId = useUiStore((s) => s.selectedHeroId);
  const setSelectedHeroId = useUiStore((s) => s.setSelectedHeroId);
  const logOpen = useUiStore((s) => s.logOpen);
  const setLogOpen = useUiStore((s) => s.setLogOpen);
  const routePreviewOpen = useUiStore((s) => s.routePreviewOpen);
  const setRoutePreviewOpen = useUiStore((s) => s.setRoutePreviewOpen);

  // 启动时尝试恢复
  useEffect(() => {
    if (state.mode === 'expedition-start' && !state.expedition.id) {
      const restored = tryRestoreGame();
      if (!restored) {
        // 留空,等用户点 "进入遗迹"
      }
    }
  }, [state.mode, state.expedition.id]);

  // Ctrl+Shift+D 切换调试面板
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        toggleDebug();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleDebug]);

  const onStart = () => {
    startExpedition(PHASE1_EXPEDITION_GOLDEN_SEED);
  };

  if (state.mode === 'game-error') {
    return (
      <div className="app-shell">
        <div className="expedition-start">
          <h1>系统错误</h1>
          <p className="subtitle">{lastError ?? '未知错误'}</p>
          <button className="primary" onClick={() => { clearError(); location.reload(); }}>刷新页面</button>
        </div>
      </div>
    );
  }

  if (state.mode === 'expedition-start' || !state.expedition.id) {
    return (
      <div className="app-shell">
        <div className="expedition-start">
          <h1>暗域远征</h1>
          <p className="subtitle">单页节点远征 · 移动优先</p>
          <div className="loadout">
            <h3>默认队伍</h3>
            <ul>
              <li>圣骑士 阿瑟</li>
              <li>浪人 凯恩</li>
              <li>祭司 莉娜</li>
              <li>药使 洛</li>
            </ul>
            <div className="divider" />
            <h3>默认补给</h3>
            <ul>
              <li>食物 × 8</li>
              <li>火把 × 6</li>
              <li>铲子 × 1</li>
              <li>万能钥匙 × 1</li>
              <li>圣水 × 1</li>
              <li>绷带 × 1</li>
            </ul>
          </div>
          <button className="start-button" onClick={onStart}>进入遗迹</button>
        </div>
      </div>
    );
  }

  // 主游戏界面
  const node = state.expedition.route.nodes[state.expedition.currentNodeId];

  return (
    <div className="app-shell">
      <ExpeditionTopBar
        onToggleInventory={() => setInventoryOpen(!inventoryOpen)}
        onToggleLog={() => setLogOpen(!logOpen)}
        onToggleRoute={() => setRoutePreviewOpen(!routePreviewOpen)}
        onToggleDebug={toggleDebug}
      />
      <ScenePanel sceneId={node?.sceneId ?? 'scene.ruins.unknown'} title={node?.title ?? '?'} description={node?.description ?? ''} />
      <PartyStatusStrip onSelect={(id) => setSelectedHeroId(id)} />
      <SituationPanel />
      <ChoicePanel />

      {/* Resolution 反馈(选完一次后出现) */}
      {state.lastResolution && (
        <ResolutionPanel
          resolution={state.lastResolution}
          onContinue={() => {
            dispatch({ type: 'CONTINUE_AFTER_RESULT', commandId: newCommandId('continue') });
          }}
        />
      )}

      {/* Drawers */}
      {inventoryOpen && <InventoryDrawer onClose={() => setInventoryOpen(false)} />}
      {selectedHeroId && <HeroDetailDrawer heroId={selectedHeroId} onClose={() => setSelectedHeroId(null)} />}
      {logOpen && <ExpeditionLogDrawer onClose={() => setLogOpen(false)} />}
      {routePreviewOpen && <RoutePreviewDrawer onClose={() => setRoutePreviewOpen(false)} />}

      {/* 终局 Modal */}
      {(state.mode === 'expedition-success' || state.mode === 'expedition-retreat' || state.mode === 'expedition-failure') && (
        <ExpeditionResultModal />
      )}

      {/* Debug Panel */}
      {debugOpen && <DebugPanel />}

      {/* Phase 2 精神事件覆盖层 */}
      {state.activeOverlay && <MentalOverlayHost />}
    </div>
  );
}
