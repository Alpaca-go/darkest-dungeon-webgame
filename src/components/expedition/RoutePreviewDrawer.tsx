import { useGameStore } from '../../store/game-store.js';

export function RoutePreviewDrawer({ onClose }: { onClose: () => void }) {
  const state = useGameStore((s) => s.state);
  const route = state.expedition.route;
  const nodeIds = Object.keys(route.nodes);
  const currentId = state.expedition.currentNodeId;
  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-title">
          <span>路线预览</span>
          <button onClick={onClose}>关闭</button>
        </div>
        <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
          区域: {route.regionId} · Seed: {route.seed}
        </div>
        {nodeIds.map((id) => {
          const node = route.nodes[id];
          if (!node) return null;
          const isCurrent = id === currentId;
          const isVisited = state.expedition.visitedNodeIds.includes(id);
          return (
            <div
              key={id}
              style={{
                padding: '6px 8px',
                marginBottom: 4,
                background: isCurrent ? '#2a1f12' : 'transparent',
                borderLeft: isCurrent ? '3px solid #d8a05a' : '3px solid transparent',
                opacity: isVisited || isCurrent ? 1 : 0.5,
              }}
            >
              <div style={{ fontSize: 12, color: '#f0d896' }}>{node.id} — {node.title}</div>
              <div style={{ fontSize: 11, color: '#8a7858' }}>类型: {node.type} · 侦察: {node.baseScoutLevel}</div>
            </div>
          );
        })}
        <div className="divider" />
        <div className="muted" style={{ fontSize: 11 }}>
          边数: {route.edges.length} · 分叉数: {route.forks.length}
        </div>
      </div>
    </div>
  );
}
