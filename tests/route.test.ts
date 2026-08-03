/**
 * 路线 / 节点 / 火把 / 移动消耗测试(SPEC §35.1)
 */

import { describe, it, expect } from 'vitest';
import { buildRuinsRoute } from '../src/content/route/ruins.js';
import { torchLevel } from '../src/game-engine/expedition/types.js';

describe('Ruins Route 数据', () => {
  it('8-10 节点', () => {
    const route = buildRuinsRoute('test');
    const nodeCount = Object.keys(route.nodes).length;
    expect(nodeCount).toBeGreaterThanOrEqual(8);
    expect(nodeCount).toBeLessThanOrEqual(10);
  });

  it('至少 2 次分叉', () => {
    const route = buildRuinsRoute('test');
    expect(route.forks.length).toBeGreaterThanOrEqual(2);
  });

  it('有 start / objective / exit 节点', () => {
    const route = buildRuinsRoute('test');
    expect(route.startNodeId).toBeTruthy();
    expect(route.objectiveNodeId).toBeTruthy();
    expect(route.exitNodeIds.length).toBeGreaterThan(0);
    expect(route.nodes[route.startNodeId]).toBeDefined();
    expect(route.nodes[route.objectiveNodeId]).toBeDefined();
    expect(route.nodes[route.exitNodeIds[0]!]).toBeDefined();
  });

  it('至少 1 条高风险支路', () => {
    const route = buildRuinsRoute('test');
    const risky = route.edges.filter((e) => e.riskTag === 'high');
    expect(risky.length).toBeGreaterThan(0);
  });

  it('每个节点都有 baseScoutLevel', () => {
    const route = buildRuinsRoute('test');
    for (const node of Object.values(route.nodes)) {
      expect(['unknown', 'vague', 'category-known', 'fully-scouted']).toContain(node.baseScoutLevel);
    }
  });
});

describe('火把等级', () => {
  it('光耀 76-100', () => {
    expect(torchLevel(76)).toBe('radiant');
    expect(torchLevel(100)).toBe('radiant');
  });
  it('明亮 51-75', () => {
    expect(torchLevel(51)).toBe('bright');
    expect(torchLevel(75)).toBe('bright');
  });
  it('昏暗 26-50', () => {
    expect(torchLevel(26)).toBe('dim');
    expect(torchLevel(50)).toBe('dim');
  });
  it('黑暗 1-25', () => {
    expect(torchLevel(1)).toBe('dark');
    expect(torchLevel(25)).toBe('dark');
  });
  it('漆黑 0', () => {
    expect(torchLevel(0)).toBe('black');
  });
});

describe('移动消耗(Edge)', () => {
  it('每条边有 timeCost / baseTorchCost', () => {
    const route = buildRuinsRoute('test');
    for (const e of route.edges) {
      expect(e.timeCost).toBeGreaterThan(0);
      expect(e.baseTorchCost).toBeGreaterThan(0);
    }
  });
});
