/**
 * CampPointBar — 露营点数条(独立组件)
 *
 * 顶栏显示当前点数 / 总数 / 守夜状态
 */

import type { CampState } from '../../game-engine/camps/types.js';

export function CampPointBar({ campState }: { campState: CampState }) {
  const pct = (campState.remainingPoints / Math.max(1, campState.totalPoints)) * 100;
  return (
    <div className="camp-point-bar">
      <div className="bar-label">露营点数</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
        <span className="bar-text">
          {campState.remainingPoints} / {campState.totalPoints}
        </span>
      </div>
      {campState.guardEstablished && <span className="guard-pill">守夜</span>}
      <span className={`status-pill status-${campState.campStatus}`}>
        {campState.campStatus}
      </span>
    </div>
  );
}
