/**
 * HeroQuirkPanel — 英雄怪癖面板(Phase 4 P4.1)
 *
 * 显示正面/负面怪癖 + 锁定状态
 */

import type { HeroInstance } from '../../game-engine/expedition/types.js';
import { getQuirkDef } from '../../game-engine/quirks/registry.js';

export function HeroQuirkPanel({ hero }: { hero: HeroInstance }) {
  const positive = hero.positiveQuirkIds ?? [];
  const negative = hero.negativeQuirkIds ?? [];
  const locked = hero.lockedPositiveQuirkIds ?? [];

  return (
    <div className="hero-quirk-panel">
      <h4 className="panel-title">怪癖</h4>

      <div className="quirk-section">
        <div className="quirk-section-label">正面({positive.length}/5)</div>
        <div className="quirk-list">
          {positive.length === 0 && <span className="muted">无</span>}
          {positive.map((qid) => {
            const def = getQuirkDef(qid);
            const isLocked = locked.includes(qid);
            return (
              <div key={qid} className={`quirk-card positive ${isLocked ? 'locked' : ''}`}>
                <div className="quirk-card-header">
                  <span className="quirk-name">{def?.name ?? qid}</span>
                  {isLocked && <span className="quirk-locked-tag" title="疗养院锁定,不会被替换">🔒</span>}
                </div>
                {def?.description && <div className="quirk-desc">{def.description}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="quirk-section">
        <div className="quirk-section-label">负面({negative.length}/5)</div>
        <div className="quirk-list">
          {negative.length === 0 && <span className="muted">无</span>}
          {negative.map((qid) => {
            const def = getQuirkDef(qid);
            return (
              <div key={qid} className="quirk-card negative">
                <div className="quirk-card-header">
                  <span className="quirk-name">{def?.name ?? qid}</span>
                </div>
                {def?.description && <div className="quirk-desc">{def.description}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
