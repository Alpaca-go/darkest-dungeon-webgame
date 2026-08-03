import type { ActorViewModel } from '../../game-engine/selectors.js';

interface ActorCardProps {
  actor: ActorViewModel;
  isValidTarget: boolean;
  isInvalidTarget: boolean;
  invalidReason?: string;
  onClick?: (id: string) => void;
}

/** 职业中文名 */
const ARCHETYPE_LABELS: Record<string, string> = {
  crusader: '十字军',
  highwayman: '强盗',
  vestal: '修女',
  plague_doctor: '瘟疫医生',
  skeleton_defender: '骸骨盾卫',
  skeleton_soldier: '骸骨士兵',
  cultist_acolyte: '邪教侍僧',
  crossbowman: '骸骨弩手',
};

/** 职业纹章(DD 风格符号):友军偏光明金,敌人偏暗红/骨白 */
const ARCHETYPE_EMBLEMS: Record<string, string> = {
  crusader: '✠',           // 洛林十字
  highwayman: '⚔',         // 双剑
  vestal: '☩',             // 带柄十字
  plague_doctor: '☠',      // 骷髅头
  skeleton_defender: '⛨',  // 盾牌(骸骨盾卫)
  skeleton_soldier: '⚔',   // 双剑(骸骨士兵)
  cultist_acolyte: '✟',    // 拉丁十字(邪教)
  crossbowman: '➳',        // 箭(弩手)
};

export function ActorCard({ actor, isValidTarget, isInvalidTarget, invalidReason, onClick }: ActorCardProps) {
  const classes = ['actor-card'];
  if (actor.isActive) classes.push('actor-card--active');
  if (actor.isDead) classes.push('actor-card--dead');
  if (actor.isCorpse) classes.push('actor-card--corpse');
  if (isValidTarget) classes.push('actor-card--valid-target');
  if (isInvalidTarget) classes.push('actor-card--invalid-target');

  const handleClick = () => {
    if (isValidTarget && onClick) {
      onClick(actor.id);
    } else if (onClick) {
      onClick(actor.id);
    }
  };

  const displayName = ARCHETYPE_LABELS[actor.archetype] ?? actor.name;
  const archetypeLabel = actor.isCorpse ? '尸体' : ARCHETYPE_LABELS[actor.archetype] ?? actor.archetype;
  const emblem = ARCHETYPE_EMBLEMS[actor.archetype] ?? '◆';

  return (
    <div
      className={classes.join(' ')}
      onClick={handleClick}
      title={invalidReason}
      role="button"
      tabIndex={0}
    >
      <span className="actor-card__emblem" aria-hidden="true">{emblem}</span>
      <div className="actor-card__name">
        <span>{displayName}</span>
        <span className="actor-card__rank">{actor.rank}</span>
      </div>
      <div className="actor-card__archetype">{archetypeLabel}</div>
      {!actor.isCorpse && (
        <div className="actor-card__hp">
          <div className="actor-card__hp-bar">
            <div
              className={
                'actor-card__hp-fill' + (actor.hpPercent < 0.3 ? ' actor-card__hp-fill--low' : '')
              }
              style={{ width: `${Math.max(0, Math.min(100, actor.hpPercent * 100))}%` }}
            />
          </div>
          <span className="actor-card__hp-text">
            {actor.hp}/{actor.maxHp}
          </span>
        </div>
      )}
      <div className="actor-card__status">
        {actor.bleed.map((b) => (
          <span key={b.id} className="status-icon status-icon--bleed" title={`流血 ${b.damagePerTurn}/回合 × ${b.remainingTurns}`}>
            流{b.damagePerTurn}
          </span>
        ))}
        {actor.blight.map((b) => (
          <span key={b.id} className="status-icon status-icon--blight" title={`腐蚀 ${b.damagePerTurn}/回合 × ${b.remainingTurns}`}>
            腐{b.damagePerTurn}
          </span>
        ))}
        {actor.stun && (
          <span className="status-icon status-icon--stun" title={`眩晕 ${actor.stun.remaining} 回合`}>
            晕
          </span>
        )}
        {actor.mark && (
          <span className="status-icon status-icon--mark" title={`标记 ${actor.mark.remaining} 回合`}>
            标
          </span>
        )}
        {actor.protBuff && (
          <span className="status-icon status-icon--prot" title={`PROT +${actor.protBuff.amount}% ${actor.protBuff.remaining} 回合`}>
            +P
          </span>
        )}
      </div>
    </div>
  );
}
