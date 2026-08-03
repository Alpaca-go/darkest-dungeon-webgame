/**
 * 露营系统类型(Phase 4 P4.4)
 *
 * 设计目标:
 *  - 中型远征允许中途露营 1 次(默认,可配置)
 *  - 露营流程: 食物选择 → 露营点数 → 活动选择(2-4 个)→ 夜袭检定 → 持续 Buff
 *  - 4 种食物 + 8 通用活动 + 12 职业活动(SPEC §11/§12)
 *  - Buff 系统(SPEC §14)持续到 encounter 结束或 N 节点
 *  - 夜袭检定(SPEC §13)用 seeded RNG,刷新后不重抽
 *
 * 状态持久化:
 *  - ExpeditionState.campUsed: true 表示本远征已露营过
 *  - ExpeditionState.campState: 当前露营状态
 *  - ExpeditionState.expeditionBuffs: 露营 + 奇物产生的持续 Buff
 */

import type { RuleEffect } from '../expedition/types.js';

// =====================================================================
// 食物选择 (SPEC §11.2)
// =====================================================================

export type CampFoodChoiceId = 'feast' | 'normal' | 'frugal' | 'none';

export interface CampFoodChoice {
  id: CampFoodChoiceId;
  name: string;
  description: string;
  /** 食物消耗(正数) */
  foodCost: number;
  /** 全队压力变化(负=减压) */
  partyStressDelta: number;
  /** 全队 HP 治疗(>0) */
  partyHealFlat: number;
  /** 全队 HP 伤害(>0) */
  partyHpDamage: number;
  /** 露营点数增量(可选) */
  bonusCampPoints?: number;
  /** 描述风险提示 */
  riskHint: string;
}

export const CAMP_FOOD_CHOICES: Record<CampFoodChoiceId, CampFoodChoice> = {
  feast: {
    id: 'feast',
    name: '丰盛进食',
    description: '让队伍充分休息,士气大振',
    foodCost: 8,
    partyStressDelta: -15,
    partyHealFlat: 5,
    partyHpDamage: 0,
    bonusCampPoints: 2,
    riskHint: '食物消耗极大,适合补给充足时使用',
  },
  normal: {
    id: 'normal',
    name: '普通进食',
    description: '简单恢复,平衡选择',
    foodCost: 4,
    partyStressDelta: -5,
    partyHealFlat: 2,
    partyHpDamage: 0,
    riskHint: '标准选择,适合大多数情况',
  },
  frugal: {
    id: 'frugal',
    name: '节省进食',
    description: '克扣口粮,勉强果腹',
    foodCost: 2,
    partyStressDelta: 5,
    partyHealFlat: 1,
    partyHpDamage: 0,
    riskHint: '压力会增加,食物不足时使用',
  },
  none: {
    id: 'none',
    name: '不进食',
    description: '放弃休息,保持警觉但饥饿难耐',
    foodCost: 0,
    partyStressDelta: 15,
    partyHealFlat: 0,
    partyHpDamage: 3,
    riskHint: '极端选择,会受伤并加压力',
  },
};

// =====================================================================
// 露营活动 (SPEC §12)
// =====================================================================

export type CampActivityCategory =
  | 'universal'         // 通用(SPEC §12.2)
  | 'crusader'          // 十字军(SPEC §12.3)
  | 'highwayman'        // 强盗
  | 'vestal'            // 修女
  | 'plague_doctor';    // 瘟疫医生

export type CampActivityTag =
  | 'guard'             // 守夜(防夜袭)
  | 'heal'              // 治疗
  | 'stress-relief'     // 压力缓解
  | 'scout'             // 侦察
  | 'buff'              // 持续 Buff
  | 'supply'            // 补给
  | 'disease-prevent'   // 疾病预防
  | 'disease-ward'      // 疾病抗性 buff
  | 'flavor';           // 风味/无效果

export interface CampActivityDef {
  id: string;
  name: string;
  description: string;
  category: CampActivityCategory;
  /** 露营点数消耗 */
  cost: number;
  tags: CampActivityTag[];
  /** 触发的 RuleEffect 列表(交给 dispatcher 执行) */
  effects: RuleEffect[];
  /** 适用目标:'all' / 'self' / 'ally' / 'lowest-hp' / 'highest-stress' */
  target: 'all' | 'self' | 'ally' | 'lowest-hp' | 'highest-stress' | 'choice';
}

// =====================================================================
// 露营点数 + Buff (SPEC §11.3, §14)
// =====================================================================

export const CAMP_BASE_POINTS = 12;

export type CampStatus =
  | 'food-choice'           // 等玩家选食物
  | 'activity-choice'       // 等玩家选活动
  | 'night-resolution'      // 夜袭结算中
  | 'completed';            // 露营完成

export interface CampState {
  /** 总点数(基础 + 食物加成 - 已消耗) */
  totalPoints: number;
  /** 剩余点数 */
  remainingPoints: number;
  /** 已选活动 id 列表 */
  selectedActivityIds: string[];
  /** 是否建立了守夜(防夜袭) */
  guardEstablished: boolean;
  /** 当前状态 */
  campStatus: CampStatus;
  /** 食物选择 id(已选后) */
  foodChoiceId: CampFoodChoiceId | null;
  /** 夜袭结果(null 表示未触发) */
  nightAmbushResult: NightAmbushResult | null;
  /** 露营开始时的 depth(用于 buff 计时) */
  startedAtDepth: number;
  /** 已生成的可用活动 id 列表(本轮) */
  availableActivityIds: string[];
}

export type ExpeditionBuffTag =
  | 'scout-bonus'           // 侦察提高
  | 'stress-shield'         // 压力吸收
  | 'torch-saver'           // 火把节省
  | 'trap-sense'            // 陷阱侦察
  | 'disease-ward'          // 防一次疾病
  | 'night-guard'           // 免疫夜袭(本露营)
  | 'next-hit-bonus'        // 下一场遭遇命中提高
  | 'formation-steady'      // 阵型稳定
  | 'heal-boost';           // 治疗增强

export interface ExpeditionBuff {
  id: string;
  sourceId: string;
  sourceLabel: string;
  tag: ExpeditionBuffTag;
  /** 剩余节点数(0 表示立即失效) */
  remainingNodes?: number;
  /** 剩余遭遇数 */
  remainingEncounters?: number;
  /** 本远征结束失效 */
  expiresAtExpeditionEnd?: boolean;
  /** 修饰符数值(用于 buff 数值计算) */
  magnitude: number;
}

export type NightAmbushOutcome =
  | 'safe'                  // 安全度过
  | 'stressed'              // 压力增加
  | 'torch-lost'            // 火把下降
  | 'food-lost'             // 食物丢失
  | 'formation-broken'      // 阵型混乱
  | 'diseased'              // 感染疾病
  | 'partial-buff-lost'     // 部分 Buff 失效
  | 'ambush-encounter';     // 触发伏击遭遇(后续 P5 实现)

export interface NightAmbushResult {
  outcome: NightAmbushOutcome;
  /** 各 outcome 触发的效果(已由 dispatcher 应用的,记录在案) */
  effects: {
    stressDelta?: number;
    torchLost?: number;
    foodLost?: number;
    diseaseId?: string;
    buffsLost?: string[];
  };
  narrative: string;
  /** 是否被守夜阻止(若是,outcome = 'safe' 且 guarded = true) */
  guarded: boolean;
}

// =====================================================================
// 露营配置 (中型任务默认 1 次,SPEC §11.1)
// =====================================================================

export interface CampConfig {
  /** 本远征允许露营次数(默认 1) */
  maxCampUses: number;
  /** 基础露营点数(SPEC §11.3 = 12) */
  basePoints: number;
  /** 夜袭基础概率(0-1,默认 0.35) */
  baseAmbushChance: number;
}

export const DEFAULT_CAMP_CONFIG: CampConfig = {
  maxCampUses: 1,
  basePoints: CAMP_BASE_POINTS,
  baseAmbushChance: 0.35,
};

// =====================================================================
// 露营节点 (用于路线生成时标记)
// =====================================================================

export interface CampNode {
  id: string;
  name: string;
  description: string;
  /** 触发条件: depth >= ... */
  minDepth: number;
}
