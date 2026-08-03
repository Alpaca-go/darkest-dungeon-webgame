import { useState } from 'react';
import type { BattleState } from '../../game-engine/types.js';
import { newCommandId } from '../../game-engine/commands.js';
import type { DebugPanelTab } from '../../store/ui-store.js';
import { useGameStore } from '../../store/game-store.js';
import { useUiStore } from '../../store/ui-store.js';
import { runBattleFull } from '../../game-engine/battle/loop.js';
import { decideAiAction } from '../../game-engine/battle/ai.js';
import { BattleContext } from '../../game-engine/battle/context.js';
import { useSkill } from '../../game-engine/battle/skill.js';
import { endTurn, findActorInLists } from '../../game-engine/battle/round.js';

interface DebugPanelProps {
  state: BattleState;
}

const TABS: DebugPanelTab[] = ['state', 'rng', 'events', 'commands', 'controls'];

export function DebugPanel({ state }: DebugPanelProps) {
  const debugTab = useUiStore((s) => s.debugTab);
  const setDebugTab = useUiStore((s) => s.setDebugTab);
  const dispatch = useGameStore((s) => s.dispatch);
  const [setHpTarget, setSetHpTarget] = useState('');
  const [setHpValue, setSetHpValue] = useState('');

  return (
    <div className="debug-panel">
      <div className="debug-panel__header">
        {TABS.map((t) => (
          <button
            key={t}
            className={'debug-panel__tab' + (t === debugTab ? ' debug-panel__tab--active' : '')}
            onClick={() => setDebugTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="debug-panel__body">
        {debugTab === 'state' && (
          <pre>{JSON.stringify(state, null, 2).slice(0, 4000)}</pre>
        )}
        {debugTab === 'rng' && (
          <div>
            <div>algorithm: {state.rng.algorithm}</div>
            <div>state: {state.rng.state}</div>
          </div>
        )}
        {debugTab === 'events' && (
          <pre>{state.log.slice(-50).map((e) => `[${e.sequence}] ${e.type}`).join('\n')}</pre>
        )}
        {debugTab === 'commands' && (
          <div>
            <p style={{ color: 'var(--text-muted)' }}>调试命令通过右边的 controls 面板下发</p>
          </div>
        )}
        {debugTab === 'controls' && (
          <div className="debug-panel__controls">
            <div className="debug-panel__field">
              <span>Set HP:</span>
              <input
                placeholder="actorId"
                value={setHpTarget}
                onChange={(e) => setSetHpTarget(e.target.value)}
              />
              <input
                placeholder="hp"
                value={setHpValue}
                onChange={(e) => setSetHpValue(e.target.value)}
                type="number"
              />
              <button
                className="btn"
                onClick={() => {
                  if (!setHpTarget || !setHpValue) return;
                  dispatch({
                    type: 'DEBUG_SET_HP',
                    actorId: setHpTarget,
                    hp: parseInt(setHpValue, 10),
                    commandId: newCommandId('debug'),
                  });
                }}
              >
                设定
              </button>
            </div>
            <div className="debug-panel__field">
              <span>Force Roll:</span>
              <button
                className="btn"
                onClick={() =>
                  dispatch({
                    type: 'DEBUG_FORCE_NEXT_ROLL',
                    rollType: 'hit',
                    commandId: newCommandId('debug'),
                  })
                }
              >
                命中
              </button>
              <button
                className="btn"
                onClick={() =>
                  dispatch({
                    type: 'DEBUG_FORCE_NEXT_ROLL',
                    rollType: 'crit',
                    commandId: newCommandId('debug'),
                  })
                }
              >
                暴击
              </button>
              <button
                className="btn"
                onClick={() =>
                  dispatch({
                    type: 'DEBUG_FORCE_NEXT_ROLL',
                    rollType: 'miss',
                    commandId: newCommandId('debug'),
                  })
                }
              >
                闪避
              </button>
            </div>
            <div className="debug-panel__field">
              <span>Apply Status:</span>
              <button
                className="btn"
                onClick={() => {
                  // 给第一个英雄加流血
                  const h = state.heroes[0];
                  if (!h) return;
                  dispatch({
                    type: 'DEBUG_APPLY_STATUS',
                    actorId: h.id,
                    status: 'bleed',
                    params: { damage: 2, duration: 3 },
                    commandId: newCommandId('debug'),
                  });
                }}
              >
                流血
              </button>
              <button
                className="btn"
                onClick={() => {
                  const h = state.heroes[0];
                  if (!h) return;
                  dispatch({
                    type: 'DEBUG_APPLY_STATUS',
                    actorId: h.id,
                    status: 'blight',
                    params: { damage: 2, duration: 3 },
                    commandId: newCommandId('debug'),
                  });
                }}
              >
                腐蚀
              </button>
              <button
                className="btn"
                onClick={() => {
                  const h = state.heroes[0];
                  if (!h) return;
                  dispatch({
                    type: 'DEBUG_APPLY_STATUS',
                    actorId: h.id,
                    status: 'stun',
                    params: { duration: 1 },
                    commandId: newCommandId('debug'),
                  });
                }}
              >
                眩晕
              </button>
            </div>
            <div className="debug-panel__field">
              <span>AI Step:</span>
              <button
                className="btn btn--primary"
                onClick={() => {
                  // 让当前 AI 行动一次
                  if (!state.activeActorId) return;
                  const a = findActorInLists(state, state.activeActorId);
                  if (!a || a.side !== 'enemy') return;
                  const dec = decideAiAction(new BattleContext(state), a.id);
                  if (dec) {
                    try {
                      useSkill(
                        new BattleContext(state),
                        a.id,
                        dec.skillId,
                        dec.targetId ? [dec.targetId] : [],
                      );
                      // 提交后 dispatch USE_SKILL
                      // 简化:直接用 hook 的 dispatch 路径不行,这里手动更新 state
                    } catch {
                      // ignore
                    }
                  }
                  endTurn(new BattleContext(state));
                }}
              >
                走一步 AI
              </button>
              <button
                className="btn"
                onClick={() => {
                  // 自动跑完整场战斗
                  const final = runBattleFull(state, { heroesControlledByAi: true });
                  useGameStore.getState().startBattleWithState(final);
                }}
              >
                跑到结束
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
