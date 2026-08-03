/**
 * 远征报告(SPEC §32)
 *
 * 报告包含:
 * - 任务结果
 * - 最深节点
 * - 访问节点数
 * - 遭遇/陷阱/饥饿次数
 * - 火把/食物使用
 * - 最低火把
 * - 战利品
 * - 丢弃物品
 * - 英雄最低 HP
 * - 关键选择
 * - 撤退位置
 *
 * 失败链:从 keyChoices + keyEvents 推导出人类可读的失败原因链。
 */

import type { GameState, ExpeditionStats, RiskLevel } from './types.js';

export interface ExpeditionReport {
  result: 'success' | 'retreat' | 'failure';
  stats: ExpeditionStats;
  failureChain: string[];
  keyChoices: { nodeId: string; choiceTitle: string; risk: RiskLevel }[];
  keyEvents: { eventId: string; nodeId: string; outcome: string }[];
  heroSnapshot: { heroId: string; name: string; hp: number; maxHp: number; isDead: boolean }[];
}

export function generateExpeditionReport(state: GameState): ExpeditionReport {
  const exp = state.expedition;
  const result = state.mode === 'expedition-success' ? 'success' :
    state.mode === 'expedition-retreat' ? 'retreat' :
      state.mode === 'expedition-failure' ? 'failure' :
        'retreat';

  const heroSnapshot = Object.values(state.party).map((h) => ({
    heroId: h.id,
    name: h.name,
    hp: h.hp,
    maxHp: h.maxHp,
    isDead: h.isDead,
  }));

  const failureChain = buildFailureChain(state);

  return {
    result,
    stats: { ...exp.stats },
    failureChain,
    keyChoices: [...exp.keyChoices],
    keyEvents: [...exp.keyEvents],
    heroSnapshot,
  };
}

function buildFailureChain(state: GameState): string[] {
  const chain: string[] = [];
  const exp = state.expedition;
  // 找高风险选择
  for (const c of exp.keyChoices) {
    if (c.risk === 'high' || c.risk === 'extreme') {
      chain.push(`在 ${c.nodeId} 选择「${c.choiceTitle}」(高风险)`);
    }
  }
  // 找 trap 触发
  for (const e of exp.keyEvents) {
    if (e.eventId.startsWith('trap_')) {
      chain.push(`触发陷阱 ${e.eventId} (${e.outcome})`);
    }
  }
  // 找 hero death
  for (const h of Object.values(state.party)) {
    if (h.isDead) {
      chain.push(`英雄 ${h.name} 阵亡`);
    }
  }
  // 火把耗尽
  if (exp.torch === 0) {
    chain.push('火把耗尽');
  }
  // 撤退位置
  if (exp.stats.retreatPosition) {
    chain.push(`在 ${exp.stats.retreatPosition.nodeId} (深度 ${exp.stats.retreatPosition.depth}) 撤退`);
  }
  // 任务失败
  if (exp.failed) {
    chain.push(`远征失败: ${exp.failReason ?? '未知'}`);
  }
  if (chain.length === 0) {
    if (state.mode === 'expedition-success') {
      chain.push('队伍稳扎稳打,完成了任务。');
    } else {
      chain.push('任务结束。');
    }
  }
  return chain;
}
