import { useState } from 'react';
import { useGameStore, makeCommandId } from '../../store/game-store.js';
import { exportDebugPackage } from '../../persistence/save.js';

type Tab = 'state' | 'rng' | 'events' | 'controls';

export function DebugPanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const setSeed = useGameStore((s) => s.setSeed);
  const wipeSave = useGameStore((s) => s.wipeSave);
  const restartWithNewSeed = useGameStore((s) => s.restartWithNewSeed);
  const restartWithSameSeed = useGameStore((s) => s.restartWithSameSeed);
  const startExpedition = useGameStore((s) => s.startExpedition);
  const [tab, setTab] = useState<Tab>('state');
  const [seedInput, setSeedInput] = useState(state.seed);
  const [torchInput, setTorchInput] = useState(String(state.expedition.torch));
  const [foodInput, setFoodInput] = useState(String(state.inventory.stacks.filter((s) => s.itemId === 'food').reduce((a, s) => a + s.count, 0)));

  return (
    <div className="debug-panel">
      <div className="debug-tabs">
        <button className={`debug-tab ${tab === 'state' ? 'active' : ''}`} onClick={() => setTab('state')}>State</button>
        <button className={`debug-tab ${tab === 'rng' ? 'active' : ''}`} onClick={() => setTab('rng')}>RNG</button>
        <button className={`debug-tab ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>Events</button>
        <button className={`debug-tab ${tab === 'controls' ? 'active' : ''}`} onClick={() => setTab('controls')}>Controls</button>
      </div>

      {tab === 'state' && (
        <div className="debug-section">
          <div><span className="label">Mode:</span> {state.mode}</div>
          <div><span className="label">Seed:</span> {state.seed}</div>
          <div><span className="label">Node:</span> {state.expedition.currentNodeId}</div>
          <div><span className="label">Depth:</span> {state.expedition.depth}</div>
          <div><span className="label">Torch:</span> {state.expedition.torch} ({state.torch.level})</div>
          <div><span className="label">Time:</span> {state.expedition.timeElapsed}</div>
          <div><span className="label">Flags:</span> {Object.keys(state.expedition.flags).join(', ') || '—'}</div>
          <div><span className="label">Pending:</span> {state.pendingDecision?.id ?? '—'}</div>
          <div><span className="label">Encounter:</span> {state.encounter?.id ?? '—'}</div>
        </div>
      )}

      {tab === 'rng' && (
        <div className="debug-section">
          <div><span className="label">Algorithm:</span> {state.rng.algorithm}</div>
          <div><span className="label">State:</span> {state.rng.state}</div>
          <div><span className="label">TxID:</span> {state.lastTransactionId ?? '—'}</div>
          <div><span className="label">EventLog:</span> {state.eventLog.length}</div>
        </div>
      )}

      {tab === 'events' && (
        <div className="debug-section" style={{ maxHeight: 200, overflowY: 'auto' }}>
          {state.eventLog.slice(-20).reverse().map((e, i) => (
            <div key={i} style={{ borderBottom: '1px solid #1a1410', padding: '2px 0' }}>
              <span className="label">#{state.eventLog.length - i}</span> {e.type}
            </div>
          ))}
        </div>
      )}

      {tab === 'controls' && (
        <>
          <div className="debug-section">
            <div className="label">Seed</div>
            <div className="debug-row">
              <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} style={{ flex: 1, padding: '4px', background: '#1a1410', color: '#d8c69a', border: '1px solid #2a201a' }} />
              <button onClick={() => { setSeed(seedInput); }}>设置</button>
            </div>
            <div className="debug-row">
              <button onClick={() => restartWithSameSeed()}>同 Seed 重启</button>
              <button onClick={() => restartWithNewSeed()}>新 Seed 重启</button>
              <button onClick={() => startExpedition()}>Golden 重启</button>
            </div>
          </div>
          <div className="debug-section">
            <div className="label">资源</div>
            <div className="debug-row">
              <input value={torchInput} onChange={(e) => setTorchInput(e.target.value)} style={{ width: 50, padding: '4px', background: '#1a1410', color: '#d8c69a', border: '1px solid #2a201a' }} />
              <button onClick={() => dispatch({ type: 'DEBUG_SET_TORCH', value: Number(torchInput), commandId: makeCommandId('dbg') })}>设火把</button>
              <input value={foodInput} onChange={(e) => setFoodInput(e.target.value)} style={{ width: 50, padding: '4px', background: '#1a1410', color: '#d8c69a', border: '1px solid #2a201a' }} />
              <button onClick={() => dispatch({ type: 'DEBUG_SET_FOOD', value: Number(foodInput), commandId: makeCommandId('dbg') })}>设食物</button>
            </div>
            <div className="debug-row">
              <button onClick={() => dispatch({ type: 'DEBUG_GRANT_ITEM', itemId: 'bandage', count: 1, commandId: makeCommandId('dbg') })}>+绷带</button>
              <button onClick={() => dispatch({ type: 'DEBUG_GRANT_ITEM', itemId: 'torch', count: 1, commandId: makeCommandId('dbg') })}>+火把</button>
              <button onClick={() => dispatch({ type: 'DEBUG_GRANT_ITEM', itemId: 'food', count: 1, commandId: makeCommandId('dbg') })}>+食物</button>
              <button onClick={() => dispatch({ type: 'DEBUG_GRANT_ITEM', itemId: 'gold', count: 1, commandId: makeCommandId('dbg') })}>+金块</button>
            </div>
          </div>
          <div className="debug-section">
            <div className="label">英雄 HP</div>
            {Object.values(state.party).map((h) => (
              <div key={h.id} className="debug-row">
                <span style={{ minWidth: 70 }}>{h.name}</span>
                <span>{h.hp}/{h.maxHp}</span>
                <button onClick={() => dispatch({ type: 'DEBUG_SET_HP', heroId: h.id, value: h.maxHp, commandId: makeCommandId('dbg') })}>满</button>
                <button onClick={() => dispatch({ type: 'DEBUG_SET_HP', heroId: h.id, value: 0, commandId: makeCommandId('dbg') })}>0</button>
              </div>
            ))}
          </div>
          <div className="debug-section">
            <div className="label">站位</div>
            {Object.values(state.party).map((h) => (
              <div key={h.id} className="debug-row">
                <span style={{ minWidth: 70 }}>{h.name}</span>
                <span>[{h.rank}]</span>
                {[1, 2, 3, 4].map((r) => (
                  <button key={r} onClick={() => dispatch({ type: 'DEBUG_MOVE_HERO', heroId: h.id, rank: r as 1 | 2 | 3 | 4, commandId: makeCommandId('dbg') })}>{r}</button>
                ))}
              </div>
            ))}
          </div>
          <div className="debug-section">
            <div className="label">触发</div>
            <div className="debug-row">
              <button onClick={() => dispatch({ type: 'DEBUG_TRIGGER_HUNGER', commandId: makeCommandId('dbg') })}>触发饥饿</button>
              <button onClick={() => dispatch({ type: 'DEBUG_TRIGGER_TRAP', commandId: makeCommandId('dbg') })}>触发陷阱</button>
              <button onClick={() => dispatch({ type: 'DEBUG_FORCE_ENCOUNTER', encounterDefId: 'encounter.skeleton_patrol', commandId: makeCommandId('dbg') })}>强制遭遇A</button>
              <button onClick={() => dispatch({ type: 'DEBUG_FORCE_ENCOUNTER', encounterDefId: 'encounter.tomb_ambush', commandId: makeCommandId('dbg') })}>强制遭遇B</button>
            </div>
            <div className="debug-row">
              <button onClick={() => dispatch({ type: 'DEBUG_TELEPORT_NODE', nodeId: 'N8_altar', commandId: makeCommandId('dbg') })}>跳到祭坛</button>
              <button onClick={() => dispatch({ type: 'DEBUG_TELEPORT_NODE', nodeId: 'N9_exit', commandId: makeCommandId('dbg') })}>跳到出口</button>
            </div>
          </div>
          <div className="debug-section">
            <div className="label">导出</div>
            <div className="debug-row">
              <button onClick={() => {
                const json = exportDebugPackage(state);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dd-debug-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}>导出调试包</button>
              <button onClick={() => { wipeSave(); }}>清空存档</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
