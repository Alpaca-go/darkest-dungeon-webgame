/**
 * NightAmbushOverlay — 夜袭结算覆盖层(Phase 4 P4.4)
 *
 * 露营完成后的弹层,显示:
 *  - 检定结果(guarded / safe / 各种 outcome)
 *  - 守夜是否阻止
 *  - 下一动作(继续远征 / 撤退)
 */

import type { NightAmbushResult } from '../../game-engine/camps/types.js';

export function NightAmbushOverlay({
  result,
  onContinue,
  onRetreat,
}: {
  result: NightAmbushResult;
  onContinue: () => void;
  onRetreat: () => void;
}) {
  const tone = result.guarded ? 'good' : result.outcome === 'safe' ? 'neutral' : 'bad';
  return (
    <div className={`night-ambush-overlay tone-${tone}`}>
      <div className="overlay-backdrop" />
      <div className="overlay-card">
        <h3 className="overlay-title">夜间伏击</h3>
        <div className="overlay-narrative">{result.narrative}</div>
        <div className="overlay-outcome">
          <span className="outcome-label">结果:</span>
          <span className="outcome-value">{result.outcome}</span>
          {result.guarded && <span className="guard-tag">守夜阻止</span>}
        </div>
        {result.effects.stressDelta && (
          <div className="effect-line">全队压力 +{result.effects.stressDelta}</div>
        )}
        {result.effects.torchLost && (
          <div className="effect-line">火把 -{result.effects.torchLost}</div>
        )}
        {result.effects.foodLost && (
          <div className="effect-line">食物 -{result.effects.foodLost}</div>
        )}
        {result.effects.diseaseId && (
          <div className="effect-line warn">感染疾病: {result.effects.diseaseId}</div>
        )}
        <div className="overlay-actions">
          <button type="button" className="primary" onClick={onContinue}>
            继续远征
          </button>
          <button type="button" className="warn" onClick={onRetreat}>
            撤退
          </button>
        </div>
      </div>
    </div>
  );
}
