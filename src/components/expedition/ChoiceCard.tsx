import type { GeneratedChoice } from '../../game-engine/expedition/types.js';

export function ChoiceCard({ choice, onClick }: { choice: GeneratedChoice; onClick: () => void }) {
  return (
    <button
      className={`choice-card ${choice.enabled ? '' : 'disabled'}`}
      onClick={choice.enabled ? onClick : undefined}
      disabled={!choice.enabled}
      title={choice.disabledReason ?? choice.description}
    >
      <div className="choice-card-title">{choice.title}</div>
      <div className="choice-card-description">{choice.description}</div>
      <div className="choice-card-meta">
        {choice.visibleCosts.map((c, i) => (
          <span key={`cost-${i}`} className="choice-cost">
            {c.kind === 'torch' && `🔥${c.amount! >= 0 ? '+' : ''}${c.amount}`}
            {c.kind === 'food' && `🍖${c.amount! >= 0 ? '+' : ''}${c.amount}`}
            {c.kind === 'time' && `⏱${c.amount! >= 0 ? '+' : ''}${c.amount}`}
            {c.kind === 'hp' && `❤${c.amount! >= 0 ? '+' : ''}${c.amount}`}
            {c.kind === 'item' && `${c.itemId} -${c.amount}`}
            {c.kind === 'position' && `位置变化`}
            {c.kind === 'flag' && c.description}
          </span>
        ))}
        {choice.visibleRisks.map((r, i) => (
          <span key={`risk-${i}`} className="choice-risk">⚠{r.description}</span>
        ))}
        {choice.tags.filter((t) => t.startsWith('risk:') || t.startsWith('reward:')).map((t, i) => (
          <span key={`tag-${i}`} className={`choice-${t.startsWith('risk:') ? 'risk' : 'reward'}`}>{t.split(':')[1]}</span>
        ))}
      </div>
      {choice.disabledReason && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{choice.disabledReason}</div>}
    </button>
  );
}
