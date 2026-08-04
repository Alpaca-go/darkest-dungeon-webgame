# Production Issue 流程

## 1. 玩家报告

玩家通过:
- 主入口 → 错误报告导出 → 附 Diagnostic Bundle
- GitHub Issue 模板(需要:版本 / 页面 / 复现 / 预期 / 实际 / 存档)
- 邮件(可选,开发构建允许)

## 2. 证据校验

每个 Production Issue 必须满足(SPEC §4.3):
- 版本(buildVersion)
- 页面或流程(title / reproductionSteps)
- 复现步骤(reproductionSteps.length >= 1)
- 预期 / 实际(expectedResult / actualResult)
- 存档或 Diagnostic Bundle(saveId / source = diagnostic-bundle / source = save-file)

## 3. 严重度

- Blocker:游戏无法启动 / 主线永久无法继续 / 存档被清空 / 结局无法提交 / PWA 大范围存档丢失
- Critical:永久死亡回滚 / 奖励复制 / 无限金币 / Boss 状态错误 / 结局重复 / 导入覆盖 / SW 循环 / Debug 泄漏 / 授权问题
- Major:重要规则错误 / 任务无法完成 / 高损耗软锁 / 移动端核心按钮无法用 / 严重理解问题
- Minor:局部反馈不足 / 低频显示错误
- Polish:动画 / 排版 / 文案 / 视觉

## 4. 修复流程

1. 复现:导入 Diagnostic Bundle + 还原问题上下文
2. 定位:最小修复
3. 回归:添加 regressionTestId
4. 验证:Production Smoke Test + 12 类标准存档迁移
5. 发布:v1.0.1 Hotfix

## 5. 阻塞规则

- Blocker 出现 → 立即停止新工作,准备回滚,发布紧急说明
- Critical 出现 → 下次 Hotfix(v1.0.1)修复
- Major 出现 → v1.0.2 Stability
- Minor / Polish → Backlog