/**
 * 露营管理(Phase 4 P4.4)
 *
 * 职责:
 *  - startCamp: 初始化 campState
 *  - selectFood: 应用食物效果 + 切到 activity-choice
 *  - generateActivities: 选 2-4 个最相关活动(SPEC §12.4 排序)
 *  - selectActivity: 扣点数 + 应用 effect + 记录 guard
 *  - resolveNightAmbush: 守夜阻止 / 检定 seeded RNG / 应用 outcome
 *  - finishCamp: 切到 completed + 应用持续 buff
 *  - tickBuffs: 节点推进/遭遇推进时减少 remainingNodes/Encounters
 *
 * 不变量(SPEC §19):
 *  - remainingPoints >= 0
 *  - 同一远征只能露营 maxCampUses 次
 *  - 露营完成后不能重复结算
 *  - 夜袭刷新后不重抽(rng 状态被 dispatcher 持久化)
 */

import type {
  HeroInstance,
  ExpeditionState,
  InventoryState,
  ItemId,
} from '../expedition/types.js';
import { torchLevel, type TorchState } from '../expedition/types.js';
import type { RngState } from '../rng/types.js';
import { Mulberry32 } from '../rng/index.js';
import {
  CAMP_BASE_POINTS,
  CAMP_FOOD_CHOICES,
  type CampActivityDef,
  type CampConfig,
  type CampFoodChoiceId,
  type CampState,
  type ExpeditionBuff,
  type NightAmbushOutcome,
  type NightAmbushResult,
  DEFAULT_CAMP_CONFIG,
} from './types.js';

export { DEFAULT_CAMP_CONFIG } from './types.js';
import { ALL_CAMP_ACTIVITIES, getCampActivity } from './activities.js';

const ITEM_FOOD: ItemId = 'food';

// =====================================================================
// 启动 / 状态
// =====================================================================

export interface StartCampResult {
  ok: boolean;
  reason?: string;
  campState: CampState;
}

/** 开始露营 */
export function startCamp(
  expedition: ExpeditionState,
  _party: Record<string, HeroInstance>,
  config: CampConfig = DEFAULT_CAMP_CONFIG,
  currentDepth: number,
): StartCampResult {
  if (expedition.campUsed) {
    return {
      ok: false,
      reason: 'camp already used this expedition',
      campState: expedition.campState ?? emptyCampState(0),
    };
  }
  if (!canCampAtNode(expedition)) {
    return {
      ok: false,
      reason: 'cannot camp at this node',
      campState: expedition.campState ?? emptyCampState(0),
    };
  }
  const campState: CampState = {
    totalPoints: config.basePoints,
    remainingPoints: config.basePoints,
    selectedActivityIds: [],
    guardEstablished: false,
    campStatus: 'food-choice',
    foodChoiceId: null,
    nightAmbushResult: null,
    startedAtDepth: currentDepth,
    availableActivityIds: [],
  };
  void _party;
  return { ok: true, campState };
}

/** 当前节点是否可露营 */
export function canCampAtNode(expedition: ExpeditionState): boolean {
  const node = expedition.route.nodes[expedition.currentNodeId];
  if (!node) return false;
  return node.type === 'empty-room' || node.type === 'corridor' || node.type === 'objective';
}

/** 露营状态是否合法 */
export function isCampCompleted(campState: CampState): boolean {
  return campState.campStatus === 'completed';
}

// =====================================================================
// 食物选择
// =====================================================================

export interface FoodResult {
  ok: boolean;
  reason?: string;
  foodConsumed: number;
  stressDelta: number;
  healFlat: number;
  hpDamage: number;
  bonusPoints: number;
}

/** 选食物 + 应用效果到 party + 更新 campState */
export function selectFood(
  expedition: ExpeditionState,
  party: Record<string, HeroInstance>,
  inventory: InventoryState,
  choiceId: CampFoodChoiceId,
): FoodResult {
  const choice = CAMP_FOOD_CHOICES[choiceId];
  if (!choice) {
    return { ok: false, reason: 'unknown food choice', foodConsumed: 0, stressDelta: 0, healFlat: 0, hpDamage: 0, bonusPoints: 0 };
  }
  const food = countInventory(inventory, ITEM_FOOD);
  if (food < choice.foodCost) {
    return { ok: false, reason: `not enough food (need ${choice.foodCost}, have ${food})`, foodConsumed: 0, stressDelta: 0, healFlat: 0, hpDamage: 0, bonusPoints: 0 };
  }

  // 扣食物
  consumeInventory(inventory, ITEM_FOOD, choice.foodCost);

  // 应用到每个存活英雄
  for (const hero of Object.values(party)) {
    if (hero.isDead) continue;
    if (choice.partyHealFlat > 0) {
      hero.hp = Math.min(hero.maxHp, hero.hp + choice.partyHealFlat);
    }
    if (choice.partyHpDamage > 0) {
      hero.hp = Math.max(0, hero.hp - choice.partyHpDamage);
    }
    hero.stress = Math.max(0, Math.min(200, hero.stress + choice.partyStressDelta));
  }

  // 更新 campState
  if (expedition.campState) {
    expedition.campState.foodChoiceId = choiceId;
    if (choice.bonusCampPoints) {
      expedition.campState.remainingPoints += choice.bonusCampPoints;
      expedition.campState.totalPoints += choice.bonusCampPoints;
    }
    expedition.campState.campStatus = 'activity-choice';
    expedition.campState.availableActivityIds = generateActivityOptions(
      expedition.campState,
      party,
    );
  }

  return {
    ok: true,
    foodConsumed: choice.foodCost,
    stressDelta: choice.partyStressDelta,
    healFlat: choice.partyHealFlat,
    hpDamage: choice.partyHpDamage,
    bonusPoints: choice.bonusCampPoints ?? 0,
  };
}

// =====================================================================
// 活动选择 (SPEC §12.4 排序: 濒死 > 疾病 > 防夜袭 > 侦察 > Buff > 恢复)
// =====================================================================

const ACTIVITY_OPTION_COUNT = 4;

/** 生成当前可用的 2-4 个活动 */
export function generateActivityOptions(
  campState: CampState,
  party: Record<string, HeroInstance>,
): string[] {
  const aliveHeroes = Object.values(party).filter((h) => !h.isDead);
  const hasLowHp = aliveHeroes.some((h) => h.hp <= h.maxHp * 0.4);
  const hasHighStress = aliveHeroes.some((h) => h.stress >= 100);
  const hasDisease = aliveHeroes.some((h) => (h.diseaseIds?.length ?? 0) > 0);
  const hasGuard = campState.guardEstablished;

  const scored: { id: string; score: number }[] = [];
  for (const activity of ALL_CAMP_ACTIVITIES) {
    if (campState.selectedActivityIds.includes(activity.id)) continue;
    if (campState.remainingPoints < activity.cost) continue;

    let score = 0;
    if (activity.tags.includes('guard') && !hasGuard) score += 50;
    if (activity.tags.includes('heal') && hasLowHp) score += 40;
    if (activity.tags.includes('stress-relief') && hasHighStress) score += 35;
    if (activity.tags.includes('disease-prevent') && hasDisease) score += 30;
    if (activity.tags.includes('scout')) score += 20;
    if (activity.tags.includes('buff')) score += 15;
    if (activity.tags.includes('supply')) score += 10;
    if (activity.tags.includes('flavor')) score += 5;

    if (activity.category !== 'universal') {
      const catMap: Record<string, HeroInstance['archetype']> = {
        crusader: 'crusader',
        highwayman: 'highwayman',
        vestal: 'vestal',
        plague_doctor: 'plague_doctor',
      };
      const targetArchetype = catMap[activity.category];
      if (targetArchetype && aliveHeroes.some((h) => h.archetype === targetArchetype)) {
        score += 25;
      } else {
        score = Math.max(1, score - 10);
      }
    }

    if (score > 0) scored.push({ id: activity.id, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, ACTIVITY_OPTION_COUNT).map((s) => s.id);
}

export interface SelectActivityResult {
  ok: boolean;
  reason?: string;
  pointsSpent: number;
  remainingPoints: number;
  buffApplied: boolean;
  guardEstablished: boolean;
}

/** 选活动 + 应用效果 */
export function selectActivity(
  expedition: ExpeditionState,
  party: Record<string, HeroInstance>,
  inventory: InventoryState,
  activityId: string,
  targetHeroId: string | null = null,
): SelectActivityResult {
  const camp = expedition.campState;
  if (!camp) return { ok: false, reason: 'no camp state', pointsSpent: 0, remainingPoints: 0, buffApplied: false, guardEstablished: false };
  if (camp.campStatus !== 'activity-choice') {
    return { ok: false, reason: `camp status is ${camp.campStatus}`, pointsSpent: 0, remainingPoints: camp.remainingPoints, buffApplied: false, guardEstablished: false };
  }
  const activity = getCampActivity(activityId);
  if (!activity) {
    return { ok: false, reason: `unknown activity ${activityId}`, pointsSpent: 0, remainingPoints: camp.remainingPoints, buffApplied: false, guardEstablished: false };
  }
  if (camp.remainingPoints < activity.cost) {
    return { ok: false, reason: `not enough camp points (need ${activity.cost})`, pointsSpent: 0, remainingPoints: camp.remainingPoints, buffApplied: false, guardEstablished: false };
  }

  // 应用 effects
  applyActivityEffects(expedition, party, inventory, activity, targetHeroId);

  // 扣点
  camp.remainingPoints -= activity.cost;
  camp.selectedActivityIds.push(activityId);

  // 守夜
  if (activity.tags.includes('guard')) {
    camp.guardEstablished = true;
  }

  const buffApplied = activity.tags.includes('buff');

  if (camp.remainingPoints > 0) {
    camp.availableActivityIds = generateActivityOptions(camp, party);
  } else {
    camp.availableActivityIds = [];
  }

  return {
    ok: true,
    pointsSpent: activity.cost,
    remainingPoints: camp.remainingPoints,
    buffApplied,
    guardEstablished: camp.guardEstablished,
  };
}

function applyActivityEffects(
  expedition: ExpeditionState,
  party: Record<string, HeroInstance>,
  inventory: InventoryState,
  activity: CampActivityDef,
  targetHeroId: string | null,
): void {
  for (const effect of activity.effects) {
    switch (effect.kind) {
      case 'heal-flat': {
        const targets = pickTargets(party, activity.target, targetHeroId, effect.heroSelector ?? 'all-alive');
        const amount = effect.amount ?? 0;
        for (const t of targets) t.hp = Math.min(t.maxHp, t.hp + amount);
        break;
      }
      case 'hp-delta': {
        const targets = pickTargets(party, activity.target, targetHeroId, effect.heroSelector ?? 'all-alive');
        const amount = effect.amount ?? 0;
        for (const t of targets) t.hp = Math.max(0, t.hp - amount);
        break;
      }
      case 'apply-stress': {
        const targets = pickTargets(party, activity.target, targetHeroId, effect.heroSelector ?? 'all-alive');
        const amount = effect.amount ?? 0;
        for (const t of targets) t.stress = Math.max(0, Math.min(200, t.stress + amount));
        break;
      }
      case 'torch-delta': {
        if (effect.amount) expedition.torch = Math.max(0, Math.min(100, expedition.torch + effect.amount));
        break;
      }
      case 'food-delta':
      case 'item-delta': {
        if (effect.itemId === ITEM_FOOD) {
          const amount = effect.count ?? 0;
          if (amount > 0) giveInventory(inventory, ITEM_FOOD, amount);
          else if (amount < 0) consumeInventory(inventory, ITEM_FOOD, -amount);
        }
        break;
      }
      default:
        break;
    }
  }

  // Buff 标签: 直接给 expeditionBuffs 注入
  if (activity.tags.includes('scout')) {
    addBuff(expedition, {
      id: `camp-scout-${activity.id}`,
      sourceId: activity.id,
      sourceLabel: activity.name,
      tag: 'scout-bonus',
      remainingNodes: 3,
      magnitude: 0.5,
    });
  }
  if (activity.tags.includes('disease-ward')) {
    addBuff(expedition, {
      id: `camp-disease-ward-${activity.id}`,
      sourceId: activity.id,
      sourceLabel: activity.name,
      tag: 'disease-ward',
      expiresAtExpeditionEnd: true,
      magnitude: 1,
    });
  }
  if (activity.id === 'camp_steady_formation') {
    addBuff(expedition, {
      id: `camp-formation-${activity.id}`,
      sourceId: activity.id,
      sourceLabel: activity.name,
      tag: 'formation-steady',
      remainingEncounters: 2,
      magnitude: 1,
    });
  }
  if (activity.id === 'camp_preserve_provisions') {
    addBuff(expedition, {
      id: `camp-torch-saver-${activity.id}`,
      sourceId: activity.id,
      sourceLabel: activity.name,
      tag: 'torch-saver',
      remainingNodes: 5,
      magnitude: 1,
    });
  }
  if (activity.id === 'camp_bless_arms') {
    addBuff(expedition, {
      id: `camp-hit-${activity.id}`,
      sourceId: activity.id,
      sourceLabel: activity.name,
      tag: 'next-hit-bonus',
      remainingEncounters: 1,
      magnitude: 0.1,
    });
  }
}

function pickTargets(
  party: Record<string, HeroInstance>,
  activityTarget: CampActivityDef['target'],
  specificHeroId: string | null,
  selector: 'specific' | 'lowest-hp' | 'highest-hp' | 'all-alive' | 'front-rank' | 'back-rank',
): HeroInstance[] {
  const alive = Object.values(party).filter((h) => !h.isDead);
  if (specificHeroId) {
    const h = party[specificHeroId];
    return h && !h.isDead ? [h] : [];
  }
  if (activityTarget === 'all') {
    if (selector === 'lowest-hp' && alive.length > 0) {
      return [alive.reduce((a, b) => (a.hp < b.hp ? a : b))];
    }
    return alive;
  }
  if (activityTarget === 'self' || activityTarget === 'choice') {
    return alive.length > 0 ? [alive[0]!] : [];
  }
  return alive;
}

// =====================================================================
// Buff 注入与衰减
// =====================================================================

/** 加 buff(自动去重) */
export function addBuff(expedition: ExpeditionState, buff: ExpeditionBuff): void {
  if (!expedition.expeditionBuffs) expedition.expeditionBuffs = [];
  const existing = expedition.expeditionBuffs.find((b) => b.id === buff.id);
  if (existing) return;
  expedition.expeditionBuffs.push(buff);
}

/** 节点推进时调用,减少 remainingNodes */
export function tickBuffsOnNodeAdvance(expedition: ExpeditionState): void {
  if (!expedition.expeditionBuffs) return;
  expedition.expeditionBuffs = expedition.expeditionBuffs.filter((b) => {
    if (b.remainingNodes === undefined) return true;
    const next = b.remainingNodes - 1;
    b.remainingNodes = next;
    return next > 0;
  });
}

/** 遭遇结算后调用,减少 remainingEncounters */
export function tickBuffsOnEncounterEnd(expedition: ExpeditionState): void {
  if (!expedition.expeditionBuffs) return;
  expedition.expeditionBuffs = expedition.expeditionBuffs.filter((b) => {
    if (b.remainingEncounters === undefined) return true;
    const next = b.remainingEncounters - 1;
    b.remainingEncounters = next;
    return next > 0;
  });
}

/** 取所有有效 buff */
export function activeBuffs(expedition: ExpeditionState): ExpeditionBuff[] {
  return expedition.expeditionBuffs ?? [];
}

/** 移除指定 buff */
export function removeBuff(expedition: ExpeditionState, buffId: string): boolean {
  if (!expedition.expeditionBuffs) return false;
  const before = expedition.expeditionBuffs.length;
  expedition.expeditionBuffs = expedition.expeditionBuffs.filter((b) => b.id !== buffId);
  return expedition.expeditionBuffs.length < before;
}

// =====================================================================
// 夜袭检定 (SPEC §13, 用 seeded RNG,刷新不重抽)
// =====================================================================

export interface NightAmbushCheckInput {
  rngState: RngState;
  baseChance: number;
  guardEstablished: boolean;
  torchValue: number;
  hasScoutBuff: boolean;
  regionDanger: number;
}

export interface NightAmbushCheckResult {
  triggered: boolean;
  guarded: boolean;
  outcome: NightAmbushOutcome;
  newRngState: RngState;
}

/** 检定夜袭 */
export function checkNightAmbush(input: NightAmbushCheckInput): NightAmbushCheckResult {
  if (input.guardEstablished) {
    return {
      triggered: false,
      guarded: true,
      outcome: 'safe',
      newRngState: input.rngState,
    };
  }

  let chance = input.baseChance;
  if (input.torchValue < 25) chance += 0.15;
  if (input.hasScoutBuff) chance -= 0.2;
  chance += input.regionDanger * 0.2;
  chance = Math.max(0, Math.min(1, chance));

  const rng = new Mulberry32(input.rngState.state);
  const roll = rng.nextFloat();
  const triggered = roll < chance;
  rng.nextFloat();

  if (!triggered) {
    return {
      triggered: false,
      guarded: false,
      outcome: 'safe',
      newRngState: rng.state,
    };
  }

  const outcomeRoll = rng.nextFloat();
  let outcome: NightAmbushOutcome;
  if (outcomeRoll < 0.3) outcome = 'stressed';
  else if (outcomeRoll < 0.5) outcome = 'torch-lost';
  else if (outcomeRoll < 0.65) outcome = 'food-lost';
  else if (outcomeRoll < 0.78) outcome = 'formation-broken';
  else if (outcomeRoll < 0.88) outcome = 'diseased';
  else if (outcomeRoll < 0.95) outcome = 'partial-buff-lost';
  else outcome = 'ambush-encounter';
  rng.nextFloat();

  return {
    triggered: true,
    guarded: false,
    outcome,
    newRngState: rng.state,
  };
}

/** 应用夜袭结果到 expedition / party */
export function applyNightAmbushResult(
  expedition: ExpeditionState,
  party: Record<string, HeroInstance>,
  inventory: InventoryState,
  result: NightAmbushResult,
): void {
  if (!result.guarded) {
    const eff = result.effects;
    if (eff.stressDelta) {
      for (const hero of Object.values(party)) {
        if (hero.isDead) continue;
        hero.stress = Math.max(0, Math.min(200, hero.stress + eff.stressDelta));
      }
    }
    if (eff.torchLost) {
      expedition.torch = Math.max(0, expedition.torch - eff.torchLost);
    }
    if (eff.foodLost) {
      consumeInventory(inventory, ITEM_FOOD, eff.foodLost);
    }
    if (eff.diseaseId) {
      const alive = Object.values(party).filter((h) => !h.isDead);
      if (alive.length > 0) {
        const target = alive[0]!;
        if (!target.diseaseIds) target.diseaseIds = [];
        if (!target.diseaseIds.includes(eff.diseaseId)) {
          target.diseaseIds.push(eff.diseaseId);
        }
      }
    }
    if (eff.buffsLost) {
      for (const id of eff.buffsLost) removeBuff(expedition, id);
    }
  }
  if (expedition.campState) {
    expedition.campState.nightAmbushResult = result;
    expedition.campState.campStatus = 'completed';
  }
}

// =====================================================================
// 完成露营
// =====================================================================

export interface FinishCampResult {
  ok: boolean;
  reason?: string;
  buffsActive: number;
}

/** 完成露营 */
export function finishCamp(expedition: ExpeditionState): FinishCampResult {
  if (!expedition.campState) {
    return { ok: false, reason: 'no camp state', buffsActive: 0 };
  }
  if (expedition.campState.campStatus === 'completed') {
    return { ok: false, reason: 'camp already completed', buffsActive: (expedition.expeditionBuffs ?? []).length };
  }
  expedition.campState.campStatus = 'completed';
  expedition.campUsed = true;
  return {
    ok: true,
    buffsActive: (expedition.expeditionBuffs ?? []).length,
  };
}

// =====================================================================
// 工具
// =====================================================================

export function emptyCampState(_unused: number): CampState {
  void _unused;
  return {
    totalPoints: CAMP_BASE_POINTS,
    remainingPoints: CAMP_BASE_POINTS,
    selectedActivityIds: [],
    guardEstablished: false,
    campStatus: 'food-choice',
    foodChoiceId: null,
    nightAmbushResult: null,
    startedAtDepth: 0,
    availableActivityIds: [],
  };
}

export function makeTorchState(value: number): TorchState {
  return { value, level: torchLevel(value) };
}

// =====================================================================
// 库存 helper(露营用)
// =====================================================================

/** 读 inventory 物品总数(无堆叠则返回 0) */
export function countInventory(inventory: InventoryState, itemId: ItemId): number {
  let total = 0;
  for (const stack of inventory.stacks) {
    if (stack.itemId === itemId) total += stack.count;
  }
  return total;
}

/** 消耗 inventory 物品 */
export function consumeInventory(inventory: InventoryState, itemId: ItemId, amount: number): number {
  let remaining = amount;
  for (const stack of inventory.stacks) {
    if (stack.itemId !== itemId) continue;
    if (stack.count <= remaining) {
      remaining -= stack.count;
      stack.count = 0;
    } else {
      stack.count -= remaining;
      remaining = 0;
      break;
    }
  }
  inventory.stacks = inventory.stacks.filter((s) => s.count > 0);
  return amount - remaining;
}

/** 给 inventory 物品 */
export function giveInventory(inventory: InventoryState, itemId: ItemId, amount: number): number {
  // 简化:加新堆叠
  inventory.stacks.push({
    id: `stack-${itemId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    itemId,
    count: amount,
  });
  return amount;
}
