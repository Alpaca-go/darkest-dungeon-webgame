/**
 * 疾病系统类型(SPEC §5)
 *
 * 疾病是负面状态:
 *  - 最多 3 个
 *  - 影响 HP / 速度 / 抗性 / 压力 / 食物 / 治疗 / 露营
 *  - 疗养院可治疗
 *
 * 怪癖 vs 疾病:
 *  - 怪癖:长期个性(可正可负)
 *  - 疾病:负面状态(最多 3 个,可治疗)
 */

import type { HeroInstance } from '../expedition/types.js';

export type DiseaseSource =
  | 'enemy-skill'
  | 'corrupted-curio'
  | 'trap'
  | 'hunger'
  | 'polluted-environment'
  | 'low-torch-event'
  | 'medium-quest-exposure'
  | 'night-ambush'
  | 'tavern-side-effect';

export interface DiseaseDefinition {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** 治疗基础费用(疗养院) */
  treatmentCostBase: number;
  /** 简短提示 */
  flavor: string;
}

export type DiseaseAcquireResult =
  | { ok: true; diseaseId: string }
  | { ok: false; reason: string };

export type DiseaseTreatResult =
  | { ok: true; diseaseId: string; costGold: number }
  | { ok: false; reason: string };

export const DISEASE_MAX = 3;

/** 从 HeroInstance 提取疾病 id 列表 */
export function readDiseaseIds(hero: HeroInstance): string[] {
  return [...(hero.diseaseIds ?? [])];
}
