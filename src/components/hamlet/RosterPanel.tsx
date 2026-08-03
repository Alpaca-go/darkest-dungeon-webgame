/**
 * RosterPanel — 英雄名册
 *
 * 列出所有 roster heroes(按活动状态排序:可用 > 治疗中 > 死亡)
 * 每行是 HeroLongTermCard
 * 顶部:返回上一级按钮
 */

import { useGameStore } from '../../store/game-store.js';
import { HeroLongTermCard } from './HeroLongTermCard.js';
import { HamletBackBar } from './HamletBackBar.js';

export function RosterPanel() {
  const state = useGameStore((s) => s.state);
  const campaign = state.campaign;
  if (!campaign) return null;

  // 排序:可用 → 治疗中 → 死亡
  const heroes = campaign.rosterHeroIds
    .map((id) => state.party[id])
    .filter((h): h is NonNullable<typeof h> => h != null);
  const sorted = [...heroes].sort((a, b) => {
    const stateOrder = (s: string) => {
      if (s === 'available' || !s) return 0;
      if (s === 'selected-for-party') return 1;
      if (s === 'stress-treatment' || s === 'medical-treatment' || s === 'training') return 2;
      return 3;
    };
    return stateOrder(a.activityState ?? 'available') - stateOrder(b.activityState ?? 'available');
  });

  return (
    <div className="hamlet-roster-panel">
      <HamletBackBar title="英雄名册" />
      <div className="roster-meta">
        名册 {heroes.length}/{campaign.rosterCapacity}
      </div>
      <div className="hero-list">
        {sorted.map((h) => (
          <HeroLongTermCard key={h.id} hero={h} />
        ))}
        {sorted.length === 0 && <p className="muted">暂无英雄</p>}
      </div>
    </div>
  );
}
