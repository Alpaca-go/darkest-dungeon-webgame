/**
 * 物品定义(SPEC §21)
 *
 * Phase 1 默认补给:
 *   食物 8 / 火把 6 / 铲子 1 / 万能钥匙 1 / 圣水 1 / 绷带 1
 *
 * 额外的游戏内可获得:
 *   解毒剂(从奇物/事件)、金块(战利品)
 */

import type { ItemDefinition, ItemId } from '../game-engine/expedition/types.js';

export const ITEM_REGISTRY: Record<ItemId, ItemDefinition> = {
  food: {
    id: 'food',
    name: '食物',
    description: '一份口粮,可在饥饿事件中消耗。',
    maxStack: 16,
    category: 'consumable',
  },
  torch: {
    id: 'torch',
    name: '火把',
    description: '可点燃,恢复 25 点光照。',
    maxStack: 16,
    category: 'supply',
  },
  'torch-fuel': {
    id: 'torch-fuel',
    name: '火把燃料',
    description: '额外的火把储料,在篝火点可消耗补充。',
    maxStack: 16,
    category: 'supply',
  },
  shovel: {
    id: 'shovel',
    name: '铲子',
    description: '清理路障,安全通过。',
    maxStack: 1,
    category: 'tool',
  },
  'skeleton-key': {
    id: 'skeleton-key',
    name: '万能钥匙',
    description: '打开上锁的古老宝箱,无需陷阱判定。',
    maxStack: 1,
    category: 'key',
  },
  'holy-water': {
    id: 'holy-water',
    name: '圣水',
    description: '净化被亵渎的祭坛,稳定获得正面结果。',
    maxStack: 1,
    category: 'consumable',
  },
  bandage: {
    id: 'bandage',
    name: '绷带',
    description: '在战斗中或事件里使用,恢复少量 HP。',
    maxStack: 4,
    category: 'consumable',
  },
  antivenom: {
    id: 'antivenom',
    name: '解毒剂',
    description: '清除腐蚀状态,防止持续伤害。',
    maxStack: 4,
    category: 'consumable',
  },
  gold: {
    id: 'gold',
    name: '金块',
    description: '战利品,可在庄园兑换资源(Phase 2 启用)。',
    maxStack: 16,
    category: 'valuable',
  },
};

export const DEFAULT_EXPEDITION_LOADOUT: ItemId[] = [
  'food', 'food', 'food', 'food', 'food', 'food', 'food', 'food',
  'torch', 'torch', 'torch', 'torch', 'torch', 'torch',
  'shovel', 'skeleton-key', 'holy-water', 'bandage',
];

export function loadoutId(): string {
  return 'loadout.default.ruins';
}
