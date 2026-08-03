interface TopBarProps {
  round: number;
  phase: string;
  seed: string;
  onRestartSame: () => void;
  onRestartNew: () => void;
  onToggleDebug: () => void;
  onExportDebug: () => void;
  debugOpen: boolean;
}

const PHASE_LABELS: Record<string, string> = {
  setup: '准备',
  'round-start': '回合开始',
  'actor-turn': '行动中',
  resolution: '结算中',
  'round-end': '回合结束',
  victory: '胜利',
  defeat: '失败',
};

export function TopBar({
  round,
  phase,
  seed,
  onRestartSame,
  onRestartNew,
  onToggleDebug,
  onExportDebug,
  debugOpen,
}: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar__title">Darkest Dungeon · Phase 1</div>
      <div className="topbar__info">
        <span>回合 <strong>{round || '-'}</strong></span>
        <span>阶段 <strong>{PHASE_LABELS[phase] ?? phase}</strong></span>
        <span>Seed <strong>{seed}</strong></span>
      </div>
      <div className="topbar__actions">
        <button className="btn" onClick={onRestartSame}>同 Seed 重启</button>
        <button className="btn" onClick={onRestartNew}>新 Seed</button>
        <button className="btn" onClick={onExportDebug}>导出调试包</button>
        <button className={'btn' + (debugOpen ? ' btn--primary' : '')} onClick={onToggleDebug}>
          调试
        </button>
      </div>
    </div>
  );
}
