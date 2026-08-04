# Beta Triage Report

构建版本: 0.9.0-rc1
生成时间: 2026-08-04T07:39:34.662Z
总 Issue: 3

## 严重度分布

- Blocker: 0
- Critical: 0
- Major: 0
- Minor: 2
- Polish: 1

## 状态分布

- reported: 0
- triaged: 0
- confirmed: 0
- fixing: 0
- fixed: 0
- verified: 1
- deferred: 2
- wont-fix: 0

## 发布目标分布

- RC2: 0
- 1.0: 0
- post-1.0: 3

## Issues(按严重度排序)

### BI-002 [minor] 持久化层 UI 未完整实现

- 状态: deferred
- 类别: ui
- Release Target: post-1.0
- 描述: Save Portability 工具函数已就绪,但 UI 按钮未挂载
- 复现步骤:
  - 新建战役
  - 查找"导出存档"按钮
- 预期: 主入口有"导入/导出"按钮
- 实际: 工具函数可用,UI 未挂载
- 根因: Phase 9 范围专注工具,UI 集成在 1.0.1
- 修复方案: 1.0.1 补 Save/Load UI

### BI-003 [minor] PWA 启动图标 PNG 缺失

- 状态: deferred
- 类别: pwa
- Release Target: post-1.0
- 描述: manifest 引用 icon-192.png / icon-512.png,目前只有 SVG
- 复现步骤:
  - PWA 安装
  - 查看启动画面
- 预期: PNG 图标显示
- 实际: 降级到 SVG
- 根因: 需要 ImageMagick/sharp 生成
- 修复方案: v1.0.1 生成 PNG

### BI-001 [polish] Phase 6 Debug Panel 未挂载生产 UI

- 状态: verified
- 类别: ui
- Release Target: post-1.0
- 描述: 开发模式可访问 Debug Panel,生产构建不挂载。
- 复现步骤:
  - npm run dev
  - 打开主页
  - 检查 Debug 入口
- 预期: 生产构建无 Debug 入口
- 实际: 开发模式可访问,生产不挂载,符合 SPEC §5.2
- 根因: isDebugEnabled() 在 production 返回 false
- 修复方案: 保留当前行为,无需修复
