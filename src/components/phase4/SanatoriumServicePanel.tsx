/**
 * SanatoriumServicePanel — 疗养院服务面板(Phase 4 P4.1)
 *
 * 3 个服务:治疗疾病 / 移除负向怪癖 / 锁定正向怪癖
 * 移动端 1 卡 1 行的纵向布局
 */

import type { HeroInstance } from '../../game-engine/expedition/types.js';

export interface SanatoriumServices {
  treatDiseaseCost: number;
  removeNegativeQuirkCost: number;
  lockPositiveQuirkCost: number;
}

export function SanatoriumServicePanel({
  hero,
  services,
  onTreatDisease,
  onRemoveQuirk,
  onLockQuirk,
}: {
  hero: HeroInstance;
  services: SanatoriumServices;
  onTreatDisease?: (diseaseId: string) => void;
  onRemoveQuirk?: (quirkId: string) => void;
  onLockQuirk?: (quirkId: string) => void;
}) {
  const diseases = hero.diseaseIds ?? [];
  const negative = hero.negativeQuirkIds ?? [];
  const positive = hero.positiveQuirkIds ?? [];
  const locked = hero.lockedPositiveQuirkIds ?? [];

  return (
    <div className="sanatorium-service-panel">
      <h3 className="panel-title">疗养院服务</h3>

      <div className="sanatorium-section">
        <h4>治疗疾病({diseases.length}/3)</h4>
        {diseases.length === 0 ? (
          <div className="muted">健康,无需治疗</div>
        ) : (
          diseases.map((did) => (
            <div key={did} className="sanatorium-row">
              <span className="row-label">{did}</span>
              <span className="row-cost">{services.treatDiseaseCost}g</span>
              {onTreatDisease && (
                <button type="button" onClick={() => onTreatDisease(did)} className="primary">
                  治疗
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="sanatorium-section">
        <h4>移除负面怪癖({negative.length}/5)</h4>
        {negative.length === 0 ? (
          <div className="muted">无负面怪癖</div>
        ) : (
          negative.map((qid) => (
            <div key={qid} className="sanatorium-row">
              <span className="row-label">{qid}</span>
              <span className="row-cost">{services.removeNegativeQuirkCost}g</span>
              {onRemoveQuirk && (
                <button type="button" onClick={() => onRemoveQuirk(qid)} className="warn">
                  移除
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="sanatorium-section">
        <h4>锁定正面怪癖({locked.length}/5)</h4>
        {positive.length === 0 ? (
          <div className="muted">无正面怪癖</div>
        ) : (
          positive.map((qid) => {
            const isLocked = locked.includes(qid);
            return (
              <div key={qid} className={`sanatorium-row ${isLocked ? 'locked' : ''}`}>
                <span className="row-label">{qid}{isLocked ? ' 🔒' : ''}</span>
                <span className="row-cost">{services.lockPositiveQuirkCost}g</span>
                {onLockQuirk && !isLocked && (
                  <button type="button" onClick={() => onLockQuirk(qid)}>
                    锁定
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
