/**
 * WeeklySummaryModal — 远征返回时的周总结
 *
 * 显示:
 * - 远征结果(成功/撤退/失败)
 * - 死亡英雄列表
 * - 状态变化(高压力)
 * - 收获(将在 Phase 4 实现)
 * - "进入庄园"按钮
 */

import { useGameStore, makeCommandId } from '../../store/game-store.js';
import type { DeathRecord } from '../../game-engine/expedition/types.js';

export function WeeklySummaryModal() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const expedition = state.expedition;
  const succeeded = expedition.objectiveCompleted;
  const retreatPosition = expedition.stats.retreatPosition;

  const onEnterHamlet = () => {
    // 远征返回 → 庄园(advanceWeek 已经由内部触发,或手动 advance)
    dispatch({ type: 'ADVANCE_WEEK', commandId: makeCommandId('enter-hamlet') });
  };

  const onSkipAdvance = () => {
    // 直接进入 weekly-summary 模式(不 advanceWeek)
    dispatch({ type: 'SET_HAMLET_MODE', mode: 'weekly-summary', commandId: makeCommandId('skip') });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card weekly-summary">
        <h2>{succeeded ? '远征成功' : retreatPosition ? '撤退' : '远征结束'}</h2>
        <div className="summary-row">
          <span>深度</span>
          <span>{expedition.stats.deepestNodeReached}</span>
        </div>
        <div className="summary-row">
          <span>节点</span>
          <span>{expedition.stats.nodesVisited}</span>
        </div>
        <div className="summary-row">
          <span>遭遇</span>
          <span>{expedition.stats.encounterCount}</span>
        </div>
        <div className="summary-row">
          <span>陷阱</span>
          <span>{expedition.stats.trapCount}</span>
        </div>
        <div className="summary-row">
          <span>饥饿</span>
          <span>{expedition.stats.hungerCount}</span>
        </div>
        {state.deathRecords.length > 0 && <DeathSummary records={state.deathRecords} />}
        <div className="modal-actions">
          <button onClick={onSkipAdvance}>查看本周</button>
          <button className="primary" onClick={onEnterHamlet}>进入庄园</button>
        </div>
      </div>
    </div>
  );
}

function DeathSummary({ records }: { records: DeathRecord[] }) {
  const recent = records.slice(-5);
  return (
    <div className="death-summary">
      <h4>近期死亡</h4>
      <ul>
        {recent.map((r) => (
          <li key={r.id}>
            {r.heroName} · {r.cause} · {r.nodeId}
          </li>
        ))}
      </ul>
    </div>
  );
}
