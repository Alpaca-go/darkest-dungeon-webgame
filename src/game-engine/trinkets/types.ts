/**
 * 饰品系统类型(SPEC §7)
 *
 * 饰品(Trinket)是英雄构筑的长期硬件:
 *  - 每名英雄 2 个装备槽
 *  - 4 稀有度(common / uncommon / rare / very-rare)
 *  - 4 职业限定(vestal / plague_doctor / crusader / highwayman)
 *  - 必须有取舍(正 modifier + 负 modifier,SPEC §1.3)
 *  - 死亡处理:回收 / 放弃 / 紧急撤退 三选一
 *
 * 与怪癖(quirk)/疾病(disease)的区别:
 *  - quirk:长期个性(可正可负)
 *  - disease:负面状态(可治疗)
 *  - trinket:可装备的硬件(可更换、可丢失)
 */

import type { HeroInstance } from '../expedition/types.js';

export type TrinketRarity = 'common' | 'uncommon' | 'rare' | 'very-rare';

export type HeroArchetype = 'crusader' | 'highwayman' | 'vestal' | 'plague_doctor';

/** 简单 modifier 描述(不实现完整 RuleModifier 系统,MVP 用 key+value) */
export interface TrinketModifier {
  key: string;
  value: number;
  description: string;
}

export interface TrinketDefinition {
  id: string;
  name: string;
  rarity: TrinketRarity;
  /** 职业限定(不填 = 通用) */
  allowedClassIds?: HeroArchetype[];
  tags: string[];
  positiveModifiers: TrinketModifier[];
  negativeModifiers: TrinketModifier[];
  /** 简短提示 */
  flavor: string;
}

export interface TrinketInstance {
  id: string;
  definitionId: string;
  acquiredWeek: number;
  acquiredSourceId: string;
}

/** 仓库(SPEC §7.5,MVP 无容量上限) */
export interface TrinketInventoryState {
  ownedInstanceIds: string[];
  /** 已装备映射:heroId → 装备槽 0/1 → instanceId */
  equippedByHero: Record<string, [string | null, string | null]>;
}

/** 装备槽数(SPEC §7.1) */
export const TRINKET_SLOT_COUNT = 2;

export const TRINKET_MAX_LEVEL = 4;

/** 读取英雄装备的饰品 id 列表(0/1 槽位,空 = null) */
export function readEquippedTrinketIds(hero: HeroInstance): [string | null, string | null] {
  if (!hero.equippedTrinketInstanceIds || hero.equippedTrinketInstanceIds.length === 0) {
    return [null, null];
  }
  return [
    hero.equippedTrinketInstanceIds[0] ?? null,
    hero.equippedTrinketInstanceIds[1] ?? null,
  ];
}
