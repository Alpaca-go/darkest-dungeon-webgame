/**
 * CampResultPanel — 露营结果 + 夜袭显示(Phase 4 P4.4)
 *
 * 显示:
 *  - 选择的食物
 *  - 已选活动列表
 *  - 夜袭结果(guarded / outcome)
 *  - 持续 Buff 列表
 */

import type { CampState, ExpeditionBuff } from '../../game-engine/camps/types.js';
import { CAMP_FOOD_CHOICES } from '../../game-engine/camps/types.js';
import { getCampActivity } from '../../game-engine/camps/activities.js';

export function CampResultPanel({
  campState,
  buffs,
  onResolveAmbush,
}: {
  campState: CampState;
  buffs: ExpeditionBuff[];
  onResolveAmbush: () => void;
}) {
  const food = campState.foodChoiceId ? CAMP_FOOD_CHOICES[campState.foodChoiceId] : null;
  const ambush = campState.nightAmbushResult;

  return (
    <div className="camp-result-panel">
      <h4 className="panel-title">露营结果</h4>

      {food && (
        <div className="camp-result-row">
          <span className="result-label">食物:</span>
          <span className="result-value">{food.name}</span>
        </div>
      )}

      <div className="camp-result-row">
        <span className="result-label">已选活动:</span>
        <span className="result-value">{campState.selectedActivityIds.length}</span>
      </div>
      <div className="camp-activity-list">
        {campState.selectedActivityIds.map((id) => {
          const a = getCampActivity(id);
          return (
            <span key={id} className="camp-activity-pill">
              {a?.name ?? id}
            </span>
          );
        })}
      </div>

      <div className="camp-result-section">
        <h5>夜袭</h5>
        {ambush ? (
          <div className={`ambush-result ${ambush.guarded ? 'guarded' : 'triggered'}`}>
            <div className="ambush-narrative">{ambush.narrative}</div>
            <div className="ambush-outcome">结果:{ambush.outcome}</div>
          </div>
        ) : (
          <div className="ambush-pending">
            <button
              type="button"
              className="primary"
              onClick={onResolveAmbush}
              disabled={campState.campStatus !== 'completed'}
            >
              检定夜袭
            </button>
          </div>
        )}
      </div>

      <div className="camp-result-section">
        <h5>持续 Buff({buffs.length})</h5>
        {buffs.length === 0 ? (
          <span className="muted">无</span>
        ) : (
          <ul className="buff-list">
            {buffs.map((b) => (
              <li key={b.id} className={`buff-item tag-${b.tag}`}>
                <span className="buff-source">{b.sourceLabel}</span>
                <span className="buff-tag">{b.tag}</span>
                {b.remainingNodes !== undefined && <span>剩 {b.remainingNodes} 节点</span>}
                {b.remainingEncounters !== undefined && <span>剩 {b.remainingEncounters} 遭遇</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
