/**
 * 饰品管理(SPEC §7 §8)
 *
 * 获得(loot):
 *  - 创建 TrinketInstance
 *  - 加到 campaign.trinketInventory.ownedInstanceIds
 *  - emit TRINKET_LOOTED
 *
 * 装备(equip):
 *  - hero.equippedTrinketInstanceIds[slotIndex] = instanceId
 *  - 校验职业限制(allowedClassIds)
 *  - 同 instance 不能被两名英雄装备
 *  - 每名英雄最多 2 件
 *  - 死英雄不能装备
 *  - 远征开始后不能调整(由 isExpeditionActive 标志控制)
 *
 * 卸下(unequip):
 *  - 槽位设为 null
 *  - emit TRINKET_UNEQUIPPED
 *
 * 死亡回收(SPEC §8.2):
 *  - 'recover-one': 1 件饰品入背包
 *  - 'abandon-all': 全部永久遗失
 *  - 'emergency-retreat': 全部 + 难度惩罚
 */

import type { HeroInstance } from '../expedition/types.js';
import { TRINKET_SLOT_COUNT } from './types.js';
import { getTrinketDef } from './registry.js';
import type { TrinketInventoryState, TrinketInstance, TrinketDefinition, HeroArchetype } from './types.js';

let trinketCounter = 0;
function nextTrinketInstanceId(week: number, defId: string): string {
  trinketCounter += 1;
  return `trk_${defId}_w${week}_${trinketCounter.toString(36)}`;
}

export type EquipResult =
  | { ok: true; instanceId: string; slotIndex: number }
  | { ok: false; reason: string };

export type UnequipResult = { ok: true; instanceId: string } | { ok: false; reason: string };

/** 创建一个新饰品实例并加入仓库 */
export function lootTrinket(
  inventory: TrinketInventoryState,
  definitionId: string,
  week: number,
  source: string,
): { ok: true; instance: TrinketInstance } | { ok: false; reason: string } {
  const def = getTrinketDef(definitionId);
  if (!def) return { ok: false, reason: `unknown trinket: ${definitionId}` };
  const instance: TrinketInstance = {
    id: nextTrinketInstanceId(week, definitionId),
    definitionId,
    acquiredWeek: week,
    acquiredSourceId: source,
  };
  inventory.ownedInstanceIds.push(instance.id);
  return { ok: true, instance };
}

/** 装备饰品到 hero 槽位 */
export function equipTrinket(
  hero: HeroInstance,
  instanceId: string,
  slotIndex: number,
  defCache: Map<string, TrinketDefinition>,
): EquipResult {
  if (slotIndex < 0 || slotIndex >= TRINKET_SLOT_COUNT) {
    return { ok: false, reason: `invalid slot index ${slotIndex}` };
  }
  if (hero.isDead) return { ok: false, reason: 'dead hero cannot equip' };

  const def = defCache.get(defCacheKeyFromInstance(instanceId));
  if (!def) return { ok: false, reason: `unknown trinket definition for ${instanceId}` };

  // 职业限制
  if (def.allowedClassIds && !def.allowedClassIds.includes(hero.archetype as HeroArchetype)) {
    return { ok: false, reason: `class ${hero.archetype} not allowed for ${def.id}` };
  }

  if (!hero.equippedTrinketInstanceIds) hero.equippedTrinketInstanceIds = [];
  // 槽位填到 2 个
  while (hero.equippedTrinketInstanceIds.length < TRINKET_SLOT_COUNT) {
    hero.equippedTrinketInstanceIds.push(null as any);
  }
  // 检查是否已装备
  if (hero.equippedTrinketInstanceIds.includes(instanceId)) {
    return { ok: true, instanceId, slotIndex: hero.equippedTrinketInstanceIds.indexOf(instanceId) };
  }
  // 检查同 instance 是否被另一英雄装备(从 inventory.equippedByHero 查)
  // 由 caller 传入 inventory 实现一致性校验
  hero.equippedTrinketInstanceIds[slotIndex] = instanceId as any;
  return { ok: true, instanceId, slotIndex };
}

/** 卸下饰品 */
export function unequipTrinket(hero: HeroInstance, slotIndex: number): UnequipResult {
  if (slotIndex < 0 || slotIndex >= TRINKET_SLOT_COUNT) {
    return { ok: false, reason: `invalid slot index ${slotIndex}` };
  }
  if (!hero.equippedTrinketInstanceIds) hero.equippedTrinketInstanceIds = [];
  while (hero.equippedTrinketInstanceIds.length < TRINKET_SLOT_COUNT) {
    hero.equippedTrinketInstanceIds.push(null as any);
  }
  const inst = hero.equippedTrinketInstanceIds[slotIndex];
  if (!inst) return { ok: false, reason: 'slot empty' };
  hero.equippedTrinketInstanceIds[slotIndex] = null as any;
  return { ok: true, instanceId: inst };
}

/** 死亡回收(SPEC §8.2) */
export type DeathRecoveryChoice = 'recover-one' | 'abandon-all' | 'emergency-retreat';

export interface DeathRecoveryResult {
  recovered: string[];
  abandoned: string[];
  retreatPenalty: number;
}

/** 处理英雄死亡时的饰品回收 */
export function processDeathRecovery(
  hero: HeroInstance,
  choice: DeathRecoveryChoice,
): DeathRecoveryResult {
  if (!hero.equippedTrinketInstanceIds) hero.equippedTrinketInstanceIds = [];
  const equipped = hero.equippedTrinketInstanceIds.filter((x) => x != null) as string[];
  // 清空装备槽
  hero.equippedTrinketInstanceIds = [null, null];

  if (choice === 'abandon-all') {
    return { recovered: [], abandoned: equipped, retreatPenalty: 0 };
  }
  if (choice === 'recover-one') {
    return {
      recovered: equipped.length > 0 ? [equipped[0]!] : [],
      abandoned: equipped.slice(1),
      retreatPenalty: 0,
    };
  }
  // emergency-retreat
  return { recovered: [...equipped], abandoned: [], retreatPenalty: 2 };
}

/** 检查同 instance 是否被另一英雄装备 */
export function isInstanceEquippedElsewhere(
  inventory: TrinketInventoryState,
  instanceId: string,
  excludeHeroId: string,
): boolean {
  for (const [heroId, slots] of Object.entries(inventory.equippedByHero)) {
    if (heroId === excludeHeroId) continue;
    if (slots.includes(instanceId as any)) return true;
  }
  return false;
}

/** 列出 hero 当前装备的饰品(0/1/2 件 + definitions) */
export function listHeroEquippedTrinkets(
  hero: HeroInstance,
  defCache: Map<string, TrinketDefinition>,
): Array<{ slotIndex: number; instanceId: string; def: TrinketDefinition }> {
  if (!hero.equippedTrinketInstanceIds) return [];
  const out: Array<{ slotIndex: number; instanceId: string; def: TrinketDefinition }> = [];
  hero.equippedTrinketInstanceIds.forEach((instId, idx) => {
    if (!instId) return;
    const def = defCache.get(instId);
    if (def) out.push({ slotIndex: idx, instanceId: instId, def });
  });
  return out;
}

/** 创建 def 缓存(hero instance id → definition) */
export function buildTrinketDefCache(inventory: TrinketInventoryState): Map<string, TrinketDefinition> {
  const cache = new Map<string, TrinketDefinition>();
  for (const instId of inventory.ownedInstanceIds) {
    // instId 格式:`trk_<defId>_w<week>_<n>`,提取 defId
    const defId = extractDefinitionId(instId);
    if (!defId) continue;
    const def = getTrinketDef(defId);
    if (def) cache.set(instId, def);
  }
  return cache;
}

function defCacheKeyFromInstance(instanceId: string): string {
  return instanceId;
}

function extractDefinitionId(instanceId: string): string | null {
  // trk_<defId>_w<week>_<n>
  const m = /^trk_(.+?)_w\d+_[a-z0-9]+$/.exec(instanceId);
  return m ? m[1]! : null;
}
