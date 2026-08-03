/**
 * 疾病管理(SPEC §5.3)
 *
 * 获得(acquire by source):
 *  - 死英雄不接受疾病
 *  - 上限 3 个,达到上限拒绝获得
 *  - 已有同 id → idempotent
 *
 * 治疗(treat):
 *  - 疗养院 service 触发
 *  - 实际费用 = treatmentCostBase × hero 等级系数 × sanitarium 等级系数(SPEC §6.2)
 */

import type { HeroInstance } from '../expedition/types.js';
import type { DiseaseAcquireResult, DiseaseTreatResult, DiseaseSource } from './types.js';
import { DISEASE_MAX } from './types.js';
import { getDiseaseDef } from './registry.js';

/** 获得一个疾病 */
export function acquireDisease(
  hero: HeroInstance,
  diseaseId: string,
  _source: DiseaseSource,
): DiseaseAcquireResult {
  if (!getDiseaseDef(diseaseId)) {
    return { ok: false, reason: `unknown disease: ${diseaseId}` };
  }
  if (hero.isDead) return { ok: false, reason: 'dead hero cannot gain diseases' };
  if (!hero.diseaseIds) hero.diseaseIds = [];
  if (hero.diseaseIds.includes(diseaseId)) {
    return { ok: true, diseaseId }; // idempotent
  }
  if (hero.diseaseIds.length >= DISEASE_MAX) {
    return { ok: false, reason: `disease slots full (max ${DISEASE_MAX})` };
  }
  hero.diseaseIds.push(diseaseId);
  return { ok: true, diseaseId };
}

/** 治疗费用计算(SPEC §6.2) */
export function calculateTreatmentCost(
  baseCost: number,
  heroLevel: number,
  facilityLevel: number,
): number {
  // 英雄等级系数:1 + 0.2 * level
  const heroCoef = 1 + 0.2 * heroLevel;
  // 设施等级系数:1 - 0.1 * (level - 1) = level 1 = 1.0, level 2 = 0.9
  const facilityCoef = Math.max(0.5, 1 - 0.1 * Math.max(0, facilityLevel - 1));
  return Math.floor(baseCost * heroCoef * facilityCoef);
}

/** 治疗一个疾病 */
export function treatDisease(
  hero: HeroInstance,
  diseaseId: string,
  heroLevel: number,
  facilityLevel: number,
): DiseaseTreatResult {
  if (!hero.diseaseIds) hero.diseaseIds = [];
  if (!hero.diseaseIds.includes(diseaseId)) {
    return { ok: false, reason: 'hero does not have this disease' };
  }
  const def = getDiseaseDef(diseaseId);
  if (!def) return { ok: false, reason: `unknown disease: ${diseaseId}` };
  const cost = calculateTreatmentCost(def.treatmentCostBase, heroLevel, facilityLevel);
  hero.diseaseIds = hero.diseaseIds.filter((d) => d !== diseaseId);
  return { ok: true, diseaseId, costGold: cost };
}

/** 列出 hero 当前疾病 + 治疗费用 */
export function listTreatableDiseases(
  hero: HeroInstance,
  heroLevel: number,
  facilityLevel: number,
): Array<{ diseaseId: string; costGold: number; name: string }> {
  if (!hero.diseaseIds) hero.diseaseIds = [];
  return hero.diseaseIds.map((id) => {
    const def = getDiseaseDef(id);
    return {
      diseaseId: id,
      costGold: def ? calculateTreatmentCost(def.treatmentCostBase, heroLevel, facilityLevel) : 0,
      name: def?.name ?? id,
    };
  });
}
