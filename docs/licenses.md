# Licenses — Darkest Dungeon 1.0

## 1. 项目代码许可

本项目(Darkest Dungeon Webgame)采用 **MIT 许可证** 发布。

```
MIT License

Copyright (c) 2026 Alpaca-go

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 2. 第三方依赖许可

| 包 | 许可证 | URL |
|----|--------|-----|
| react@^18.3.1 | MIT | https://github.com/facebook/react |
| react-dom@^18.3.1 | MIT | https://github.com/facebook/react |
| zustand@^4.5.5 | MIT | https://github.com/pmndrs/zustand |
| vite@^5.4.8 | MIT | https://github.com/vitejs/vite |
| typescript@^5.6.2 | Apache-2.0 | https://github.com/microsoft/TypeScript |
| vitest@^2.1.1 | MIT | https://github.com/vitest-dev/vitest |
| @vitejs/plugin-react@^4.3.1 | MIT | https://github.com/vitejs/vite-plugin-react |
| tsx@^4.19.1 | MIT | https://github.com/esbuild-kit/tsx |
| eslint@^8.57.1 | MIT | https://github.com/eslint/eslint |
| @typescript-eslint/*@^8.65.0 | MIT | https://github.com/typescript-eslint/typescript-eslint |
| eslint-plugin-react@^7.37.5 | MIT | https://github.com/jsx-eslint/eslint-plugin-react |
| eslint-plugin-react-hooks@^7.1.1 | MIT | https://github.com/facebook/react |

---

## 3. 原创性声明(SPEC §22)

> **2026-08-04 重要变更**:用户选择**路线 B(承担版权风险)**,本项目现已使用原作《Darkest Dungeon》专名
> (英雄 Reynauld / Dismas / Junia / Paracelsus、Boss Necromancer / Hag / Swine Prince、
> 区域 Weald / Warrens、最终区域 The Darkest Dungeon、最终 Boss Heart of Darkness 等)。

本项目以《Darkest Dungeon》电子游戏为**基础进行扩展与重制**,代码与游戏机制实现为原创:

- ❌ **不包含** 原作美术资源(图标 / 立绘 / 地图)
- ❌ **不包含** 原作音频(音乐 / 音效)
- ❌ **不包含** 原作 Logo
- ❌ **不包含** 原作文案原文(剧情 / 任务描述 / 角色对话)
- ✅ **使用** 原作专有名称(角色 / 区域 / Boss / 敌人 / 任务物品) — 用户主动承担版权风险

所有游戏机制实现(远征系统 / 压力系统 / 战斗 / 露营 / 持久化 / 迁移 / 审计 / 发布工程)均为**原创**。

详见 `docs/originality-manifest.json` 和 `docs/originality-audit-report.md`。
Production Audit 报告会标记未授权词(`unlicensedAssetsPresent` > 0)为 Blocker,
由发布负责人人工签字放行,详见 `docs/production-build-audit.md`。

---

## 4. 私有素材清单

| 类型 | 来源 | 状态 |
|------|------|------|
| 启动图标 (`icons/icon.svg`) | 原创 SVG | 公开使用 |
| 品牌色 (#8b1e1e 暗红) | 通用色值 | 公开使用 |
| 项目名(Darkest Dungeon) | 参考原作专名(用户选 B 承担版权风险) | 见 §3 |
| 包名(`darkest-dungeon-webgame`) | 仅 package.json 标识 | package 名 |

---

## 5. 第三方资源(CDN / 字体等)

**无第三方 CDN 资源**。所有依赖打包到构建产物中。

---

## 6. 数据收集

本项目**不收集任何用户数据**:

- ❌ 无后端服务器
- ❌ 无 API 调用
- ❌ 无 Google Analytics / Sentry / Mixpanel 等
- ❌ 无 Cookie
- ❌ 无 LocalStorage 之外的数据存储(仅游戏存档)

玩家主动导出的「诊断包」也仅本地生成,不自动上传。

详见 `docs/privacy-notice.md`。

---

## 7. 致谢

- 灵感来源:《Darkest Dungeon》(Red Hook Studios)
- 灵感来源:《赛博朋克 2077》网页交互模式
- 引擎:React + Vite + Zustand
- 测试框架:Vitest

所有引用均用于**机制参考**,不涉及原作资产。

---

## 8. 完整许可链

- 项目代码:MIT
- 第三方依赖:各自许可证(见 §2)
- 私有素材:原创(见 §4)
- 数据收集:无(见 §6)
- 商标使用:无(项目名与原作不同)
