import { useGameStore } from '../../store/game-store.js';

const RANK_LABEL: Record<number, string> = { 1: '前1', 2: '前2', 3: '后3', 4: '后4' };

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
        return (
          <button
            key={h.id}
            className={`hero-card ${h.isDead ? 'dead' : ''}`}
            onClick={() => onSelect(h.id)}
          >
            <div className="hero-card-name">{h.name}</div>
            <div className={`hero-card-hp ${isLow ? 'low' : ''}`}>{h.hp}/{h.maxHp}</div>
            <div className="hero-card-rank">[{RANK_LABEL[h.rank]}]</div>
            <div className="hero-card-status">
              {statuses.map((s) => (
                <span key={s} className={`status-badge ${s}`}>{s[0]?.toUpperCase()}</span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
