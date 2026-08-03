import { useGameStore } from '../../store/game-store.js';
import { getAfflictionDef } from '../../game-engine/mental/afflictions.js';
import { getVirtueDef } from '../../game-engine/mental/virtues.js';

const RANK_LABEL: Record<number, string> = { 1: '前1', 2: '前2', 3: '后3', 4: '后4' };

/** 压力等级颜色:0-50 绿, 50-75 黄, 75-100 橙, 100+ 红 */
function stressClass(stress: number): string {
  if (stress >= 100) return 'critical';
  if (stress >= 75) return 'high';
  if (stress >= 50) return 'mid';
  return 'low';
}

export function PartyStatusStrip({ onSelect }: { onSelect: (heroId: string) => void }) {
  const state = useGameStore((s) => s.state);
  const heroes = Object.values(state.party).sort((a, b) => a.rank - b.rank);

  return (
    <div className="party-strip">
      {heroes.map((h) => {
        const isLow = h.hp < h.maxHp * 0.4;
        const statuses: string[] = [];
        if (h.bleed.length) statuses.push('bleed');
        if (h.blight.length) statuses.push('blight');
        if (h.stun) statuses.push('stun');
        if (h.mark) statuses.push('mark');
        if (h.protBuff) statuses.push('prot');
        // Phase 2 标识
        const affliction = h.afflictionId ? getAfflictionDef(h.afflictionId) : null;
        const virtue = h.virtueId ? getVirtueDef(h.virtueId) : null;
        const isDeathsDoor = h.atDeathsDoor && !h.isDead;
        const stressPct = Math.min(100, Math.max(0, h.stress / 2));
        return (
          <button
            key={h.id}
            className={`hero-card ${h.isDead ? 'dead' : ''} ${isDeathsDoor ? 'deaths-door' : ''}`}
            onClick={() => onSelect(h.id)}
            title={[
              affliction ? `折磨:${affliction.name}` : null,
              virtue ? `美德:${virtue.name}` : null,
              h.isDead ? '已永久死亡' : null,
              isDeathsDoor ? '处于死亡之门' : null,
            ].filter(Boolean).join(' | ')}
          >
            <div className="hero-card-name">{h.name}</div>
            <div className={`hero-card-hp ${isLow ? 'low' : ''}`}>{h.hp}/{h.maxHp}</div>
            <div className="hero-card-stress">
              <div className="stress-bar-bg">
                <div className={`stress-bar-fill ${stressClass(h.stress)}`} style={{ width: `${stressPct}%` }} />
              </div>
              <div className={`stress-text ${stressClass(h.stress)}`}>压{h.stress}</div>
            </div>
            <div className="hero-card-rank">[{RANK_LABEL[h.rank]}]</div>
            <div className="hero-card-status">
              {statuses.map((s) => (
                <span key={s} className={`status-badge ${s}`}>{s[0]?.toUpperCase()}</span>
              ))}
              {affliction && <span className="status-badge affliction" title={affliction.name}>折</span>}
              {virtue && <span className="status-badge virtue" title={virtue.name}>德</span>}
              {isDeathsDoor && <span className="status-badge deaths-door" title="死亡之门">死</span>}
              {h.isDead && <span className="status-badge dead" title="永久死亡">亡</span>}
            </div>
            {h.deathsDoorRecoveryStacks > 0 && (
              <div className="recovery-stacks" title="Death's Door Recovery 累积">R{h.deathsDoorRecoveryStacks}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
