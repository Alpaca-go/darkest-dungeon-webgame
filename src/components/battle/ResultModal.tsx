import type { BattleResultViewModel } from '../../game-engine/selectors.js';

interface ResultModalProps {
  result: BattleResultViewModel;
  onRestartSame: () => void;
  onRestartNew: () => void;
}

export function ResultModal({ result, onRestartSame, onRestartNew }: ResultModalProps) {
  const isVictory = result.outcome === 'victory';
  return (
    <div className="modal-overlay">
      <div className={'modal' + (isVictory ? '' : ' modal--defeat')}>
        <div className="modal__title">{isVictory ? '战斗胜利' : '战斗失败'}</div>
        <div className="modal__stats">
          <span className="modal__stat-label">Seed</span>
          <span className="modal__stat-value">{result.seed}</span>
          <span className="modal__stat-label">回合数</span>
          <span className="modal__stat-value">{result.rounds}</span>
          <span className="modal__stat-label">事件数</span>
          <span className="modal__stat-value">{result.totalEvents}</span>
          <span className="modal__stat-label">造成伤害</span>
          <span className="modal__stat-value">{result.stats.totalDamageDealt}</span>
          <span className="modal__stat-label">承受伤害</span>
          <span className="modal__stat-value">{result.stats.totalDamageTaken}</span>
          <span className="modal__stat-label">暴击数</span>
          <span className="modal__stat-value">{result.stats.critCount}</span>
          <span className="modal__stat-label">闪避数</span>
          <span className="modal__stat-value">{result.stats.missCount}</span>
          <span className="modal__stat-label">眩晕数</span>
          <span className="modal__stat-value">{result.stats.stunCount}</span>
          <span className="modal__stat-label">位移数</span>
          <span className="modal__stat-value">{result.stats.moveCount}</span>
          <span className="modal__stat-label">敌人击杀</span>
          <span className="modal__stat-value">{result.stats.enemiesKilled}</span>
        </div>
        <div className="modal__actions">
          <button className="btn btn--primary" onClick={onRestartSame}>
            同 Seed 重玩
          </button>
          <button className="btn" onClick={onRestartNew}>
            新 Seed
          </button>
        </div>
      </div>
    </div>
  );
}
