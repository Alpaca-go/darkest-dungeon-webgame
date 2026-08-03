import { useGameStore } from '../../store/game-store.js';
import { generateExpeditionReport } from '../../game-engine/expedition/report.js';

export function ExpeditionResultModal() {
  const state = useGameStore((s) => s.state);
  const startExpedition = useGameStore((s) => s.startExpedition);
  const report = generateExpeditionReport(state);
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>远征报告</h2>
        <div className={`result-tag ${report.result}`}>
          {report.result === 'success' ? '成功撤离' : report.result === 'retreat' ? '主动撤退' : '任务失败'}
        </div>
        <div className="modal-stats">
          <div className="label">最深节点</div><div className="value">{report.stats.deepestNodeReached}</div>
          <div className="label">访问节点</div><div className="value">{report.stats.nodesVisited}</div>
          <div className="label">遭遇次数</div><div className="value">{report.stats.encounterCount}</div>
          <div className="label">陷阱次数</div><div className="value">{report.stats.trapCount}</div>
          <div className="label">饥饿次数</div><div className="value">{report.stats.hungerCount}</div>
          <div className="label">火把使用</div><div className="value">{report.stats.torchUsed}</div>
          <div className="label">食物使用</div><div className="value">{report.stats.foodUsed}</div>
          <div className="label">最低火把</div><div className="value">{report.stats.lowestTorch}</div>
        </div>
        {report.failureChain.length > 0 && (
          <div>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
              {report.result === 'success' ? '关键选择' : '失败链'}
            </div>
            <div className="modal-failure-chain">
              {report.failureChain.map((line, i) => (
                <div key={i}>· {line}</div>
              ))}
            </div>
          </div>
        )}
        <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>英雄状态</div>
        {report.heroSnapshot.map((h) => (
          <div key={h.heroId} className="hero-detail-row">
            <span>{h.name}</span>
            <strong className={h.isDead ? 'danger' : h.hp < h.maxHp / 2 ? 'warn' : ''}>
              {h.isDead ? '阵亡' : `${h.hp}/${h.maxHp}`}
            </strong>
          </div>
        ))}
        <div className="divider" />
        <div className="flex-col">
          <button className="primary" onClick={() => startExpedition(state.seed)}>同 Seed 重玩</button>
          <button onClick={() => startExpedition()}>新 Seed 开始</button>
        </div>
      </div>
    </div>
  );
}
