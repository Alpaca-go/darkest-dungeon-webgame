import { useGameStore } from '../../store/game-store.js';

export function ExpeditionTopBar({
  onToggleInventory,
  onToggleLog,
  onToggleRoute,
  onToggleDebug,
}: {
  onToggleInventory: () => void;
  onToggleLog: () => void;
  onToggleRoute: () => void;
  onToggleDebug: () => void;
}) {
  const state = useGameStore((s) => s.state);
  const torch = state.expedition.torch;
  const torchClass = torch < 26 ? 'danger' : torch < 51 ? 'warning' : '';
  const node = state.expedition.route.nodes[state.expedition.currentNodeId];
  const food = state.inventory.stacks.filter((s) => s.itemId === 'food').reduce((a, s) => a + s.count, 0);
  const keys = state.inventory.stacks.filter((s) => s.itemId === 'skeleton-key').reduce((a, s) => a + s.count, 0);

  return (
    <div className="expedition-top-bar">
      <div className="top-bar-row">
        <span className="top-bar-title">{node?.title ?? '远征'} · 深度 {state.expedition.depth}</span>
        <span className="muted" style={{ fontSize: 11 }}>回合 {state.expedition.stats.encounterCount}</span>
      </div>
      <div className="top-bar-row">
        <div className="top-bar-resources">
          <span className={`resource-item ${torchClass}`}><span className="icon">🔥</span>{torch}</span>
          <span className="resource-item"><span className="icon">🍖</span>{food}</span>
          <span className="resource-item"><span className="icon">🗝️</span>{keys}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onToggleRoute} style={{ padding: '4px 6px', minHeight: 28, minWidth: 28, fontSize: 11 }}>🗺</button>
          <button onClick={onToggleInventory} style={{ padding: '4px 6px', minHeight: 28, minWidth: 28, fontSize: 11 }}>🎒</button>
          <button onClick={onToggleLog} style={{ padding: '4px 6px', minHeight: 28, minWidth: 28, fontSize: 11 }}>📜</button>
          <button onClick={onToggleDebug} style={{ padding: '4px 6px', minHeight: 28, minWidth: 28, fontSize: 11 }}>🐞</button>
        </div>
      </div>
    </div>
  );
}
