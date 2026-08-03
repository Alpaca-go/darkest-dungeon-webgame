/**
 * 疾病库(SPEC §5.2)
 *
 * 10 个首发疾病,每个:
 *  - id / name / description / flavor
 *  - treatmentCostBase:疗养院治疗基础费用
 *
 * 效果实现:
 *  - HP / 速度 / 抗性 / 压力:由 stress-engine / encounter 集成
 *  - 食物 / 露营 / 治疗:P4.4 实现
 *  - 命中 / 致死打击:P4.1 通过 mental 引擎集成
 */

import type { DiseaseDefinition } from './types.js';

export const DISEASE_REGISTRY: Record<string, DiseaseDefinition> = {
  disease_red_pestilence: {
    id: 'disease_red_pestilence',
    name: '红疫',
    description: '流血抗性和最大 HP 降低。',
    tags: ['hp', 'bleed-resist', 'mid-tier'],
    flavor: '皮肤上蔓延的红色斑点。',
    treatmentCostBase: 500,
  },
  disease_black_death: {
    id: 'disease_black_death',
    name: '黑死病',
    description: '最大 HP 大幅降低,压力增长提高。',
    tags: ['hp', 'stress', 'severe'],
    flavor: '淋巴结肿大,发烧,濒死。',
    treatmentCostBase: 900,
  },
  disease_sluggish: {
    id: 'disease_sluggish',
    name: '迟钝症',
    description: '速度降低,主要执行者评分下降。',
    tags: ['speed', 'actor-rating'],
    flavor: '反应慢了半拍。',
    treatmentCostBase: 400,
  },
  disease_lung: {
    id: 'disease_lung',
    name: '肺病',
    description: '中型任务疲劳提高,露营恢复降低。',
    tags: ['camp', 'recovery', 'stamina'],
    flavor: '每一步都像在爬坡。',
    treatmentCostBase: 600,
  },
  disease_parasite: {
    id: 'disease_parasite',
    name: '寄生感染',
    description: '食物消耗和饥饿风险提高。',
    tags: ['food', 'hunger'],
    flavor: '肚子里的东西在吃她吃的东西。',
    treatmentCostBase: 450,
  },
  disease_tetanus: {
    id: 'disease_tetanus',
    name: '破伤风',
    description: '命中降低,陷阱失败伤害提高。',
    tags: ['accuracy', 'trap', 'damage-taken'],
    flavor: '肌肉痉挛,关节锁死。',
    treatmentCostBase: 500,
  },
  disease_rabies: {
    id: 'disease_rabies',
    name: '狂犬病',
    description: '伤害提高,但命中和精神稳定降低。',
    tags: ['damage', 'accuracy', 'mental'],
    flavor: '她在咆哮。',
    treatmentCostBase: 750,
  },
  disease_weakness: {
    id: 'disease_weakness',
    name: '虚弱症',
    description: '治疗效果降低,死亡之门恢复惩罚加重。',
    tags: ['healing', 'deaths-door'],
    flavor: '连站起来都困难。',
    treatmentCostBase: 500,
  },
  disease_scurvy: {
    id: 'disease_scurvy',
    name: '坏血病',
    description: '露营和进食恢复降低。',
    tags: ['camp', 'healing', 'recovery'],
    flavor: '牙齿松动,伤口不愈。',
    treatmentCostBase: 400,
  },
  disease_hallucination: {
    id: 'disease_hallucination',
    name: '幻觉症',
    description: '风险提示偶尔失真。',
    tags: ['risk-preview', 'info'],
    flavor: '墙角在动,门在低语。',
    treatmentCostBase: 600,
  },
};

export function getDiseaseDef(id: string): DiseaseDefinition | null {
  return DISEASE_REGISTRY[id] ?? null;
}

export function listDiseases(): DiseaseDefinition[] {
  return Object.values(DISEASE_REGISTRY);
}
