/**
 * PartyFormationPanel — 组队
 *
 * 显示:
 * - 名册可用英雄(可点选,最多 4)
 * - 已选英雄列表
 * - 移除按钮
 * - "确认"按钮(写入 hamlet.selectedPartyHeroIds)
 */

import { useGameStore, makeCommandId } from '../../store/game-store.js';
import { HamletBackBar } from './HamletBackBar.js';

export function PartyFormationPanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const campaign = state.campaign;
  const hamlet = state.hamlet;
  if (!campaign || !hamlet) return null;

  // 可用英雄(活 + available)
  const candidates = campaign.rosterHeroIds
    .map((id) => state.party[id])
    .filter((h): h is NonNullable<typeof h> => h != null && !h.isDead && (h.activityState === 'available' || h.activityState === undefined));
  const selected = hamlet.selectedPartyHeroIds;

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      dispatch({ type: 'SET_PARTY', heroIds: selected.filter((x) => x !== id), commandId: makeCommandId('party') });
    } else if (selected.length < 4) {
      dispatch({ type: 'SET_PARTY', heroIds: [...selected, id], commandId: makeCommandId('party') });
    }
  };

  return (
    <div className="hamlet-party-panel">
      <HamletBackBar title="组队" />
      <div className="party-meta">
        已选 {selected.length}/4
      </div>
      {candidates.length === 0 ? (
        <p className="muted">没有可出征的英雄</p>
      ) : (
        <ul className="party-list">
          {candidates.map((h) => {
            const isSelected = selected.includes(h.id);
            return (
              <li
                key={h.id}
                className={`party-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggle(h.id)}
              >
                <div className="party-card-header">
                  <strong>{h.name}</strong>
                  <span className="muted">{h.archetype}</span>
                </div>
                <div className="party-card-stats">
                  HP {h.hp}/{h.maxHp} · 压力 {Math.round(h.stress)}/200
                </div>
                {isSelected && <div className="party-check">✓</div>}
              </li>
            );
          })}
        </ul>
      )}
      {selected.length > 0 && selected.length < 4 && (
        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
          可以少于 4 人出征,但要注意高风险任务
        </p>
      )}
    </div>
  );
}
