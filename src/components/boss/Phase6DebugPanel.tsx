/**
 * Phase6DebugPanel — Phase 6 Boss 调试面板(SPEC §39)
 *
 * 调试操作(精简到 12 项核心,移动端友好):
 *  - 设置区域威胁值 / 状态
 *  - 显示 / 隐藏 Boss
 *  - 授予 / 移除情报
 *  - 完成调查 / 削弱任务
 *  - 跳转 Boss 阶段
 *  - 设置 Boss HP
 *  - 强制召唤
 *  - 强制撤退成功 / 失败
 *  - 强制 Boss 击败
 *  - 重置 Boss 状态
 *
 * 全部通过 onXxx 回调暴露给父组件;UI 不直接 dispatch 命令。
 */

import { useState } from 'react';
import {
  BOSS_DEFINITIONS,
  BOSS_INTELLIGENCE,
  BOSS_TASKS,
} from '../../game-engine/boss/registry.js';
import type {
  BossStatus,
  RegionThreatState,
} from '../../game-engine/boss/types.js';
import type { RegionId } from '../../game-engine/regions/types.js';

export interface Phase6DebugActions {
  // 区域威胁
  onSetRegionThreat?: (regionId: RegionId, value: number) => void;
  onSetRegionThreatState?: (regionId: RegionId, state: RegionThreatState) => void;
  // Boss
  onSetBossStatus?: (bossId: string, status: BossStatus) => void;
  onGrantIntelligence?: (bossId: string, entryId: string) => void;
  onRemoveIntelligence?: (bossId: string, entryId: string) => void;
  onCompleteQuest?: (questId: string) => void;
  onJumpBossPhase?: (bossId: string, phaseIndex: number) => void;
  onSetBossHp?: (bossId: string, value: number) => void;
  onForceBossSummon?: (bossId: string, summonId: string) => void;
  onForceRetreat?: (bossId: string, success: boolean) => void;
  onForceDefeat?: (bossId: string) => void;
  onResetBoss?: (bossId: string) => void;
}

const REGION_IDS: RegionId[] = ['ruins', 'corrupted-woods', 'underground-burrows'];
const THREAT_STATES: RegionThreatState[] = [
  'dormant', 'stirring', 'active', 'uncontrolled', 'boss-revealed', 'boss-defeated',
];
const BOSS_STATUSES: BossStatus[] = [
  'hidden', 'rumored', 'investigating', 'revealed', 'weakened', 'hunt-ready', 'active', 'defeated',
];

export function Phase6DebugPanel({
  actions,
  open = true,
}: {
  actions: Phase6DebugActions;
  open?: boolean;
}) {
  // 默认测试 Boss
  const [bossId, setBossId] = useState('boss-test-arbiter');
  const [regionId, setRegionId] = useState<RegionId>('ruins');
  const [threatValue, setThreatValue] = useState(50);
  const [threatState, setThreatState] = useState<RegionThreatState>('active');
  const [bossStatus, setBossStatus] = useState<BossStatus>('revealed');
  const [intelId, setIntelId] = useState('intel-attack-1');
  const [questId, setQuestId] = useState('task-test-investigate-1');
  const [phaseIndex, setPhaseIndex] = useState(1);
  const [bossHp, setBossHp] = useState(50);
  const [summonId, setSummonId] = useState('summon-亡魂');

  if (!open) return null;

  const bossDef = BOSS_DEFINITIONS[bossId];
  const intelIds = bossDef ? bossDef.intelligenceEntryIds : Object.keys(BOSS_INTELLIGENCE);
  const questIds = bossDef
    ? [...bossDef.investigationQuestIds, ...bossDef.weakeningQuestIds, bossDef.finalQuestId]
    : Object.keys(BOSS_TASKS);
  const summonIds = bossDef ? bossDef.summonPoolIds : [];

  return (
    <div className="phase6-debug-panel">
      <h3 className="panel-title">Phase 6 Boss 调试</h3>

      {/* Boss 选择 */}
      <div className="debug-section">
        <h4>目标 Boss</h4>
        <label>
          Boss:
          <select value={bossId} onChange={(e) => setBossId(e.target.value)}>
            {Object.keys(BOSS_DEFINITIONS).map((id) => (
              <option key={id} value={id}>{BOSS_DEFINITIONS[id]!.name} ({id})</option>
            ))}
          </select>
        </label>
      </div>

      {/* 区域威胁 */}
      <div className="debug-section">
        <h4>区域威胁</h4>
        <label>
          区域:
          <select value={regionId} onChange={(e) => setRegionId(e.target.value as RegionId)}>
            {REGION_IDS.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>
        <label>
          数值 ({threatValue}):
          <input
            type="range" min={0} max={100} step={1}
            value={threatValue}
            onChange={(e) => setThreatValue(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={() => actions.onSetRegionThreat?.(regionId, threatValue)}
          disabled={!actions.onSetRegionThreat}
        >
          设置威胁 = {threatValue}
        </button>
        <label>
          状态:
          <select value={threatState} onChange={(e) => setThreatState(e.target.value as RegionThreatState)}>
            {THREAT_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => actions.onSetRegionThreatState?.(regionId, threatState)}
          disabled={!actions.onSetRegionThreatState}
        >
          设置状态 = {threatState}
        </button>
      </div>

      {/* Boss 状态 */}
      <div className="debug-section">
        <h4>Boss 状态</h4>
        <label>
          状态:
          <select value={bossStatus} onChange={(e) => setBossStatus(e.target.value as BossStatus)}>
            {BOSS_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => actions.onSetBossStatus?.(bossId, bossStatus)}
          disabled={!actions.onSetBossStatus}
        >
          设置 Boss 状态
        </button>
        <button
          type="button"
          onClick={() => actions.onResetBoss?.(bossId)}
          disabled={!actions.onResetBoss}
        >
          重置 Boss 状态(hidden)
        </button>
        <button
          type="button"
          onClick={() => actions.onForceDefeat?.(bossId)}
          disabled={!actions.onForceDefeat}
        >
          强制 Boss 击败
        </button>
      </div>

      {/* 情报 */}
      <div className="debug-section">
        <h4>情报</h4>
        <label>
          情报:
          <select value={intelId} onChange={(e) => setIntelId(e.target.value)}>
            {intelIds.map((id) => {
              const intel = BOSS_INTELLIGENCE[id];
              return <option key={id} value={id}>{intel ? intel.title : id}</option>;
            })}
          </select>
        </label>
        <div className="button-row">
          <button
            type="button"
            onClick={() => actions.onGrantIntelligence?.(bossId, intelId)}
            disabled={!actions.onGrantIntelligence}
          >
            授予
          </button>
          <button
            type="button"
            onClick={() => actions.onRemoveIntelligence?.(bossId, intelId)}
            disabled={!actions.onRemoveIntelligence}
          >
            移除
          </button>
        </div>
      </div>

      {/* 任务 */}
      <div className="debug-section">
        <h4>任务</h4>
        <label>
          任务:
          <select value={questId} onChange={(e) => setQuestId(e.target.value)}>
            {questIds.map((id) => {
              const task = BOSS_TASKS[id];
              return <option key={id} value={id}>{task ? `${task.name} (${task.type})` : id}</option>;
            })}
          </select>
        </label>
        <button
          type="button"
          onClick={() => actions.onCompleteQuest?.(questId)}
          disabled={!actions.onCompleteQuest}
        >
          完成任务
        </button>
      </div>

      {/* 阶段 / HP / 召唤 */}
      <div className="debug-section">
        <h4>Boss 战</h4>
        <label>
          阶段 (0/1/2):
          <input
            type="number" min={0} max={2} step={1}
            value={phaseIndex}
            onChange={(e) => setPhaseIndex(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={() => actions.onJumpBossPhase?.(bossId, phaseIndex)}
          disabled={!actions.onJumpBossPhase}
        >
          跳转阶段
        </button>
        <label>
          HP ({bossHp}):
          <input
            type="range" min={0} max={200} step={1}
            value={bossHp}
            onChange={(e) => setBossHp(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={() => actions.onSetBossHp?.(bossId, bossHp)}
          disabled={!actions.onSetBossHp}
        >
          设置 HP
        </button>
        <label>
          召唤物:
          <select value={summonId} onChange={(e) => setSummonId(e.target.value)}>
            {summonIds.map((id) => (<option key={id} value={id}>{id}</option>))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => actions.onForceBossSummon?.(bossId, summonId)}
          disabled={!actions.onForceBossSummon}
        >
          强制召唤
        </button>
        <div className="button-row">
          <button
            type="button"
            onClick={() => actions.onForceRetreat?.(bossId, true)}
            disabled={!actions.onForceRetreat}
          >
            强制撤退成功
          </button>
          <button
            type="button"
            onClick={() => actions.onForceRetreat?.(bossId, false)}
            disabled={!actions.onForceRetreat}
          >
            强制撤退失败
          </button>
        </div>
      </div>
    </div>
  );
}
