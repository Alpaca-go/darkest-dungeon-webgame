/**
 * 任务生成(SPEC §17)
 *
 * 每周 3 个任务,Seeded RNG 决定难度 / 节点数 / 推荐职业 / 奖励。
 */

import type { GameState } from '../expedition/types.js';
import type { QuestDefinition, QuestDifficulty } from './types.js';
import { ensureCampaign } from './state.js';

const QUESTS_PER_WEEK = 3;

const QUEST_TEMPLATES: { title: string; description: string; difficulty: QuestDifficulty; threat: QuestDefinition['threat']; nodeCount: [number, number]; rewards: QuestDefinition['rewards']; specialEventTendency?: QuestDefinition['specialEventTendency'] }[] = [
  { title: '清扫墓室入口', description: '清理墓室入口的骸骨巡逻队。', difficulty: 'safe', threat: 'beast', nodeCount: [3, 5], rewards: { gold: 800, portraits: 1, crests: 1, heroXp: 50 } },
  { title: '追回失窃遗物', description: '强盗偷走了家族遗物,追踪他们的巢穴。', difficulty: 'standard', threat: 'human', nodeCount: [5, 7], rewards: { gold: 1500, portraits: 2, crests: 2, heroXp: 120 } },
  { title: '净化污秽祭坛', description: '深处有邪教祭坛,需要彻底摧毁。', difficulty: 'high-risk', threat: 'unholy', nodeCount: [7, 9], rewards: { gold: 2500, portraits: 4, crests: 3, heroXp: 200 } },
  { title: '探索古井', description: '村庄古井中传来怪声,深入调查。', difficulty: 'safe', threat: 'eldritch', nodeCount: [4, 6], rewards: { gold: 1000, portraits: 1, crests: 2, heroXp: 80 } },
  { title: '镇压强盗据点', description: '附近的强盗越来越嚣张,需要给他们教训。', difficulty: 'standard', threat: 'human', nodeCount: [5, 7], rewards: { gold: 1400, portraits: 2, crests: 1, heroXp: 100 }, specialEventTendency: 'traps' },
  { title: '猎杀变异巨鼠', description: '变异巨鼠侵扰了商路,需要清剿。', difficulty: 'high-risk', threat: 'beast', nodeCount: [6, 8], rewards: { gold: 2000, portraits: 3, crests: 2, heroXp: 180 }, specialEventTendency: 'starvation' },
];

// 用 seed + week + slot 哈希派生稳定 id(不依赖跨调用 counter)
function nextQuestId(week: number, slot: number, seed: string): string {
  const seedHash = seed.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `quest_w${week}_s${slot}_${(seedHash + week * 13 + slot * 7).toString(36)}`;
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 每周生成 3 个任务 */
export function generateWeeklyQuests(state: GameState): QuestDefinition[] {
  const campaign = ensureCampaign(state);
  const out: QuestDefinition[] = [];
  for (let slot = 0; slot < QUESTS_PER_WEEK; slot += 1) {
    const seed = `${campaign.seed}:quests:${campaign.week}:${slot}`;
    const h = simpleHash(seed);
    const tpl = QUEST_TEMPLATES[h % QUEST_TEMPLATES.length]!;
    const [minN, maxN] = tpl.nodeCount;
    const nodeCount = minN + (h % (maxN - minN + 1));
    out.push({
      id: nextQuestId(campaign.week, slot, campaign.seed),
      title: tpl.title,
      description: tpl.description,
      difficulty: tpl.difficulty,
      nodeCount,
      threat: tpl.threat,
      recommendedClassTags: [tpl.threat === 'beast' ? 'blight' : tpl.threat === 'human' ? 'ranged' : tpl.threat === 'unholy' ? 'holy' : 'scout'],
      expectedProvisions: {
        food: nodeCount * 2,
        torch: nodeCount * 4,
        bandage: 1,
      },
      rewards: { ...tpl.rewards },
      failPenalty: { goldLost: Math.floor(tpl.rewards.gold * 0.3) },
      specialEventTendency: tpl.specialEventTendency,
    });
  }
  return out;
}

// 注:QuestDefinition 在调用 generateWeeklyQuests() 时生成并返回;
// caller 需自己把结果存到 hamlet.weeklyQuestDefs / campaign.availableQuestIds
// 没有再单独提供 getQuest 入口 — 任务在选择前已存为 weeklyQuestDefs 列表。
