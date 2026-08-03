/**
 * 饰品库(SPEC §7.3)
 *
 * 20 件饰品:
 *  - 4 件职业限定
 *  - 8 件通用
 *  - 4 件稀有
 *  - 4 件高风险高收益
 *
 * 每件必须有正 modifier + 负 modifier(SPEC §1.3 禁止纯正收益)
 */

import type { TrinketDefinition } from './types.js';

// ============== 职业限定 (4 件) ==============

const TRINKET_CRUSADERS_VOW: TrinketDefinition = {
  id: 'trinket_crusaders_vow',
  name: '十字军誓言',
  rarity: 'uncommon',
  allowedClassIds: ['crusader'],
  tags: ['melee', 'defense', 'religion'],
  positiveModifiers: [
    { key: 'damage_vs_unholy', value: 0.25, description: '对邪恶敌人伤害 +25%' },
    { key: 'stress_resist', value: 0.15, description: '压力抗性 +15%' },
  ],
  negativeModifiers: [
    { key: 'speed', value: -5, description: '速度 -5' },
  ],
  flavor: '圣印在皮肤上灼烧,但力量随之涌来。',
};

const TRINKET_HIGHWAYMANS_CLOAK: TrinketDefinition = {
  id: 'trinket_highwaymans_cloak',
  name: '强盗披风',
  rarity: 'common',
  allowedClassIds: ['highwayman'],
  tags: ['ranged', 'stealth', 'dodge'],
  positiveModifiers: [
    { key: 'dodge', value: 8, description: '闪避 +8' },
    { key: 'backline_damage', value: 0.15, description: '后排压制 +15%' },
  ],
  negativeModifiers: [
    { key: 'max_hp', value: -0.1, description: '最大 HP -10%' },
  ],
  flavor: '暗影中移动更快,但更脆弱。',
};

const TRINKET_VESTALS_HYMN: TrinketDefinition = {
  id: 'trinket_vestals_hymn',
  name: '修女圣歌',
  rarity: 'uncommon',
  allowedClassIds: ['vestal'],
  tags: ['healing', 'holy', 'stress'],
  positiveModifiers: [
    { key: 'healing_power', value: 0.2, description: '治疗效果 +20%' },
    { key: 'party_stress_recovery', value: 0.15, description: '队伍压力恢复 +15%' },
  ],
  negativeModifiers: [
    { key: 'self_stress_gain', value: 0.15, description: '自身压力获取 +15%' },
  ],
  flavor: '她替所有人承受痛苦。',
};

const TRINKET_PLAGUE_KIT: TrinketDefinition = {
  id: 'trinket_plague_kit',
  name: '瘟医药箱',
  rarity: 'uncommon',
  allowedClassIds: ['plague_doctor'],
  tags: ['blight', 'disease', 'cleanse'],
  positiveModifiers: [
    { key: 'blight_success', value: 0.25, description: '腐蚀成功率 +25%' },
    { key: 'disease_cleanse', value: 0.2, description: '疾病清除 +20%' },
  ],
  negativeModifiers: [
    { key: 'max_hp', value: -0.1, description: '最大 HP -10%' },
  ],
  flavor: '治愈和致死在同一双手。',
};

// ============== 通用 (8 件) ==============

const TRINKET_SHARP_AMMO: TrinketDefinition = {
  id: 'trinket_sharp_ammo',
  name: '锐利弹匣',
  rarity: 'common',
  tags: ['ranged', 'damage'],
  positiveModifiers: [
    { key: 'backline_damage', value: 0.2, description: '后排压制 +20%' },
  ],
  negativeModifiers: [
    { key: 'dodge', value: -5, description: '闪避 -5' },
  ],
  flavor: '每一颗子弹都打磨过,但背包少了护符。',
};

const TRINKET_HOLY_AMULET: TrinketDefinition = {
  id: 'trinket_holy_amulet',
  name: '圣徽吊坠',
  rarity: 'common',
  tags: ['healing', 'religion'],
  positiveModifiers: [
    { key: 'healing_received', value: 0.15, description: '受到治疗 +15%' },
  ],
  negativeModifiers: [
    { key: 'stress_gain', value: 0.2, description: '压力增长 +20%' },
  ],
  flavor: '圣光之重,凡人难承。',
};

const TRINKET_IRON_TALISMAN: TrinketDefinition = {
  id: 'trinket_iron_talisman',
  name: '铁制护符',
  rarity: 'common',
  tags: ['defense', 'death-resist'],
  positiveModifiers: [
    { key: 'deathblow_resist', value: 0.1, description: '致死抗性 +10%' },
  ],
  negativeModifiers: [
    { key: 'speed', value: -3, description: '速度 -3' },
  ],
  flavor: '沉重的护符,沉重的命运。',
};

const TRINKET_SCOUT_COMPASS: TrinketDefinition = {
  id: 'trinket_scout_compass',
  name: '侦察罗盘',
  rarity: 'common',
  tags: ['scout', 'route'],
  positiveModifiers: [
    { key: 'scout_level', value: 1, description: '路线侦察 +1 级' },
  ],
  negativeModifiers: [
    { key: 'low_torch_penalty', value: 0.2, description: '低火把时惩罚 +20%' },
  ],
  flavor: '光在时它指引方向,光灭时它沉默。',
};

const TRINKET_NIGHT_STALKER: TrinketDefinition = {
  id: 'trinket_night_stalker',
  name: '夜行者徽记',
  rarity: 'common',
  tags: ['ambush', 'torch'],
  positiveModifiers: [
    { key: 'low_torch_damage', value: 0.2, description: '低火把伤害 +20%' },
  ],
  negativeModifiers: [
    { key: 'high_torch_accuracy', value: -0.15, description: '高火把命中 -15%' },
  ],
  flavor: '黑暗是她的家,光是她的牢笼。',
};

const TRINKET_RATIONS_POUCH: TrinketDefinition = {
  id: 'trinket_rations_pouch',
  name: '破旧食袋',
  rarity: 'common',
  tags: ['food', 'supply'],
  positiveModifiers: [
    { key: 'food_stack', value: 2, description: '食物堆叠 +2' },
  ],
  negativeModifiers: [
    { key: 'hunger_stress', value: 0.15, description: '饥饿压力 +15%' },
  ],
  flavor: '背包更满,但它也有自己的饥饿。',
};

const TRINKET_SURGEON_GLOVES: TrinketDefinition = {
  id: 'trinket_surgeon_gloves',
  name: '外科手套',
  rarity: 'common',
  tags: ['cleanse', 'medical'],
  positiveModifiers: [
    { key: 'status_cleanse', value: 0.2, description: '状态清除 +20%' },
  ],
  negativeModifiers: [
    { key: 'self_heal', value: -0.2, description: '自我治疗 -20%' },
  ],
  flavor: '治愈别人,却忘了治愈自己。',
};

const TRINKET_CURSED_EYE: TrinketDefinition = {
  id: 'trinket_cursed_eye',
  name: '诅咒之眼',
  rarity: 'common',
  tags: ['reveal', 'stress'],
  positiveModifiers: [
    { key: 'reveal_hidden', value: 0.25, description: '侦察隐藏 +25%' },
  ],
  negativeModifiers: [
    { key: 'stress_gain', value: 0.15, description: '压力增长 +15%' },
  ],
  flavor: '看得越多,失去的越多。',
};

// ============== 稀有 (4 件) ==============

const TRINKET_HEIRLOOM_RING: TrinketDefinition = {
  id: 'trinket_heirloom_ring',
  name: '传承戒指',
  rarity: 'rare',
  tags: ['resource', 'legacy'],
  positiveModifiers: [
    { key: 'gold_find', value: 0.3, description: '金币获取 +30%' },
    { key: 'hero_xp_gain', value: 0.15, description: '英雄经验 +15%' },
  ],
  negativeModifiers: [
    { key: 'dodge', value: -5, description: '闪避 -5' },
  ],
  flavor: '家族的光芒,也是家族的枷锁。',
};

const TRINKET_BLOOD_AMULET: TrinketDefinition = {
  id: 'trinket_blood_amulet',
  name: '血玉护符',
  rarity: 'rare',
  tags: ['damage', 'bleed'],
  positiveModifiers: [
    { key: 'damage', value: 0.2, description: '伤害 +20%' },
    { key: 'bleed_chance', value: 0.2, description: '流血触发 +20%' },
  ],
  negativeModifiers: [
    { key: 'max_hp', value: -0.15, description: '最大 HP -15%' },
    { key: 'bleed_resist', value: -0.3, description: '流血抗性 -30%' },
  ],
  flavor: '它让你流的血更少,但别人流的血更多。',
};

const TRINKET_QUICK_POUCH: TrinketDefinition = {
  id: 'trinket_quick_pouch',
  name: '快手袋',
  rarity: 'rare',
  tags: ['item', 'speed'],
  positiveModifiers: [
    { key: 'item_use_speed', value: 0.4, description: '物品使用 +40% 速度' },
    { key: 'first_round_damage', value: 0.2, description: '首轮伤害 +20%' },
  ],
  negativeModifiers: [
    { key: 'late_round_damage', value: -0.1, description: '后期轮次 -10%' },
  ],
  flavor: '她出手如风,但持久不足。',
};

const TRINKET_GUARDIAN_AMULET: TrinketDefinition = {
  id: 'trinket_guardian_amulet',
  name: '守护者护符',
  rarity: 'rare',
  tags: ['protection', 'deaths-door'],
  positiveModifiers: [
    { key: 'prot', value: 0.3, description: '护甲 +30%' },
    { key: 'deaths_door_recovery', value: 0.5, description: '死亡之门恢复 +50%' },
  ],
  negativeModifiers: [
    { key: 'damage', value: -0.2, description: '伤害 -20%' },
  ],
  flavor: '她保护每一个人,但不能伤害任何敌人。',
};

// ============== 高风险高收益 (4 件) ==============

const TRINKET_DEMON_HEART: TrinketDefinition = {
  id: 'trinket_demon_heart',
  name: '恶魔之心',
  rarity: 'very-rare',
  tags: ['damage', 'affliction', 'risk'],
  positiveModifiers: [
    { key: 'damage', value: 0.35, description: '伤害 +35%' },
    { key: 'crit', value: 0.1, description: '暴击 +10%' },
  ],
  negativeModifiers: [
    { key: 'affliction_chance', value: 0.2, description: '折磨概率 +20%' },
    { key: 'heart_attack_chance', value: 0.1, description: '心脏病概率 +10%' },
  ],
  flavor: '它在你胸腔里跳动,与你的心脏不合拍。',
};

const TRINKET_GODS_PITY: TrinketDefinition = {
  id: 'trinket_gods_pity',
  name: '神祇之怜',
  rarity: 'very-rare',
  tags: ['healing', 'virtue', 'risk'],
  positiveModifiers: [
    { key: 'healing_power', value: 0.4, description: '治疗 +40%' },
    { key: 'virtue_chance', value: 0.3, description: '美德概率 +30%' },
  ],
  negativeModifiers: [
    { key: 'damage', value: -0.3, description: '伤害 -30%' },
  ],
  flavor: '神听见了祈祷,但也看见了你的怯懦。',
};

const TRINKET_FAMINE_HORNS: TrinketDefinition = {
  id: 'trinket_famine_horns',
  name: '饥荒之角',
  rarity: 'very-rare',
  tags: ['disease', 'plague', 'risk'],
  positiveModifiers: [
    { key: 'disease_damage', value: 0.4, description: '疾病伤害 +40%' },
    { key: 'plague_disease_apply', value: 0.3, description: '施加疾病 +30%' },
  ],
  negativeModifiers: [
    { key: 'disease_resist', value: -0.5, description: '疾病抗性 -50%' },
  ],
  flavor: '它带来瘟疫,也抵御不了瘟疫。',
};

const TRINKET_ABYSSAL_EYE: TrinketDefinition = {
  id: 'trinket_abyssal_eye',
  name: '深渊之眼',
  rarity: 'very-rare',
  tags: ['reveal', 'damage', 'risk'],
  positiveModifiers: [
    { key: 'reveal_all', value: 0.5, description: '完全揭示 +50%' },
    { key: 'damage_vs_hidden', value: 0.3, description: '对隐藏敌人 +30%' },
  ],
  negativeModifiers: [
    { key: 'stress_gain', value: 0.3, description: '压力增长 +30%' },
    { key: 'max_hp', value: -0.1, description: '最大 HP -10%' },
  ],
  flavor: '深渊回望你,你也回望深渊。',
};

export const ALL_TRINKETS: Record<string, TrinketDefinition> = {
  trinket_crusaders_vow: TRINKET_CRUSADERS_VOW,
  trinket_highwaymans_cloak: TRINKET_HIGHWAYMANS_CLOAK,
  trinket_vestals_hymn: TRINKET_VESTALS_HYMN,
  trinket_plague_kit: TRINKET_PLAGUE_KIT,
  trinket_sharp_ammo: TRINKET_SHARP_AMMO,
  trinket_holy_amulet: TRINKET_HOLY_AMULET,
  trinket_iron_talisman: TRINKET_IRON_TALISMAN,
  trinket_scout_compass: TRINKET_SCOUT_COMPASS,
  trinket_night_stalker: TRINKET_NIGHT_STALKER,
  trinket_rations_pouch: TRINKET_RATIONS_POUCH,
  trinket_surgeon_gloves: TRINKET_SURGEON_GLOVES,
  trinket_cursed_eye: TRINKET_CURSED_EYE,
  trinket_heirloom_ring: TRINKET_HEIRLOOM_RING,
  trinket_blood_amulet: TRINKET_BLOOD_AMULET,
  trinket_quick_pouch: TRINKET_QUICK_POUCH,
  trinket_guardian_amulet: TRINKET_GUARDIAN_AMULET,
  trinket_demon_heart: TRINKET_DEMON_HEART,
  trinket_gods_pity: TRINKET_GODS_PITY,
  trinket_famine_horns: TRINKET_FAMINE_HORNS,
  trinket_abyssal_eye: TRINKET_ABYSSAL_EYE,
};

export function getTrinketDef(id: string): TrinketDefinition | null {
  return ALL_TRINKETS[id] ?? null;
}

export function listTrinkets(): TrinketDefinition[] {
  return Object.values(ALL_TRINKETS);
}

export function listClassTrinkets(archetype: string): TrinketDefinition[] {
  return listTrinkets().filter((t) => !t.allowedClassIds || t.allowedClassIds.includes(archetype as any));
}
