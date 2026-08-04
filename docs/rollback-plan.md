# Rollback Plan — Darkest Dungeon 1.0

> 适用版本:0.9.0-rc1 / 0.9.0-rc2 / 1.0.0
> 最后更新:2026-08-04
> 触发条件:1.0 出现严重 Blocker / Critical 问题

---

## 1. 回滚目标

| 目标 | 描述 |
|------|------|
| **快速回滚** | 30 分钟内恢复上一稳定版本(0.9.0-rc2 或 0.9.0-rc1) |
| **保留玩家存档** | 玩家浏览器 localStorage 不受影响 |
| **不破坏 Schema** | 回滚不降低 Schema 版本,避免已迁移存档失效 |

---

## 2. 触发条件

满足以下任一条件,**必须回滚**:

### 2.1 Blocker
- ❌ 正式构建无法启动
- ❌ 存档无法加载
- ❌ 主线剧情无法继续
- ❌ 结局无法完成
- ❌ PWA 更新导致存档丢失

### 2.2 Critical
- ❌ 永久死亡回滚
- ❌ 奖励复制
- ❌ 结局重复提交
- ❌ Debug 泄漏到正式构建
- ❌ 未授权素材进入正式构建

### 2.3 Critical Mobile
- ❌ 移动端核心流程无法完成
- ❌ 启动画面卡死
- ❌ 触屏按钮全部失效

---

## 3. 回滚步骤

### 3.1 静态部署回滚(GitHub Pages / Cloudflare Pages)

```bash
# 1. 切回上一稳定 tag
git checkout v0.9.0-rc2

# 2. 重新构建
npm ci
npm run build:release

# 3. 部署(替换 dist/ 到 hosting)
# - GitHub Pages:推送 gh-pages 分支
# - Cloudflare Pages:触发回滚 hook

# 4. 验证
# - 打开浏览器,检查版本号
# - 加载旧存档,验证数据完整
```

### 3.2 Service Worker 缓存清除

如果回滚是因 SW 缓存问题:

```javascript
// 在新版本中,SKIP_WAITING 强制更新
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 或者在旧版本中加 unregister
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});
```

### 3.3 玩家数据恢复

回滚**不应影响**玩家 localStorage:

- 玩家浏览器 localStorage 跨版本保留
- 新版本读 v7 存档,旧版本也读 v7 存档
- **唯一例外**:Schema 升 v8 时需迁移(本次不升)

---

## 4. 存档兼容性矩阵

| 当前版本 | 上一版本 | 存档兼容? |
|----------|----------|-----------|
| 1.0.0 (v7) | 0.9.0-rc2 (v7) | ✅ 兼容 |
| 1.0.0 (v7) | 0.9.0-rc1 (v7) | ✅ 兼容 |
| 1.0.0 (v7) | Phase 8 (v7) | ✅ 兼容 |
| 1.0.0 (v7) | Phase 7 (v7) | ✅ 兼容(但内容可能不完整) |
| 1.0.0 (v7) | Phase 6 (v6) | ⚠️ 需 v6→v7 迁移(自动) |
| 1.0.0 (v7) | Phase 5 (v5) | ⚠️ 需链式迁移 v5→v6→v7(自动) |
| 1.0.0 (v7) | Phase 1-4 (v2-v4) | ⚠️ 需链式迁移(自动) |

**关键**:回滚**不降级 Schema**,所以玩家存档保持可用。

---

## 5. 发布版本 vs 存档版本

### 5.1 存档 Schema 演化

| 阶段 | Schema | 关键字段 |
|------|--------|----------|
| Phase 1 | v1 | 基础 GameState |
| Phase 2 | v2 | + hero list |
| Phase 3 | v3 | + campaign / hamlet |
| Phase 4 | v4 | + quirk / disease / trinket |
| Phase 5 | v5 | + regionProgress / discovery |
| Phase 6 | v6 | + bossStates / threat |
| Phase 7 | v7 | + finalCampaignState / ending |
| **1.0** | **v7** | 冻结,不升 v8 |

### 5.2 1.0 后的 Schema 策略

- **1.0.0**:Schema 仍为 v7(不升)
- **1.0.1**:仅修 Blocker / Critical,不动 Schema
- **1.1.0(可选)**:可升 v8,但需迁移 v7→v8 工具

---

## 6. 回滚沟通模板

### 6.1 GitHub Issue 模板

```markdown
## 回滚报告

**回滚时间**:2026-08-XX HH:MM
**回滚版本**:v0.9.0-rc2(从 v1.0.0)
**触发条件**:[Blocker / Critical 描述]
**影响范围**:
- [列出影响]
**已采取行动**:
- 部署回滚(30 分钟内)
- 通知 Beta 测试者
- 修复 v1.0.1

**回滚验证**:
- [x] 主入口可访问
- [x] 玩家存档可用
- [x] Golden Run 全过
- [x] PWA 离线正常
```

### 6.2 Release Notes 标注

在 release-notes.json 中追加:

```json
{
  "buildVersion": "1.0.0",
  "rolledBackFrom": "1.0.0",
  "rolledBackTo": "0.9.0-rc2",
  "rolledBackAt": "2026-08-XX HH:MM",
  "reason": "..."
}
```

---

## 7. 回滚后修复流程

```text
回滚到 0.9.0-rc2
→ 收集 Beta 反馈
→ 复现问题(Diagnostic Bundle)
→ 最小修复
→ 添加回归测试
→ 1.0.1 候选
→ Beta 复测
→ 部署 1.0.1
```

**禁止**:
- 跳过复现直接修
- 不加回归测试
- 不复测就部署
- 绕过 1.0.1 跳到 1.1

---

## 8. 数据保留

### 8.1 玩家数据

玩家 localStorage 数据**保留**:

- 主存档 / 备份 / 最后合法快照
- UI 设置

### 8.2 服务端数据

无服务端数据(单机游戏)。

### 8.3 Beta Issue

保留 `docs/beta-issues.json` + `docs/beta-triage-report.md`,作为修复参考。

---

## 9. 回滚记录(占位)

| 日期 | 从 | 到 | 原因 | 状态 |
|------|-----|-----|------|------|
| (暂无) | | | | |

---

## 10. 总结

| 维度 | 状态 |
|------|------|
| 回滚目标 | ✅ 明确(30 分钟内) |
| Schema 兼容性 | ✅ v7 跨版本兼容 |
| 玩家数据保护 | ✅ localStorage 保留 |
| 回滚沟通 | ✅ Issue 模板就绪 |
| 回滚后修复 | ✅ 1.0.1 流程清晰 |
| 触发条件 | ✅ 5 类 Blocker + Critical |
| 部署流程 | ✅ GitHub Pages / Cloudflare |
| Service Worker | ✅ 缓存版本控制 |

**回滚计划就绪。可在 30 分钟内回滚到 0.9.0-rc2,保留所有玩家数据。**
