/**
 * RecruitmentPanel — 马车招募
 *
 * 显示:
 * - 3 个候选(本周刷出)
 * - 每候选:名字/职业/技能/压力/怪癖/费用
 * - 招募按钮(把候选加入名册)
 * - 名册容量提示
 */

import { useGameStore, makeCommandId } from '../../store/game-store.js';
import { HamletBackBar } from './HamletBackBar.js';

const ARCHETYPE_LABELS: Record<string, string> = {
  crusader: '十字军',
  highwayman: '强盗',
  vestal: '修女',
  plague_doctor: '瘟疫医生',
  bounty_hunter: '赏金猎人',
  jester: '小丑',
};

const DEFAULT_BASE_ACTOR = {
  maxHp: 22,
  dodge: 5,
  speed: 4,
  accuracy: 0.85,
  crit: 0.05,
  skills: ['basic', 'secondary'],
  rank: 4 as 1 | 2 | 3 | 4,
};

export function RecruitmentPanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const campaign = state.campaign;
  const hamlet = state.hamlet;
  if (!campaign || !hamlet) return null;

  const onRecruit = (candidateId: string) => {
    dispatch({
      type: 'RECRUIT_HERO',
      candidateId,
      baseActor: DEFAULT_BASE_ACTOR,
      commandId: makeCommandId('recruit'),
    });
  };

  return (
    <div className="hamlet-recruit-panel">
      <HamletBackBar title="马车招募" />
      <div className="roster-meta">
        名册 {campaign.rosterHeroIds.length}/{campaign.rosterCapacity}
      </div>
      {hamlet.recruitCandidates.length === 0 ? (
        <p className="muted">本周马车没有新候选</p>
      ) : (
        <ul className="recruit-list">
          {hamlet.recruitCandidates.map((c) => {
            const full = campaign.rosterHeroIds.length >= campaign.rosterCapacity;
            return (
              <li key={c.id} className="recruit-card">
                <div className="recruit-header">
                  <strong>{c.name}</strong>
                  <span className="recruit-class">
                    {ARCHETYPE_LABELS[c.archetype] ?? c.archetype} · Lv.{c.level}
                  </span>
                </div>
                <div className="recruit-skills">
                  技能: {c.skills.join(', ')}
                </div>
                <div className="recruit-stats">
                  <span>压力 {c.stress}/200</span>
                  {c.positiveQuirkIds.length > 0 && <span className="quirk-pos">✦ {c.positiveQuirkIds.join(', ')}</span>}
                  {c.negativeQuirkIds.length > 0 && <span className="quirk-neg">⚠ {c.negativeQuirkIds.join(', ')}</span>}
                </div>
                <div className="recruit-actions">
                  <button
                    className="primary"
                    disabled={full}
                    onClick={() => onRecruit(c.id)}
                  >
                    {full ? '名册已满' : '招募'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
