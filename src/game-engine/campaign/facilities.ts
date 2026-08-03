/**
 * 设施服务(SPEC §9 §10 §11 §12 §15)
 *
 * - 酒馆:35-55 stress 减压(波动大,可复现副作用)
 * - 修道院:45-60 stress 减压(稳定)
 * - 疗养院:移除 1 怪癖 / 治疗 1 疾病(占位)
 * - 公会:升级技能 0-2
 * - 铁匠铺:升级武器 / 护甲 0-2
 * - 马车:刷新候选(在 recruits.ts)
 * - 商店:购买补给(在 provisioning.ts)
 *
 * 所有服务占 1 周(下周结算)。
 */

import type { GameState, HeroInstance } from '../expedition/types.js';
import type { FacilityId, FacilityServiceId, HeirloomWallet } from './types.js';
import { ensureCampaign } from './state.js';

/** 副作用:酒馆有 1 个可复现副作用(SPEC §9.2) */
export const TAVERN_SIDE_EFFECT_ID = 'side_effect_tavern';
const TAVERN_SIDE_EFFECT_GOLD_LOST_MIN = 100;
const TAVERN_SIDE_EFFECT_GOLD_LOST_MAX = 300;

export interface ServiceAssignmentResult {
  ok: boolean;
  reason?: string;
  costGold?: number;
  costHeirlooms?: Partial<HeirloomWallet>;
  /** 1 = 下周结算(SPEC §9.1) */
  weeksRequired?: number;
  /** 实际效果(下周结算时计算) */
  effect?: {
    type: 'stress-relief' | 'quirk-removal' | 'disease-treatment' | 'skill-upgrade' | 'weapon-upgrade' | 'armor-upgrade';
    min?: number;
    max?: number;
    /** 治疗对负向怪癖 / 疾病 */
    targetId?: string;
    /** 是否可能产生副作用 */
    sideEffectChance?: number;
  };
}

/**
 * 把英雄分配到设施(SPEC §9.1 治疗原则)
 *
 *  - 不可用英雄(死 / 治疗中)不能分配
 *  - 设施占用不得超过 slotCount
 *  - 金币 / 遗产资源校验
 */
export function assignHeroToFacility(
  state: GameState,
  heroId: string,
  facilityId: FacilityId,
  serviceId: FacilityServiceId,
): ServiceAssignmentResult {
  const campaign = ensureCampaign(state);
  const hero = state.party[heroId];
  if (!hero) return { ok: false, reason: '英雄不存在' };
  if (hero.isDead) return { ok: false, reason: '死亡英雄不可使用' };
  const facility = campaign.facilityStates[facilityId];
  if (!facility) return { ok: false, reason: '设施不存在' };
  // 先检查"已在该设施" — 同一英雄不能重复分配
  if (facility.occupiedSlots.some((s) => s.heroId === heroId)) {
    return { ok: false, reason: '英雄已在该设施' };
  }
  // 再检查"不在可用状态" — 治疗/训练中不能被分配
  if (hero.activityState && hero.activityState !== 'available') {
    return { ok: false, reason: '英雄不在可用状态' };
  }
  if (facility.occupiedSlots.length >= facility.slotCount) {
    return { ok: false, reason: '设施已满' };
  }

  // 服务特定逻辑
  const result = getServiceCostAndEffect(facilityId, serviceId, hero, campaign);
  if (!result.ok) return result;
  if (result.costGold && campaign.gold < result.costGold) {
    return { ok: false, reason: `金币不足(需 ${result.costGold})` };
  }
  if (result.costHeirlooms) {
    if (result.costHeirlooms.portraits && campaign.heirlooms.portraits < result.costHeirlooms.portraits) {
      return { ok: false, reason: '画像不足' };
    }
    if (result.costHeirlooms.crests && campaign.heirlooms.crests < result.costHeirlooms.crests) {
      return { ok: false, reason: '纹章不足' };
    }
  }

  // 扣资源
  if (result.costGold) campaign.gold -= result.costGold;
  if (result.costHeirlooms) {
    if (result.costHeirlooms.portraits) campaign.heirlooms.portraits -= result.costHeirlooms.portraits;
    if (result.costHeirlooms.crests) campaign.heirlooms.crests -= result.costHeirlooms.crests;
  }

  // 分配 slot
  facility.occupiedSlots.push({
    heroId,
    serviceId,
    weeksRemaining: 1,
    transactionId: state.lastTransactionId ?? 'no-tx',
    resultSeedState: 'pending',
  });

  // 更新 hero 状态
  hero.activityState = serviceId === 'stress-tavern' || serviceId === 'stress-abbey' ? 'stress-treatment' : serviceId === 'quirk-removal' || serviceId === 'disease-treatment' ? 'medical-treatment' : 'training';
  hero.assignedFacilityId = facilityId;
  hero.activityWeeksRemaining = 1;

  return result;
}

function getServiceCostAndEffect(
  facilityId: FacilityId,
  serviceId: FacilityServiceId,
  hero: HeroInstance,
  campaign: ReturnType<typeof ensureCampaign>,
): ServiceAssignmentResult {
  // 酒馆
  if (facilityId === 'tavern' && serviceId === 'stress-tavern') {
    return {
      ok: true,
      costGold: 650,
      weeksRequired: 1,
      effect: { type: 'stress-relief', min: 35, max: 55, sideEffectChance: 0.4 },
    };
  }
  // 修道院
  if (facilityId === 'abbey' && serviceId === 'stress-abbey') {
    return {
      ok: true,
      costGold: 900,
      weeksRequired: 1,
      effect: { type: 'stress-relief', min: 45, max: 60 },
    };
  }
  // 疗养院:移除 1 负面怪癖
  if (facilityId === 'sanitarium' && serviceId === 'quirk-removal') {
    if (!hero.negativeQuirkIds || hero.negativeQuirkIds.length === 0) {
      return { ok: false, reason: '没有负面怪癖' };
    }
    return {
      ok: true,
      costGold: 500,
      weeksRequired: 1,
      effect: { type: 'quirk-removal', targetId: hero.negativeQuirkIds[0]! },
    };
  }
  // 疗养院:治疗 1 疾病
  if (facilityId === 'sanitarium' && serviceId === 'disease-treatment') {
    if (!hero.diseaseIds || hero.diseaseIds.length === 0) {
      return { ok: false, reason: '没有疾病' };
    }
    return {
      ok: true,
      costGold: 750,
      weeksRequired: 1,
      effect: { type: 'disease-treatment', targetId: hero.diseaseIds[0]! },
    };
  }
  // 公会:升级技能
  if (facilityId === 'guild' && serviceId === 'skill-upgrade') {
    if (campaign.facilityStates['guild']!.level < 1) {
      return { ok: false, reason: '公会尚未升级' };
    }
    if (!hero.skillLevels) hero.skillLevels = {};
    const skill = hero.skills[0];
    if (!skill) return { ok: false, reason: '没有技能可升级' };
    const cur = hero.skillLevels[skill] ?? 0;
    if (cur >= 2) return { ok: false, reason: '技能已达最高等级' };
    return {
      ok: true,
      costGold: 800,
      weeksRequired: 1,
      effect: { type: 'skill-upgrade', targetId: skill, max: 2 },
    };
  }
  // 铁匠铺:武器
  if (facilityId === 'blacksmith' && serviceId === 'weapon-upgrade') {
    if (hero.weaponLevel !== undefined && hero.weaponLevel >= 2) {
      return { ok: false, reason: '武器已达最高等级' };
    }
    return { ok: true, costGold: 750, weeksRequired: 1, effect: { type: 'weapon-upgrade', max: 2 } };
  }
  // 铁匠铺:护甲
  if (facilityId === 'blacksmith' && serviceId === 'armor-upgrade') {
    if (hero.armorLevel !== undefined && hero.armorLevel >= 2) {
      return { ok: false, reason: '护甲已达最高等级' };
    }
    return { ok: true, costGold: 750, weeksRequired: 1, effect: { type: 'armor-upgrade', max: 2 } };
  }
  return { ok: false, reason: '不支持的服务组合' };
}

/** 周推进时结算所有设施占用(SPEC §4.1) */
export function settleFacilities(state: GameState): {
  completed: { heroId: string; serviceId: FacilityServiceId; result: 'success' | 'failed' | 'partial' }[];
} {
  const campaign = ensureCampaign(state);
  const completed: { heroId: string; serviceId: FacilityServiceId; result: 'success' | 'failed' | 'partial' }[] = [];
  for (const facility of Object.values(campaign.facilityStates)) {
    const still: typeof facility.occupiedSlots = [];
    for (const slot of facility.occupiedSlots) {
      slot.weeksRemaining -= 1;
      if (slot.weeksRemaining <= 0) {
        applyServiceEffect(state, slot);
        const hero = state.party[slot.heroId];
        if (hero) {
          hero.assignedFacilityId = null;
          hero.activityWeeksRemaining = 0;
          hero.activityState = 'available';
        }
        completed.push({ heroId: slot.heroId, serviceId: slot.serviceId, result: 'success' });
      } else {
        still.push(slot);
      }
    }
    facility.occupiedSlots = still;
  }
  return { completed };
}

function applyServiceEffect(state: GameState, slot: { heroId: string; serviceId: FacilityServiceId }): void {
  const hero = state.party[slot.heroId];
  if (!hero) return;
  const campaign = ensureCampaign(state);
  switch (slot.serviceId) {
    case 'stress-tavern':
    case 'stress-abbey': {
      // 减压(Seeded RNG 用 campaign.seed + hero.id + week)
      const seed = `${campaign.seed}:${hero.id}:stress:${campaign.week}`;
      const hash = simpleHash(seed);
      const isTavern = slot.serviceId === 'stress-tavern';
      const min = isTavern ? 35 : 45;
      const max = isTavern ? 55 : 60;
      const relief = min + (hash % (max - min + 1));
      hero.stress = Math.max(0, hero.stress - relief);
      // 酒馆 40% 副作用:丢失 100-300 金币
      if (isTavern && (hash % 10) < 4) {
        const lost = TAVERN_SIDE_EFFECT_GOLD_LOST_MIN + (hash * 7 % (TAVERN_SIDE_EFFECT_GOLD_LOST_MAX - TAVERN_SIDE_EFFECT_GOLD_LOST_MIN + 1));
        campaign.gold = Math.max(0, campaign.gold - lost);
      }
      return;
    }
    case 'quirk-removal': {
      if (hero.negativeQuirkIds && hero.negativeQuirkIds.length > 0) {
        hero.negativeQuirkIds.shift();
      }
      return;
    }
    case 'disease-treatment': {
      if (hero.diseaseIds && hero.diseaseIds.length > 0) {
        hero.diseaseIds.shift();
      }
      return;
    }
    case 'skill-upgrade': {
      const skill = hero.skills[0];
      if (skill && hero.skillLevels) {
        hero.skillLevels[skill] = Math.min(2, (hero.skillLevels[skill] ?? 0) + 1);
      }
      return;
    }
    case 'weapon-upgrade': {
      hero.weaponLevel = Math.min(2, (hero.weaponLevel ?? 0) + 1);
      return;
    }
    case 'armor-upgrade': {
      hero.armorLevel = Math.min(2, (hero.armorLevel ?? 0) + 1);
      return;
    }
  }
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}
