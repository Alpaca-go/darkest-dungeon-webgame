/**
 * TreatmentPanel — 治疗(酒馆/修道院/疗养院)
 *
 * 3 个 FacilityCard + 英雄选择器
 */

import { useState } from 'react';
import { useGameStore } from '../../store/game-store.js';
import { FacilityCard } from './FacilityCard.js';
import { HamletBackBar } from './HamletBackBar.js';
import type { FacilityId } from '../../game-engine/campaign/types.js';

const TREATMENT_FACILITIES: FacilityId[] = ['tavern', 'abbey', 'sanitarium'];

export function TreatmentPanel() {
  const state = useGameStore((s) => s.state);
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);

  // 可用英雄(活 + available)
  const candidates = Object.values(state.party).filter(
    (h) => !h.isDead && (h.activityState === 'available' || h.activityState === undefined),
  );

  return (
    <div className="hamlet-treatment-panel">
      <HamletBackBar title="治疗" />
      {/* 英雄选择器 */}
      <div className="hero-selector">
        <span className="muted" style={{ fontSize: 12 }}>选择英雄:</span>
        {candidates.length === 0 ? (
          <span className="muted" style={{ fontSize: 12 }}>无空闲英雄</span>
        ) : (
          <div className="hero-selector-chips">
            {candidates.map((h) => (
              <button
                key={h.id}
                className={`hero-chip ${selectedHeroId === h.id ? 'selected' : ''}`}
                onClick={() => setSelectedHeroId(h.id === selectedHeroId ? null : h.id)}
                style={{ minHeight: 36, fontSize: 12, padding: '4px 8px' }}
              >
                {h.name} <span className="muted">({h.stress})</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* 设施列表 */}
      <div className="facility-list">
        {TREATMENT_FACILITIES.map((id) => {
          const fac = state.campaign?.facilityStates[id];
          if (!fac) return null;
          return (
            <FacilityCard
              key={id}
              facilityId={id}
              facility={fac}
              selectedHeroId={selectedHeroId}
            />
          );
        })}
      </div>
    </div>
  );
}
