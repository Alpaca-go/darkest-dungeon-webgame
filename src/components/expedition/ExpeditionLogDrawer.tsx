import { useGameStore } from '../../store/game-store.js';

export function ExpeditionLogDrawer({ onClose }: { onClose: () => void }) {
  const state = useGameStore((s) => s.state);
  // 取最近 30 条事件
  const recent = state.eventLog.slice(-30).reverse();
  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-title">
          <span>事件日志 ({state.eventLog.length})</span>
          <button onClick={onClose}>关闭</button>
        </div>
        {recent.length === 0 && <div className="muted">暂无事件</div>}
        {recent.map((evt, i) => (
          <div key={i} style={{ fontSize: 11, padding: '4px 0', borderBottom: '1px solid #1a1410' }}>
            <span className="muted">{evt.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
