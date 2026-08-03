/**
 * GraveyardPanel — 墓园
 *
 * 显示所有死亡记录(从 state.deathRecords):
 * - 英雄名
 * - 死亡原因
 * - 节点 + 远征 id
 * - 时间戳
 *
 * 仅读,不复活。
 */

import { useGameStore } from '../../store/game-store.js';
import { HamletBackBar } from './HamletBackBar.js';

export function GraveyardPanel() {
  const state = useGameStore((s) => s.state);
  const records = state.deathRecords;
  return (
    <div className="hamlet-graveyard-panel">
      <HamletBackBar title="墓园" />
      <div className="graveyard-meta">永久记录 {records.length} 人</div>
      {records.length === 0 ? (
        <p className="muted">至今无人阵亡。</p>
      ) : (
        <ul className="graveyard-list">
          {records.slice().reverse().map((r) => (
            <li key={r.id} className="graveyard-row">
              <div className="graveyard-name">{r.heroName}</div>
              <div className="graveyard-cause">死因:{r.cause}</div>
              <div className="graveyard-meta-row">
                远征 {r.expeditionId.slice(-6)} · 节点 {r.nodeId}
              </div>
              <div className="graveyard-time muted" style={{ fontSize: 11 }}>
                {r.timestamp.slice(0, 10)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
