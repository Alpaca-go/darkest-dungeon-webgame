/**
 * 怪癖库(SPEC §3.3 §3.4)
 *
 * 12 个正面怪癖 + 12 个负面怪癖,每个怪癖定义:
 *  - id / name / description / flavor
 *  - tags(用于检索/筛选)
 *  - behaviors(0+ 个强迫行为)
 */

import type { QuirkDefinition } from './types.js';

// ============== 正面怪癖 (12 个) ==============

export const POSITIVE_QUIRKS: Record<string, QuirkDefinition> = {
  quirk_ruins_explorer: {
    id: 'quirk_ruins_explorer',
    name: '废墟探险家',
    type: 'positive',
    description: '熟悉遗迹,提高侦察等级并解锁路线判断。',
    tags: ['scout', 'route', 'exploration'],
    flavor: '多年的遗迹探险让她对地下通道有本能的直觉。',
    behaviors: [],
  },
  quirk_hardy: {
    id: 'quirk_hardy',
    name: '坚韧',
    type: 'positive',
    description: '提高死亡抗性,降低队友目睹濒死时的压力。',
    tags: ['death', 'party', 'stress'],
    flavor: '她从死亡边缘爬回来过太多次,身体比灵魂更顽强。',
    behaviors: [],
  },
  quirk_holy_faith: {
    id: 'quirk_holy_faith',
    name: '神圣信仰',
    type: 'positive',
    description: '宗教奇物风险降低,修道院效果提高。',
    tags: ['religion', 'curio', 'healing'],
    flavor: '圣光指引着她的每一步。',
    behaviors: [],
  },
  quirk_quick_reflexes: {
    id: 'quirk_quick_reflexes',
    name: '快速反应',
    type: 'positive',
    description: '陷阱和伏击时更稳定。',
    tags: ['trap', 'ambush', 'dodge'],
    flavor: '在危险来临前,身体先于意识做出反应。',
    behaviors: [],
  },
  quirk_light_keeper: {
    id: 'quirk_light_keeper',
    name: '光明守望',
    type: 'positive',
    description: '高火把时压力增长降低。',
    tags: ['torch', 'stress'],
    flavor: '光是她对抗恐惧的盾牌。',
    behaviors: [],
  },
  quirk_precise: {
    id: 'quirk_precise',
    name: '精准',
    type: 'positive',
    description: '后排压制方案更稳定。',
    tags: ['damage', 'ranged'],
    flavor: '她的攻击不会落空。',
    behaviors: [],
  },
  quirk_medical_instinct: {
    id: 'quirk_medical_instinct',
    name: '医疗本能',
    type: 'positive',
    description: '治疗和疾病处理方案增强。',
    tags: ['healing', 'disease'],
    flavor: '绷带在她手中似乎更有用。',
    behaviors: [],
  },
  quirk_frugal: {
    id: 'quirk_frugal',
    name: '节俭',
    type: 'positive',
    description: '部分补给消耗降低。',
    tags: ['provision', 'resource'],
    flavor: '从不浪费——包括别人的生命。',
    behaviors: [],
  },
  quirk_scout_keen: {
    id: 'quirk_scout_keen',
    name: '侦察敏锐',
    type: 'positive',
    description: '分叉路线信息更完整。',
    tags: ['scout', 'route', 'fork'],
    flavor: '她能看到别人看不到的脚印和陷阱痕迹。',
    behaviors: [],
  },
  quirk_indomitable: {
    id: 'quirk_indomitable',
    name: '不屈',
    type: 'positive',
    description: '低 HP 时仍能稳定执行。',
    tags: ['hp', 'resolve'],
    flavor: '即便濒死,她的意志也不曾动摇。',
    behaviors: [],
  },
  quirk_disciplined: {
    id: 'quirk_disciplined',
    name: '纪律严明',
    type: 'positive',
    description: '阵型被打乱时恢复更快。',
    tags: ['formation', 'recovery'],
    flavor: '多年的军旅让她在任何混乱中保持冷静。',
    behaviors: [],
  },
  quirk_composed: {
    id: 'quirk_composed',
    name: '沉着',
    type: 'positive',
    description: '折磨触发概率略降。',
    tags: ['affliction', 'mental'],
    flavor: '她的心如深井,不起波澜。',
    behaviors: [],
  },
};

// ============== 负面怪癖 (12 个) ==============

export const NEGATIVE_QUIRKS: Record<string, QuirkDefinition> = {
  quirk_afraid_of_dark: {
    id: 'quirk_afraid_of_dark',
    name: '怕黑',
    type: 'negative',
    description: '低火把时额外压力,可能拒绝漆黑路线。',
    tags: ['torch', 'route', 'stress'],
    flavor: '黑暗中有东西在看她。',
    behaviors: [
      {
        trigger: 'on-route-choice',
        effect: 'add-stress',
        baseChance: 0.6,
        cooldownDecisions: 3,
        description: '低火把路线时增加 5 压力。',
      },
    ],
  },
  quirk_obsessive: {
    id: 'quirk_obsessive',
    name: '强迫症',
    type: 'negative',
    description: '可能擅自调查奇物。',
    tags: ['curio', 'compulsion'],
    flavor: '那个奇物的盖子必须打开。',
    behaviors: [
      {
        trigger: 'on-curio-choice',
        effect: 'force-choice',
        baseChance: 0.35,
        cooldownDecisions: 4,
        description: '强制选择调查选项。',
      },
    ],
  },
  quirk_selfish: {
    id: 'quirk_selfish',
    name: '自私',
    type: 'negative',
    description: '不愿共享补给。',
    tags: ['resource', 'sharing'],
    flavor: '我的先,我先。',
    behaviors: [
      {
        trigger: 'on-provision-use',
        effect: 'consume-resource',
        baseChance: 0.25,
        cooldownDecisions: 3,
        description: '可能拒绝分享补给。',
      },
    ],
  },
  quirk_drunkard: {
    id: 'quirk_drunkard',
    name: '酒鬼',
    type: 'negative',
    description: '只能使用酒馆减压,修道院/疗养院服务可能不接。',
    tags: ['facility', 'treatment'],
    flavor: '没有酒,他什么也不做。',
    behaviors: [
      {
        trigger: 'on-facility-selection',
        effect: 'modify-treatment-eligibility',
        baseChance: 0.5,
        cooldownDecisions: 2,
        description: '修道院/疗养院服务可能被拒绝。',
      },
    ],
  },
  quirk_clean_freak: {
    id: 'quirk_clean_freak',
    name: '洁癖',
    type: 'negative',
    description: '污染、尸体和疾病事件压力提高。',
    tags: ['disease', 'stress', 'curio'],
    flavor: '她无法忍受任何污秽。',
    behaviors: [
      {
        trigger: 'on-curio-choice',
        effect: 'add-stress',
        baseChance: 0.4,
        cooldownDecisions: 3,
        description: '接触污染奇物时 +4 压力。',
      },
    ],
  },
  quirk_greedy: {
    id: 'quirk_greedy',
    name: '贪婪',
    type: 'negative',
    description: '背包满时可能强迫保留高价值战利品。',
    tags: ['loot', 'inventory'],
    flavor: '那个值钱的不能丢。',
    behaviors: [
      {
        trigger: 'on-loot-choice',
        effect: 'force-choice',
        baseChance: 0.5,
        cooldownDecisions: 2,
        description: '强制保留高价值物品。',
      },
    ],
  },
  quirk_reckless: {
    id: 'quirk_reckless',
    name: '鲁莽',
    type: 'negative',
    description: '高风险战术权重增加。',
    tags: ['combat', 'risk'],
    flavor: '管它呢,冲!',
    behaviors: [
      {
        trigger: 'on-route-choice',
        effect: 'modify-risk-preview',
        baseChance: 0.3,
        cooldownDecisions: 4,
        description: '高风险路线风险被低估。',
      },
    ],
  },
  quirk_cowardly: {
    id: 'quirk_cowardly',
    name: '懦弱',
    type: 'negative',
    description: '死亡之门附近更容易拒绝执行。',
    tags: ['deaths-door', 'courage'],
    flavor: '她不敢看。',
    behaviors: [
      {
        trigger: 'on-retreat-choice',
        effect: 'block-choice',
        baseChance: 0.3,
        cooldownDecisions: 3,
        description: '可能阻止冒险选项。',
      },
    ],
  },
  quirk_distrustful: {
    id: 'quirk_distrustful',
    name: '疑神疑鬼',
    type: 'negative',
    description: '侦察信息可信度下降。',
    tags: ['scout', 'info'],
    flavor: '他们在骗我。',
    behaviors: [
      {
        trigger: 'on-route-choice',
        effect: 'modify-scouting',
        baseChance: 0.4,
        cooldownDecisions: 3,
        description: '侦察信息被高风险过滤。',
      },
    ],
  },
  quirk_religion_hater: {
    id: 'quirk_religion_hater',
    name: '厌恶宗教',
    type: 'negative',
    description: '拒绝部分修道院或宗教奇物方案。',
    tags: ['religion', 'facility'],
    flavor: '没有神,只有骨头。',
    behaviors: [
      {
        trigger: 'on-facility-selection',
        effect: 'block-choice',
        baseChance: 0.4,
        cooldownDecisions: 2,
        description: '修道院服务可能被拒绝。',
      },
    ],
  },
  quirk_glutton: {
    id: 'quirk_glutton',
    name: '暴食',
    type: 'negative',
    description: '食物消耗提高。',
    tags: ['food', 'consumption'],
    flavor: '再多一份……',
    behaviors: [],
  },
  quirk_kleptomaniac: {
    id: 'quirk_kleptomaniac',
    name: '偷窃癖',
    type: 'negative',
    description: '可能擅自消耗或带走资源。',
    tags: ['resource', 'compulsion'],
    flavor: '她忍不住。',
    behaviors: [
      {
        trigger: 'on-provision-use',
        effect: 'consume-resource',
        baseChance: 0.3,
        cooldownDecisions: 4,
        description: '可能偷走一个补给。',
      },
    ],
  },
};

export const ALL_QUIRKS: Record<string, QuirkDefinition> = {
  ...POSITIVE_QUIRKS,
  ...NEGATIVE_QUIRKS,
};

export function getQuirkDef(id: string): QuirkDefinition | null {
  return ALL_QUIRKS[id] ?? null;
}

export function isPositiveQuirk(id: string): boolean {
  const def = ALL_QUIRKS[id];
  return def?.type === 'positive';
}

export function isNegativeQuirk(id: string): boolean {
  const def = ALL_QUIRKS[id];
  return def?.type === 'negative';
}
