/**
 * 区域 UI 组件集(Phase 5)
 *
 * 包含 14 个 UI 组件:
 *  - RegionSelectPanel
 *  - RegionCard
 *  - RegionDetailDrawer
 *  - RegionProgressPanel
 *  - RegionDiscoveryPanel
 *  - RegionModifierCard
 *  - GeneratedQuestCard
 *  - QuestModifierBadge
 *  - RecommendedProvisionPanel
 *  - RecommendedHeroTagPanel
 *  - EncounterPreviewPanel
 *  - RegionRewardPanel
 *  - RegionReportPanel
 *  - Phase5DebugPanel
 */

import { useState } from 'react';
import type { RegionId, RegionProgress, RegionDiscoveryState } from '../../game-engine/regions/types.js';
import {
  REGION_ENEMIES,
  REGION_CURIOS,
  REGION_TRAPS,
  QUEST_MODIFIERS,
  getAllRegionIds,
  getRegionDefinition,
  getEnemyDef,
  getCurioDef,
  getTrapDef,
  getQuestModifier,
} from '../../game-engine/regions/registry.js';
import {
  REGION_MAX_LEVEL,
  REGION_XP_TABLE,
} from '../../game-engine/regions/manager.js';

// =====================================================================
// 1. RegionSelectPanel — 3 区域选择面板
// =====================================================================

export function RegionSelectPanel({
  regionProgress,
  selectedRegionId,
  onSelect,
}: {
  regionProgress: Record<string, RegionProgress | undefined>;
  selectedRegionId: string | null;
  onSelect: (regionId: RegionId) => void;
}) {
  return (
    <div className="region-select-panel">
      <h3 className="panel-title">选择区域</h3>
      <div className="region-grid">
        {getAllRegionIds().map((rid) => (
          <RegionCard
            key={rid}
            regionId={rid}
            progress={regionProgress[rid]}
            selected={selectedRegionId === rid}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// 2. RegionCard — 单个区域卡
// =====================================================================

export function RegionCard({
  regionId,
  progress,
  selected,
  onSelect,
}: {
  regionId: RegionId;
  progress?: RegionProgress;
  selected: boolean;
  onSelect: (regionId: RegionId) => void;
}) {
  const def = getRegionDefinition(regionId);
  const lvl = progress?.level ?? 0;
  const xp = progress?.experience ?? 0;
  const nextXp = REGION_XP_TABLE[Math.min(lvl + 1, REGION_MAX_LEVEL)] ?? xp;
  return (
    <button
      type="button"
      className={`region-card ${selected ? 'selected' : ''} ${def.id}`}
      onClick={() => onSelect(regionId)}
    >
      <div className="region-card-header">
        <span className="region-icon">{def.iconHint}</span>
        <span className="region-name">{def.name}</span>
      </div>
      <div className="region-card-desc">{def.description}</div>
      <div className="region-card-meta">
        <div className="meta-row">
          <span>等级</span>
          <span>{lvl} / {REGION_MAX_LEVEL}</span>
        </div>
        <div className="meta-row">
          <span>经验</span>
          <span>{xp} / {nextXp}</span>
        </div>
        <div className="meta-row">
          <span>主要威胁</span>
          <span>{def.dominantThreat}</span>
        </div>
        <div className="meta-row">
          <span>奖励倾向</span>
          <span>{def.rewardLean}</span>
        </div>
      </div>
      {progress?.bossQuestReady && (
        <div className="boss-ready-badge">⚔️ Boss 接口已准备</div>
      )}
    </button>
  );
}

// =====================================================================
// 3. RegionDetailDrawer — 抽屉(已发现内容)
// =====================================================================

export function RegionDetailDrawer({
  regionId,
  discovery,
  progress,
  onClose,
}: {
  regionId: RegionId;
  discovery: RegionDiscoveryState;
  progress: RegionProgress;
  onClose: () => void;
}) {
  const def = getRegionDefinition(regionId);
  return (
    <div className="region-detail-drawer">
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-card">
        <div className="drawer-header">
          <h3>{def.iconHint} {def.name} 详情</h3>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
        <div className="drawer-body">
          <RegionProgressPanel regionId={regionId} progress={progress} />
          <RegionDiscoveryPanel discovery={discovery} regionId={regionId} />
          <RegionModifierCard regionId={regionId} />
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 4. RegionProgressPanel — 进度 + 解锁内容
// =====================================================================

export function RegionProgressPanel({
  regionId,
  progress,
}: {
  regionId: RegionId;
  progress: RegionProgress;
}) {
  const def = getRegionDefinition(regionId);
  const nextXp = REGION_XP_TABLE[Math.min(progress.level + 1, REGION_MAX_LEVEL)] ?? 0;
  return (
    <div className="region-progress-panel">
      <h4>区域进度</h4>
      <div className="progress-stats">
        <div>等级:{progress.level}/{REGION_MAX_LEVEL}</div>
        <div>经验:{progress.experience}{progress.level < REGION_MAX_LEVEL ? ` / ${nextXp}` : ''}</div>
        <div>完成:{progress.completedQuestCount} 失败:{progress.failedQuestCount} 撤退:{progress.retreatCount}</div>
      </div>
      <h5>已解锁</h5>
      {progress.unlockedEliteEncounterIds.length === 0 ? (
        <div className="muted">升到等级 1 解锁精英</div>
      ) : (
        <ul>
          {progress.unlockedEliteEncounterIds.map((eid) => {
            const e = getEnemyDef(eid);
            return <li key={eid}>{e?.name ?? eid}</li>;
          })}
        </ul>
      )}
      <h5>推荐补给</h5>
      <div className="recommend-list">
        {def.recommendedProvisionIds.map((id) => (
          <span key={id} className="provision-tag">{id}</span>
        ))}
      </div>
      {progress.bossQuestReady && (
        <div className="boss-ready-banner">⚔️ Boss 任务接口已准备(Phase 5 不实现 Boss 战)</div>
      )}
    </div>
  );
}

// =====================================================================
// 5. RegionDiscoveryPanel — 区域发现列表
// =====================================================================

export function RegionDiscoveryPanel({
  regionId: _regionId,
  discovery,
}: {
  regionId: RegionId;
  discovery: RegionDiscoveryState;
}) {
  return (
    <div className="region-discovery-panel">
      <h4>已发现内容</h4>
      <div className="discovery-section">
        <h5>敌人({discovery.discoveredEnemyIds.length})</h5>
        {discovery.discoveredEnemyIds.length === 0 ? (
          <div className="muted">尚未遭遇</div>
        ) : (
          <ul>
            {discovery.discoveredEnemyIds.map((id) => {
              const e = getEnemyDef(id);
              return <li key={id}>{e?.name ?? id}</li>;
            })}
          </ul>
        )}
      </div>
      <div className="discovery-section">
        <h5>奇物({discovery.discoveredCurioIds.length})</h5>
        {discovery.discoveredCurioIds.length === 0 ? (
          <div className="muted">尚未发现</div>
        ) : (
          <ul>
            {discovery.discoveredCurioIds.map((id) => {
              const c = getCurioDef(id);
              return <li key={id}>{c?.name ?? id}</li>;
            })}
          </ul>
        )}
      </div>
      <div className="discovery-section">
        <h5>陷阱({discovery.discoveredTrapIds.length})</h5>
        {discovery.discoveredTrapIds.length === 0 ? (
          <div className="muted">尚未触发</div>
        ) : (
          <ul>
            {discovery.discoveredTrapIds.map((id) => {
              const t = getTrapDef(id);
              return <li key={id}>{t?.name ?? id}</li>;
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// 6. RegionModifierCard — 区域规则 modifier
// =====================================================================

export function RegionModifierCard({ regionId }: { regionId: RegionId }) {
  const def = getRegionDefinition(regionId);
  const mods: { label: string; value: string; tone: 'good' | 'bad' | 'neutral' }[] = [
    { label: '火把消耗', value: `${(def.torchModifier * 100).toFixed(0)}%`, tone: def.torchModifier > 1 ? 'bad' : def.torchModifier < 1 ? 'good' : 'neutral' },
    { label: '饥饿频率', value: `${(def.hungerModifier * 100).toFixed(0)}%`, tone: def.hungerModifier > 1 ? 'bad' : 'neutral' },
    { label: '夜袭概率', value: `+${(def.ambushModifier * 100).toFixed(0)}%`, tone: def.ambushModifier > 0.1 ? 'bad' : 'neutral' },
    { label: '压力倍率', value: `${(def.stressModifier * 100).toFixed(0)}%`, tone: def.stressModifier > 1 ? 'bad' : 'good' },
    { label: '侦察收益', value: `${(def.scoutingModifier * 100).toFixed(0)}%`, tone: def.scoutingModifier > 1 ? 'good' : 'bad' },
    { label: '疾病感染', value: `${(def.diseaseModifier * 100).toFixed(0)}%`, tone: def.diseaseModifier > 1 ? 'bad' : 'good' },
    { label: '补给需求', value: `${(def.supplyModifier * 100).toFixed(0)}%`, tone: def.supplyModifier > 1 ? 'bad' : 'good' },
  ];
  return (
    <div className="region-modifier-card">
      <h4>区域规则</h4>
      <ul>
        {mods.map((m) => (
          <li key={m.label} className={`modifier-row tone-${m.tone}`}>
            <span className="modifier-label">{m.label}</span>
            <span className="modifier-value">{m.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =====================================================================
// 7. GeneratedQuestCard — 任务卡
// =====================================================================

export function GeneratedQuestCard({
  quest,
  onSelect,
  disabled,
}: {
  quest: {
    id: string;
    regionId: RegionId;
    objectiveType: string;
    length: 'short' | 'medium';
    modifierIds: string[];
    recommendedProvisionIds: string[];
    recommendedHeroTags: string[];
    rewardPreview: { gold: number; portraits: number; crests: number; heroXp: number };
  };
  onSelect?: () => void;
  disabled?: boolean;
}) {
  const regionDef = getRegionDefinition(quest.regionId);
  return (
    <div className={`generated-quest-card region-${quest.regionId} ${quest.length === 'medium' ? 'medium' : 'short'} ${disabled ? 'disabled' : ''}`}>
      <div className="quest-card-header">
        <span className="region-tag">{regionDef.iconHint} {regionDef.name}</span>
        <span className={`length-tag tag-${quest.length}`}>
          {quest.length === 'medium' ? '中型' : '短型'}
        </span>
      </div>
      <div className="quest-card-objective">
        目标:<strong>{quest.objectiveType}</strong>
      </div>
      <div className="quest-modifier-list">
        {quest.modifierIds.slice(0, 2).map((mid) => (
          <QuestModifierBadge key={mid} modifierId={mid} />
        ))}
        {quest.modifierIds.length > 2 && (
          <span className="more-modifiers">+{quest.modifierIds.length - 2}</span>
        )}
      </div>
      <div className="quest-card-rewards">
        <span className="reward">{quest.rewardPreview.gold}g</span>
        {quest.rewardPreview.portraits > 0 && <span className="reward">肖像 ×{quest.rewardPreview.portraits}</span>}
        {quest.rewardPreview.crests > 0 && <span className="reward">纹章 ×{quest.rewardPreview.crests}</span>}
      </div>
      {onSelect && (
        <button type="button" className="primary" onClick={onSelect} disabled={disabled}>
          选择任务
        </button>
      )}
    </div>
  );
}

// =====================================================================
// 8. QuestModifierBadge — 修正词标签
// =====================================================================

export function QuestModifierBadge({ modifierId }: { modifierId: string }) {
  const m = getQuestModifier(modifierId);
  if (!m) return <span className="quest-modifier-badge unknown">{modifierId}</span>;
  const isRisk = m.tags.some((t) => t === 'risk');
  return (
    <span className={`quest-modifier-badge ${isRisk ? 'risk' : 'reward'}`}>
      {m.name}
    </span>
  );
}

// =====================================================================
// 9. RecommendedProvisionPanel — 推荐补给
// =====================================================================

export function RecommendedProvisionPanel({
  regionId,
  modifierIds,
  customIds,
}: {
  regionId: RegionId;
  modifierIds: string[];
  customIds?: string[];
}) {
  const def = getRegionDefinition(regionId);
  const ids = new Set(def.recommendedProvisionIds);
  // 修正词触发额外推荐
  for (const mid of modifierIds) {
    const m = getQuestModifier(mid);
    if (!m) continue;
    if (m.id === 'qm_disease_outbreak') {
      ids.add('antivenom');
      ids.add('bandage');
    }
    if (m.id === 'qm_hungry_terrain') ids.add('food');
    if (m.id === 'qm_dark_zone') ids.add('torch');
  }
  if (customIds) for (const id of customIds) ids.add(id);
  return (
    <div className="recommended-provision-panel">
      <h4>推荐补给</h4>
      <ul>
        {Array.from(ids).map((id) => (
          <li key={id} className="provision-row">
            <span className="provision-name">{id}</span>
            <span className="provision-qty">x{countRecommended(id, def.id)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function countRecommended(id: string, _regionId: string): number {
  if (id === 'food') return 8;
  if (id === 'torch') return 6;
  if (id === 'bandage' || id === 'antivenom' || id === 'holy-water' || id === 'shovel' || id === 'skeleton-key') return 2;
  return 1;
}

// =====================================================================
// 10. RecommendedHeroTagPanel — 推荐英雄标签
// =====================================================================

export function RecommendedHeroTagPanel({
  regionId,
  tags,
}: {
  regionId: RegionId;
  tags?: string[];
}) {
  const def = getRegionDefinition(regionId);
  const finalTags = tags ?? def.recommendedHeroTags;
  return (
    <div className="recommended-hero-tag-panel">
      <h4>推荐英雄</h4>
      <div className="hero-tag-list">
        {finalTags.map((t) => (
          <span key={t} className="hero-tag">{t}</span>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// 11. EncounterPreviewPanel — 敌人预览
// =====================================================================

export function EncounterPreviewPanel({
  regionId,
  unlockedEliteIds,
  showUndiscovered,
}: {
  regionId: RegionId;
  unlockedEliteIds: string[];
  showUndiscovered: boolean;
}) {
  const normal = REGION_ENEMIES.filter((e) => e.regionId === regionId && !e.isElite);
  const elites = REGION_ENEMIES.filter((e) => e.regionId === regionId && e.isElite);
  return (
    <div className="encounter-preview-panel">
      <h4>敌人预览</h4>
      <div className="encounter-section">
        <h5>普通</h5>
        <ul>
          {normal.map((e) => (
            <li key={e.id} className="enemy-row">
              <span>{e.name}</span>
              <span className="enemy-focus">{e.tacticalFocus}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="encounter-section">
        <h5>精英({unlockedEliteIds.length}/{elites.length} 已解锁)</h5>
        <ul>
          {elites.map((e) => {
            const unlocked = unlockedEliteIds.includes(e.id);
            if (!unlocked && !showUndiscovered) {
              return <li key={e.id} className="enemy-row locked">??? (升级解锁)</li>;
            }
            return (
              <li key={e.id} className="enemy-row">
                <span>{e.name}</span>
                <span className="enemy-focus">{e.tacticalFocus}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// =====================================================================
// 12. RegionRewardPanel — 奖励预览
// =====================================================================

export function RegionRewardPanel({
  regionId: _regionId,
  rewardPreview,
}: {
  regionId: RegionId;
  rewardPreview: { gold: number; portraits: number; crests: number; heroXp: number; trinketDefId?: string };
}) {
  return (
    <div className="region-reward-panel">
      <h4>奖励</h4>
      <ul>
        <li>{rewardPreview.gold}g</li>
        {rewardPreview.portraits > 0 && <li>肖像 ×{rewardPreview.portraits}</li>}
        {rewardPreview.crests > 0 && <li>纹章 ×{rewardPreview.crests}</li>}
        {rewardPreview.heroXp > 0 && <li>英雄 XP +{rewardPreview.heroXp}</li>}
        {rewardPreview.trinketDefId && <li>饰品:{rewardPreview.trinketDefId}</li>}
      </ul>
    </div>
  );
}

// =====================================================================
// 13. RegionReportPanel — 远征报告
// =====================================================================

export interface RegionReportData {
  regionId: RegionId;
  regionExpGained: number;
  newLevel: number;
  newDiscovered: {
    enemies: string[];
    curios: string[];
    traps: string[];
    diseases: string[];
    trinkets: string[];
  };
  bossReady: boolean;
  recommendedMatch: boolean; // 推荐 vs 实际
  failureChain: string[];
}

export function RegionReportPanel({ report }: { report: RegionReportData }) {
  const def = getRegionDefinition(report.regionId);
  return (
    <div className="region-report-panel">
      <h3>{def.iconHint} {def.name} 远征报告</h3>
      <div className="report-section">
        <h4>区域经验 +{report.regionExpGained}</h4>
        <div>当前等级 {report.newLevel}</div>
        {report.bossReady && <div className="boss-ready">⚔️ Boss 任务接口已准备</div>}
      </div>
      <div className="report-section">
        <h4>新发现</h4>
        {report.newDiscovered.enemies.length > 0 && <div>敌人: {report.newDiscovered.enemies.length}</div>}
        {report.newDiscovered.curios.length > 0 && <div>奇物: {report.newDiscovered.curios.length}</div>}
        {report.newDiscovered.traps.length > 0 && <div>陷阱: {report.newDiscovered.traps.length}</div>}
        {report.newDiscovered.diseases.length > 0 && <div>疾病: {report.newDiscovered.diseases.length}</div>}
        {report.newDiscovered.trinkets.length > 0 && <div>饰品: {report.newDiscovered.trinkets.length}</div>}
      </div>
      <div className="report-section">
        <h4>区域准备评估</h4>
        <div className={report.recommendedMatch ? 'good' : 'bad'}>
          {report.recommendedMatch ? '✓ 推荐准备匹配' : '✗ 准备与区域风险不匹配'}
        </div>
      </div>
      {report.failureChain.length > 0 && (
        <div className="report-section">
          <h4>失败链</h4>
          <ol>
            {report.failureChain.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// 14. Phase5DebugPanel — 调试面板
// =====================================================================

export interface Phase5DebugActions {
  onSetRegionLevel?: (regionId: RegionId, level: number) => void;
  onGrantRegionXp?: (regionId: RegionId, amount: number) => void;
  onForceRegionQuest?: (regionId: RegionId) => void;
  onMarkBossReady?: (regionId: RegionId) => void;
  onSelectRegion?: (regionId: RegionId) => void;
  onSetRegionModifier?: (modifierId: string) => void;
}

export function Phase5DebugPanel({
  actions,
  open = true,
  selectedRegionId,
}: {
  actions: Phase5DebugActions;
  open?: boolean;
  selectedRegionId: RegionId | null;
}) {
  const [level, setLevel] = useState(0);
  const [xp, setXp] = useState(50);
  const [modifier, setModifier] = useState('qm_disease_outbreak');
  if (!open) return null;
  return (
    <div className="phase5-debug-panel">
      <h3>Phase 5 调试</h3>
      <div className="debug-section">
        <h4>区域选择</h4>
        <div className="region-buttons">
          {getAllRegionIds().map((rid) => (
            <button
              key={rid}
              type="button"
              className={selectedRegionId === rid ? 'selected' : ''}
              onClick={() => actions.onSelectRegion?.(rid)}
            >
              {getRegionDefinition(rid).name}
            </button>
          ))}
        </div>
      </div>
      <div className="debug-section">
        <h4>区域等级</h4>
        <label>
          等级
          <input type="number" min={0} max={4} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
          <button type="button" onClick={() => selectedRegionId && actions.onSetRegionLevel?.(selectedRegionId, level)}>
            设置
          </button>
        </label>
      </div>
      <div className="debug-section">
        <h4>区域经验</h4>
        <label>
          数量
          <input type="number" min={0} max={500} value={xp} onChange={(e) => setXp(Number(e.target.value))} />
          <button type="button" onClick={() => selectedRegionId && actions.onGrantRegionXp?.(selectedRegionId, xp)}>
            给予
          </button>
        </label>
      </div>
      <div className="debug-section">
        <h4>任务</h4>
        <label>
          修正词
          <select value={modifier} onChange={(e) => setModifier(e.target.value)}>
            {QUEST_MODIFIERS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => actions.onSetRegionModifier?.(modifier)}>记录</button>
        <button type="button" onClick={() => selectedRegionId && actions.onForceRegionQuest?.(selectedRegionId)}>
          强制生成任务
        </button>
        <button type="button" onClick={() => selectedRegionId && actions.onMarkBossReady?.(selectedRegionId)}>
          标记 Boss
        </button>
      </div>
      <div className="debug-section">
        <h4>查看池(只读)</h4>
        <div>敌人:{REGION_ENEMIES.length} | 奇物:{REGION_CURIOS.length} | 陷阱:{REGION_TRAPS.length}</div>
      </div>
    </div>
  );
}
