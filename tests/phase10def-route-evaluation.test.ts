/**
 * Phase 10D/E/F: 实战平衡 + Patch 流程 + 1.1 路线评估
 *
 * 10D:ProductionBalanceChange 数据结构 + 状态变更
 * 10E:12 步 Patch 流水线 + 6 个回归场景 + 10 个发布后验证
 * 10F:VersionRouteEvaluation + 1.1 决策(用户选 A 内容扩展)
 *
 * 关联文档:docs/version-1.1-decision.md(测试运行时生成)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createBalanceChange,
  applyBalanceChange,
  PATCH_RELEASE_PIPELINE,
  PATCH_REGRESSION_SCENARIOS,
  POST_DEPLOY_VERIFICATION,
  evaluateRoute,
  calculateRouteScore,
  selectBestRoute,
  createVersion111Decision,
  renderDecisionReport,
  writeDecisionReport,
  type RouteId,
  type VersionRouteEvaluation,
  type Version111Decision,
} from '../src/tools/route-evaluation.js';

const DOCS_DIR = 'docs';
const DECISION_MD = join(DOCS_DIR, 'version-1.1-decision.md');

describe('Phase 10D: 实战平衡调整记录(SPEC §19.3)', () => {
  it('createBalanceChange:包含 11 字段 + proposed 状态', () => {
    const c = createBalanceChange({
      id: 'BC-001',
      buildVersionFrom: '1.0.0',
      buildVersionTo: '1.0.1',
      targetMetric: 'finalBossSuccessRate',
      evidenceIssueIds: ['PI-001'],
      previousValue: 0.5,
      newValue: 0.45,
      expectedEffect: '降低最终 Boss 数值,提高玩家公平感',
      regressionRisk: ['可能影响已通关玩家体验'],
    });
    expect(c.id).toBe('BC-001');
    expect(c.status).toBe('proposed');
    expect(c.buildVersionFrom).toBe('1.0.0');
    expect(c.buildVersionTo).toBe('1.0.1');
  });

  it('applyBalanceChange:状态变更', () => {
    const c = createBalanceChange({
      id: 'BC-002',
      buildVersionFrom: '1.0.0',
      buildVersionTo: '1.0.1',
      targetMetric: 'X',
      evidenceIssueIds: [],
      previousValue: 1,
      newValue: 2,
      expectedEffect: '...',
      regressionRisk: [],
    });
    const applied = applyBalanceChange(c, 'applied');
    expect(applied.status).toBe('applied');
  });
});

describe('Phase 10E: Patch 发布流程(SPEC §22)', () => {
  it('PATCH_RELEASE_PIPELINE 包含 12 步', () => {
    expect(PATCH_RELEASE_PIPELINE.length).toBe(12);
    expect(PATCH_RELEASE_PIPELINE[0]).toContain('Install');
    expect(PATCH_RELEASE_PIPELINE[11]).toContain('Smoke');
  });

  it('PATCH_REGRESSION_SCENARIOS 包含 6 项', () => {
    expect(PATCH_REGRESSION_SCENARIOS.length).toBe(6);
    expect(PATCH_REGRESSION_SCENARIOS).toContain('原问题存档');
    expect(PATCH_REGRESSION_SCENARIOS).toContain('PWA 更新');
  });

  it('POST_DEPLOY_VERIFICATION 包含 10 项', () => {
    expect(POST_DEPLOY_VERIFICATION.length).toBe(10);
    expect(POST_DEPLOY_VERIFICATION).toContain('版本号');
    expect(POST_DEPLOY_VERIFICATION).toContain('Service Worker');
  });
});

describe('Phase 10F: 1.1 路线评估(SPEC §24)', () => {
  it('evaluateRoute:包含 16 字段', () => {
    const r = evaluateRoute({
      routeId: 'content',
      routeName: '内容扩展',
      routeDescription: '2 新职业 + 1 新区域 + 1 Boss',
      playerDemandScore: 7,
      retentionImpactScore: 8,
      reuseExistingSystemsScore: 5,
      developmentCostScore: 8,
      maintenanceCostScore: 6,
      technicalRiskScore: 4,
      legalRiskScore: 2,
      evidenceConfidenceScore: 5,
    });
    expect(r.routeId).toBe('content');
    expect(r.evaluatedAt).toBeTruthy();
  });

  it('calculateRouteScore:综合得分 0-100', () => {
    const r = evaluateRoute({
      routeId: 'content',
      routeName: 'A',
      routeDescription: 'A',
      playerDemandScore: 5,
      retentionImpactScore: 5,
      reuseExistingSystemsScore: 5,
      developmentCostScore: 5,
      maintenanceCostScore: 5,
      technicalRiskScore: 5,
      legalRiskScore: 5,
      evidenceConfidenceScore: 5,
    });
    const score = calculateRouteScore(r);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('selectBestRoute:选择得分最高', () => {
    const r1 = evaluateRoute({
      routeId: 'content', routeName: 'A', routeDescription: 'A',
      playerDemandScore: 9, retentionImpactScore: 9, reuseExistingSystemsScore: 9,
      developmentCostScore: 5, maintenanceCostScore: 5,
      technicalRiskScore: 3, legalRiskScore: 2, evidenceConfidenceScore: 8,
    });
    const r2 = evaluateRoute({
      routeId: 'replayability', routeName: 'B', routeDescription: 'B',
      playerDemandScore: 5, retentionImpactScore: 5, reuseExistingSystemsScore: 5,
      developmentCostScore: 5, maintenanceCostScore: 5,
      technicalRiskScore: 5, legalRiskScore: 5, evidenceConfidenceScore: 5,
    });
    const best = selectBestRoute([r2, r1]);
    expect(best.routeId).toBe('content');
  });
});

describe('Phase 10F: 1.1 决策 = 路线 A(用户选择)', () => {
  let decision: Version111Decision;

  beforeAll(() => {
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });

    // 评估三条路线
    const contentRoute = evaluateRoute({
      routeId: 'content',
      routeName: '路线 A:内容扩展',
      routeDescription: '2 新职业 + 1 新区域 + 1 Boss + 配套敌人/奇物/饰品/任务',
      playerDemandScore: 7,
      retentionImpactScore: 8,
      reuseExistingSystemsScore: 5,
      developmentCostScore: 8,
      maintenanceCostScore: 7,
      technicalRiskScore: 4,
      legalRiskScore: 3,
      evidenceConfidenceScore: 6,
      supportingIssueIds: ['PI-002', 'PI-003'],
      decisionNotes: [
        '用户已选 A 内容扩展(2026-08-04 确认)',
        '2 新职业 + 1 新区域 + 1 Boss 复用 Phase 1-10 内容框架',
        '需要重新走 Content Audit(109+ 条目) + Originality Audit',
      ],
    });

    const replayRoute = evaluateRoute({
      routeId: 'replayability',
      routeName: '路线 B:重玩深度',
      routeDescription: '难度模式 / 随机战役修正 / 挑战 Seed / 区域变体',
      playerDemandScore: 8,
      retentionImpactScore: 9,
      reuseExistingSystemsScore: 9,
      developmentCostScore: 5,
      maintenanceCostScore: 4,
      technicalRiskScore: 3,
      legalRiskScore: 2,
      evidenceConfidenceScore: 5,
      decisionNotes: [
        'SPEC §23.2 默认推荐',
        '复用 Phase 1-10 全部内容',
        '但用户已选 A 优先',
      ],
    });

    const productRoute = evaluateRoute({
      routeId: 'productization',
      routeName: '路线 C:产品化升级',
      routeDescription: '账号 / 云存档 / 多设备同步',
      playerDemandScore: 6,
      retentionImpactScore: 7,
      reuseExistingSystemsScore: 3,
      developmentCostScore: 9,
      maintenanceCostScore: 9,
      technicalRiskScore: 8,
      legalRiskScore: 8,
      evidenceConfidenceScore: 3,
      decisionNotes: [
        '需要后端 + 数据库 + DDoS + GDPR 全面评估',
        '超出单机娱乐项目范围',
        '用户已确认不选 C',
      ],
    });

    decision = createVersion111Decision({
      buildVersion: '0.9.0-rc1',
      decidedBy: 'Alpaca-go',
      selectedRoute: 'content',
      rationale: '用户(2026-08-04)选择路线 A 内容扩展:2 新职业 + 1 新区域 + 1 Boss + 配套。\n\n' +
        '依据:\n' +
        '- 现有 Phase 1-10 内容已就位(109 条目 / 39 原创条目)\n' +
        '- 玩家可通关,但重开率仍待真实测试确认\n' +
        '- 内容扩展能直接复用 Phase 1-10 框架(战斗/远征/区域/Boss 状态机)\n' +
        '- 路线 B 重玩深度为 SPEC 默认推荐,留作 Phase 12 backlog\n' +
        '- 路线 C 产品化升级需后端运维,超出单机范围',
      routesEvaluated: [contentRoute, replayRoute, productRoute],
      evidenceRequired: [
        'v1.0.0 真实玩家流失数据(5-15 名测试者)',
        '第二局开启率统计',
        '内容重复感反馈',
        '职业 / 区域使用率',
      ],
      nextSteps: [
        'Phase 11 立项:2 新职业设计(具体职业待定)',
        'Phase 11 立项:1 新区域 + 1 Boss + 4 任务链',
        'Phase 11:重新走 Content Audit(目标 130+ 条目)',
        'Phase 11:重新走 Originality Audit(0 阻塞)',
        'Phase 11:更新 9 平衡指标 + 健康检查',
      ],
    });
    writeDecisionReport(decision);
  });

  it('decision.selectedRoute = content(路线 A)', () => {
    expect(decision.selectedRoute).toBe('content');
  });

  it('routesEvaluated 包含 3 条路线', () => {
    expect(decision.routesEvaluated.length).toBe(3);
    const ids = decision.routesEvaluated.map((r) => r.routeId);
    expect(ids).toContain('content');
    expect(ids).toContain('replayability');
    expect(ids).toContain('productization');
  });

  it('rejectedRoutes 包含非选中的 2 条', () => {
    expect(decision.rejectedRoutes.length).toBe(2);
    const ids = decision.rejectedRoutes.map((r) => r.routeId);
    expect(ids).toContain('replayability');
    expect(ids).toContain('productization');
    expect(ids).not.toContain('content');
  });

  it('evidenceRequired 至少 4 条', () => {
    expect(decision.evidenceRequired.length).toBeGreaterThanOrEqual(4);
  });

  it('nextSteps 至少 5 条', () => {
    expect(decision.nextSteps.length).toBeGreaterThanOrEqual(5);
  });

  it('renderDecisionReport:Markdown 包含所有评分', () => {
    const md = renderDecisionReport(decision);
    expect(md).toContain('1.1 路线决策报告');
    expect(md).toMatch(/\| 路线 \| 玩家需求/);
    expect(md).toContain('content');
    expect(md).toContain('replayability');
    expect(md).toContain('productization');
  });

  it('renderDecisionReport:包含决策理由 + 拒绝理由', () => {
    const md = renderDecisionReport(decision);
    expect(md).toContain('决策理由');
    expect(md).toContain('拒绝路线');
    expect(md).toContain('下一步');
  });

  it('生成 docs/version-1.1-decision.md', () => {
    expect(existsSync(DECISION_MD)).toBe(true);
  });
});
