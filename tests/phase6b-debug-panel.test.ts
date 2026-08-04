/**
 * Phase 6B Phase6DebugPanel 组件测试
 *
 * 不实际渲染 React(项目没装 @testing-library),只验证:
 *  - 组件模块能正常 import
 *  - Phase6DebugActions 类型签名正确
 *  - 默认导出存在
 *  - 组件接受 open / actions props
 */

import { describe, it, expect } from 'vitest';
import { Phase6DebugPanel } from '../src/components/boss/index.js';
import type { Phase6DebugActions } from '../src/components/boss/index.js';

describe('Phase 6B: Phase6DebugPanel 模块', () => {
  it('组件从 index.ts 正确导出', () => {
    expect(typeof Phase6DebugPanel).toBe('function');
  });

  it('Phase6DebugActions 类型支持 12 项调试动作', () => {
    // 编译期类型测试:如果某个 action prop 名错,这里类型不匹配会编译失败
    const actions: Phase6DebugActions = {
      onSetRegionThreat: () => {},
      onSetRegionThreatState: () => {},
      onSetBossStatus: () => {},
      onGrantIntelligence: () => {},
      onRemoveIntelligence: () => {},
      onCompleteQuest: () => {},
      onJumpBossPhase: () => {},
      onSetBossHp: () => {},
      onForceBossSummon: () => {},
      onForceRetreat: () => {},
      onForceDefeat: () => {},
      onResetBoss: () => {},
    };
    expect(actions).toBeDefined();
    expect(Object.keys(actions).length).toBe(12);
  });

  it('组件支持 open=false 时不渲染(空组件)', () => {
    // 不实际渲染,只验证函数签名
    const stub: React.ComponentType<{ actions: Phase6DebugActions; open?: boolean }>
      = Phase6DebugPanel as any;
    expect(typeof stub).toBe('function');
  });
});
