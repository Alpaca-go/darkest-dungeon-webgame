/**
 * 区域注册表(Phase 5)
 *
 * - 3 区域定义
 * - 12 普通 + 6 精英敌人(4 + 2 普通/精英, +4+2 遗迹)
 * - 12 奇物(4/区域)
 * - 9 陷阱(3/区域)
 * - 3 区域疾病权重
 * - 3 区域战利品表
 * - 12 任务修正词
 */

import type {
  RegionDefinition,
  RegionCurioDef,
  RegionTrapDef,
  RegionDiseaseWeight,
  RegionLootTable,
  QuestModifierDef,
  RegionEnemyDef,
  QuestObjectiveDef,
  RegionExpeditionModifiers,
  RegionId,
} from './types.js';

// =====================================================================
// 3 区域定义
// =====================================================================

export const REGION_DEFINITIONS: Record<RegionId, RegionDefinition> = {
  ruins: {
    id: 'ruins',
    name: '遗迹',
    description: '古老墓穴与地下教堂,亡灵与亡灵法术遍行。路线相对规整,分叉少。',
    environmentTags: ['ruins', 'holy', 'undead', 'stress', 'scouting'],
    routeGeneratorId: 'ruins-linear',
    encounterPoolIds: ['e_ruins_skeleton', 'e_ruins_ghost', 'e_ruins_cultist', 'e_ruins_bone_soldier'],
    eliteEncounterPoolIds: ['e_ruins_abbots_ghost', 'e_ruins_bone_construct'],
    curioPoolIds: ['c_ruins_altar', 'c_ruins_sarcophagus', 'c_ruins_armor', 'c_ruins_statue'],
    trapPoolIds: ['t_ruins_falling_rock', 't_ruins_bolt', 't_ruins_cursed_tile'],
    diseasePoolIds: ['d_ruins_pool'],
    lootTableId: 'ruins-loot',
    trinketPoolIds: ['trinket_holy_amulet', 'trinket_heirloom_ring', 'trinket_crusaders_vow'],
    torchModifier: 1.0,
    hungerModifier: 1.0,
    ambushModifier: 0.0,
    stressModifier: 1.2,
    scoutingModifier: 1.3,
    diseaseModifier: 0.6,
    supplyModifier: 1.0,
    recommendedProvisionIds: ['torch', 'holy-water', 'skeleton-key', 'food'],
    recommendedHeroTags: ['holy', 'stun', 'blight', 'stress-support', 'scouting'],
    questObjectivePoolIds: ['clear', 'investigate', 'deep', 'purge'],
    questModifierPoolIds: ['qm_stress_surge', 'qm_dark_zone', 'qm_holy_relics', 'qm_pilgrims_passage'],
    campAmbushChanceBonus: 0.0,
    campFoodConsumptionBonus: 0,
    campHealingBonus: 0.2,
    iconHint: '⛪',
    dominantThreat: '压力 / 亡灵',
    rewardLean: '抗压 / 宗教 / 侦察',
  },
  'corrupted-woods': {
    id: 'corrupted-woods',
    name: '腐败林地',
    description: '荆棘与毒菌遍地的污染林地,疾病与腐蚀高发,隐藏路线和分叉多。',
    environmentTags: ['corrupted-woods', 'beast', 'blight', 'disease', 'nature', 'branching'],
    routeGeneratorId: 'woods-branching',
    encounterPoolIds: ['e_woods_spore', 'e_woods_thornbeast', 'e_woods_swamp_stalker', 'e_woods_fungal_corpse'],
    eliteEncounterPoolIds: ['e_woods_plague_hive', 'e_woods_thorn_king'],
    curioPoolIds: ['c_woods_fungal_bed', 'c_woods_thorn_altar', 'c_woods_parasite_fruit', 'c_woods_glow_spore'],
    trapPoolIds: ['t_woods_thorn_snare', 't_woods_spore_burst', 't_woods_swamp_pit'],
    diseasePoolIds: ['d_woods_pool'],
    lootTableId: 'woods-loot',
    trinketPoolIds: ['trinket_plague_kit', 'trinket_surgeon_gloves', 'trinket_iron_talisman'],
    torchModifier: 0.9,
    hungerModifier: 1.0,
    ambushModifier: 0.2,
    stressModifier: 0.9,
    scoutingModifier: 1.1,
    diseaseModifier: 1.8,
    supplyModifier: 1.2,
    recommendedProvisionIds: ['antivenom', 'bandage', 'torch', 'food', 'shovel'],
    recommendedHeroTags: ['medical', 'blight-resist', 'scouting', 'trap-specialist', 'cleanse'],
    questObjectivePoolIds: ['clear', 'investigate', 'collect', 'purge'],
    questModifierPoolIds: ['qm_disease_outbreak', 'qm_blight_zone', 'qm_poison_air', 'qm_nest_clearing'],
    campAmbushChanceBonus: 0.15,
    campFoodConsumptionBonus: 0,
    campHealingBonus: 0.1,
    iconHint: '🌿',
    dominantThreat: '疾病 / 腐蚀 / 野兽',
    rewardLean: '疾病抗性 / 露营 / 治疗',
  },
  'underground-burrows': {
    id: 'underground-burrows',
    name: '地下兽穴',
    description: '狭窄、黑暗、血腥的地下通道,饥饿与流血事件频发,撤退路径危险。',
    environmentTags: ['underground-burrows', 'beast', 'bleed', 'hunger', 'dark', 'close-quarters'],
    routeGeneratorId: 'burrows-narrow',
    encounterPoolIds: ['e_burrows_hungry_predator', 'e_burrows_fangbeast', 'e_burrows_ambusher', 'e_burrows_carrion_eater'],
    eliteEncounterPoolIds: ['e_burrows_giant_beast', 'e_burrows_blood_butcher'],
    curioPoolIds: ['c_burrows_carrion_pile', 'c_burrows_bone_cache', 'c_burrows_bitten_chest', 'c_burrows_blood_pool'],
    trapPoolIds: ['t_burrows_bone_pit', 't_burrows_predator_jaw', 't_burrows_collapse'],
    diseasePoolIds: ['d_burrows_pool'],
    lootTableId: 'burrows-loot',
    trinketPoolIds: ['trinket_blood_amulet', 'trinket_rations_pouch', 'trinket_sharp_ammo', 'trinket_highwaymans_cloak'],
    torchModifier: 1.3,
    hungerModifier: 1.5,
    ambushModifier: 0.1,
    stressModifier: 1.0,
    scoutingModifier: 0.8,
    diseaseModifier: 1.0,
    supplyModifier: 1.5,
    recommendedProvisionIds: ['food', 'bandage', 'torch', 'shovel', 'skeleton-key'],
    recommendedHeroTags: ['bleed-resist', 'frontline', 'sustain', 'healing', 'corpse-control'],
    questObjectivePoolIds: ['clear', 'collect', 'deep', 'escort-item'],
    questModifierPoolIds: ['qm_hungry_terrain', 'qm_dark_zone', 'qm_blood_moon', 'qm_narrow_passage'],
    campAmbushChanceBonus: 0.05,
    campFoodConsumptionBonus: 2,
    campHealingBonus: 0.0,
    iconHint: '🕳️',
    dominantThreat: '饥饿 / 流血 / 野兽',
    rewardLean: '流血 / 食物 / 生存',
  },
};

export function getRegionDefinition(id: RegionId): RegionDefinition {
  return REGION_DEFINITIONS[id];
}

export function getAllRegionIds(): RegionId[] {
  return ['ruins', 'corrupted-woods', 'underground-burrows'];
}

// =====================================================================
// 区域敌人
// =====================================================================

export const REGION_ENEMIES: RegionEnemyDef[] = [
  // 遗迹普通 4
  { id: 'e_ruins_skeleton', regionId: 'ruins', name: '骸骨战士', archetype: 'undead', isElite: false, tacticalFocus: 'priority-target', baseHp: 18, baseDamage: [3, 6], baseAccuracy: 0.85, baseCrit: 0.05, baseSpeed: 4, baseDodge: 5, baseProtection: 0.1, baseBleedResist: 0.6, baseBlightResist: 0.6, baseStunResist: 0.5, baseMoveResist: 0.5, statusChance: 0, description: '脆弱但数量多,易被眩晕' },
  { id: 'e_ruins_ghost', regionId: 'ruins', name: '哀号幽灵', archetype: 'undead', isElite: false, tacticalFocus: 'stress-pressure', baseHp: 12, baseDamage: [2, 4], baseAccuracy: 0.80, baseCrit: 0.10, baseSpeed: 6, baseDodge: 10, baseProtection: 0.0, baseBleedResist: 0.8, baseBlightResist: 0.8, baseStunResist: 0.3, baseMoveResist: 0.7, primaryStatus: 'mark', statusChance: 0.4, description: '高压力 + 标记后排,优先处理' },
  { id: 'e_ruins_cultist', regionId: 'ruins', name: '亡者教徒', archetype: 'humanoid', isElite: false, tacticalFocus: 'heal-pressure', baseHp: 16, baseDamage: [3, 5], baseAccuracy: 0.85, baseCrit: 0.05, baseSpeed: 5, baseDodge: 5, baseProtection: 0.0, baseBleedResist: 0.4, baseBlightResist: 0.4, baseStunResist: 0.4, baseMoveResist: 0.4, statusChance: 0, description: '会治疗友军,优先击杀' },
  { id: 'e_ruins_bone_soldier', regionId: 'ruins', name: '骸骨卫兵', archetype: 'undead', isElite: false, tacticalFocus: 'protect-break', baseHp: 22, baseDamage: [4, 7], baseAccuracy: 0.85, baseCrit: 0.05, baseSpeed: 3, baseDodge: 2, baseProtection: 0.3, baseBleedResist: 0.7, baseBlightResist: 0.7, baseStunResist: 0.7, baseMoveResist: 0.5, statusChance: 0, description: '高护甲,需破防' },

  // 遗迹精英 2
  { id: 'e_ruins_abbots_ghost', regionId: 'ruins', name: '院长幽灵', archetype: 'undead', isElite: true, tacticalFocus: 'stress-pressure', baseHp: 35, baseDamage: [5, 9], baseAccuracy: 0.90, baseCrit: 0.15, baseSpeed: 5, baseDodge: 8, baseProtection: 0.1, baseBleedResist: 0.9, baseBlightResist: 0.9, baseStunResist: 0.5, baseMoveResist: 0.7, primaryStatus: 'mark', statusChance: 0.5, description: '高压力 AOE + 标记,需尽快击杀' },
  { id: 'e_ruins_bone_construct', regionId: 'ruins', name: '骨构装', archetype: 'undead', isElite: true, tacticalFocus: 'protect-break', baseHp: 50, baseDamage: [6, 11], baseAccuracy: 0.85, baseCrit: 0.05, baseSpeed: 2, baseDodge: 0, baseProtection: 0.5, baseBleedResist: 1.0, baseBlightResist: 1.0, baseStunResist: 1.0, baseMoveResist: 0.3, statusChance: 0, description: '极硬护甲,需 buff/debuff' },

  // 腐败林地普通 4
  { id: 'e_woods_spore', regionId: 'corrupted-woods', name: '孢子喷吐者', archetype: 'blight', isElite: false, tacticalFocus: 'control', baseHp: 14, baseDamage: [2, 4], baseAccuracy: 0.80, baseCrit: 0.05, baseSpeed: 4, baseDodge: 4, baseProtection: 0.0, baseBleedResist: 0.5, baseBlightResist: 0.8, baseStunResist: 0.3, baseMoveResist: 0.4, primaryStatus: 'blight', statusChance: 0.6, description: '群体腐蚀后排,需清除状态' },
  { id: 'e_woods_thornbeast', regionId: 'corrupted-woods', name: '荆棘兽', archetype: 'beast', isElite: false, tacticalFocus: 'protect-break', baseHp: 24, baseDamage: [4, 7], baseAccuracy: 0.85, baseCrit: 0.10, baseSpeed: 4, baseDodge: 3, baseProtection: 0.2, baseBleedResist: 0.5, baseBlightResist: 0.5, baseStunResist: 0.6, baseMoveResist: 0.4, primaryStatus: 'bleed', statusChance: 0.4, description: '反伤 + 流血前排压制' },
  { id: 'e_woods_swamp_stalker', regionId: 'corrupted-woods', name: '沼泽猎手', archetype: 'beast', isElite: false, tacticalFocus: 'formation', baseHp: 18, baseDamage: [4, 6], baseAccuracy: 0.85, baseCrit: 0.10, baseSpeed: 6, baseDodge: 8, baseProtection: 0.0, baseBleedResist: 0.5, baseBlightResist: 0.4, baseStunResist: 0.3, baseMoveResist: 0.7, statusChance: 0, description: '后排突袭 + 阵型打乱' },
  { id: 'e_woods_fungal_corpse', regionId: 'corrupted-woods', name: '腐化菌体', archetype: 'blight', isElite: false, tacticalFocus: 'status-cleanup', baseHp: 16, baseDamage: [3, 5], baseAccuracy: 0.80, baseCrit: 0.05, baseSpeed: 3, baseDodge: 2, baseProtection: 0.0, baseBleedResist: 0.5, baseBlightResist: 0.9, baseStunResist: 0.3, baseMoveResist: 0.3, primaryStatus: 'blight', statusChance: 0.5, description: '死亡后释放污染,需先清后排' },

  // 腐败林地精英 2
  { id: 'e_woods_plague_hive', regionId: 'corrupted-woods', name: '疫病母巢', archetype: 'blight', isElite: true, tacticalFocus: 'control', baseHp: 40, baseDamage: [4, 8], baseAccuracy: 0.85, baseCrit: 0.10, baseSpeed: 3, baseDodge: 2, baseProtection: 0.2, baseBleedResist: 0.6, baseBlightResist: 0.95, baseStunResist: 0.5, baseMoveResist: 0.4, primaryStatus: 'blight', statusChance: 0.7, description: '群体腐蚀+疾病召唤,需快速清场' },
  { id: 'e_woods_thorn_king', regionId: 'corrupted-woods', name: '荆棘巨兽', archetype: 'beast', isElite: true, tacticalFocus: 'protect-break', baseHp: 60, baseDamage: [7, 12], baseAccuracy: 0.85, baseCrit: 0.10, baseSpeed: 3, baseDodge: 0, baseProtection: 0.4, baseBleedResist: 0.7, baseBlightResist: 0.7, baseStunResist: 0.7, baseMoveResist: 0.3, primaryStatus: 'bleed', statusChance: 0.5, description: '高 HP + 反伤 + 流血,需 buff' },

  // 地下兽穴普通 4
  { id: 'e_burrows_hungry_predator', regionId: 'underground-burrows', name: '饥饿掠夺者', archetype: 'beast', isElite: false, tacticalFocus: 'supply-pressure', baseHp: 18, baseDamage: [4, 6], baseAccuracy: 0.85, baseCrit: 0.05, baseSpeed: 5, baseDodge: 6, baseProtection: 0.0, baseBleedResist: 0.5, baseBlightResist: 0.4, baseStunResist: 0.3, baseMoveResist: 0.5, statusChance: 0, description: '偷取食物 + 持续流血' },
  { id: 'e_burrows_fangbeast', regionId: 'underground-burrows', name: '裂齿兽', archetype: 'beast', isElite: false, tacticalFocus: 'priority-target', baseHp: 20, baseDamage: [5, 8], baseAccuracy: 0.85, baseCrit: 0.10, baseSpeed: 5, baseDodge: 4, baseProtection: 0.0, baseBleedResist: 0.5, baseBlightResist: 0.4, baseStunResist: 0.3, baseMoveResist: 0.4, primaryStatus: 'bleed', statusChance: 0.5, description: '高流血,集中攻击' },
  { id: 'e_burrows_ambusher', regionId: 'underground-burrows', name: '地穴潜伏者', archetype: 'beast', isElite: false, tacticalFocus: 'formation', baseHp: 16, baseDamage: [3, 5], baseAccuracy: 0.85, baseCrit: 0.10, baseSpeed: 7, baseDodge: 10, baseProtection: 0.0, baseBleedResist: 0.5, baseBlightResist: 0.4, baseStunResist: 0.3, baseMoveResist: 0.8, statusChance: 0, description: '伏击 + 阵型打乱' },
  { id: 'e_burrows_carrion_eater', regionId: 'underground-burrows', name: '腐肉吞噬者', archetype: 'beast', isElite: false, tacticalFocus: 'heal-pressure', baseHp: 22, baseDamage: [4, 6], baseAccuracy: 0.85, baseCrit: 0.05, baseSpeed: 4, baseDodge: 2, baseProtection: 0.1, baseBleedResist: 0.6, baseBlightResist: 0.6, baseStunResist: 0.5, baseMoveResist: 0.4, statusChance: 0, description: '尸体强化攻击,需先清场' },

  // 地下兽穴精英 2
  { id: 'e_burrows_giant_beast', regionId: 'underground-burrows', name: '巨型穴居兽', archetype: 'beast', isElite: true, tacticalFocus: 'protect-break', baseHp: 55, baseDamage: [7, 11], baseAccuracy: 0.85, baseCrit: 0.05, baseSpeed: 3, baseDodge: 0, baseProtection: 0.3, baseBleedResist: 0.7, baseBlightResist: 0.6, baseStunResist: 0.7, baseMoveResist: 0.3, primaryStatus: 'bleed', statusChance: 0.6, description: '高 HP + 重击 + 流血' },
  { id: 'e_burrows_blood_butcher', regionId: 'underground-burrows', name: '血腥屠夫', archetype: 'humanoid', isElite: true, tacticalFocus: 'priority-target', baseHp: 38, baseDamage: [8, 13], baseAccuracy: 0.90, baseCrit: 0.15, baseSpeed: 6, baseDodge: 5, baseProtection: 0.0, baseBleedResist: 0.6, baseBlightResist: 0.5, baseStunResist: 0.5, baseMoveResist: 0.5, primaryStatus: 'bleed', statusChance: 0.7, description: '高伤害后排突袭 + 流血' },
];

export function getEnemyDef(id: string): RegionEnemyDef | undefined {
  return REGION_ENEMIES.find((e) => e.id === id);
}

// =====================================================================
// 奇物
// =====================================================================

export const REGION_CURIOS: RegionCurioDef[] = [
  // 遗迹 4
  { id: 'c_ruins_altar', regionId: 'ruins', name: '被亵渎的祭坛', description: '点燃蜡烛可减少压力,但有概率被诅咒', tags: ['holy', 'stress', 'curse'], persistentRegionEffects: [], persistentEffectChance: 0, riskHint: '需圣水或修女', preferredClassTags: ['holy', 'stress-support'] },
  { id: 'c_ruins_sarcophagus', regionId: 'ruins', name: '锁住的石棺', description: '打开有概率获得奖励或被埋伏', tags: ['lock', 'loot', 'trap'], persistentRegionEffects: [], persistentEffectChance: 0, riskHint: '需骷髅钥匙', preferredClassTags: ['holy'] },
  { id: 'c_ruins_armor', regionId: 'ruins', name: '古老盔甲', description: '装备后获得护甲,但有概率被诅咒', tags: ['armor', 'equip', 'curse'], persistentRegionEffects: [], persistentEffectChance: 0, riskHint: '需圣水保护', preferredClassTags: ['holy', 'frontline'] },
  { id: 'c_ruins_statue', regionId: 'ruins', name: '破碎圣像', description: '侦察可获得情报,或治愈队伍', tags: ['scout', 'heal'], persistentRegionEffects: [], persistentEffectChance: 0, riskHint: '需侦察', preferredClassTags: ['scouting', 'holy'] },

  // 腐败林地 4
  { id: 'c_woods_fungal_bed', regionId: 'corrupted-woods', name: '腐败菌床', description: '焚烧可降低后续疾病风险,消耗火把', tags: ['disease', 'torch', 'risk'], persistentRegionEffects: [], persistentEffectChance: 0.6, riskHint: '消耗火把,降低后续 3 节点疾病', preferredClassTags: ['medical'] },
  { id: 'c_woods_thorn_altar', regionId: 'corrupted-woods', name: '荆棘祭坛', description: '献祭可获得奖励,但有概率受伤', tags: ['sacrifice', 'loot'], persistentRegionEffects: [], persistentEffectChance: 0, riskHint: '高风险高收益', preferredClassTags: ['blight-resist'] },
  { id: 'c_woods_parasite_fruit', regionId: 'corrupted-woods', name: '寄生果实', description: '食用获得临时 buff,但有概率感染疾病', tags: ['food', 'buff', 'disease'], persistentRegionEffects: [], persistentEffectChance: 0, riskHint: '高风险 buff', preferredClassTags: ['medical'] },
  { id: 'c_woods_glow_spore', regionId: 'corrupted-woods', name: '发光孢子囊', description: '采集可照亮路径,降低夜袭', tags: ['scout', 'torch', 'ambush'], persistentRegionEffects: [], persistentEffectChance: 0.5, riskHint: '降低夜袭 1 次', preferredClassTags: ['scouting', 'trap-specialist'] },

  // 地下兽穴 4
  { id: 'c_burrows_carrion_pile', regionId: 'underground-burrows', name: '腐肉堆', description: '搜索可获得食物,但吸引野兽', tags: ['food', 'ambush'], persistentRegionEffects: [], persistentEffectChance: 0, riskHint: '高风险食物', preferredClassTags: ['sustain'] },
  { id: 'c_burrows_bone_cache', regionId: 'underground-burrows', name: '兽骨储藏坑', description: '可获得战利品与纹章', tags: ['loot', 'crest'], persistentRegionEffects: [], persistentEffectChance: 0, riskHint: '需压力足够', preferredClassTags: ['sustain'] },
  { id: 'c_burrows_bitten_chest', regionId: 'underground-burrows', name: '被啃咬的补给箱', description: '打开可获得补给,但有概率触发陷阱', tags: ['supply', 'trap'], persistentRegionEffects: [], persistentEffectChance: 0, riskHint: '中等风险', preferredClassTags: ['sustain'] },
  { id: 'c_burrows_blood_pool', regionId: 'underground-burrows', name: '地下血池', description: '饮用恢复 HP 但感染疾病', tags: ['heal', 'disease'], persistentRegionEffects: [], persistentEffectChance: 0, riskHint: '高风险治疗', preferredClassTags: ['bleed-resist'] },
];

export function getCurioDef(id: string): RegionCurioDef | undefined {
  return REGION_CURIOS.find((c) => c.id === id);
}

// =====================================================================
// 陷阱
// =====================================================================

export const REGION_TRAPS: RegionTrapDef[] = [
  // 遗迹 3
  { id: 't_ruins_falling_rock', regionId: 'ruins', name: '落石机关', description: '前排受 HP 伤害', primaryImpact: 'hp', baseChance: 0.6, damageRange: [3, 8], description2: '前排受 HP 伤害' },
  { id: 't_ruins_bolt', regionId: 'ruins', name: '石弩', description: '后排受 HP 伤害 + 标记', primaryImpact: 'hp', baseChance: 0.5, damageRange: [4, 9], description2: '后排受 HP 伤害' },
  { id: 't_ruins_cursed_tile', regionId: 'ruins', name: '诅咒地砖', description: '踩中全队压力 +15', primaryImpact: 'stress', baseChance: 0.5, stressDelta: 15, description2: '全队压力 +15' },

  // 腐败林地 3
  { id: 't_woods_thorn_snare', regionId: 'corrupted-woods', name: '荆棘绊索', description: '前排 + 流血', primaryImpact: 'hp', baseChance: 0.6, damageRange: [2, 5], description2: '前排受 HP 伤害 + 流血' },
  { id: 't_woods_spore_burst', regionId: 'corrupted-woods', name: '孢子爆裂', description: '全队腐蚀 + 疾病感染', primaryImpact: 'disease', baseChance: 0.6, diseaseChance: 0.5, description2: '全队腐蚀 + 高疾病风险' },
  { id: 't_woods_swamp_pit', regionId: 'corrupted-woods', name: '沼泽陷坑', description: '阵型混乱 + 食物损失', primaryImpact: 'formation', baseChance: 0.5, supplyLoss: 2, description2: '阵型混乱 + 食物 -2' },

  // 地下兽穴 3
  { id: 't_burrows_bone_pit', regionId: 'underground-burrows', name: '骨刺坑', description: '前排受 HP 伤害 + 流血', primaryImpact: 'hp', baseChance: 0.7, damageRange: [3, 7], description2: '前排受 HP 伤害 + 流血' },
  { id: 't_burrows_predator_jaw', regionId: 'underground-burrows', name: '捕食兽夹', description: '前排受 HP 伤害 + 食物损失', primaryImpact: 'supply', baseChance: 0.5, damageRange: [2, 5], supplyLoss: 3, description2: '前排 HP + 食物 -3' },
  { id: 't_burrows_collapse', regionId: 'underground-burrows', name: '坍塌通道', description: '火把下降 + 路径阻断', primaryImpact: 'torch', baseChance: 0.5, torchLoss: 25, description2: '火把 -25' },
];

export function getTrapDef(id: string): RegionTrapDef | undefined {
  return REGION_TRAPS.find((t) => t.id === id);
}

// =====================================================================
// 区域疾病权重
// =====================================================================

export const REGION_DISEASE_WEIGHTS: Record<RegionId, RegionDiseaseWeight> = {
  ruins: {
    regionId: 'ruins',
    weights: { disease_red_pestilence: 0.3, disease_black_death: 0.1, disease_hallucination: 0.6 },
    globalAcquisitionModifier: 0.5,
  },
  'corrupted-woods': {
    regionId: 'corrupted-woods',
    weights: { disease_parasite: 0.6, disease_lung: 0.5, disease_hallucination: 0.4, disease_red_pestilence: 0.3 },
    globalAcquisitionModifier: 1.8,
  },
  'underground-burrows': {
    regionId: 'underground-burrows',
    weights: { disease_rabies: 0.5, disease_scurvy: 0.4, disease_weakness: 0.3, disease_tetanus: 0.4 },
    globalAcquisitionModifier: 1.0,
  },
};

// =====================================================================
// 战利品 / 饰品池
// =====================================================================

export const REGION_LOOT_TABLES: Record<RegionId, RegionLootTable> = {
  ruins: {
    id: 'ruins-loot',
    regionId: 'ruins',
    goldBase: 350,
    goldRandom: 200,
    heirloomBase: { portraits: 1, crests: 2 },
    trinketWeights: { trinket_holy_amulet: 5, trinket_heirloom_ring: 2, trinket_crusaders_vow: 3 },
    provisionWeights: { food: 1, torch: 1, 'holy-water': 2, 'skeleton-key': 2 },
  },
  'corrupted-woods': {
    id: 'woods-loot',
    regionId: 'corrupted-woods',
    goldBase: 400,
    goldRandom: 250,
    heirloomBase: { portraits: 1, crests: 1 },
    trinketWeights: { trinket_plague_kit: 5, trinket_surgeon_gloves: 3, trinket_iron_talisman: 2 },
    provisionWeights: { food: 1, torch: 1, bandage: 2, antivenom: 3, shovel: 1 },
  },
  'underground-burrows': {
    id: 'burrows-loot',
    regionId: 'underground-burrows',
    goldBase: 500,
    goldRandom: 300,
    heirloomBase: { portraits: 0, crests: 3 },
    trinketWeights: { trinket_blood_amulet: 4, trinket_rations_pouch: 3, trinket_sharp_ammo: 2 },
    provisionWeights: { food: 3, torch: 2, bandage: 2, shovel: 1 },
  },
};

// =====================================================================
// 任务修正词(12)
// =====================================================================

export const QUEST_MODIFIERS: QuestModifierDef[] = [
  { id: 'qm_disease_outbreak', name: '疾病高发', description: '全队疾病感染概率 +50%', tags: ['disease', 'risk'], difficultyMultiplier: 1.3, rewardMultiplier: 1.2, allowedRegionIds: ['corrupted-woods', 'ruins'] },
  { id: 'qm_dark_zone', name: '黑暗区域', description: '火把消耗 +50%', tags: ['torch', 'risk'], difficultyMultiplier: 1.2, rewardMultiplier: 1.1, allowedRegionIds: ['ruins', 'underground-burrows'] },
  { id: 'qm_torch_burn_fast', name: '火把消耗加快', description: '火把消耗 +30%', tags: ['torch'], difficultyMultiplier: 1.1, rewardMultiplier: 1.0, allowedRegionIds: ['ruins', 'underground-burrows', 'corrupted-woods'] },
  { id: 'qm_scout_blocked', name: '侦察受阻', description: '侦察收益 -50%', tags: ['scout'], difficultyMultiplier: 1.1, rewardMultiplier: 1.0, allowedRegionIds: ['corrupted-woods', 'underground-burrows'] },
  { id: 'qm_ambush_heavy', name: '敌方伏击提高', description: '遭遇伏击概率 +25%', tags: ['encounter', 'risk'], difficultyMultiplier: 1.3, rewardMultiplier: 1.1, allowedRegionIds: ['corrupted-woods', 'underground-burrows'] },
  { id: 'qm_loot_plus', name: '战利品增加', description: '战利品 +30%', tags: ['loot'], difficultyMultiplier: 1.0, rewardMultiplier: 1.3, allowedRegionIds: ['ruins', 'corrupted-woods', 'underground-burrows'] },
  { id: 'qm_supply_price_up', name: '补给价格提高', description: '购买补给价格 +20%', tags: ['supply'], difficultyMultiplier: 1.0, rewardMultiplier: 1.2, allowedRegionIds: ['ruins', 'corrupted-woods', 'underground-burrows'] },
  { id: 'qm_camp_weak', name: '露营效果降低', description: '露营治疗 -50%', tags: ['camp'], difficultyMultiplier: 1.2, rewardMultiplier: 1.0, allowedRegionIds: ['underground-burrows', 'corrupted-woods'] },
  { id: 'qm_elite_swarm', name: '精英出没', description: '精英遭遇概率 +100%', tags: ['elite', 'risk'], difficultyMultiplier: 1.5, rewardMultiplier: 1.5, allowedRegionIds: ['ruins', 'corrupted-woods', 'underground-burrows'] },
  { id: 'qm_hungry_terrain', name: '饥饿频繁', description: '饥饿频率 +50%', tags: ['hunger'], difficultyMultiplier: 1.2, rewardMultiplier: 1.0, allowedRegionIds: ['underground-burrows'] },
  { id: 'qm_stress_surge', name: '压力攻击增强', description: '压力敌人攻击 +50%', tags: ['stress'], difficultyMultiplier: 1.3, rewardMultiplier: 1.1, allowedRegionIds: ['ruins', 'corrupted-woods'] },
  { id: 'qm_status_resist', name: '敌方状态抗性提高', description: '状态技能命中率 -30%', tags: ['status', 'risk'], difficultyMultiplier: 1.3, rewardMultiplier: 1.2, allowedRegionIds: ['ruins', 'corrupted-woods', 'underground-burrows'] },

  // 区域专属
  { id: 'qm_holy_relics', name: '圣物珍宝', description: '遗迹专属 - 奖励含额外肖像', tags: ['loot', 'region-specific'], difficultyMultiplier: 1.0, rewardMultiplier: 1.4, allowedRegionIds: ['ruins'] },
  { id: 'qm_pilgrims_passage', name: '朝圣者通道', description: '遗迹专属 - 压力事件减少', tags: ['stress', 'region-specific'], difficultyMultiplier: 0.9, rewardMultiplier: 1.0, allowedRegionIds: ['ruins'] },
  { id: 'qm_blight_zone', name: '腐蚀之地', description: '林地专属 - 腐蚀感染 +30%', tags: ['blight', 'region-specific'], difficultyMultiplier: 1.3, rewardMultiplier: 1.2, allowedRegionIds: ['corrupted-woods'] },
  { id: 'qm_poison_air', name: '毒气弥漫', description: '林地专属 - 持续压力', tags: ['stress', 'region-specific'], difficultyMultiplier: 1.2, rewardMultiplier: 1.1, allowedRegionIds: ['corrupted-woods'] },
  { id: 'qm_nest_clearing', name: '巢穴清扫', description: '林地专属 - 多精英,高奖励', tags: ['elite', 'region-specific'], difficultyMultiplier: 1.5, rewardMultiplier: 1.5, allowedRegionIds: ['corrupted-woods'] },
  { id: 'qm_blood_moon', name: '血月之夜', description: '兽穴专属 - 流血伤害 +30%', tags: ['bleed', 'region-specific'], difficultyMultiplier: 1.3, rewardMultiplier: 1.2, allowedRegionIds: ['underground-burrows'] },
  { id: 'qm_narrow_passage', name: '狭窄通道', description: '兽穴专属 - 阵型受限', tags: ['formation', 'region-specific'], difficultyMultiplier: 1.2, rewardMultiplier: 1.1, allowedRegionIds: ['underground-burrows'] },
];

export function getQuestModifier(id: string): QuestModifierDef | undefined {
  return QUEST_MODIFIERS.find((m) => m.id === id);
}

// =====================================================================
// 任务目标(5 + 1 护送接口)
// =====================================================================

export const QUEST_OBJECTIVES: QuestObjectiveDef[] = [
  { id: 'clear', name: '清理', description: '完成指定数量遭遇', defaultTarget: 3 },
  { id: 'investigate', name: '调查', description: '找到并调查目标奇物', defaultTarget: 2 },
  { id: 'collect', name: '收集', description: '带回指定数量的任务物品', defaultTarget: 3 },
  { id: 'deep', name: '深入', description: '抵达指定深度节点', defaultTarget: 12 },
  { id: 'purge', name: '净化', description: '处理多个区域目标', defaultTarget: 3 },
  { id: 'escort-item', name: '护送物品', description: '携带一个占用背包或产生风险的特殊物品抵达出口', defaultTarget: 1 },
];

export function getQuestObjectiveDef(id: string): QuestObjectiveDef | undefined {
  return QUEST_OBJECTIVES.find((o) => o.id === id);
}

// =====================================================================
// 区域 modifier helper
// =====================================================================

export function getRegionExpeditionModifiers(id: RegionId): RegionExpeditionModifiers {
  const d = REGION_DEFINITIONS[id];
  return {
    torchRate: d.torchModifier,
    hungerRate: d.hungerModifier,
    ambushRate: d.ambushModifier,
    stressRate: d.stressModifier,
    scoutRate: d.scoutingModifier,
    diseaseRate: d.diseaseModifier,
    supplyNeed: d.supplyModifier,
    teamSwapRecommended: d.supplyModifier > 1.0 || d.diseaseModifier > 1.3,
  };
}
