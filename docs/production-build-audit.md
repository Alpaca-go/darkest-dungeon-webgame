# Production Build Audit

构建版本: 0.9.0-rc1
扫描时间: 2026-08-04T07:39:34.820Z
扫描文件: 166

## 严重度:Blocker=1 / Critical=0

**发布就绪: 否**

## Debug 泄漏

- Debug 组件被引用: 1
  - Phase6DebugPanel
- Debug 命令: 0
- 测试 Seed: 0
- 内部概率 UI: 否

## 内容审计

- 占位内容: 0
- 未授权词: 9
  - src\content\heroes\lineup.ts:27:Reynauld
  - src\content\heroes\lineup.ts:47:Dismas
  - src\content\heroes\lineup.ts:67:Junia
  - src\content\heroes\lineup.ts:87:Paracelsus
  - src\game-engine\campaign\recruits.ts:14:Reynauld
  - src\game-engine\campaign\recruits.ts:15:Dismas
  - src\game-engine\campaign\recruits.ts:16:Junia
  - src\game-engine\campaign\recruits.ts:17:Paracelsus
  - src\game-engine\final\registry.ts:42:Darkest Dungeon
- 客户端密钥: 0

## PWA 与离线

- PWA Manifest: 存在
- Service Worker: 存在
- 离线回退: 存在
- License Notice: 存在

## 警告

- Debug 组件被引用(可保留,但生产不挂载): Phase6DebugPanel