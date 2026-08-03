import { useGameStore } from '../../store/game-store.js';
import { PARTY_LINEUP } from '../../content/heroes/lineup.js';
import { getAfflictionDef } from '../../game-engine/mental/afflictions.js';
import { getVirtueDef } from '../../game-engine/mental/virtues.js';

export function HeroDetailDrawer({ heroId, onClose }: { heroId: string; onClose: () => void }) {
  const state = useGameStore((s) => s.state);
  const hero = state.party[heroId];
  if (!hero) return null;
  const partyDef = PARTY_LINEUP.find((p) => p.actor.id === heroId);
  const skills = partyDef?.skills ?? [];
  const affliction = hero.afflictionId ? getAfflictionDef(hero.afflictionId) : null;
  const virtue = hero.virtueId ? getVirtueDef(hero.virtueId) : null;
  const stressPct = Math.min(100, Math.max(0, hero.stress / 2));
  const stressLabel = hero.stress >= 100 ? '临界' : hero.stress >= 75 ? '高' : hero.stress >= 50 ? '中' : '低';
  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-title">
          <span>{hero.name} ({hero.archetype}){hero.isDead ? ' ☠' : ''}{hero.atDeathsDoor ? ' ⚰' : ''}</span>
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
        {/* Phase 2 精神系统 */}
        <div className="hero-detail-section">
          <div className="hero-detail-row"><span>压力</span><strong className={`stress-${stressLabel.toLowerCase()}`}>{hero.stress} / 200 ({stressLabel})</strong></div>
          <div className="stress-bar-bg" style={{ marginTop: 4 }}>
            <div className={`stress-bar-fill ${stressLabel.toLowerCase()}`} style={{ width: `${stressPct}%` }} />
          </div>
          <div className="hero-detail-row"><span>意志</span><strong>{hero.resolveState}</strong></div>
          {affliction && (
            <>
              <div className="hero-detail-row"><span>折磨</span><strong style={{ color: '#ff8060' }}>{affliction.name}</strong></div>
              <div className="hero-detail-row" style={{ fontSize: 11, color: '#aa7a5a' }}>{affliction.description}</div>
            </>
          )}
          {virtue && (
            <>
              <div className="hero-detail-row"><span>美德</span><strong style={{ color: '#80d8d8' }}>{virtue.name}</strong></div>
              <div className="hero-detail-row" style={{ fontSize: 11, color: '#7aaa9a' }}>{virtue.description}</div>
            </>
          )}
        </div>
        {/* Phase 2 死亡状态 */}
        {(hero.atDeathsDoor || hero.deathsDoorRecoveryStacks > 0 || hero.deathblowPenalty > 0 || hero.heartAttackCount > 0 || hero.isDead) && (
          <div className="hero-detail-section">
            <div className="hero-detail-row"><span>死亡之门</span><strong>{hero.atDeathsDoor ? '是' : '否'}</strong></div>
            <div className="hero-detail-row"><span>恢复层数</span><strong>{hero.deathsDoorRecoveryStacks}</strong></div>
            <div className="hero-detail-row"><span>致死打击惩罚</span><strong>{hero.deathblowPenalty.toFixed(2)}</strong></div>
            <div className="hero-detail-row"><span>心脏病次数</span><strong>{hero.heartAttackCount}</strong></div>
            {hero.isDead && <div className="hero-detail-row" style={{ color: '#aa3030' }}>已永久死亡</div>}
          </div>
        )}
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
