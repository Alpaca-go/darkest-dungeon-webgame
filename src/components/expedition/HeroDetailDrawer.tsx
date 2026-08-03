import { useGameStore } from '../../store/game-store.js';
import { PARTY_LINEUP } from '../../content/heroes/lineup.js';

export function HeroDetailDrawer({ heroId, onClose }: { heroId: string; onClose: () => void }) {
  const state = useGameStore((s) => s.state);
  const hero = state.party[heroId];
  if (!hero) return null;
  const partyDef = PARTY_LINEUP.find((p) => p.actor.id === heroId);
  const skills = partyDef?.skills ?? [];
  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-title">
          <span>{hero.name} ({hero.archetype})</span>
          <button onClick={onClose}>关闭</button>
        </div>
        <div className="hero-detail-section">
          <div className="hero-detail-row"><span>职业</span><strong>{hero.archetype}</strong></div>
          <div className="hero-detail-row"><span>HP</span><strong>{hero.hp} / {hero.maxHp}</strong></div>
          <div className="hero-detail-row"><span>站位</span><strong>{hero.rank}</strong></div>
          <div className="hero-detail-row"><span>速度</span><strong>{hero.speed}</strong></div>
          <div className="hero-detail-row"><span>闪避</span><strong>{hero.dodge}</strong></div>
          <div className="hero-detail-row"><span>暴击</span><strong>{hero.crit}%</strong></div>
          <div className="hero-detail-row"><span>PROT</span><strong>{hero.protection}%</strong></div>
        </div>
        <div className="hero-detail-section">
          <div className="hero-detail-row"><span>抗性</span></div>
          <div className="hero-detail-row"><span>· 流血</span><strong>{Math.round(hero.bleedResist * 100)}%</strong></div>
          <div className="hero-detail-row"><span>· 腐蚀</span><strong>{Math.round(hero.blightResist * 100)}%</strong></div>
          <div className="hero-detail-row"><span>· 眩晕</span><strong>{Math.round(hero.stunResist * 100)}%</strong></div>
        </div>
        <div className="hero-detail-section">
          <div className="hero-detail-row"><span>技能</span></div>
          {skills.map((s, i) => (
            <div key={i} className="hero-detail-row"><span>· {s.skillId}</span><strong className="muted">{s.skillId}</strong></div>
          ))}
        </div>
        {hero.bleed.length > 0 && (
          <div className="hero-detail-section">
            <div className="hero-detail-row"><span>流血</span><strong>{hero.bleed.length} 个</strong></div>
          </div>
        )}
        {hero.blight.length > 0 && (
          <div className="hero-detail-section">
            <div className="hero-detail-row"><span>腐蚀</span><strong>{hero.blight.length} 个</strong></div>
          </div>
        )}
        {hero.stun && (
          <div className="hero-detail-section">
            <div className="hero-detail-row"><span>眩晕</span><strong>剩余 {hero.stun.remaining}</strong></div>
          </div>
        )}
      </div>
    </div>
  );
}
