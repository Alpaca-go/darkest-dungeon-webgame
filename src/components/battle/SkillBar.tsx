import type { SkillButtonViewModel } from '../../game-engine/selectors.js';

interface SkillBarProps {
  skills: SkillButtonViewModel[];
  selectedSkillId: string | null;
  onSelect: (skillId: string | null) => void;
  canPlayerInteract: boolean;
}

export function SkillBar({ skills, selectedSkillId, onSelect, canPlayerInteract }: SkillBarProps) {
  if (skills.length === 0) {
    return (
      <div className="skill-bar">
        <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
          {canPlayerInteract ? '加载中...' : '等待行动者'}
        </div>
      </div>
    );
  }

  return (
    <div className="skill-bar">
      <div className="skill-bar-header">技能</div>
      {skills.map((s) => {
        const isSelected = selectedSkillId === s.id;
        const classes = ['skill-btn', 'skill-btn--relative'];
        if (isSelected) classes.push('skill-btn--selected');
        return (
          <button
            key={s.id}
            className={classes.join(' ')}
            disabled={!s.enabled || !canPlayerInteract}
            onClick={() => {
              if (!canPlayerInteract) return;
              if (isSelected) onSelect(null);
              else if (s.enabled) onSelect(s.id);
            }}
            title={s.disabledReason ?? s.statusSummary.join(' | ')}
          >
            {s.cooldown > 0 && <span className="skill-btn__cooldown">CD {s.cooldown}</span>}
            <div className="skill-btn__name">{s.name}</div>
            <div className="skill-btn__hint">
              {s.targetSide === 'self' ? '自身' : s.targetSide === 'ally' ? '友军' : '敌方'}
              {' · '}
              {s.targetRanks.length === 4
                ? '任意'
                : s.targetRanks.join('/')}
            </div>
            {s.damagePreview && (
              <div className="skill-btn__hint">伤害 {s.damagePreview}</div>
            )}
            {s.accuracyPreview !== undefined && (
              <div className="skill-btn__hint">命中 {s.accuracyPreview}%</div>
            )}
            <div className="skill-btn__summary">
              {s.statusSummary.slice(0, 3).map((t, i) => (
                <span key={i} className="skill-btn__summary-item">{t}</span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
