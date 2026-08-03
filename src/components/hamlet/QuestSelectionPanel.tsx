/**
 * QuestSelectionPanel — 任务选择
 *
 * 显示本周 3 个任务,每任务:
 * - 标题 / 描述
 * - 难度 / 节点数 / 威胁
 * - 推荐职业
 * - 预期补给 / 奖励 / 失败惩罚
 * - "选择此任务" 按钮
 */

import { useGameStore, makeCommandId } from '../../store/game-store.js';
import { HamletBackBar } from './HamletBackBar.js';

const DIFFICULTY_LABELS: Record<string, string> = {
  safe: '安全',
  standard: '标准',
  'high-risk': '高风险',
};

const THREAT_LABELS: Record<string, string> = {
  unholy: '邪恶',
  beast: '野兽',
  human: '人类',
  eldritch: '古神',
};

export function QuestSelectionPanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const hamlet = state.hamlet;
  if (!hamlet) return null;

  const onSelect = (questId: string) => {
    dispatch({
      type: 'SELECT_WEEKLY_QUEST',
      questId,
      commandId: makeCommandId('quest'),
    });
  };

  return (
    <div className="hamlet-quest-panel">
      <HamletBackBar title="选择任务" />
      {hamlet.weeklyQuestIds.length === 0 ? (
        <p className="muted">本周无可用任务</p>
      ) : (
        <ul className="quest-list">
          {hamlet.weeklyQuestIds.map((qid) => {
            const q = hamlet.weeklyQuestDefs[qid];
            if (!q) return null;
            const isSelected = hamlet.selectedQuestId === qid;
            return (
              <li key={qid} className={`quest-card ${isSelected ? 'selected' : ''}`}>
                <div className="quest-header">
                  <strong>{q.title}</strong>
                  <span className={`quest-difficulty diff-${q.difficulty}`}>
                    {DIFFICULTY_LABELS[q.difficulty]}
                  </span>
                </div>
                <p className="quest-desc">{q.description}</p>
                <div className="quest-meta">
                  <span>📍 节点 {q.nodeCount}</span>
                  <span>💀 威胁 {THREAT_LABELS[q.threat]}</span>
                  <span>👥 推荐 {q.recommendedClassTags.join(', ')}</span>
                </div>
                <div className="quest-rewards">
                  🪙 {q.rewards.gold} · 🖼 {q.rewards.portraits} · 🏅 {q.rewards.crests} · ⭐ {q.rewards.heroXp} XP
                </div>
                {q.failPenalty && (
                  <div className="quest-fail muted" style={{ fontSize: 11 }}>
                    失败:丢失 {q.failPenalty.goldLost} 金币
                  </div>
                )}
                <button
                  className={isSelected ? '' : 'primary'}
                  onClick={() => onSelect(qid)}
                  style={{ marginTop: 8, width: '100%' }}
                >
                  {isSelected ? '✓ 已选' : '选择此任务'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
