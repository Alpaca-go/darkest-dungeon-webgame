/**
 * HeroLongTermCard — 单个英雄的长期经营卡
 *
 * 显示:
 * - 名字 + 职业 + 活动状态
 * - HP / 压力 / resolveLevel / XP
 * - 武器/护甲/技能等级
 * - 远征/死亡之门统计
 */

import type { HeroInstance } from '../../game-engine/expedition/types.js';

export function HeroLongTermCard({ hero }: { hero: HeroInstance }) {
  const stressPct = (hero.stress / 200) * 100;
  const hpPct = (hero.hp / hero.maxHp) * 100;
  const deadClass = hero.isDead ? 'hero-dead' : '';
  return (
    <div className={`hero-long-term-card ${deadClass}`}>
      <div className="hero-card-header">
        <div className="hero-card-name">
          <strong>{hero.name}</strong>
          <span className="hero-class-tag">{hero.archetype}</span>
        </div>
        <ActivityBadge state={hero.activityState ?? 'available'} />
      </div>

      {/* HP / 压力条 */}
      <div className="hero-card-bars">
        <div className="bar-row">
          <span className="bar-label">HP</span>
          <div className="bar-track hp-bar">
            <div className="bar-fill" style={{ width: `${hpPct}%` }} />
            <span className="bar-text">{hero.hp}/{hero.maxHp}</span>
          </div>
        </div>
        <div className="bar-row">
          <span className="bar-label">压力</span>
          <div className={`bar-track stress-bar ${stressPct >= 100 ? 'critical' : stressPct >= 50 ? 'high' : ''}`}>
            <div className="bar-fill" style={{ width: `${stressPct}%` }} />
            <span className="bar-text">{Math.round(hero.stress)}/200</span>
          </div>
        </div>
      </div>

      {/* 长期经营数据 */}
      <div className="hero-card-stats">
        <Stat label="意志" value={hero.resolveLevel ?? 0} max={2} />
        <Stat label="经验" value={hero.xp ?? 0} />
        <Stat label="武器" value={hero.weaponLevel ?? 0} max={2} />
        <Stat label="护甲" value={hero.armorLevel ?? 0} max={2} />
        <Stat label="远征" value={hero.expeditionCount ?? 0} />
        <Stat label="成功" value={hero.successfulExpeditionCount ?? 0} />
      </div>

      {/* 死亡之门状态 */}
      {hero.deathsDoorCount !== undefined && hero.deathsDoorCount > 0 && (
        <div className="hero-card-ddr">
          死亡之门 {hero.deathsDoorCount} 次 · 抵抗 {hero.resistedDeathblowCount ?? 0} 次
        </div>
      )}

      {/* 怪癖 */}
      {hero.negativeQuirkIds && hero.negativeQuirkIds.length > 0 && (
        <div className="hero-card-quirks negative">
          ⚠ {hero.negativeQuirkIds.join(', ')}
        </div>
      )}
      {hero.positiveQuirkIds && hero.positiveQuirkIds.length > 0 && (
        <div className="hero-card-quirks positive">
          ✦ {hero.positiveQuirkIds.join(', ')}
        </div>
      )}
    </div>
  );
}

function ActivityBadge({ state }: { state: NonNullable<HeroInstance['activityState']> }) {
  const map: Record<typeof state, { label: string; cls: string }> = {
    'available': { label: '可用', cls: 'badge-available' },
    'selected-for-party': { label: '出征', cls: 'badge-party' },
    'stress-treatment': { label: '减压中', cls: 'badge-treatment' },
    'medical-treatment': { label: '疗养中', cls: 'badge-treatment' },
    'training': { label: '训练中', cls: 'badge-training' },
    'missing': { label: '已解雇', cls: 'badge-missing' },
    'dead': { label: '死亡', cls: 'badge-dead' },
  };
  const b = map[state];
  return <span className={`activity-badge ${b.cls}`}>{b.label}</span>;
}

function Stat({ label, value, max }: { label: string; value: number; max?: number }) {
  return (
    <div className="stat-cell">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {max !== undefined && <span className="stat-max">/{max}</span>}
      </div>
    </div>
  );
}
