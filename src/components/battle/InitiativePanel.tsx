import type { InitiativeItemViewModel } from '../../game-engine/selectors.js';

interface InitiativePanelProps {
  items: InitiativeItemViewModel[];
  round: number;
}

export function InitiativePanel({ items, round }: InitiativePanelProps) {
  return (
    <div className="initiative">
      <div className="initiative__title">行动顺序 · 第 {round} 回合</div>
      <div className="initiative__list">
        {items.map((it) => {
          const classes = ['initiative__item', `initiative__item--${it.side}`];
          if (it.active) classes.push('initiative__item--active');
          if (it.acted) classes.push('initiative__item--acted');
          return (
            <span key={it.actorId} className={classes.join(' ')}>
              {it.active ? '▶ ' : ''}
              {it.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
