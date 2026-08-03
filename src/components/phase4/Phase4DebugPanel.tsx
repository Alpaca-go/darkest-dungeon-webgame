/**
 * Phase4DebugPanel — Phase 4 调试面板
 *
 * 调试操作:
 *  - 强制开启营地
 *  - 设置露营点数
 *  - 强制/阻止夜袭
 *  - 注入 Buff
 *  - 给予 XP
 *  - 治疗疾病
 *  - 装备饰品
 *  - 锁定怪癖
 */

import { useState } from 'react';
import type { HeroInstance } from '../../game-engine/expedition/types.js';

export interface Phase4DebugActions {
  onForceCamp?: () => void;
  onSetCampPoints?: (value: number) => void;
  onForceNightAmbush?: (prevent: boolean) => void;
  onAddBuff?: (tag: string, magnitude: number, remainingNodes: number) => void;
  onGrantXp?: (heroId: string, amount: number) => void;
  onTreatDisease?: (heroId: string, diseaseId: string) => void;
}

export function Phase4DebugPanel({
  heroes,
  actions,
  open = true,
}: {
  heroes: HeroInstance[];
  actions: Phase4DebugActions;
  open?: boolean;
}) {
  const [campPoints, setCampPoints] = useState(12);
  const [buffTag, setBuffTag] = useState('scout-bonus');
  const [buffMag, setBuffMag] = useState(0.5);
  const [buffNodes, setBuffNodes] = useState(5);
  const [selectedHero, setSelectedHero] = useState(heroes[0]?.id ?? '');

  if (!open) return null;

  return (
    <div className="phase4-debug-panel">
      <h3 className="panel-title">Phase 4 调试</h3>

      <div className="debug-section">
        <h4>露营</h4>
        <button type="button" onClick={actions.onForceCamp}>强制开启营地</button>
        <label>
          露营点数
          <input
            type="number"
            min={0}
            max={24}
            value={campPoints}
            onChange={(e) => setCampPoints(Number(e.target.value))}
          />
          <button type="button" onClick={() => actions.onSetCampPoints?.(campPoints)}>设置</button>
        </label>
        <label>
          夜袭
          <button type="button" onClick={() => actions.onForceNightAmbush?.(true)}>阻止</button>
          <button type="button" onClick={() => actions.onForceNightAmbush?.(false)}>允许</button>
        </label>
      </div>

      <div className="debug-section">
        <h4>Buff 注入</h4>
        <label>
          tag
          <select value={buffTag} onChange={(e) => setBuffTag(e.target.value)}>
            <option value="scout-bonus">scout-bonus</option>
            <option value="stress-shield">stress-shield</option>
            <option value="torch-saver">torch-saver</option>
            <option value="trap-sense">trap-sense</option>
            <option value="disease-ward">disease-ward</option>
            <option value="formation-steady">formation-steady</option>
            <option value="next-hit-bonus">next-hit-bonus</option>
            <option value="heal-boost">heal-boost</option>
          </select>
        </label>
        <label>
          强度
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={buffMag}
            onChange={(e) => setBuffMag(Number(e.target.value))}
          />
        </label>
        <label>
          节点
          <input
            type="number"
            min="0"
            max="20"
            value={buffNodes}
            onChange={(e) => setBuffNodes(Number(e.target.value))}
          />
        </label>
        <button type="button" onClick={() => actions.onAddBuff?.(buffTag, buffMag, buffNodes)}>
          注入
        </button>
      </div>

      <div className="debug-section">
        <h4>英雄操作</h4>
        <label>
          英雄
          <select value={selectedHero} onChange={(e) => setSelectedHero(e.target.value)}>
            {heroes.map((h) => (
              <option key={h.id} value={h.id}>{h.name} ({h.archetype})</option>
            ))}
          </select>
        </label>
        <label>
          XP
          <button type="button" onClick={() => actions.onGrantXp?.(selectedHero, 3)}>+3 XP</button>
          <button type="button" onClick={() => actions.onGrantXp?.(selectedHero, 5)}>+5 XP</button>
        </label>
        {heroes.find((h) => h.id === selectedHero)?.diseaseIds?.[0] && (
          <button
            type="button"
            onClick={() => {
              const d = heroes.find((h) => h.id === selectedHero)?.diseaseIds?.[0];
              if (d) actions.onTreatDisease?.(selectedHero, d);
            }}
          >
            治疗首个疾病
          </button>
        )}
      </div>
    </div>
  );
}
