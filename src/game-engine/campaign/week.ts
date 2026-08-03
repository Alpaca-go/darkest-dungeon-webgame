/**
 * 周推进(SPEC §4.1 §5 §8 §17)
 *
 * advanceWeek 把状态推进一周:
 *   1. 结算所有设施占用(设施 1 周后产生效果)
 *   2. 把 selected-for-party / 治疗 / 训练 等所有活动状态在合适时机重置
 *   3. campaign.week += 1
 *   4. 刷新本周招募候选(马车)
 *   5. 刷新本周任务列表
 *   6. 重置 hamlet weekly state(quest 选、party 选、provision cart)
 *   7. 生成本周提示
 *
 * 死英雄永久保留 deadHeroIds,不会复活。
 */

import type { GameState } from '../expedition/types.js';
import type { WeeklyNotice } from './types.js';
import { ensureCampaign, ensureHamlet } from './state.js';
import { settleFacilities } from './facilities.js';
import { generateWeeklyRecruits } from './recruits.js';
import { generateWeeklyQuests } from './quests.js';

let noticeCounter = 0;
function nextNoticeId(): string {
  noticeCounter += 1;
  return `notice_${noticeCounter.toString(36)}`;
}

export interface AdvanceWeekResult {
  /** 新周数 */
  week: number;
  /** 设施完成的英雄 */
  facilityCompleted: { heroId: string; serviceId: string }[];
  /** 新生成的招募候选 id */
  recruitCandidateIds: string[];
  /** 新生成的任务 id */
  questIds: string[];
  /** 本周提示 */
  notices: WeeklyNotice[];
}

/** 周推进(不修改旧 state,在传入的 state 上原地写) */
export function advanceWeek(state: GameState): AdvanceWeekResult {
  const campaign = ensureCampaign(state);
  const hamlet = ensureHamlet(state);

  // 1. 设施结算
  const facility = settleFacilities(state);

  // 2. 还原 selected-for-party (远征结束后)
  for (const hero of Object.values(state.party)) {
    if (hero.activityState === 'selected-for-party') {
      hero.activityState = 'available';
      hero.assignedFacilityId = null;
      hero.activityWeeksRemaining = 0;
    }
  }

  // 3. 周数 + 1
  campaign.week += 1;
  // 本周完成的任务从 availableQuestIds 移到 completedQuestIds
  campaign.completedQuestIds = [
    ...campaign.completedQuestIds,
    ...campaign.availableQuestIds,
  ];
  campaign.availableQuestIds = [];

  // 4. 刷新招募
  hamlet.recruitCandidates = generateWeeklyRecruits(state);
  campaign.availableRecruitIds = hamlet.recruitCandidates.map((c) => c.id);

  // 5. 刷新任务
  const newQuests = generateWeeklyQuests(state);
  hamlet.weeklyQuestDefs = {};
  hamlet.weeklyQuestIds = [];
  for (const q of newQuests) {
    hamlet.weeklyQuestDefs[q.id] = q;
    hamlet.weeklyQuestIds.push(q.id);
  }
  campaign.availableQuestIds = [...hamlet.weeklyQuestIds];

  // 6. 重置 hamlet 临时状态
  hamlet.selectedQuestId = null;
  hamlet.selectedPartyHeroIds = [];
  hamlet.provisionCart = {};

  // 7. 生成本周提示
  hamlet.weeklyNotices = generateWeeklyNotices(state);

  return {
    week: campaign.week,
    facilityCompleted: facility.completed.map((c) => ({ heroId: c.heroId, serviceId: c.serviceId })),
    recruitCandidateIds: campaign.availableRecruitIds,
    questIds: campaign.availableQuestIds,
    notices: hamlet.weeklyNotices,
  };
}

/** 根据当前状态生成 3-5 条提示(按 priority 排序) */
export function generateWeeklyNotices(state: GameState): WeeklyNotice[] {
  const campaign = ensureCampaign(state);
  const hamlet = ensureHamlet(state);
  const notices: WeeklyNotice[] = [];

  // 1. 队伍全死 — cannot-form-party
  const aliveCount = countAliveRoster(state);
  if (aliveCount === 0) {
    notices.push({
      id: nextNoticeId(),
      type: 'cannot-form-party',
      priority: 100,
      message: '名册已空 — 无法组队出征。',
    });
  }

  // 2. 高压力英雄 — high-stress
  for (const hero of Object.values(state.party)) {
    if (hero.isDead) continue;
    if (hero.stress >= 100) {
      notices.push({
        id: nextNoticeId(),
        type: 'high-stress',
        priority: 80,
        message: `${hero.name} 压力 ${Math.round(hero.stress)}/200 — 建议减压或换下。`,
        relatedId: hero.id,
      });
    }
  }

  // 3. 资源短缺
  if (campaign.gold < 1000) {
    notices.push({
      id: nextNoticeId(),
      type: 'resource-shortage',
      priority: 70,
      message: `金币仅剩 ${campaign.gold} — 远低于基本维持费。`,
    });
  }

  // 4. 马车有候选 — recruit-opportunity
  if (hamlet.recruitCandidates.length > 0) {
    notices.push({
      id: nextNoticeId(),
      type: 'recruit-opportunity',
      priority: 50,
      message: `马车有 ${hamlet.recruitCandidates.length} 名新候选。`,
    });
  }

  // 5. 设施升级机会
  for (const fac of Object.values(campaign.facilityStates)) {
    if (fac.upgradeOptions.length > 0) {
      notices.push({
        id: nextNoticeId(),
        type: 'upgrade-opportunity',
        priority: 30,
        message: `${fac.id} 可升级 (${fac.upgradeOptions[0]!.title})。`,
        relatedId: fac.id,
      });
    }
  }

  // 排序:priority desc
  notices.sort((a, b) => b.priority - a.priority);
  return notices.slice(0, 5);
}

function countAliveRoster(state: GameState): number {
  let n = 0;
  for (const hero of Object.values(state.party)) {
    if (!hero.isDead) n += 1;
  }
  return n;
}
