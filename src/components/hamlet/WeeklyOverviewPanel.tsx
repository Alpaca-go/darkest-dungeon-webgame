/**
 * WeeklyOverviewPanel — 庄园首页
 *
 * 显示:
 * - 本周 3-5 条通知(高压力、缺金币、新候选、设施完成等)
 * - 7 个一级入口: 名册 / 治疗 / 招募 / 升级 / 墓园 / 任务 / 远征准备
 * - 底部: 周推进按钮(在所有事项处理完后)
 */

import { useGameStore, makeCommandId } from '../../store/game-store.js';
import type { WeeklyNotice } from '../../game-engine/campaign/types.js';

interface PanelProps {
  onNavigate: (mode: 'roster' | 'treatment' | 'recruitment' | 'upgrades' | 'graveyard' | 'quest-selection' | 'party-formation' | 'provisioning') => void;
}

const NOTICE_ICONS: Record<WeeklyNotice['type'], string> = {
  'cannot-form-party': '💀',
  'high-stress': '😰',
  'facility-completed': '✅',
  'recruit-opportunity': '🆕',
  'upgrade-opportunity': '⬆️',
  'resource-shortage': '⚠️',
  'general': '📣',
};

export function WeeklyOverviewPanel({ onNavigate }: PanelProps) {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const campaign = state.campaign;
  const hamlet = state.hamlet;
  if (!campaign || !hamlet) return null;

  const onAdvanceWeek = () => {
    dispatch({ type: 'ADVANCE_WEEK', commandId: makeCommandId('week') });
  };

  return (
    <div className="hamlet-overview-panel">
      {/* 通知 */}
      {hamlet.weeklyNotices.length > 0 && (
        <div className="notice-list">
          {hamlet.weeklyNotices.slice(0, 5).map((n) => (
            <div key={n.id} className={`notice-row notice-${n.type}`}>
              <span className="notice-icon">{NOTICE_ICONS[n.type] ?? '📣'}</span>
              <span className="notice-msg">{n.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* 一级入口 — 6 个 2x3 网格 */}
      <div className="hamlet-entry-grid">
        <EntryButton icon="👥" label="名册" subLabel={`${countAlive(campaign.rosterHeroIds, state.party)} 可用`} onClick={() => onNavigate('roster')} />
        <EntryButton icon="🍺" label="治疗" subLabel="酒馆/修道院/疗养院" onClick={() => onNavigate('treatment')} />
        <EntryButton icon="🚪" label="马车" subLabel={`${hamlet.recruitCandidates.length} 候选`} onClick={() => onNavigate('recruitment')} />
        <EntryButton icon="🔨" label="升级" subLabel="公会/铁匠铺" onClick={() => onNavigate('upgrades')} />
        <EntryButton icon="⚰️" label="墓园" subLabel={`${state.deathRecords.length} 死亡`} onClick={() => onNavigate('graveyard')} />
        <EntryButton icon="📋" label="任务" subLabel={`${hamlet.weeklyQuestIds.length} 可选`} onClick={() => onNavigate('quest-selection')} />
      </div>

      {/* 远征准备 */}
      <div className="expedition-prep-card">
        <h4>远征准备</h4>
        <p className="muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>
          {hamlet.selectedQuestId
            ? `已选任务: ${hamlet.weeklyQuestDefs[hamlet.selectedQuestId]?.title ?? hamlet.selectedQuestId}`
            : '未选任务'}
          {' · '}
          队伍 {hamlet.selectedPartyHeroIds.length}/4
        </p>
        <div className="expedition-prep-actions">
          <button onClick={() => onNavigate('party-formation')}>组队</button>
          <button onClick={() => onNavigate('provisioning')}>补给</button>
          <button
            className="primary"
            onClick={() => {
              if (hamlet.selectedQuestId && hamlet.selectedPartyHeroIds.length > 0) {
                dispatch({ type: 'START_SELECTED_EXPEDITION', commandId: makeCommandId('start-exp') });
              } else {
                onNavigate('quest-selection');
              }
            }}
            disabled={!hamlet.selectedQuestId || hamlet.selectedPartyHeroIds.length === 0}
          >
            开始远征
          </button>
        </div>
      </div>

      {/* 推进周 — 重要操作,放底部 */}
      <button className="advance-week-btn danger" onClick={onAdvanceWeek}>
        ⏭ 推进下一周
      </button>
    </div>
  );
}

function EntryButton({ icon, label, subLabel, onClick }: { icon: string; label: string; subLabel: string; onClick: () => void }) {
  return (
    <button className="hamlet-entry" onClick={onClick}>
      <span className="entry-icon">{icon}</span>
      <span className="entry-label">{label}</span>
      <span className="entry-sub">{subLabel}</span>
    </button>
  );
}

function countAlive(rosterIds: string[], party: Record<string, { isDead: boolean }>): number {
  let n = 0;
  for (const id of rosterIds) {
    if (party[id] && !party[id]!.isDead) n += 1;
  }
  return n;
}
