# Phase 6D 报告:地下兽穴 Boss「饥渊吞噬者」完整垂直切片(6/6D)

> **版本**: 6.0.0-rc.1
> **完成日期**: 2026-08-04
> **前置**: Phase 6C 孢疫母巢(已收官)
> **下一步**: Phase 6E 战役威胁 + 总报告
> **本阶段 Boss**: 新增 `boss-burrows-devourer` id(region: underground-burrows)

---

## 1. 阶段定位

dev 文档 §31 明确 6D 范围:
> 6D 地下兽穴 Boss
> 使用同一框架完成:
> - 撕裂獠牙机制
> - 食物掠夺
> - 流血
> - 储粮坑 / 尸体堆环境
> - 精英护卫召唤
> - 三个削弱任务 / 阶段(任务链 4 步)
> - 战斗绷带补给
> - Golden Run
> 用于验证 Boss 框架不是为遗迹或林地硬编码

本次交付:
- ✅ 饥渊吞噬者 Boss 完整内容(8 情报 + 3 阶段 + 2 削弱 + 1 调查 + 1 讨伐 + 2 环境 + 2 物品 + 1 永久奖励)
- ✅ 6B 框架 + 6C 升级全部不动
- ✅ Golden Run C(DD-WEB-PHASE6-RETREAT-001)验证撤退规则真实生效
- ✅ 52 个新单元/集成测试(42 narrative + 10 golden run)
- ✅ 6B 测试 Boss `boss-test-arbiter` 不被破坏(intelligenceEntryIds 显式列举)
- ✅ 6C Boss `boss-spore-matriarch` 不被破坏(intelligenceEntryIds 显式列举)

---

## 2. 模块清单

### 2.1 修改模块

- `boss/registry.ts` — 大量追加(全部为新内容,不动 6A/6B/6C 现有):
  - 4 个 burrows 任务(task-burrows-investigate-1/weaken-1/weaken-2/final-1)
  - 8 条 burrows 情报(intel-burrows-attack-1/attack-2/status-1/phase-1/phase-2/env-1/provision-1/retreat-1)
  - 2 个 burrows 削弱(weaken-burrows-food/guard)
  - 3 个 burrows 阶段(phase-burrows-0/1/2)
  - 1 个 burrows 永久奖励(reward-burrows-devourer)
  - 2 个 burrows 特殊物品(item-burrows-bandage/purifier)
  - 2 个 burrows 环境目标(env-burrows-food-pit/corpse-pile)
  - 1 个 burrows BossDefinition(boss-burrows-devourer)
  - 1 个 burrows 撤退规则(BURROWS_BOSS_RETREAT,基础 55%,阶段 2 仅 10%)

### 2.2 新增测试

- `tests/phase6d-burrows-devourer.test.ts` — 42 个 narrative 测试
- `tests/phase6d-golden-run-c.test.ts` — 10 个 golden run 集成测试

---

## 3. 6D 主题设计

### 3.1 核心威胁

- **撕裂獠牙**:前排 HP 损失 + 持续流血
- **食物掠夺**:每 2 轮 -2 食物 + 饥饿状态
- **饥饿狂潮**:食物 < 50% 时全员额外 HP 损失
- **精英护卫召唤**:阶段 1 从尸体堆召出,默认 2 只(削弱后 1 只)
- **吞噬一切**:阶段 2 持续流血 + 吞咽后排

### 3.2 削弱任务设计

| 任务 | 名称 | 效果 | 副作用 |
|------|------|------|--------|
| task-burrows-weaken-1 | 焚毁储粮巢穴 | 阶段 1 精英护卫 2→1 只 + 攻击 -25% | 撤退后失效 |
| task-burrows-weaken-2 | 杀死精英护卫 | 阶段 1+2 不再召护卫 + 撕裂獠牙 -5 HP | 撤退后失效 |

### 3.3 特殊物品设计

| 物品 | 名称 | 用途 | 战术 |
|------|------|------|------|
| item-burrows-bandage | 战斗绷带 | 阶段 0/2 缓解压力或提升撤退 +15% | stabilize-stress / retreat |
| item-burrows-purifier | 储粮焚毁圣物 | 阶段 1 封印储粮坑,本轮不召护卫 | destroy-environment |

### 3.4 阶段叙事

- **阶段 0 潜伏捕食**:吞噬者潜伏,前排冒险用火油焚粮
- **阶段 1 饥饿狂潮**:从尸体堆召出精英护卫(2 或 1 只),集中击杀或硬吃
- **阶段 2 吞噬一切**:持续流血 + 吞咽后排,前 2 轮孤注一掷

---

## 4. 撤退规则

| 阶段 | 基础 | 阶段 modifier | 最终 |
|------|------|---------------|------|
| 0 | 0.55 | 0 | 0.55 |
| 1 | 0.55 | -0.25 | 0.30 |
| 2 | 0.55 | -0.45 | 0.10 |

- 威胁增长 +20(3 个 Boss 中最高,因为食物掠夺 + 流血)
- stressPenalty = 10
- 撤退后 lossRules = `['weaken-burrows-food']`(焚毁储粮失效,但杀死精英护卫永久保留)

---

## 5. 永久奖励

**饥饿者的记忆**:
- 饰品:`trinket-吞噬者之牙`
- 任务修正词:`modifier-饥饿本能`
- 区域 modifier:
  - `burrows_food_consumption` = -0.25(食物消耗 -25%)
  - `burrows_scouting_bonus` = 0.15(前排警戒 +15%)

---

## 6. Golden Run C 验收

**Seed**: `DD-WEB-PHASE6-RETREAT-001`

**流程**:
1. 完成调查 + 2 削弱(获得 3 情报 + 2 削弱,但玩家**没读情报 + 没带战斗绷带**)
2. 启动最终讨伐
3. 阶段 0 尝试撤退
4. 验证:
   - 撤退成功 → burrows 区域威胁 +20
   - Boss 状态从 active 回退到 revealed(可重新挑战)
   - encounterStatus = retreated
   - weaken-burrows-food 失效(lose rule)
   - 同 seed 可复现

**覆盖范围**:
- burrows 撤退规则(基础 55% / 阶段 1 30% / 阶段 2 10%)真实生效
- 撤退成功 + 区域威胁增长 +20
- 削弱按 lossRules 失效
- Boss 状态保留,encounterStatus = retreated
- 同 seed 可复现(SPEC §27)

---

## 7. 测试统计

| 阶段 | 测试文件 | 新增测试数 |
|------|----------|-----------|
| 6A 框架 | phase6-boss-*.test.ts | 114 |
| 6B 失落审判者 | phase6b-*.test.ts | 44 |
| 6C 孢疫母巢 | phase6c-*.test.ts | 42 |
| **6D 饥渊吞噬者** | **phase6d-*.test.ts** | **52** |
| **总计** | | **252(Phase 6 新增)** |

**全部测试**:
- 6D 完成后:752 测试通过(40 个测试文件,9.26s)
- 6D 阶段 6A 114 + 6B 44 + 6C 42 + 6D 52 = 252 新增测试

---

## 8. 验证清单

- ✅ 3 Boss 整体一致性(3 阶段 / 2 削弱 / 2 环境 / 8 情报 / 1 奖励)
- ✅ 6B 失落审判者不被破坏
- ✅ 6C 孢疫母巢不被破坏
- ✅ 撤退规则真实生效
- ✅ 区域威胁 +20
- ✅ Boss 状态保留(可重新挑战)
- ✅ weaken-burrows-food 失效
- ✅ 同 seed 可复现
- ✅ typecheck 通过
- ✅ 752 测试全过

---

## 9. 已知限制(6D 范围内,等 6E 处理)

- ⚠️ 6D 战术选项规则中,战斗绷带 +15% 撤退成功率在 dispatcher 的 `cmdAttemptBossRetreat` 中**未实现** — 目前 dispatcher 只硬编码 `item-test-holy-relic`(6B 圣物)。6E 可考虑将"物品影响撤退成功率"提取为 encounter-resolver 通用配置项。
- ⚠️ UI 集成未完成:Phase6DebugPanel 组件已写(6B-C3),但未挂载到 App.tsx。
- ⚠️ 召唤规则 `BossSummonRule.summonId` / `maxPerPhase` 字段首次实际使用(6C 全用 `summonRules: []`),6E 需要验证 encounter 实际触发是否正确。

---

## 10. 提交记录

- `fff5ad0` feat(boss): Phase 6D 6D-C1 饥渊吞噬者完整 Boss 内容(8 情报 / 3 阶段 / 2 削弱 / 2 环境 / 2 物品 / 1 奖励) + 42 narrative 测试
- (本次 6D-C2 commit 待 push)
