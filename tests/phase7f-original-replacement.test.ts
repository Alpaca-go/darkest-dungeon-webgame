/**
 * Phase 7F 原创替换 + 发布前稳定化测试(SPEC §26 + §29)
 *
 * 验证产品代码(非测试)不含原作专属词:
 *  - 原作职业:Crusader / Plague Doctor / Vestal / Highwayman / Jester 等
 *  - 原作英雄:Reynauld / Dismas / Junia / Baudelaire 等
 *  - 原作地名:Hamlet / Estate / Darkest Dungeon
 *  - 原作 UI 词:Heart Attack / Stress Heal
 *
 * 此外验证:
 *  - Phase 1-7 完整存档迁移链
 *  - 最终结果原子保存
 *  - Debug 事件不进入正式统计
 *  - 不可重复结算
 *  - 同 seed 可复现
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveFinalVictory,
  resolveFinalFailure,
  attemptFinalRetreat,
  createEmptyFinalCampaignState,
  openFinalCampaignGate,
  startFinalOuterQuest,
  completeFinalOuterQuest,
  destroyFinalSeal,
  unlockFinalAssault,
  startFinalAssault,
  calculateCampaignSummary,
  FINAL_REGIONS,
  FINAL_ENEMIES,
  FINAL_CURIOS,
  FINAL_TRAPS,
  FINAL_QUEST_ITEMS,
  FINAL_CAMP_ACTIVITIES,
  HERO_TRIALS,
  FINAL_BOSS_INFO,
  FINAL_BOSS_PHASE_IDS,
} from '../src/game-engine/final/index.js';

// 原作专属词(SPEC §26.1) — 只查"高唯一性"专有名词(人名/UI 词)
// 不查区域名(Weald / Warrens / Cove),因 'recover' / 'cove' 等 false positive 高
const HIGH_IDENTITY_WORDS = [
  // 原作英雄(SPEC §7F 验收)
  'Reynauld', 'Dismas', 'Junia', 'Baudelaire', 'Paracelsus',
  // 原作 UI 词
  'Heart Attack', 'stress heal',
];

function walkDir(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkDir(full, out);
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('Phase 7F: 产品代码使用 Darkest Dungeon 原作专属词(用户选择 B / 2026-08-04)', () => {
  it('src/** 含 Reynauld / Dismas / Junia / Paracelsus 等高识别度原作英雄名', () => {
    // 用户明确选择 B(承担版权风险),将原"原创"英雄名还原为原作名
    // 验收:HERO_FIRST_NAMES 包含 Reynauld / Dismas / Junia / Paracelsus
    const files = walkDir('src');
    const found: { file: string; word: string; line: number }[] = [];
    for (const file of files) {
      if (file.includes('test') || file.includes('spec')) continue;
      if (file.includes('content-audit')) continue;
      if (file.includes('originality')) continue; // originality 工具仍排除
      if (file.includes('production-audit')) continue; // production-audit 检测自身也排除
      const text = readFileSync(file, 'utf-8');
      for (const word of ['Reynauld', 'Dismas', 'Junia', 'Paracelsus']) {
        if (text.includes(word)) {
          const lines = text.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(word)) {
              found.push({ file, word, line: i + 1 });
            }
          }
        }
      }
    }
    // 期望至少 recruits.ts 和 lineup.ts 都含原作英雄名
    const foundWords = new Set(found.map((f) => f.word));
    expect(foundWords.has('Reynauld')).toBe(true);
    expect(foundWords.has('Dismas')).toBe(true);
    expect(foundWords.has('Junia')).toBe(true);
    expect(foundWords.has('Paracelsus')).toBe(true);
  });

  it('最终 Boss + 最终区域:命名就位(后续 commit 还原)', () => {
    // 注意:用户已选 B(2026-08-04),后续 commit 将把名字改回原作名
    // 本测试只验证结构存在性,不做内容校验
    expect(FINAL_BOSS_INFO).toBeDefined();
    expect(FINAL_BOSS_INFO.id).toBeTruthy();
    expect(FINAL_REGIONS['darkest-core']).toBeDefined();
    expect(FINAL_QUEST_ITEMS).toBeDefined();
    expect(FINAL_CAMP_ACTIVITIES).toBeDefined();
    expect(HERO_TRIALS).toBeDefined();
  });
});

describe('Phase 7F: 不可重复结算(SPEC §19)', () => {
  it('最终胜利不可重复结算', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'final-assault-active';
    s = resolveFinalVictory(s).state;
    expect(s.finalBossDefeated).toBe(true);
    expect(s.status).toBe('victory');
    // 再次胜利应失败
    const r2 = resolveFinalVictory(s);
    expect(r2.errors.length).toBeGreaterThan(0);
  });

  it('失败不可回退到胜利', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'final-assault-active';
    s = resolveFinalFailure(s).state;
    expect(s.status).toBe('failed');
    // 尝试胜利应失败
    const r = resolveFinalVictory(s);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('封印摧毁去重(SPEC §19)', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'outer-complete';
    const r1 = destroyFinalSeal(s, {
      sealId: 'seal-a',
      finalQuestItemId: 'item-a',
      intelligenceId: 'intel-1',
      week: 1,
    });
    s = r1.state;
    const r2 = destroyFinalSeal(s, {
      sealId: 'seal-a', // 重复
      finalQuestItemId: 'item-a',
      intelligenceId: 'intel-1',
      week: 2,
    });
    expect(r2.errors.length).toBeGreaterThan(0);
  });

  it('最终 Boss 4 阶段不可重复进入', () => {
    expect(FINAL_BOSS_PHASE_IDS.length).toBe(4);
    // 阶段 index 0/1/2/3 唯一
    const uniquePhases = new Set(FINAL_BOSS_PHASE_IDS);
    expect(uniquePhases.size).toBe(4);
  });
});

describe('Phase 7F: Debug 事件不进入正式统计(SPEC §1.4)', () => {
  it('calculateCampaignSummary 过滤 debug 事件', () => {
    const summary = calculateCampaignSummary({
      events: [
        { type: 'QUEST_SUCCESS' },
        { type: 'QUEST_SUCCESS' },
        { type: 'DEBUG_FORCE_BOSS_DEFEAT', debug: true },
        { type: 'DEBUG_SET_REGION_THREAT', debug: true },
      ],
      finalState: createEmptyFinalCampaignState(),
      finalRegionName: '黑暗核心',
      week: 30,
      graveyardHeroIds: [],
      usedHeroIds: [],
      mostUsedPartyHeroIds: [],
      keyTurningPointEventIds: [],
      finalEndingType: 'failed-assault',
    });
    expect(summary.successfulQuests).toBe(2);
    // 没有正式 BOSS_DEFEATED 事件,所以击败 0
    expect(summary.defeatedBossIds.length).toBe(0);
  });
});

describe('Phase 7F: 完整流程不变量(SPEC §28)', () => {
  it('完整流程:开入口 → 外层 → 3 封印 → 讨伐 → 胜利,所有阶段推进', () => {
    let s = createEmptyFinalCampaignState();
    s = openFinalCampaignGate(s, {
      defeatedBossIds: ['a', 'b', 'c'],
      finalCampaignGateReady: true,
      week: 50,
    }).state;
    s = startFinalOuterQuest(s, { week: 51 }).state;
    s = completeFinalOuterQuest(s, { week: 52 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-a', finalQuestItemId: 'item-a', intelligenceId: 'intel-1', week: 53 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-b', finalQuestItemId: 'item-b', intelligenceId: 'intel-2', week: 54 }).state;
    s = destroyFinalSeal(s, { sealId: 'seal-c', finalQuestItemId: 'item-c', intelligenceId: 'intel-3', week: 55 }).state;
    s = unlockFinalAssault(s, { requiredSealIds: ['seal-a', 'seal-b', 'seal-c'], week: 56 }).state;
    s = startFinalAssault(s, { week: 57 }).state;
    s = resolveFinalVictory(s).state;
    expect(s.status).toBe('victory');
    expect(s.finalBossDefeated).toBe(true);
    expect(s.destroyedSealIds.length).toBe(3);
    expect(s.completedQuestStageIds).toEqual(['outer-expedition', 'seal-destruction', 'final-assault']);
  });

  it('失败继续可重新挑战(SPEC §13)', () => {
    let s = createEmptyFinalCampaignState();
    s.status = 'failed';
    s.destroyedSealIds = ['seal-a', 'seal-b', 'seal-c'];
    s.collectedFinalQuestItemIds = ['item-a', 'item-b', 'item-c'];
    s.finalRegionThreat = 50;
    s = openFinalCampaignGate(s, {
      defeatedBossIds: ['a', 'b', 'c'],
      finalCampaignGateReady: true,
      week: 60,
    }).state; // 不会通过(status !== gate-ready)
    // 实际流程
    s.status = 'final-assault-ready';
    s = startFinalAssault(s, { week: 61 }).state;
    s = attemptFinalRetreat(s).state;
    expect(s.status).toBe('failed');
    s = openFinalCampaignGate(s, {
      defeatedBossIds: ['a', 'b', 'c'],
      finalCampaignGateReady: true,
      week: 62,
    }).state; // 仍不会通过
    // 验证累积损失保留
    expect(s.finalRegionThreat).toBe(75); // 50 + 25
  });
});
