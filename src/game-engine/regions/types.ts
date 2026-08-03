/**
 * 区域系统类型(Phase 5)
 *
 * 三大区域:
 *  - ruins 遗迹
 *  - corrupted-woods 腐败林地
 *  - underground-burrows 地下兽穴
 *
 * 数据驱动:
 *  - RegionDefinition 完整描述
 *  - RegionProgress 0-4 等级
 *  - RegionDiscoveryState 5 类内容发现
 *  - RegionModifier 应用到规则引擎
 */

import type { RuleEffect } from '../expedition/types.js';

// =====================================================================
// 区域定义
// =====================================================================

export type RegionId = 'ruins' | 'corrupted-woods' | 'underground-burrows';

export type RegionQuestObjectiveType =
  | 'clear'        // 完成指定数量遭遇
  | 'investigate'  // 调查目标奇物
  | 'collect'      // 收集任务物品
  | 'deep'         // 抵达指定深度
  | 'purge'        // 处理多个区域目标
  | 'escort-item'; // 护送物品接口

export type RegionRouteGeneratorId = 'ruins-linear' | 'woods-branching' | 'burrows-narrow';

export type RegionLootTableId = 'ruins-loot' | 'woods-loot' | 'burrows-loot';

export interface RegionDefinition {
  id: RegionId;
  name: string;
  description: string;
  environmentTags: string[];
  routeGeneratorId: RegionRouteGeneratorId;

  // 池
  encounterPoolIds: string[];
  eliteEncounterPoolIds: string[];
  curioPoolIds: string[];
  trapPoolIds: string[];
  diseasePoolIds: string[];
  lootTableId: RegionLootTableId;
  trinketPoolIds: string[];

  // Modifier(可叠加到远征规则)
  torchModifier: number;        // 火把消耗倍率(0.8 = 节省 20%)
  hungerModifier: number;       // 饥饿频率倍率
  ambushModifier: number;       // 夜袭基础概率加成
  stressModifier: number;       // 压力增加倍率
  scoutingModifier: number;     // 侦察收益倍率
  diseaseModifier: number;      // 疾病感染倍率
  supplyModifier: number;       // 推荐补给消费量

  // 推荐
  recommendedProvisionIds: string[];
  recommendedHeroTags: string[];

  // 任务池
  questObjectivePoolIds: RegionQuestObjectiveType[];
  questModifierPoolIds: string[];

  // 露营差异
  campAmbushChanceBonus: number;
  campFoodConsumptionBonus: number;
  campHealingBonus: number;

  // 显示
  iconHint: string;
  dominantThreat: string;
  rewardLean: string;
}

// =====================================================================
// 区域进度
// =====================================================================

export const REGION_MAX_LEVEL = 4;
export const REGION_XP_TABLE: number[] = [0, 25, 60, 110, 180];

export interface RegionProgress {
  regionId: RegionId;
  level: number;          // 0-4
  experience: number;     // 当前累计 XP
  completedQuestCount: number;
  failedQuestCount: number;
  retreatCount: number;
  unlockedQuestTypeIds: string[];
  discoveredContentIds: string[];
  unlockedEliteEncounterIds: string[];
  unlockedRareLootIds: string[];
  bossQuestReady: boolean;
}

// =====================================================================
// 区域发现
// =====================================================================

export type RegionContentType = 'enemy' | 'curio' | 'trap' | 'disease' | 'trinket';

export interface RegionDiscoveryState {
  discoveredEnemyIds: string[];
  discoveredCurioIds: string[];
  discoveredTrapIds: string[];
  discoveredDiseaseIds: string[];
  discoveredTrinketIds: string[];
}

// =====================================================================
// 敌人池
// =====================================================================

export type EnemyArchetype = 'humanoid' | 'beast' | 'undead' | 'eldritch' | 'blight' | 'bleed';

export interface RegionEnemyDef {
  id: string;
  regionId: RegionId | 'global';
  name: string;
  archetype: EnemyArchetype;
  isElite: boolean;
  /** 该敌人主要影响哪种战术选择 */
  tacticalFocus: 'priority-target' | 'control' | 'protect-break' | 'heal-pressure' | 'status-cleanup' | 'formation' | 'retreat' | 'supply-pressure' | 'environment' | 'stress-pressure';
  baseHp: number;
  baseDamage: [number, number]; // [min, max]
  baseAccuracy: number;
  baseCrit: number;
  baseSpeed: number;
  baseDodge: number;
  baseProtection: number;
  baseBleedResist: number;
  baseBlightResist: number;
  baseStunResist: number;
  baseMoveResist: number;
  /** 主要状态攻击(bleed/blight/stun/mark) */
  primaryStatus?: 'bleed' | 'blight' | 'stun' | 'mark';
  /** 0-1 主要状态触发概率(无 primaryStatus 时为 0) */
  statusChance: number;
  description: string;
}

// =====================================================================
// 奇物
// =====================================================================

export interface RegionCurioDef {
  id: string;
  regionId: RegionId;
  name: string;
  description: string;
  tags: string[];
  /** 该奇物可产生的持续区域效果(写入 expedition.regionPersistentEffects) */
  persistentRegionEffects: RuleEffect[];
  /** 0-1 触发持续效果概率 */
  persistentEffectChance: number;
  riskHint: string;
  /** 推荐职业 tag */
  preferredClassTags: string[];
}

// =====================================================================
// 陷阱
// =====================================================================

export interface RegionTrapDef {
  id: string;
  regionId: RegionId;
  name: string;
  description: string;
  /** 主要影响 */
  primaryImpact: 'hp' | 'stress' | 'disease' | 'supply' | 'formation' | 'torch' | 'route' | 'scout';
  /** 0-1 触发基础概率 */
  baseChance: number;
  /** 数值效果范围 [min, max] */
  damageRange?: [number, number];
  stressDelta?: number;
  supplyLoss?: number;
  torchLoss?: number;
  diseaseChance?: number;
  description2: string;
}

// =====================================================================
// 区域疾病权重
// =====================================================================

export interface RegionDiseaseWeight {
  regionId: RegionId;
  /** disease id → 相对权重 */
  weights: Record<string, number>;
  /** 全局感染倍率 */
  globalAcquisitionModifier: number;
}

// =====================================================================
// 区域战利品 / 饰品池
// =====================================================================

export interface RegionLootTable {
  id: RegionLootTableId;
  regionId: RegionId;
  goldBase: number;
  goldRandom: number;
  heirloomBase: { portraits: number; crests: number };
  /** trinket definition id → 权重 */
  trinketWeights: Record<string, number>;
  /** provision itemId → 权重(奖励生成) */
  provisionWeights: Record<string, number>;
}

// =====================================================================
// 任务目标 / 修正词
// =====================================================================

export interface QuestObjectiveDef {
  id: RegionQuestObjectiveType;
  name: string;
  description: string;
  /** 默认需要完成数(对应 clear 计数等) */
  defaultTarget: number;
}

export interface QuestModifierDef {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** 难度倍率 */
  difficultyMultiplier: number;
  /** 奖励倍率 */
  rewardMultiplier: number;
  /** 限制到哪些 region(空=全) */
  allowedRegionIds: RegionId[];
}

// =====================================================================
// 路线生成 Context
// =====================================================================

export interface RouteGenerationContext {
  regionId: RegionId;
  questLength: 'short' | 'medium';
  difficulty: number;
  seed: string;
  partyLevel: number;
  objectiveType: RegionQuestObjectiveType;
  questModifierIds: string[];
}

export interface GeneratedRouteStats {
  nodeCount: number;
  branchCount: number;
  hiddenNodeCount: number;
  campNodeCount: number;
  eliteNodeCount: number;
  objectiveNodeIds: string[];
  exitNodeIds: string[];
}

// =====================================================================
// 任务生成结果
// =====================================================================

export interface GeneratedQuest {
  id: string;
  regionId: RegionId;
  objectiveType: RegionQuestObjectiveType;
  length: 'short' | 'medium';
  difficulty: number;
  routeSeed: string;
  rewardTableId: RegionLootTableId;
  modifierIds: string[];
  recommendedProvisionIds: string[];
  recommendedHeroTags: string[];
  objectiveData: { target: number; type: RegionQuestObjectiveType };
  rewardPreview: {
    gold: number;
    portraits: number;
    crests: number;
    heroXp: number;
    trinketDefId?: string;
  };
  regionExperienceReward: number;
}

// =====================================================================
// 区域远征 modifier 效果(在远征前应用)
// =====================================================================

export interface RegionExpeditionModifiers {
  torchRate: number;
  hungerRate: number;
  ambushRate: number;
  stressRate: number;
  scoutRate: number;
  diseaseRate: number;
  supplyNeed: number;
  /** 远征后是否需要推荐换队 */
  teamSwapRecommended: boolean;
}
