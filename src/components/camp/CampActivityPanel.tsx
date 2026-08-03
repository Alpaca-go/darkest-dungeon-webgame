/**
 * CampActivityPanel — 露营活动选择(Phase 4 P4.4)
 *
 * 显示当前可用活动(2-4 个),点击 dispatch CHOOSE_CAMP_ACTIVITY
 * 显示露营点数
 */

import type { CampState } from '../../game-engine/camps/types.js';
import { getCampActivity } from '../../game-engine/camps/activities.js';

export function CampActivityPanel({
  campState,
  onChoose,
  onFinish,
}: {
  campState: CampState;
  onChoose: (activityId: string, targetHeroId?: string) => void;
  onFinish: () => void;
}) {
  const activities = campState.availableActivityIds
    .map((id) => getCampActivity(id))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);

  return (
    <div className="camp-activity-panel">
      <div className="camp-points-bar">
        <span>露营点数</span>
        <strong>
          {campState.remainingPoints} / {campState.totalPoints}
        </strong>
        {campState.guardEstablished && <span className="guard-badge">守夜已建立</span>}
      </div>

      <h4 className="panel-title">选择活动</h4>

      {activities.length === 0 ? (
        <div className="muted">没有可用活动</div>
      ) : (
        <div className="camp-activity-choices">
          {activities.map((a) => (
            <button
              key={a.id}
              type="button"
              className="camp-activity-card"
              onClick={() => onChoose(a.id)}
            >
              <div className="camp-activity-name">{a.name}</div>
              <div className="camp-activity-desc">{a.description}</div>
              <div className="camp-activity-cost">消耗 {a.cost} 点</div>
              <div className="camp-activity-tags">
                {a.tags.map((t) => (
                  <span key={t} className="camp-tag">{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="camp-finish-row">
        <button
          type="button"
          className="camp-finish-btn primary"
          onClick={onFinish}
          disabled={campState.campStatus !== 'activity-choice'}
        >
          完成露营
        </button>
      </div>
    </div>
  );
}
