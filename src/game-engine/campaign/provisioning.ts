/**
 * 补给购买(SPEC §21)
 *
 * 庄园商店(phase-3 商店):
 *  - 玩家在 hamlet-provision 选物品 + 数量 → 加入 provisionCart
 *  - 结算时(开始远征前)扣金币 + 加物品到 inventory
 *
 * 当前实现:简单按物品 + 数量,扣金币 + 写入 inventory。
 */

import type { GameState, ItemId } from '../expedition/types.js';
import { ensureCampaign, ensureHamlet } from './state.js';

/** 单价(SPEC §21.1) */
export const PROVISION_PRICES: Record<ItemId, number> = {
  food: 50,
  torch: 30,
  'torch-fuel': 60,
  shovel: 200,
  'skeleton-key': 250,
  'holy-water': 300,
  bandage: 200,
  antivenom: 350,
  gold: 0, // 不卖
};

export interface BuyProvisionResult {
  ok: boolean;
  reason?: string;
  totalCost?: number;
}

/** 把物品加入购物车(未付款) */
export function addToProvisionCart(state: GameState, itemId: ItemId, count: number): BuyProvisionResult {
  if (count <= 0) return { ok: false, reason: '数量必须 > 0' };
  const hamlet = ensureHamlet(state);
  hamlet.provisionCart[itemId] = (hamlet.provisionCart[itemId] ?? 0) + count;
  return { ok: true };
}

/** 从购物车移除 */
export function removeFromProvisionCart(state: GameState, itemId: ItemId, count: number): BuyProvisionResult {
  const hamlet = ensureHamlet(state);
  const cur = hamlet.provisionCart[itemId] ?? 0;
  if (count <= 0) return { ok: false, reason: '数量必须 > 0' };
  if (cur < count) return { ok: false, reason: `购物车中没有 ${count} 个 ${itemId}` };
  hamlet.provisionCart[itemId] = cur - count;
  if (hamlet.provisionCart[itemId] === 0) {
    delete hamlet.provisionCart[itemId];
  }
  return { ok: true };
}

/** 购物车总金币 */
export function provisionCartTotal(state: GameState): number {
  const hamlet = ensureHamlet(state);
  let total = 0;
  for (const [itemId, count] of Object.entries(hamlet.provisionCart)) {
    const price = PROVISION_PRICES[itemId as ItemId] ?? 0;
    total += price * count;
  }
  return total;
}

/** 结算购物车:扣金币 + 加物品到 inventory */
export function settleProvisionCart(state: GameState): BuyProvisionResult {
  const campaign = ensureCampaign(state);
  const hamlet = ensureHamlet(state);
  const total = provisionCartTotal(state);
  if (total > campaign.gold) {
    return { ok: false, reason: `金币不足 (需 ${total}, 现有 ${campaign.gold})` };
  }
  if (total === 0) {
    return { ok: true, totalCost: 0 };
  }
  // 扣金币
  campaign.gold -= total;
  // 加物品到背包
  for (const [itemId, count] of Object.entries(hamlet.provisionCart)) {
    addItemToInventory(state, itemId as ItemId, count);
  }
  hamlet.provisionCart = {};
  return { ok: true, totalCost: total };
}

function addItemToInventory(state: GameState, itemId: ItemId, count: number): void {
  // 简单堆叠:如果已有 stack,加;否则新建
  const existing = state.inventory.stacks.find((s) => s.itemId === itemId);
  if (existing) {
    existing.count += count;
    return;
  }
  state.inventory.stacks.push({
    id: `stack_${itemId}_${Date.now().toString(36)}`,
    itemId,
    count,
  });
}
