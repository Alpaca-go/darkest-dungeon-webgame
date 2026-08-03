import type { ResolutionResult } from '../../game-engine/expedition/types.js';

export function ResolutionPanel({ resolution, onContinue }: { resolution: ResolutionResult; onContinue: () => void }) {
  return (
    <div className="resolution-panel">
      <div className="resolution-title">结果:{resolution.title}</div>
      <div className="resolution-narrative">
        {resolution.narrative.map((n, i) => (
          <div key={i}>{n}</div>
        ))}
      </div>
      {resolution.resourceChanges && (
        <div className="resolution-changes">
          {resolution.resourceChanges.torch !== 0 && (
            <span className={resolution.resourceChanges.torch < 0 ? 'change-negative' : 'change-positive'}>
              🔥{resolution.resourceChanges.torch > 0 ? '+' : ''}{resolution.resourceChanges.torch}
            </span>
          )}
          {resolution.resourceChanges.food !== 0 && (
            <span className={resolution.resourceChanges.food < 0 ? 'change-negative' : 'change-positive'}>
              🍖{resolution.resourceChanges.food > 0 ? '+' : ''}{resolution.resourceChanges.food}
            </span>
          )}
          {resolution.resourceChanges.time !== 0 && (
            <span className={resolution.resourceChanges.time < 0 ? 'change-positive' : 'change-negative'}>
              ⏱{resolution.resourceChanges.time > 0 ? '+' : ''}{resolution.resourceChanges.time}
            </span>
          )}
        </div>
      )}
      <button onClick={onContinue} className="primary" style={{ marginTop: 8, width: '100%' }}>继续</button>
    </div>
  );
}
