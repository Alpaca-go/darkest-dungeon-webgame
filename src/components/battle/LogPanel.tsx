import type { BattleLogItemViewModel } from '../../game-engine/selectors.js';

interface LogPanelProps {
  events: BattleLogItemViewModel[];
}

function getEventClass(type: string): string {
  if (type === 'DAMAGE_DEALT' || type === 'DOT_TICKED') return 'log-item--damage';
  if (type === 'HEALING_APPLIED') return 'log-item--heal';
  if (type === 'STUN_APPLIED' || type === 'BLEED_APPLIED' || type === 'BLIGHT_APPLIED' || type === 'MARK_APPLIED' || type === 'PROT_BUFF_APPLIED') {
    return 'log-item--status';
  }
  if (type === 'ACTOR_DIED') return 'log-item--death';
  return 'log-item--system';
}

export function LogPanel({ events }: LogPanelProps) {
  return (
    <div className="log-panel">
      <div className="log-panel__title">
        <span>战斗日志 ({events.length})</span>
      </div>
      <div className="log-panel__list">
        {events.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: 8 }}>
            暂无事件
          </div>
        ) : (
          events.map((e) => (
            <div key={e.id} className={`log-item ${getEventClass(e.type)}`}>
              {e.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
