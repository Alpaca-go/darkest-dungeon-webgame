/**
 * 区域 manager(Phase 5)
 *
 * 区域进度管理 + 任务生成 + 路线生成 + 区域发现
 */

import { Mulberry32 } from '../rng/index.js';
import type { RngState } from '../rng/types.js';
import type {
  RegionId,
  RegionProgress,
  RegionDiscoveryState,
  GeneratedQuest,
  GeneratedRouteStats,
  RouteGenerationContext,
} from './types.js';
import {
  REGION_ENEMIES,
  REGION_LOOT_TABLES,
  QUEST_MODIFIERS,
  getRegionDefinition,
  getQuestModifier,
  getQuestObjectiveDef,
} from './registry.js';
import { REGION_XP_TABLE, REGION_MAX_LEVEL } from './types.js';
export { REGION_XP_TABLE, REGION_MAX_LEVEL };

// =====================================================================
// 区域进度
// =====================================================================

export function emptyRegionProgress(regionId: RegionId): RegionProgress {
  return {
    regionId,
    level: 0,
    experience: 0,
    completedQuestCount: 0,
    failedQuestCount: 0,
    retreatCount: 0,
    unlockedQuestTypeIds: [],
    discoveredContentIds: [],
    unlockedEliteEncounterIds: [],
    unlockedRareLootIds: [],
    bossQuestReady: false,
  };
}

export function emptyRegionDiscovery(): RegionDiscoveryState {
  return {
    discoveredEnemyIds: [],
    discoveredCurioIds: [],
    discoveredTrapIds: [],
    discoveredDiseaseIds: [],
    discoveredTrinketIds: [],
  };
}

export interface GrantRegionXpResult {
  ok: boolean;
  reason?: string;
  newLevel: number;
  oldLevel: number;
  leveledUp: boolean;
  bossReady: boolean;
  unlockedEliteIds: string[];
  unlockedRareLootIds: string[];
}

/** 增加区域经验,可能触发升级 */
export function grantRegionExperience(
  progress: RegionProgress,
  amount: number,
): GrantRegionXpResult {
  if (amount <= 0) {
    return {
      ok: false,
      reason: 'amount must be positive',
      newLevel: progress.level,
      oldLevel: progress.level,
      leveledUp: false,
      bossReady: progress.bossQuestReady,
      unlockedEliteIds: [],
      unlockedRareLootIds: [],
    };
  }
  const oldLevel = progress.level;
  progress.experience = Math.max(0, progress.experience + amount);
  const newLevel = levelFromXp(progress.experience);
  progress.level = newLevel;
  const leveledUp = newLevel > oldLevel;
  const unlockedEliteIds: string[] = [];
  const unlockedRareLootIds: string[] = [];
  if (leveledUp) {
    // 解锁精英(区域敌人池中 isElite=true 的)
    for (const enemy of REGION_ENEMIES) {
      if (enemy.regionId === progress.regionId && enemy.isElite && newLevel >= 1) {
        if (!progress.unlockedEliteEncounterIds.includes(enemy.id)) {
          progress.unlockedEliteEncounterIds.push(enemy.id);
          unlockedEliteIds.push(enemy.id);
        }
      }
    }
    // 解锁稀有饰品
    if (newLevel >= 2) {
      const loot = REGION_LOOT_TABLES[progress.regionId];
      const rare = Object.entries(loot.trinketWeights)
        .filter(([id]) => !progress.unlockedRareLootIds.includes(id))
        .map(([id]) => id);
      for (const id of rare) {
        progress.unlockedRareLootIds.push(id);
        unlockedRareLootIds.push(id);
      }
    }
  }
  // Boss 任务接口:等级 4
  const bossReady = newLevel >= REGION_MAX_LEVEL;
  progress.bossQuestReady = bossReady;
  return {
    ok: true,
    newLevel,
    oldLevel,
    leveledUp,
    bossReady,
    unlockedEliteIds,
    unlockedRareLootIds,
  };
}

/** 从 XP 算等级 */
export function levelFromXp(xp: number): number {
  let level = 0;
  for (let i = 0; i < REGION_XP_TABLE.length; i++) {
    if (xp >= REGION_XP_TABLE[i]!) level = i;
  }
  return Math.min(level, REGION_MAX_LEVEL);
}

/** 下一级所需 XP */
export function xpToNextLevel(currentXp: number): number {
  const lvl = levelFromXp(currentXp);
  if (lvl >= REGION_MAX_LEVEL) return 0;
  return Math.max(0, REGION_XP_TABLE[lvl + 1]! - currentXp);
}

// =====================================================================
// 区域发现
// =====================================================================

export type DiscoveryResult = {
  newlyDiscovered: string[];
};

/** 标记发现某内容(自动去重) */
export function markDiscovered(
  discovery: RegionDiscoveryState,
  contentType: 'enemy' | 'curio' | 'trap' | 'disease' | 'trinket',
  contentId: string,
): DiscoveryResult {
  const key = (
    contentType === 'enemy' ? 'discoveredEnemyIds' :
    contentType === 'curio' ? 'discoveredCurioIds' :
    contentType === 'trap' ? 'discoveredTrapIds' :
    contentType === 'disease' ? 'discoveredDiseaseIds' :
    'discoveredTrinketIds'
  ) as keyof RegionDiscoveryState;
  const list = discovery[key] as string[];
  if (list.includes(contentId)) return { newlyDiscovered: [] };
  list.push(contentId);
  return { newlyDiscovered: [contentId] };
}

// =====================================================================
// 路线生成器
// =====================================================================

/** 遗迹路线生成器 - 长直走廊, 较少分叉 */
export function generateRuinsRoute(ctx: RouteGenerationContext, rng: Mulberry32): GeneratedRouteStats {
  const targetNodes = ctx.questLength === 'short' ? 8 : 12;
  const branchCount = Math.min(3, Math.floor(rng.nextFloat() * 2));
  const hiddenNodeCount = 0;
  const campNodeCount = ctx.questLength === 'short' ? 0 : 1;
  const eliteNodeCount = Math.floor(rng.nextFloat() * 2) + 1;
  const objectiveNodeIds: string[] = [];
  const exitNodeIds: string[] = [];
  for (let i = 0; i < Math.max(1, Math.floor(targetNodes / 4)); i++) {
    objectiveNodeIds.push(`obj-${i}`);
  }
  exitNodeIds.push('exit-1');
  return {
    nodeCount: targetNodes,
    branchCount,
    hiddenNodeCount,
    campNodeCount,
    eliteNodeCount,
    objectiveNodeIds,
    exitNodeIds,
  };
}

/** 腐败林地路线生成器 - 分叉多, 隐藏节点多 */
export function generateWoodsRoute(ctx: RouteGenerationContext, rng: Mulberry32): GeneratedRouteStats {
  const targetNodes = ctx.questLength === 'short' ? 10 : 14;
  const branchCount = 4 + Math.floor(rng.nextFloat() * 3); // 4-6
  const hiddenNodeCount = 2 + Math.floor(rng.nextFloat() * 2); // 2-3
  const campNodeCount = ctx.questLength === 'short' ? 0 : 1;
  const eliteNodeCount = 1 + Math.floor(rng.nextFloat() * 2);
  const objectiveNodeIds: string[] = [];
  const exitNodeIds: string[] = [];
  for (let i = 0; i < Math.max(1, Math.floor(targetNodes / 4)); i++) {
    objectiveNodeIds.push(`obj-${i}`);
  }
  exitNodeIds.push('exit-1');
  return {
    nodeCount: targetNodes,
    branchCount,
    hiddenNodeCount,
    campNodeCount,
    eliteNodeCount,
    objectiveNodeIds,
    exitNodeIds,
  };
}

/** 地下兽穴路线生成器 - 狭窄, 连续遭遇, 回头成本高 */
export function generateBurrowsRoute(ctx: RouteGenerationContext, rng: Mulberry32): GeneratedRouteStats {
  const targetNodes = ctx.questLength === 'short' ? 9 : 13;
  const branchCount = 1 + Math.floor(rng.nextFloat() * 2); // 1-2
  const hiddenNodeCount = 0;
  const campNodeCount = ctx.questLength === 'short' ? 0 : 1;
  const eliteNodeCount = 2 + Math.floor(rng.nextFloat() * 2); // 连续遭遇
  const objectiveNodeIds: string[] = [];
  const exitNodeIds: string[] = [];
  for (let i = 0; i < Math.max(1, Math.floor(targetNodes / 4)); i++) {
    objectiveNodeIds.push(`obj-${i}`);
  }
  exitNodeIds.push('exit-1', 'exit-2'); // 多重撤退
  return {
    nodeCount: targetNodes,
    branchCount,
    hiddenNodeCount,
    campNodeCount,
    eliteNodeCount,
    objectiveNodeIds,
    exitNodeIds,
  };
}

const ROUTE_GENERATORS: Record<string, (ctx: RouteGenerationContext, rng: Mulberry32) => GeneratedRouteStats> = {
  'ruins-linear': generateRuinsRoute,
  'woods-branching': generateWoodsRoute,
  'burrows-narrow': generateBurrowsRoute,
};

export function generateRegionRoute(
  ctx: RouteGenerationContext,
  rngState: RngState,
): { stats: GeneratedRouteStats; newRngState: RngState } {
  const region = getRegionDefinition(ctx.regionId);
  const gen = ROUTE_GENERATORS[region.routeGeneratorId];
  if (!gen) throw new Error(`unknown route generator ${region.routeGeneratorId}`);
  const rng = new Mulberry32(rngState.state);
  rng.nextFloat(); rng.nextFloat(); // 消耗稳定
  const stats = gen(ctx, rng);
  return { stats, newRngState: rng.state };
}

// =====================================================================
// 任务生成
// =====================================================================

export interface GenerateQuestInput {
  regionId: RegionId;
  questLength: 'short' | 'medium';
  difficulty: number; // 0-1
  partyLevel: number;
  seed: string;
  rngState: RngState;
  /** 该区域当前已用任务(防重复) */
  recentQuestTypeIds?: string[];
  /** 该区域已用修正词 */
  recentModifierIds?: string[];
}

export interface GenerateQuestResult {
  quest: GeneratedQuest;
  newRngState: RngState;
  /** 解释:为什么生成这个 */
  reasons: string[];
}

/** 生成单个区域任务 */
export function generateRegionQuest(input: GenerateQuestInput): GenerateQuestResult {
  const region = getRegionDefinition(input.regionId);
  const rng = new Mulberry32(input.rngState.state);
  const reasons: string[] = [];

  // 1. 选目标类型(从区域允许的池中,避开 recentQuestTypeIds)
  const recent = new Set(input.recentQuestTypeIds ?? []);
  const availableObjectives = region.questObjectivePoolIds.filter((id) => !recent.has(id));
  const objectivePool = availableObjectives.length > 0 ? availableObjectives : region.questObjectivePoolIds;
  const objectiveType = objectivePool[Math.floor(rng.nextFloat() * objectivePool.length)]!;
  reasons.push(`objective=${objectiveType}(from ${objectivePool.length} candidates)`);

  // 2. 选 0-2 个修正词
  const recentMod = new Set(input.recentModifierIds ?? []);
  const allowedMods = QUEST_MODIFIERS.filter(
    (m) => m.allowedRegionIds.length === 0 || m.allowedRegionIds.includes(input.regionId),
  ).filter((m) => !recentMod.has(m.id));
  const modCount = Math.floor(rng.nextFloat() * 3); // 0,1,2
  const modifierIds: string[] = [];
  for (let i = 0; i < modCount; i++) {
    if (allowedMods.length === 0) break;
    const idx = Math.floor(rng.nextFloat() * allowedMods.length);
    const mod = allowedMods[idx]!;
    modifierIds.push(mod.id);
    allowedMods.splice(idx, 1);
    reasons.push(`modifier=${mod.id}`);
  }

  // 3. 算奖励
  const loot = REGION_LOOT_TABLES[input.regionId];
  const modRewardMult = modifierIds.reduce((acc, mid) => {
    const m = getQuestModifier(mid);
    return m ? acc * m.rewardMultiplier : acc;
  }, 1.0);
  const lengthMult = input.questLength === 'medium' ? 1.5 : 1.0;
  const difficultyMult = 1.0 + input.difficulty * 0.5;
  const gold = Math.floor((loot.goldBase + rng.nextFloat() * loot.goldRandom) * modRewardMult * lengthMult * difficultyMult);
  const portraits = Math.floor(loot.heirloomBase.portraits * lengthMult);
  const crests = Math.floor(loot.heirloomBase.crests * lengthMult);
  const heroXp = Math.floor(3 * lengthMult * difficultyMult);
  reasons.push(`reward: gold=${gold}, p=${portraits}, c=${crests}, xp=${heroXp}`);

  // 4. 选饰品(20% 概率)
  let trinketDefId: string | undefined;
  if (rng.nextFloat() < 0.2) {
    const entries = Object.entries(loot.trinketWeights);
    if (entries.length > 0) {
      const total = entries.reduce((acc, [, w]) => acc + w, 0);
      let r = rng.nextFloat() * total;
      for (const [id, w] of entries) {
        r -= w;
        if (r <= 0) {
          trinketDefId = id;
          reasons.push(`trinket=${id}`);
          break;
        }
      }
    }
  }

  // 5. 任务目标数据
  const objDef = getQuestObjectiveDef(objectiveType);
  const objectiveTarget = objDef?.defaultTarget ?? 1;
  if (objectiveType === 'deep') {
    // deep 任务目标 = 节点数
  }

  // 6. 推荐补给
  const recommendedProvisionIds = [...region.recommendedProvisionIds];
  if (modifierIds.includes('qm_disease_outbreak')) {
    recommendedProvisionIds.push('antivenom');
    recommendedProvisionIds.push('bandage');
  }
  if (modifierIds.includes('qm_hungry_terrain')) {
    recommendedProvisionIds.push('food');
  }

  // 7. 区域经验奖励
  const regionExperienceReward = Math.floor(20 * lengthMult * difficultyMult);

  // 8. 路线 seed
  rng.nextFloat();
  const routeSeed = `route-${input.regionId}-${Math.floor(rng.nextFloat() * 0x1000000).toString(16)}`;
  reasons.push(`routeSeed=${routeSeed}`);

  const quest: GeneratedQuest = {
    id: `q-${input.regionId}-${Date.now().toString(36)}-${Math.floor(rng.nextFloat() * 0x1000).toString(16)}`,
    regionId: input.regionId,
    objectiveType,
    length: input.questLength,
    difficulty: input.difficulty,
    routeSeed,
    rewardTableId: loot.id,
    modifierIds,
    recommendedProvisionIds,
    recommendedHeroTags: region.recommendedHeroTags,
    objectiveData: { target: objectiveTarget, type: objectiveType },
    rewardPreview: { gold, portraits, crests, heroXp, trinketDefId },
    regionExperienceReward,
  };

  return { quest, newRngState: rng.state, reasons };
}

// =====================================================================
// 防重复
// =====================================================================

/** 过滤掉最近用过的,保留至少 50% 多样性 */
export function filterForDiversity<T extends { id: string }>(
  items: T[],
  recentIds: string[],
  minKeepRatio: number = 0.5,
): T[] {
  if (items.length === 0) return items;
  const filtered = items.filter((it) => !recentIds.includes(it.id));
  if (filtered.length / items.length >= minKeepRatio) return filtered;
  // 不够多样 → 至少返回前 50%
  return items.slice(0, Math.max(1, Math.floor(items.length * minKeepRatio)));
}
