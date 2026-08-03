import type { GeneratedChoice, MentalRiskLevel, ObedienceRiskLevel, DeathRiskLevel } from '../../game-engine/expedition/types.js';

const MENTAL_RISK_LABEL: Record<MentalRiskLevel, string> = {
  stable: '精神稳定',
  'may-stress': '可能产生压力',
  'high-stress': '精神紧绷',
  'may-resolve-check': '可能意志检定',
  'may-heart-attack': '可能心脏病',
};

const OBEDIENCE_RISK_LABEL: Record<ObedienceRiskLevel, string> = {
  stable: '会服从',
  'may-refuse': '可能拒绝',
  'may-replace': '可能替换',
  conflicts: '当前折磨与该选择冲突',
};

const DEATH_RISK_LABEL: Record<DeathRiskLevel, string> = {
  safe: '死亡安全',
  'may-entered-door': '可能进入死亡之门',
  'door-may-deathblow': '可能致死打击',
  extreme: '极高死亡风险',
};

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
      {/* Phase 2 风险预览 */}
      {(choice.mentalRisk || choice.obedienceRisk || choice.deathRisk) && (
        <div className="choice-card-risks">
          {choice.mentalRisk && (
            <span className={`choice-mental-risk level-${choice.mentalRisk.level}`}>
              🧠 {MENTAL_RISK_LABEL[choice.mentalRisk.level]}
            </span>
          )}
          {choice.obedienceRisk && choice.obedienceRisk.level !== 'stable' && (
            <span className={`choice-obedience-risk level-${choice.obedienceRisk.level}`}>
              ⚠ {OBEDIENCE_RISK_LABEL[choice.obedienceRisk.level]}
            </span>
          )}
          {choice.deathRisk && choice.deathRisk.level !== 'safe' && (
            <span className={`choice-death-risk level-${choice.deathRisk.level}`}>
              💀 {DEATH_RISK_LABEL[choice.deathRisk.level]}
            </span>
          )}
        </div>
      )}
      {choice.disabledReason && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{choice.disabledReason}</div>}
    </button>
  );
}
