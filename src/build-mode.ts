/**
 * Phase 9A: Build Mode 工具(SPEC §5)
 *
 * 支持 5 种构建环境:
 * - development(默认 vite dev)
 * - test(vitest)
 * - audit(content/save/originality audit)
 * - release-candidate(RC1/RC2)
 * - production(1.0)
 *
 * 关键不变量:
 * - Production 模式 MUST NOT 暴露 Debug / Audit / 测试 Seed / 内部概率 / 跳阶段 / 强制资源
 * - Debug 隔离通过 isDebugEnabled() 判定,生产构建返回 false
 * - 运行时断言通过 assertProductionClean() 强制
 *
 * 实现:
 * - 开发期:用 import.meta.env.MODE + import.meta.env.PROD 判定(Vite)
 * - 测试期:vitest 全局变量 __BUILD_MODE__ 可覆盖(默认 'test')
 * - 生产期:在 build:release 注入 define 全局
 */

export type BuildMode = 'development' | 'test' | 'audit' | 'release-candidate' | 'production';

// 编译期注入(由 Vite define 替换)
// vitest 默认 production=false,test 环境
// 在 production 构建中,以下会被静态替换
declare const __BUILD_MODE__: BuildMode | undefined;
declare const __BUILD_VERSION__: string | undefined;
declare const __IS_PRODUCTION__: boolean | undefined;

function detectBuildMode(): BuildMode {
  // 1. 优先用编译期注入
  if (typeof __BUILD_MODE__ !== 'undefined') {
    return __BUILD_MODE__;
  }
  // 2. 退化用 import.meta.env(开发/test 模式)
  try {
    // @ts-ignore - import.meta.env 由 Vite 注入
    const env = (import.meta as any).env;
    if (env && env.MODE) {
      const mode = env.MODE as string;
      if (mode === 'production' || mode === 'release-candidate' || mode === 'audit' || mode === 'test') {
        return mode as BuildMode;
      }
      return 'development';
    }
  } catch {
    // import.meta 在某些环境不可用
  }
  // 3. SSR/Node 兜底
  if (typeof process !== 'undefined' && process.env) {
    const m = process.env.BUILD_MODE;
    if (m === 'production' || m === 'release-candidate' || m === 'audit' || m === 'test') {
      return m as BuildMode;
    }
    if (process.env.NODE_ENV === 'production') return 'production';
    if (process.env.NODE_ENV === 'test') return 'test';
  }
  return 'development';
}

function detectBuildVersion(): string {
  if (typeof __BUILD_VERSION__ !== 'undefined') {
    return __BUILD_VERSION__;
  }
  if (typeof process !== 'undefined' && process.env?.BUILD_VERSION) {
    return process.env.BUILD_VERSION;
  }
  return '0.9.0-rc1';
}

function detectIsProduction(): boolean {
  if (typeof __IS_PRODUCTION__ !== 'undefined') {
    return __IS_PRODUCTION__;
  }
  const mode = detectBuildMode();
  return mode === 'production' || mode === 'release-candidate';
}

export const BUILD_MODE: BuildMode = detectBuildMode();
export const BUILD_VERSION: string = detectBuildVersion();
export const IS_PRODUCTION: boolean = detectIsProduction();

/**
 * Debug 启用判定:
 * - development / test / audit:启用
 * - release-candidate / production:禁用
 */
export function isDebugEnabled(): boolean {
  if (BUILD_MODE === 'release-candidate' || BUILD_MODE === 'production') {
    return false;
  }
  // 额外保险:即使模式判定为非生产,也检查 IS_PRODUCTION
  if (IS_PRODUCTION) return false;
  return true;
}

/**
 * Audit 面板启用判定(Debug 关闭时也关闭)
 */
export function isAuditEnabled(): boolean {
  return isDebugEnabled() && (BUILD_MODE === 'development' || BUILD_MODE === 'audit');
}

/**
 * Production 模式运行时断言:任何代码路径都不能在 production 暴露 Debug UI
 */
export function assertProductionClean(label: string, condition: boolean): void {
  if (IS_PRODUCTION && !condition) {
    throw new Error(`[build-mode] Production 违规: ${label} 在 production 模式必须为 false`);
  }
}

/**
 * 包装 Debug 入口:production 模式下 no-op
 */
export function withDebugGuard<T>(value: T, fallback: T): T {
  return isDebugEnabled() ? value : fallback;
}
