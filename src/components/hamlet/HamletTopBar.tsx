/**
 * Hamlet 顶部条:周数 / 金币 / 肖像 / 纹章 + 调试按钮
 */

import { useGameStore } from '../../store/game-store.js';

export function HamletTopBar({ onToggleDebug }: { onToggleDebug: () => void }) {
  const state = useGameStore((s) => s.state);
  const campaign = state.campaign;
  if (!campaign) return null;
  return (
    <div className="hamlet-top-bar">
      <div className="top-bar-row">
        <span className="top-bar-title">庄园 · 第 {campaign.week} 周</span>
        <button onClick={onToggleDebug} style={{ padding: '4px 6px', minHeight: 28, minWidth: 28, fontSize: 11 }}>🐞</button>
      </div>
      <div className="top-bar-row">
        <div className="hamlet-resources">
          <span className="resource-item"><span className="icon">🪙</span>{campaign.gold}</span>
          <span className="resource-item"><span className="icon">🖼</span>{campaign.heirlooms.portraits}</span>
          <span className="resource-item"><span className="icon">🏅</span>{campaign.heirlooms.crests}</span>
        </div>
        <span className="muted" style={{ fontSize: 11 }}>
          名册 {campaign.rosterHeroIds.length}/{campaign.rosterCapacity}
        </span>
      </div>
    </div>
  );
}
