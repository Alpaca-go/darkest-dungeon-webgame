/**
 * Phase 3 战役 / 庄园类型(SPEC §4 §6 §15 §17 §22)
 *
 * - CampaignState:跨周持久化的战役状态
 * - HamletState:庄园内 session 状态(本周概况、招募、任务、组队、补给)
 * - HeroActivityState:英雄可用性(SPEC §6.2)
 * - FacilityState / FacilityAssignment / HeirloomWallet
 * - RecruitCandidate / QuestDefinition / WeeklyNotice
 * - HamletDecisionType / HamletChoice
 *
 * 注:HeroInstance 的扩展字段(resolveLevel / xp / weaponLevel / armorLevel / skillLevels
 * / activityState / assignedFacilityId / activityWeeksRemaining / expeditionCount / ...)
 * 加在 expedition/types.ts,不在这里重复。
 */

import type { ItemId } from '../expedition/types.js';

// =====================================================================
// 英雄活动状态(SPEC §6.2)
// =====================================================================

export type HeroActivityState =
  | 'available'
  | 'selected-for-party'
  | 'stress-treatment'
  | 'medical-treatment'
  | 'training'
  | 'missing'
  | 'dead';

// =====================================================================
// 战役状态(SPEC §4.2)
// =====================================================================

export interface HeirloomWallet {
  portraits: number;
  crests: number;
}

export type CampaignStatus = 'active' | 'victory' | 'failed' | 'abandoned';

export interface CampaignState {
  id: string;
  seed: string;
  week: number;
  gold: number;
  heirlooms: HeirloomWallet;
  /** 名册容量(可升级马车提升) */
  rosterCapacity: number;
  /** 在册英雄 id 列表(不含死亡) */
  rosterHeroIds: string[];
  /** 死亡英雄 id 列表 */
  deadHeroIds: string[];
  /** 已完成的任务 id(本周内完成) */
  completedQuestIds: string[];
  /** 当前可领取的任务 id 列表 */
  availableQuestIds: string[];
  /** 马车候选 id 列表 */
  availableRecruitIds: string[];
  /** 设施状态(按设施 id) */
  facilityStates: Record<string, FacilityState>;
  status: CampaignStatus;
}

// =====================================================================
// 庄园状态(SPEC §22 §23)
// =====================================================================

export type HamletMode =
  | 'weekly-summary'
  | 'roster'
  | 'treatment'
  | 'recruitment'
  | 'upgrades'
  | 'graveyard'
  | 'quest-selection'
  | 'party-formation'
  | 'provisioning';

export interface HamletState {
  mode: HamletMode;
  /** 马车候选 */
  recruitCandidates: RecruitCandidate[];
  /** 本周任务 id 列表 */
  weeklyQuestIds: string[];
  /** 任务定义字典(weeklyQuestIds -> QuestDefinition) */
  weeklyQuestDefs: Record<string, QuestDefinition>;
  /** 选中的任务(开始远征前) */
  selectedQuestId: string | null;
  /** 选中的远征队伍 hero ids(最多 4) */
  selectedPartyHeroIds: string[];
  /** 补给购物车(按 itemId) */
  provisionCart: Record<string, number>;
  /** 本周提示(3-5 条,按优先级排序) */
  weeklyNotices: WeeklyNotice[];
}

// =====================================================================
// 设施(SPEC §15)
// =====================================================================

export type FacilityId = 'wagon' | 'tavern' | 'abbey' | 'sanitarium' | 'guild' | 'blacksmith' | 'provision-shop';

export type FacilityServiceId = 'recruit' | 'stress-tavern' | 'stress-abbey' | 'quirk-removal' | 'disease-treatment' | 'skill-upgrade' | 'weapon-upgrade' | 'armor-upgrade' | 'provision-buy' | 'facility-upgrade';

export interface FacilityAssignment {
  heroId: string;
  serviceId: FacilityServiceId;
  weeksRemaining: number;
  transactionId: string;
  /** 治疗/刷新结果用的 seed state(用于结果可复现) */
  resultSeedState: string;
}

export interface FacilityUpgradeDefinition {
  id: string;
  title: string;
  description: string;
  goldCost: number;
  heirloomCost?: Partial<HeirloomWallet>;
  effect: string;
}

export interface FacilityState {
  id: FacilityId;
  level: number;
  /** 同时可容纳的 slot 数 */
  slotCount: number;
  /** 当前占用 */
  occupiedSlots: FacilityAssignment[];
  /** 升级选项(可空) */
  upgradeOptions: FacilityUpgradeDefinition[];
}

// =====================================================================
// 马车候选(SPEC §8)
// =====================================================================

export interface RecruitCandidate {
  id: string;
  name: string;
  archetype: 'crusader' | 'highwayman' | 'vestal' | 'plague_doctor' | 'bounty_hunter' | 'jester';
  /** 初始等级 0-2 */
  level: number;
  /** 初始技能 id 列表 */
  skills: string[];
  /** 初始压力 */
  stress: number;
  /** 1 个正面怪癖 id(Phase 4 接入) */
  positiveQuirkIds: string[];
  /** 1 个负面怪癖 id */
  negativeQuirkIds: string[];
  /** 可选疾病 id(Phase 4 接入) */
  diseaseIds: string[];
  /** 可招募期限(默认 1 周) */
  weeksAvailable: number;
}

// =====================================================================
// 任务(SPEC §17)
// =====================================================================

export type QuestDifficulty = 'safe' | 'standard' | 'high-risk';

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  difficulty: QuestDifficulty;
  /** 节点数量 */
  nodeCount: number;
  /** 威胁类型(单选) */
  threat: 'unholy' | 'beast' | 'human' | 'eldritch';
  /** 推荐职业 tag 列表 */
  recommendedClassTags: string[];
  /** 预期补给消耗 */
  expectedProvisions: Partial<Record<ItemId, number>>;
  /** 奖励 */
  rewards: {
    gold: number;
    portraits: number;
    crests: number;
    heroXp: number;
  };
  /** 失败惩罚(可选) */
  failPenalty?: { goldLost: number; };
  /** 事件倾向(可选) */
  specialEventTendency?: 'curse' | 'traps' | 'starvation' | 'mysteries';
}

// =====================================================================
// 本周提示(SPEC §21)
// =====================================================================

export type WeeklyNoticeType =
  | 'cannot-form-party'
  | 'high-stress'
  | 'facility-completed'
  | 'recruit-opportunity'
  | 'upgrade-opportunity'
  | 'resource-shortage'
  | 'general';

export interface WeeklyNotice {
  id: string;
  type: WeeklyNoticeType;
  priority: number; // 数字越大越靠前
  message: string;
  /** 相关 hero / quest / facility id */
  relatedId?: string;
}

// =====================================================================
// 庄园决策(SPEC §22.1)
// =====================================================================

export type HamletDecisionType =
  | 'weekly-overview'
  | 'stress-treatment'
  | 'medical-treatment'
  | 'recruitment'
  | 'hero-upgrade'
  | 'facility-upgrade'
  | 'quest-selection'
  | 'party-formation'
  | 'provisioning'
  | 'dismiss-hero';

export interface HamletChoice {
  id: string;
  title: string;
  description: string;
  heroId?: string;
  facilityId?: FacilityId;
  serviceId?: FacilityServiceId;
  enabled: boolean;
  disabledReason?: string;
  goldCost?: number;
  heirloomCost?: Partial<HeirloomWallet>;
  weeksRequired?: number;
  /** 结果预览(文字列表) */
  outcomePreview: string[];
  tags: string[];
  /** 候选 id(招募场景) */
  candidateId?: string;
  /** 任务 id(任务选择场景) */
  questId?: string;
  /** 物品 id(补给场景) */
  itemId?: ItemId;
  /** 技能 id(升级场景) */
  skillId?: string;
  /** 升级槽(weapon / armor / skill) */
  upgradeSlot?: 'weapon' | 'armor' | 'skill';
  /** 数量 */
  count?: number;
}

// =====================================================================
// 初始常量(SPEC §29)
// =====================================================================

export const INITIAL_GOLD = 8000;
export const INITIAL_PORTRAITS = 6;
export const INITIAL_CRESTS = 12;
export const INITIAL_ROSTER_CAPACITY = 8;
export const INITIAL_RECRUIT_COUNT = 3;
export const INITIAL_QUESTS_PER_WEEK = 3;

// 设施初始状态(SPEC §15)
export const INITIAL_FACILITY_STATES: Record<FacilityId, FacilityState> = {
  wagon: {
    id: 'wagon',
    level: 1,
    slotCount: 1, // 招募无 slot 占用
    occupiedSlots: [],
    upgradeOptions: [],
  },
  tavern: {
    id: 'tavern',
    level: 1,
    slotCount: 1,
    occupiedSlots: [],
    upgradeOptions: [
      { id: 'tavern.lvl2', title: '酒馆扩建', description: '名额 +1,最低减压 +5', goldCost: 1200, effect: 'slotCount+1;minRelief+5' },
    ],
  },
  abbey: {
    id: 'abbey',
    level: 1,
    slotCount: 1,
    occupiedSlots: [],
    upgradeOptions: [
      { id: 'abbey.lvl2', title: '修道院扩建', description: '名额 +1,最低减压 +5', goldCost: 1500, effect: 'slotCount+1;minRelief+5' },
    ],
  },
  sanitarium: {
    id: 'sanitarium',
    level: 1,
    slotCount: 1,
    occupiedSlots: [],
    upgradeOptions: [
      { id: 'sanitarium.lvl2', title: '疗养院扩建', description: '名额 +1,治疗费用 -20%', goldCost: 1000, effect: 'slotCount+1;costReduction+20%' },
    ],
  },
  guild: {
    id: 'guild',
    level: 1,
    slotCount: 1,
    occupiedSlots: [],
    upgradeOptions: [
      { id: 'guild.lvl2', title: '公会升级', description: '解锁技能等级 2', goldCost: 1500, effect: 'maxSkillLevel=2' },
    ],
  },
  blacksmith: {
    id: 'blacksmith',
    level: 1,
    slotCount: 1,
    occupiedSlots: [],
    upgradeOptions: [
      { id: 'blacksmith.lvl2', title: '铁匠铺升级', description: '解锁武器/护甲等级 2', goldCost: 1500, effect: 'maxWeaponLevel=2;maxArmorLevel=2' },
    ],
  },
  'provision-shop': {
    id: 'provision-shop',
    level: 1,
    slotCount: 1,
    occupiedSlots: [],
    upgradeOptions: [
      { id: 'shop.lvl2', title: '商店升级', description: '补给价格 -15%', goldCost: 800, effect: 'priceReduction+15%' },
    ],
  },
};
