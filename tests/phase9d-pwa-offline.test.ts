/**
 * Phase 9D: PWA + 离线(SPEC §10)
 *
 * 验收:
 * - public/manifest.webmanifest 包含 name/short_name/icons/start_url/display
 * - public/sw.js Service Worker 包含 install/activate/fetch 监听
 * - public/offline.html 离线回退页存在
 * - public/icons/icon.svg 启动图标存在
 * - index.html 引用 manifest + 注册 SW
 * - 不缓存 POST / PUT / DELETE
 * - 同源策略生效
 *
 * 关联文档:docs/pwa-offline-test-report.md(测试运行时生成)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DOCS_DIR = 'docs';
const REPORT_MD = join(DOCS_DIR, 'pwa-offline-test-report.md');

function readIfExists(p: string): string | null {
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
}

describe('Phase 9D: PWA 资源(SPEC §10)', () => {
  beforeAll(() => {
    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
    writeFileSync(REPORT_MD, '# PWA Offline Test Report\n\nPhase 9D 验收报告:Manifest / Service Worker / 离线回退 / 启动图标。\n', 'utf-8');
  });

  it('public/manifest.webmanifest 存在', () => {
    expect(existsSync('public/manifest.webmanifest')).toBe(true);
  });

  it('manifest 包含必要字段: name / short_name / start_url / display', () => {
    const raw = readIfExists('public/manifest.webmanifest');
    expect(raw).not.toBeNull();
    const m = JSON.parse(raw!);
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
  });

  it('manifest name 与项目名一致:Darkest Dungeon', () => {
    const m = JSON.parse(readIfExists('public/manifest.webmanifest')!);
    expect(m.name).toContain('Darkest Dungeon');
  });

  it('manifest icons 至少 2 个(192 + 512 + svg)', () => {
    const m = JSON.parse(readIfExists('public/manifest.webmanifest')!);
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
    const sizes = m.icons.map((i: any) => i.sizes);
    expect(sizes.some((s: string) => s.includes('192'))).toBe(true);
  });

  it('manifest theme_color 与品牌一致(暗红)', () => {
    const m = JSON.parse(readIfExists('public/manifest.webmanifest')!);
    expect(m.theme_color).toBe('#8b1e1e');
  });

  it('public/icons/icon.svg 启动图标存在', () => {
    expect(existsSync('public/icons/icon.svg')).toBe(true);
  });

  it('icon.svg 是有效 SVG', () => {
    const svg = readIfExists('public/icons/icon.svg');
    expect(svg).not.toBeNull();
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});

describe('Phase 9D: Service Worker(SPEC §10.1)', () => {
  it('public/sw.js 存在', () => {
    expect(existsSync('public/sw.js')).toBe(true);
  });

  it('SW 包含 install/activate/fetch 监听', () => {
    const sw = readIfExists('public/sw.js')!;
    expect(sw).toContain("addEventListener('install'");
    expect(sw).toContain("addEventListener('activate'");
    expect(sw).toContain("addEventListener('fetch'");
  });

  it('SW 跳过非 GET 请求', () => {
    const sw = readIfExists('public/sw.js')!;
    expect(sw).toMatch(/request\.method\s*!==\s*['"]GET['"]/);
  });

  it('SW 处理 navigation 请求 + 回退到 offline.html', () => {
    const sw = readIfExists('public/sw.js')!;
    expect(sw).toContain("request.mode === 'navigate'");
    expect(sw).toContain('offline.html');
  });

  it('SW 缓存版本号注入:CACHE_NAME 含版本', () => {
    const sw = readIfExists('public/sw.js')!;
    expect(sw).toMatch(/CACHE_NAME\s*=\s*[`'"]darkest-dungeon-/);
  });

  it('SW 同源过滤:不同 origin 跳过', () => {
    const sw = readIfExists('public/sw.js')!;
    expect(sw).toContain('self.location.origin');
  });

  it('SW 不缓存敏感 header(无 credentials: include 模式)', () => {
    const sw = readIfExists('public/sw.js')!;
    // 不应缓存带 credentials 的请求
    expect(sw).not.toMatch(/credentials:\s*['"]include['"]/);
  });
});

describe('Phase 9D: 离线回退(SPEC §10.3)', () => {
  it('public/offline.html 存在', () => {
    expect(existsSync('public/offline.html')).toBe(true);
  });

  it('offline.html 包含离线提示', () => {
    const html = readIfExists('public/offline.html')!;
    expect(html).toContain('离线');
    expect(html).toContain('Darkest Dungeon');
  });

  it('offline.html 是有效 HTML 结构', () => {
    const html = readIfExists('public/offline.html')!;
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('lang="zh-CN"');
    expect(html).toContain('</html>');
  });

  it('offline.html 主按钮 ≥ 44px(SPEC §15.1 触控目标)', () => {
    const html = readIfExists('public/offline.html')!;
    expect(html).toMatch(/min-height:\s*48px/);
  });
});

describe('Phase 9D: index.html PWA 集成', () => {
  it('index.html 引用 manifest', () => {
    const html = readIfExists('index.html')!;
    expect(html).toMatch(/<link[^>]+rel="manifest"/);
  });

  it('index.html 包含 theme-color meta', () => {
    const html = readIfExists('index.html')!;
    expect(html).toMatch(/<meta[^>]+name="theme-color"/);
  });

  it('index.html 包含 apple-touch-icon', () => {
    const html = readIfExists('index.html')!;
    expect(html).toMatch(/<link[^>]+rel="apple-touch-icon"/);
  });

  it('index.html 注册 Service Worker 脚本', () => {
    const html = readIfExists('index.html')!;
    expect(html).toContain("'serviceWorker' in navigator");
    expect(html).toContain('register(');
    expect(html).toContain('sw.js');
  });

  it('index.html 包含离线/在线事件监听', () => {
    const html = readIfExists('index.html')!;
    expect(html).toContain("addEventListener('offline'");
    expect(html).toContain("addEventListener('online'");
  });

  it('index.html 标题含项目名', () => {
    const html = readIfExists('index.html')!;
    expect(html).toContain('<title>Darkest Dungeon');
  });

  it('index.html 含 noscript 回退', () => {
    const html = readIfExists('index.html')!;
    expect(html).toContain('<noscript>');
  });
});

describe('Phase 9D: 安全基线(SPEC §26)', () => {
  it('index.html 不包含内联密钥/API key', () => {
    const html = readIfExists('index.html')!;
    expect(html).not.toMatch(/api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{20,}/i);
  });

  it('sw.js 不缓存敏感路径(/api/)', () => {
    const sw = readIfExists('public/sw.js')!;
    // 不应主动缓存 /api/ 路径
    expect(sw).not.toMatch(/['"`]\/api\//);
  });
});
