/**
 * 马车招募(SPEC §8)
 *
 * 每周刷新 3 名候选,Seeded RNG 决定职业/姓名/等级/技能/压力/怪癖接口。
 * 候选 id 与周数 + position 关联,刷新页面不重抽。
 */

import type { GameState, HeroInstance } from '../expedition/types.js';
import type { RecruitCandidate } from './types.js';
import { ensureCampaign } from './state.js';
import { INITIAL_RECRUIT_COUNT } from './types.js';

const HERO_FIRST_NAMES = [
  ['阿瑟', 'crusader'],
  ['凯恩', 'highwayman'],
  ['莉娜', 'vestal'],
  ['洛', 'plague_doctor'],
  ['欧德丽', 'bounty_hunter'],
  ['苦行者', 'jester'],
  ['莫德', 'bounty_hunter'],
  ['鲍德温', 'crusader'],
] as const;

const POSITIVE_QUIRK_IDS = ['quirk_beast_hunter', 'quirk_hardy', 'quirk_quick_reflexes'];
const NEGATIVE_QUIRK_IDS = ['quirk_disease_prone', 'quirk_draconic_taint', 'quirk_night_blind'];

// 用 seed + week + slot 哈希派生稳定 id,不依赖跨调用 counter
function nextRecruitId(week: number, slot: number, seed: string): string {
  const seedHash = seed.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `recruit_w${week}_s${slot}_${(seedHash + week * 17 + slot * 53).toString(36)}`;
}

/** 用 ctx.nextInt / ctx.nextFloat 生成 1 个候选(同一 seed 同结果) */
function rollCandidate(week: number, slot: number, seed: string): RecruitCandidate {
  // 简单可复现:用 seed 哈希
  const seedHash = seed.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  const idx = (seedHash + week * 17 + slot * 53) % HERO_FIRST_NAMES.length;
  const pick = HERO_FIRST_NAMES[idx]!;
  const [name, archetype] = pick as unknown as readonly [string, RecruitCandidate['archetype']];
  const level = ((seedHash + week * 13 + slot * 7) % 3);
  const stress = (seedHash + week * 11 + slot * 23) % 50;
  const positive = POSITIVE_QUIRK_IDS[(seedHash + week * 5) % POSITIVE_QUIRK_IDS.length]!;
  const negative = NEGATIVE_QUIRK_IDS[(seedHash + week * 19 + slot * 3) % NEGATIVE_QUIRK_IDS.length]!;
  return {
    id: nextRecruitId(week, slot, seed),
    name,
    archetype: archetype as RecruitCandidate['archetype'],
    level,
    skills: [`${archetype}.basic`, `${archetype}.secondary`],
    stress,
    positiveQuirkIds: [positive],
    negativeQuirkIds: [negative],
    diseaseIds: [],
    weeksAvailable: 1,
  };
}

/** 每周刷新 3 名候选(SPEC §8.1) */
export function generateWeeklyRecruits(state: GameState): RecruitCandidate[] {
  const campaign = ensureCampaign(state);
  const out: RecruitCandidate[] = [];
  // SPEC §8.1:每刷新 3 名候选(马车默认 3 名)
  for (let slot = 0; slot < INITIAL_RECRUIT_COUNT; slot += 1) {
    out.push(rollCandidate(campaign.week, slot, campaign.seed));
  }
  return out;
}

/** 招募候选进入名册(SPEC §8.3) */
export function recruitHeroToRoster(
  state: GameState,
  candidate: RecruitCandidate,
  baseActor: { maxHp: number; dodge: number; speed: number; accuracy: number; crit: number; skills: string[]; rank: 1 | 2 | 3 | 4 },
): { ok: boolean; reason?: string; hero?: HeroInstance } {
  const campaign = ensureCampaign(state);
  if (candidate.weeksAvailable <= 0) {
    return { ok: false, reason: '候选已过期' };
  }
  if (campaign.rosterHeroIds.length >= campaign.rosterCapacity) {
    return { ok: false, reason: '名册已满' };
  }
  if (campaign.rosterHeroIds.includes(candidate.id) || campaign.deadHeroIds.includes(candidate.id)) {
    return { ok: false, reason: '该英雄已在名册' };
  }
  // 分配新 id(可复现 — 基于 candidate.id,不用 Date.now)
  const newId = `hero_${candidate.id}`;
  const hero: HeroInstance = {
    id: newId,
    name: candidate.name,
    archetype: candidate.archetype as HeroInstance['archetype'],
    tags: [candidate.archetype],
    rank: baseActor.rank,
    hp: baseActor.maxHp,
    maxHp: baseActor.maxHp,
    protection: 0.1,
    dodge: baseActor.dodge,
    speed: baseActor.speed,
    accuracy: baseActor.accuracy,
    crit: baseActor.crit,
    bleedResist: 0.3,
    blightResist: 0.3,
    stunResist: 0.3,
    moveResist: 0.3,
    bleed: [],
    blight: [],
    stun: null,
    mark: null,
    protBuff: null,
    cooldowns: {},
    isDead: false,
    conditions: [],
    skills: baseActor.skills,
    stress: candidate.stress,
    resolveState: 'stable',
    afflictionId: null,
    virtueId: null,
    atDeathsDoor: false,
    deathsDoorRecoveryStacks: 0,
    deathblowPenalty: 0,
    heartAttackCount: 0,
    behaviorCooldowns: {},
    resolveLevel: candidate.level,
    xp: 0,
    weaponLevel: 0,
    armorLevel: 0,
    skillLevels: Object.fromEntries(baseActor.skills.map((s) => [s, 0])),
    positiveQuirkIds: [...candidate.positiveQuirkIds],
    negativeQuirkIds: [...candidate.negativeQuirkIds],
    diseaseIds: [],
    activityState: 'available',
    assignedFacilityId: null,
    activityWeeksRemaining: 0,
    expeditionCount: 0,
    successfulExpeditionCount: 0,
    retreatCount: 0,
    deathsDoorCount: 0,
    resistedDeathblowCount: 0,
  };
  state.party[newId] = hero;
  campaign.rosterHeroIds.push(newId);
  candidate.weeksAvailable = 0;
  return { ok: true, hero };
}
