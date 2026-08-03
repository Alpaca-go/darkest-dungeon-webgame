/* eslint-disable react-hooks/immutability, no-param-reassign */
/**
 * HamletDebugPanel — 庄园调试面板
 *
 * 提供调试入口:
 *  - 增删金币
 *  - 强制刷新招募 / 任务
 *  - 强制设施完成
 *  - 强制英雄状态(活动、stress)
 *  - 强制死亡记录
 */

import { useGameStore, makeCommandId } from '../../store/game-store.js';

export function HamletDebugPanel({ onClose }: { onClose: () => void }) {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);

  const gold = state.campaign?.gold ?? 0;
  const week = state.campaign?.week ?? 1;

  return (
    <div className="drawer hamlet-debug-panel">
      <div className="drawer-header">
        <h3>庄园调试</h3>
        <button onClick={onClose} style={{ padding: '4px 8px', minHeight: 32, minWidth: 32, fontSize: 12 }}>✕</button>
      </div>
      <div className="drawer-body">
        <Section title="资源">
          <div className="debug-row">
            <span>金币 {gold}</span>
            <button onClick={() => {
              if (state.campaign) {
                useGameStore.setState((s) => ({
                  state: { ...s.state, campaign: { ...s.state.campaign!, gold: s.state.campaign!.gold + 1000 } },
                }));
              }
            }}>+1000</button>
            <button onClick={() => {
              if (state.campaign) {
                useGameStore.setState((s) => ({
                  state: { ...s.state, campaign: { ...s.state.campaign!, gold: Math.max(0, s.state.campaign!.gold - 500) } },
                }));
              }
            }}>-500</button>
          </div>
          <div className="debug-row">
            <span>肖像</span>
            <button onClick={() => {
              if (state.campaign) {
                useGameStore.setState((s) => ({
                  state: { ...s.state, campaign: { ...s.state.campaign!, heirlooms: { ...s.state.campaign!.heirlooms, portraits: s.state.campaign!.heirlooms.portraits + 5 } } },
                }));
              }
            }}>+5</button>
          </div>
          <div className="debug-row">
            <span>纹章</span>
            <button onClick={() => {
              if (state.campaign) {
                useGameStore.setState((s) => ({
                  state: { ...s.state, campaign: { ...s.state.campaign!, heirlooms: { ...s.state.campaign!.heirlooms, crests: s.state.campaign!.heirlooms.crests + 5 } } },
                }));
              }
            }}>+5</button>
          </div>
        </Section>

        <Section title="周数">
          <div className="debug-row">
            <span>当前第 {week} 周</span>
            <button onClick={() => dispatch({ type: 'ADVANCE_WEEK', commandId: makeCommandId('dbg-week') })}>
              推进 1 周
            </button>
          </div>
        </Section>

        <Section title="英雄">
          <ul className="debug-hero-list">
            {Object.values(state.party).filter((h) => !h.isDead).slice(0, 8).map((h) => (
              <li key={h.id} className="debug-hero-row">
                <span>{h.name} · 压力 {Math.round(h.stress)}</span>
                <button onClick={() => {
                  const newActivity = h.activityState === 'stress-treatment' ? 'available' : 'stress-treatment';
                  useGameStore.setState((s) => ({
                    state: { ...s.state, party: { ...s.state.party, [h.id]: { ...s.state.party[h.id]!, activityState: newActivity } } },
                  }));
                }}>切换活动</button>
                <button onClick={() => {
                  useGameStore.setState((s) => ({
                    state: { ...s.state, party: { ...s.state.party, [h.id]: { ...s.state.party[h.id]!, stress: Math.min(200, s.state.party[h.id]!.stress + 30) } } },
                  }));
                }}>+压力</button>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="设施">
          {state.campaign && (
            <div className="debug-row">
              <button onClick={() => {
                useGameStore.setState((s) => {
                  const campaign = s.state.campaign!;
                  const newFacilityStates: typeof campaign.facilityStates = {};
                  for (const [id, f] of Object.entries(campaign.facilityStates)) {
                    newFacilityStates[id] = { ...f, occupiedSlots: [] };
                  }
                  const newParty = { ...s.state.party };
                  for (const [id, hero] of Object.entries(s.state.party)) {
                    if (hero.activityState === 'stress-treatment' || hero.activityState === 'medical-treatment' || hero.activityState === 'training') {
                      newParty[id] = { ...hero, activityState: 'available', assignedFacilityId: null, activityWeeksRemaining: 0 };
                    }
                  }
                  return {
                    state: {
                      ...s.state,
                      campaign: { ...campaign, facilityStates: newFacilityStates },
                      party: newParty,
                    },
                  };
                });
              }}>清空所有设施</button>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="debug-section">
      <h4>{title}</h4>
      {children}
    </div>
  );
}
