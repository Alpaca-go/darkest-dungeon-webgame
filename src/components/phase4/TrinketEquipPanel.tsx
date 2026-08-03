/**
 * TrinketEquipPanel — 英雄饰品装备(Phase 4 P4.2)
 *
 * 显示 hero.equippedTrinketInstanceIds (2 槽) + 仓库
 * 由父组件 dispatch EQUIP_TRINKET / UNEQUIP_TRINKET
 */

import type { HeroInstance } from '../../game-engine/expedition/types.js';

export function TrinketEquipPanel({
  hero,
  onUnequip,
}: {
  hero: HeroInstance;
  onUnequip?: (slotIndex: number) => void;
}) {
  const slots = hero.equippedTrinketInstanceIds ?? [null, null];

  return (
    <div className="trinket-equip-panel">
      <h4 className="panel-title">饰品槽({slots.filter((s) => s !== null).length}/2)</h4>
      <div className="trinket-slots">
        {[0, 1].map((idx) => {
          const instanceId = slots[idx] ?? null;
          return (
            <div key={idx} className={`trinket-slot ${instanceId ? 'filled' : 'empty'}`}>
              <span className="slot-label">槽 {idx + 1}</span>
              <span className="slot-value">
                {instanceId ? instanceId.slice(0, 12) : '空'}
              </span>
              {instanceId && onUnequip && (
                <button
                  type="button"
                  className="trinket-unequip-btn"
                  onClick={() => onUnequip(idx)}
                  title="卸下饰品"
                >
                  卸下
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
