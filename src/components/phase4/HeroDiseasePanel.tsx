/**
 * HeroDiseasePanel — 英雄疾病面板(Phase 4 P4.1)
 *
 * 显示当前疾病 + 治疗按钮(由父组件 dispatch)
 */

import type { HeroInstance } from '../../game-engine/expedition/types.js';
import { getDiseaseDef } from '../../game-engine/diseases/registry.js';

export function HeroDiseasePanel({
  hero,
  onTreat,
}: {
  hero: HeroInstance;
  onTreat?: (diseaseId: string) => void;
}) {
  const diseases = hero.diseaseIds ?? [];

  return (
    <div className="hero-disease-panel">
      <h4 className="panel-title">疾病({diseases.length}/3)</h4>

      {diseases.length === 0 && <div className="muted">健康</div>}

      <div className="disease-list">
        {diseases.map((did) => {
          const def = getDiseaseDef(did);
          return (
            <div key={did} className="disease-card">
              <div className="disease-card-header">
                <span className="disease-name">{def?.name ?? did}</span>
                {onTreat && (
                  <button
                    type="button"
                    className="disease-treat-btn"
                    onClick={() => onTreat(did)}
                    title="去疗养院治疗"
                  >
                    治疗
                  </button>
                )}
              </div>
              {def?.description && <div className="disease-desc">{def.description}</div>}
              {def && (
                <div className="disease-stats">
                  <span>tags: {def.tags.join(', ')}</span>
                  <span>基础费用 {def.treatmentCostBase}g</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
