/**
 * ProvisioningPanel — 购买补给
 *
 * 列出所有可购买物品 + 单价,加入购物车
 * 底部:购物车总金币 + 结算按钮
 */

import { useState } from 'react';
import { useGameStore, makeCommandId } from '../../store/game-store.js';
import { PROVISION_PRICES, provisionCartTotal } from '../../game-engine/campaign/provisioning.js';
import { HamletBackBar } from './HamletBackBar.js';
import type { ItemId } from '../../game-engine/expedition/types.js';

const ITEM_LABELS: Record<ItemId, string> = {
  food: '🍖 食物',
  torch: '🔥 火把',
  'torch-fuel': '🪔 火把燃料',
  shovel: '⛏ 铲子',
  'skeleton-key': '🗝 万能钥匙',
  'holy-water': '✨ 圣水',
  bandage: '🩹 绷带',
  antivenom: '💊 解毒剂',
  gold: '🪙 金币',
};

const BUYABLE: ItemId[] = ['food', 'torch', 'torch-fuel', 'shovel', 'skeleton-key', 'holy-water', 'bandage', 'antivenom'];

export function ProvisioningPanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const campaign = state.campaign;
  const hamlet = state.hamlet;
  const [error, setError] = useState<string | null>(null);
  if (!campaign || !hamlet) return null;

  const cartTotal = provisionCartTotal(state);

  const onAdd = (itemId: ItemId) => {
    setError(null);
    try {
      dispatch({ type: 'BUY_PROVISION', itemId, count: 1, commandId: makeCommandId('buy') });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onRemove = (itemId: ItemId) => {
    setError(null);
    try {
      dispatch({ type: 'REMOVE_PROVISION', itemId, count: 1, commandId: makeCommandId('rm') });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onSettle = () => {
    setError(null);
    try {
      dispatch({ type: 'SETTLE_PROVISION', commandId: makeCommandId('settle') });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="hamlet-provision-panel">
      <HamletBackBar title="购买补给" />
      <ul className="provision-list">
        {BUYABLE.map((id) => {
          const price = PROVISION_PRICES[id];
          const inCart = hamlet.provisionCart[id] ?? 0;
          return (
            <li key={id} className="provision-row">
              <div className="provision-info">
                <strong>{ITEM_LABELS[id]}</strong>
                <div className="muted" style={{ fontSize: 11 }}>单价 {price} 金币</div>
              </div>
              <div className="provision-cart">
                <button onClick={() => onRemove(id)} disabled={inCart === 0} style={{ minWidth: 36, padding: '4px' }}>−</button>
                <span className="cart-count">{inCart}</span>
                <button onClick={() => onAdd(id)} style={{ minWidth: 36, padding: '4px' }}>+</button>
              </div>
            </li>
          );
        })}
      </ul>
      {error && <div className="provision-error">{error}</div>}
      <div className="provision-summary">
        <span>购物车总价</span>
        <span className="gold">🪙 {cartTotal}</span>
      </div>
      <button
        className="primary"
        disabled={cartTotal === 0 || cartTotal > campaign.gold}
        onClick={onSettle}
        style={{ width: '100%', marginTop: 8 }}
      >
        结算购物车
      </button>
    </div>
  );
}
