/**
 * CampFoodPanel — 露营食物选择(Phase 4 P4.4)
 *
 * 4 种选择卡:丰盛 / 普通 / 节省 / 不进食
 * 由父组件 dispatch CHOOSE_CAMP_FOOD
 */

import { CAMP_FOOD_CHOICES, type CampFoodChoiceId } from '../../game-engine/camps/types.js';
import { countInventory } from '../../game-engine/camps/manager.js';
import type { InventoryState } from '../../game-engine/expedition/types.js';

export function CampFoodPanel({
  inventory,
  onChoose,
}: {
  inventory: InventoryState;
  onChoose: (choiceId: CampFoodChoiceId) => void;
}) {
  const foodCount = countInventory(inventory, 'food');

  return (
    <div className="camp-food-panel">
      <h4 className="panel-title">选择食物(当前 {foodCount})</h4>
      <div className="camp-food-choices">
        {(Object.values(CAMP_FOOD_CHOICES) as { id: CampFoodChoiceId; name: string; description: string; foodCost: number; partyStressDelta: number; partyHealFlat: number; partyHpDamage: number; riskHint: string }[]).map((c) => {
          const canAfford = foodCount >= c.foodCost;
          return (
            <button
              key={c.id}
              type="button"
              className={`camp-food-card ${canAfford ? 'available' : 'locked'}`}
              onClick={() => canAfford && onChoose(c.id)}
              disabled={!canAfford}
            >
              <div className="camp-food-name">{c.name}</div>
              <div className="camp-food-desc">{c.description}</div>
              <div className="camp-food-stats">
                <span>食物 {c.foodCost > 0 ? `-${c.foodCost}` : '不变'}</span>
                {c.partyStressDelta !== 0 && (
                  <span className={c.partyStressDelta < 0 ? 'good' : 'bad'}>
                    压力 {c.partyStressDelta > 0 ? '+' : ''}{c.partyStressDelta}
                  </span>
                )}
                {c.partyHealFlat > 0 && <span className="good">HP +{c.partyHealFlat}</span>}
                {c.partyHpDamage > 0 && <span className="bad">HP -{c.partyHpDamage}</span>}
              </div>
              <div className="camp-food-risk">{c.riskHint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
