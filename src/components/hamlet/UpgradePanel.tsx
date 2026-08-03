/**
 * UpgradePanel — 升级(公会/铁匠铺)
 *
 * 显示:
 * - 公会设施(技能升级)
 * - 铁匠铺设施(武器/护甲升级)
 * - 英雄选择器 + 设施服务
 */

import { useState } from 'react';
import { useGameStore } from '../../store/game-store.js';
import { FacilityCard } from './FacilityCard.js';
import { HamletBackBar } from './HamletBackBar.js';
import type { FacilityId } from '../../game-engine/campaign/types.js';

const UPGRADE_FACILITIES: FacilityId[] = ['guild', 'blacksmith'];

export function UpgradePanel() {
  const state = useGameStore((s) => s.state);
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);

  // 可用英雄(活 + available)
  const candidates = Object.values(state.party).filter(
    (h) => !h.isDead && (h.activityState === 'available' || h.activityState === undefined),
  );

  return (
    <div className="hamlet-upgrade-panel">
      <HamletBackBar title="升级" />
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
                {h.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="facility-list">
        {UPGRADE_FACILITIES.map((id) => {
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
