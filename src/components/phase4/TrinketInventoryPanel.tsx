/**
 * TrinketInventoryPanel — 饰品仓库(Phase 4 P4.2)
 *
 * 显示 campaign.trinketInventory.ownedInstanceIds 列表
 * 点击饰品可装备(由父组件 onEquip)
 */

import type { CampaignState } from '../../game-engine/campaign/types.js';

export function TrinketInventoryPanel({
  campaign,
}: {
  campaign: CampaignState;
}) {
  const inv = campaign.trinketInventory;
  if (!inv) return <div className="muted">无饰品仓库</div>;

  // 简化:这里只显示 instance 数量 + 名;真实实现需要 inv.instanceById map
  // P4 还没有 instanceById 完整持久化,先显示 ownedInstanceIds
  return (
    <div className="trinket-inventory-panel">
      <h4 className="panel-title">饰品仓库({inv.ownedInstanceIds.length})</h4>
      {inv.ownedInstanceIds.length === 0 && <div className="muted">仓库为空</div>}
      <div className="trinket-list">
        {inv.ownedInstanceIds.map((id) => (
          <div key={id} className="trinket-card">
            <span className="trinket-id">{id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
