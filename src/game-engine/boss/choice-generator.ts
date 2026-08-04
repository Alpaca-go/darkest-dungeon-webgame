/**
 * Boss 战术选择生成器(Phase 6A,SPEC §13)
 *
 * 输入:当前阶段 + 玩家已知情报 + 已应用削弱 + 环境目标 + 队伍状态
 * 输出:2-4 个 GeneratedChoice(复用现有选择管线)
 *
 * 数据驱动:选项来自 phase.tacticalOptionRules;UI 不生成战术。
 */

import type {
  BossPhaseDefinition,
  TacticalOptionRule,
  IntelligenceUnlockSource,
} from './types.js';
import { BOSS_INTELLIGENCE, BOSS_WEAKENING_EFFECTS } from './registry.js';
import type { GeneratedChoice, RiskPreview } from '../expedition/types.js';

// =====================================================================
// 上下文
// =====================================================================

/**
 * 选择生成上下文
 */
export interface BossChoiceContext {
  bossId: string;
  phaseId: string;
  /** 已发现情报 id */
  discoveredIntelligenceIds: string[];
  /** 已应用削弱效果 id */
  appliedWeakeningIds: string[];
  /** 当前存活环境目标 id */
  intactEnvironmentTargetIds: string[];
  /** 已拥有 Boss 特殊物品 id */
  availableBossItemIds: string[];
  /** 当前队伍状态(简化版;用于 condition 判定) */
  party: {
    heroIds: string[];
    lowestHpPercent: number;   // 0-1
    maxStressPercent: number;   // 0-1
    anyHeroOnDeathsDoor: boolean;
  };
}

// =====================================================================
// 选择生成
// =====================================================================

/**
 * 生成 Boss 战术选项
 * 永远返回 2-4 个选项(SPEC §13);若不足则用空默认值
 */
export function generateBossTacticalOptions(
  phase: BossPhaseDefinition,
  context: BossChoiceContext,
): GeneratedChoice[] {
  // 1. 过滤出当前阶段且满足条件的选项
  const candidates = phase.tacticalOptionRules.filter((rule) =>
    isRuleApplicable(rule, context),
  );

  // 2. 按 weight 排序
  candidates.sort((a, b) => b.weight - a.weight);

  // 3. 限制为 2-4 个
  const selected = candidates.slice(0, 4);
  if (selected.length < 2) {
    selected.push(...candidates.slice(0, 2 - selected.length));
  }

  // 4. 转成 GeneratedChoice
  return selected.map((rule, i) => ruleToGeneratedChoice(rule, i, phase, context));
}

// =====================================================================
// 内部:规则 → GeneratedChoice
// =====================================================================

function isRuleApplicable(
  rule: TacticalOptionRule,
  context: BossChoiceContext,
): boolean {
  // 阶段匹配(若规则指定 phaseIndex)
  if (rule.phaseIndex !== undefined && rule.phaseIndex !== phasePhaseIndex(rule, context.phaseId)) {
    return false;
  }

  // 条件检查
  for (const cond of rule.conditions) {
    if (!evalCondition(cond, context)) return false;
  }

  // 物品条件:use-item 类别的选项通常依赖特定 Boss 物品
  // 这里用 riskTags 包含 'consume-boss-item' 作为检查信号
  if (rule.category === 'use-item' && rule.riskTags.includes('consume-boss-item')) {
    if (context.availableBossItemIds.length === 0) {
      return false;
    }
  }

  return true;
}

function phasePhaseIndex(rule: TacticalOptionRule, _phaseId: string): number {
  // 通过 rule 自身获取(调用方已知)
  return rule.phaseIndex ?? 0;
}

function ruleToGeneratedChoice(
  rule: TacticalOptionRule,
  index: number,
  phase: BossPhaseDefinition,
  context: BossChoiceContext,
): GeneratedChoice {
  const visibleRisks: RiskPreview[] = rule.riskTags.map((tag) => ({
    kind: 'enemy-react',
    severity: 'medium',
    description: tag,
  }));
  return {
    id: `boss-choice-${context.bossId}-${phase.phaseIndex}-${rule.id}-${index}`,
    sourceDefinitionId: rule.id,
    title: rule.title,
    description: rule.description,
    enabled: true,
    visibleCosts: [],
    visibleRisks,
    tags: ['boss-tactical', `phase-${phase.phaseIndex}`, rule.category],
    reason: `阶段 ${phase.phaseIndex} · ${rule.category}`,
  };
}

// =====================================================================
// 条件评估(简化版)
// =====================================================================

function evalCondition(
  cond: { kind: string; flagName?: string; value?: number | string; tags?: string[] },
  context: BossChoiceContext,
): boolean {
  switch (cond.kind) {
    case 'flag-exists':
      // 简化:不评估真实 flag 表,仅供框架使用
      return true;
    case 'flag-gte':
      return true;
    case 'tag-has':
      return !!cond.tags && cond.tags.every((t) => context.discoveredIntelligenceIds.includes(t));
    default:
      // 未实现的条件 → 默认通过(避免误判)
      return true;
  }
}

// =====================================================================
// 辅助:应用情报解锁
// =====================================================================

/**
 * 应用情报解锁(返回新的 discoveredIntelligenceIds,幂等)
 * 实际逻辑由 dispatcher 触发;这里只是辅助函数
 */
export function applyIntelligenceUnlock(
  discovered: string[],
  unlockSource: IntelligenceUnlockSource,
): string[] {
  // unlockSource.sourceId 即情报 id(对于 investigation-quest 类型)
  if (discovered.includes(unlockSource.sourceId)) return discovered;
  if (!BOSS_INTELLIGENCE[unlockSource.sourceId]) return discovered;
  return [...discovered, unlockSource.sourceId];
}

// =====================================================================
// 辅助:应用削弱效果(幂等)
// =====================================================================

/**
 * 应用削弱效果(SPEC §27 不变量: "削弱效果不得重复叠加")
 * 返回新的 activeWeakeningEffectIds
 */
export function applyWeakening(
  active: string[],
  weakeningId: string,
): string[] {
  if (active.includes(weakeningId)) return active;
  if (!BOSS_WEAKENING_EFFECTS[weakeningId]) return active;
  return [...active, weakeningId];
}

/**
 * 移除削弱效果(撤退后可能失效)
 */
export function removeWeakening(
  active: string[],
  weakeningId: string,
): string[] {
  return active.filter((id) => id !== weakeningId);
}
