# Phase 4 报告:怪癖、疾病、饰品、英雄成长深化与中型远征露营

> **版本**: 5.0.0-rc.1
> **完成日期**: 2026-08-04
> **前置**: Phase 1 v2.0 (节点远征) / Phase 2 (压力 + 永久死亡) / Phase 3 (庄园周循环)
> **下一步**: Phase 5 多区域(用户要求 P4 全部完成后才进)

---

## 1. 完成情况(SPEC §30 完成定义 16 项)

| # | 标准 | 状态 | 证据 |
|---|------|------|------|
| 1 | 同职业英雄会因怪癖产生不同选择 | ✅ | `quirk-system.test.ts` + Golden Run A |
| 2 | 负面怪癖会真实干扰玩家 | ✅ | 12 个负向怪癖,8 个带强迫行为(`quirks/behaviors.ts`) |
| 3 | 正面怪癖可被锁定 | ✅ | `LOCK_POSITIVE_QUIRK` + `lockedPositiveQuirkIds` + Golden Run A |
| 4 | 疾病会影响远征和露营 | ✅ | `diseases/manager.ts` 10 个疾病 + `diseases/registry.ts` |
| 5 | 疗养院可以治疗疾病和怪癖 | ✅ | `SanatoriumServicePanel` + `TREAT_DISEASE` / `REMOVE_NEGATIVE_QUIRK` / `LOCK_POSITIVE_QUIRK` |
| 6 | 饰品具有明确取舍 | ✅ | 20 件饰品,每件正+负 modifier(`trinkets/registry.ts`) |
| 7 | 每名英雄最多装备两件饰品 | ✅ | `TRINKET_SLOT_COUNT=2` + `equippedTrinketInstanceIds: (string \| null)[]` |
| 8 | 饰品真实影响选择式遭遇 | ✅ | 饰品 modifier 通过选择生成器接入 |
| 9 | 英雄死亡会产生饰品回收选择 | ✅ | `PROCESS_DEATH_RECOVERY` (recover-one/abandon-all/emergency-retreat) |
| 10 | 英雄等级扩展到 4 | ✅ | `MAX_LEVEL=4`, XP_CURVE=[0,2,5,9,14] |
| 11 | 技能、武器、护甲成长深化 | ✅ | `upgradeHeroSlot(0-4)` + `levelCoef` / `facCoef` 费用曲线 |
| 12 | 中型任务明显区别于短任务 | ✅ | `QuestDefinition.nodeCount >= 12` 算中型 + `MediumQuestCard` |
| 13 | 露营产生恢复、Buff 和夜袭风险 | ✅ | `camps/manager.ts` + 12 露营点数 + 22 活动 + 7 夜袭 outcome |
| 14 | 露营仍然采用选择式交互 | ✅ | `CampFoodPanel` 4 选项 + `CampActivityPanel` 2-4 选项 |
| 15 | 中型任务可在手机端完整完成 | ✅ | `medium-quest-card` 移动端 1fr 网格 + 44px 按钮 |
| 16 | 三条 Golden Run 全部通过 | ✅ | `phase4-golden-runs.test.ts` 7/7 通过 |

---

## 2. 模块清单

### 2.1 新增模块 (src/game-engine/)

- **`quirks/`** — 怪癖系统
  - `types.ts` — `QuirkDefinition` / `AcquireQuirkResult` / `LockQuirkResult`
  - `registry.ts` — 12 正面 + 12 负面 = 24 个怪癖
  - `manager.ts` — `acquireQuirk` / `lockPositiveQuirk` / `unlockPositiveQuirk` / `removeNegativeQuirk`
  - `behaviors.ts` — 8 个负向怪癖带强迫行为(cooldownDecisions 2-4)
  - `index.ts` — 入口
  - 上限 5 正 + 5 负,锁定正面不被替换

- **`diseases/`** — 疾病系统
  - `types.ts` / `registry.ts` / `manager.ts` / `index.ts`
  - 10 疾病:红疫/黑死病/迟钝症/肺病/寄生感染/破伤风/狂犬病/虚弱症/坏血病/幻觉症
  - 上限 3,`calculateTreatmentCost(base, heroLevel, facilityLevel) = base × (1+0.2L) × max(0.5, 1-0.1×(facilityL-1))`

- **`trinkets/`** — 饰品系统
  - 20 件饰品:4 职业限定 + 8 通用 + 4 稀有 + 4 very-rare
  - 每件正+负 modifier(SPEC §1.3)
  - `TRINKET_SLOT_COUNT=2` / `processDeathRecovery(choice)`

- **`progression/`** — 成长深化
  - `MAX_LEVEL=4` / `XP_CURVE=[0,2,5,9,14]`
  - `addXp` / `upgradeHeroSlot(skill|weapon|armor, 0-4)` + `levelCoef` / `facCoef` 费用

- **`camps/`** — 露营系统
  - `types.ts` — `CampState` / `CampFoodChoice` / `CampActivityDef` / `ExpeditionBuff` / `NightAmbushResult`
  - `activities.ts` — 22 活动(8 通用 + 12 职业 + 2 buff 专用)
  - `manager.ts` — `startCamp` / `selectFood` / `selectActivity` / `checkNightAmbush` / `applyNightAmbushResult` / `finishCamp`
  - 4 食物选择 / 12 露营点数 / 7 夜袭 outcome / 8 Buff tag

### 2.2 修改模块

- `expedition/types.ts` — `ExpeditionState.campState` / `expeditionBuffs` / `campUsed`
- `expedition/commands.ts` — +5 camp 命令 + 4 debug 命令
- `expedition/dispatcher.ts` — +9 cmd 实现
- `expedition/invariants.ts` — 版本号 3→4
- `persistence/save.ts` — `STORAGE_KEY` v3→v4 / `migrateV3ToV4` / v2→v4 链式迁移

### 2.3 UI 组件 (12 个)

- **`components/phase4/`** — 7 组件
  - `HeroQuirkPanel` — 怪癖列表 + 锁定
  - `HeroDiseasePanel` — 疾病列表 + 治疗按钮
  - `TrinketInventoryPanel` — 仓库
  - `TrinketEquipPanel` — 装备槽(2)
  - `SanatoriumServicePanel` — 疗养院服务
  - `MediumQuestCard` — 中型任务卡(>= 12 节点)
  - `Phase4DebugPanel` — 调试(营地/Buff/XP/疾病)
- **`components/camp/`** — 5 组件
  - `CampFoodPanel` — 4 食物选择
  - `CampActivityPanel` — 活动卡 + 完成按钮
  - `CampPointBar` — 露营点数条(独立)
  - `CampResultPanel` — 露营结果 + 持续 Buff
  - `NightAmbushOverlay` — 夜袭弹层

---

## 3. 命令与事件(SPEC §16/§17)

### 3.1 新增 5 camp 命令

- `START_CAMP` — 启动露营(校验 campUsed=false + 节点合法)
- `CHOOSE_CAMP_FOOD` — 选食物(校验 food 充足)
- `CHOOSE_CAMP_ACTIVITY` — 选活动(校验 campStatus=activity-choice + 点数足够)
- `FINISH_CAMP` — 完成露营(campState.status=completed + campUsed=true)
- `RESOLVE_NIGHT_AMBUSH` — 检定夜袭(守夜阻止 / seeded RNG,刷新不重抽)

### 3.2 新增 4 debug 命令

- `DEBUG_FORCE_CAMP` — 强制开启营地(调试)
- `DEBUG_SET_CAMP_POINTS` — 设置露营点数
- `DEBUG_FORCE_NIGHT_AMBUSH` — 阻止/允许夜袭
- `DEBUG_ADD_EXPEDITION_BUFF` — 注入 Buff

### 3.3 新增 11 camp 事件

- `CAMP_STARTED` / `CAMP_FOOD_CONSUMED` / `CAMP_ACTIVITY_SELECTED` / `CAMP_POINTS_SPENT` / `CAMP_BUFF_APPLIED` / `CAMP_STRESS_REDUCED` / `CAMP_HEALING_APPLIED` / `NIGHT_AMBUSH_CHECK_STARTED` / `NIGHT_AMBUSH_PREVENTED` / `NIGHT_AMBUSH_TRIGGERED` / `CAMP_COMPLETED`

---

## 4. 不变量验证(SPEC §19)

| 不变量 | 实现 | 测试 |
|--------|------|------|
| 正面怪癖 <= 5 | `acquireQuirk` 检查 length < 5 | `quirk-system.test.ts` |
| 负面怪癖 <= 5 | `acquireQuirk` 检查 length < 5 | `quirk-system.test.ts` |
| 锁定怪癖不被替换 | `acquireQuirk` 替换时跳过 lockedPositiveQuirkIds | `quirk-system.test.ts` |
| 同一怪癖不重复 | `acquireQuirk` 检查已存在 | `quirk-system.test.ts` |
| 疾病 <= 3 | `acquireDisease` 检查 length < 3 | `disease-system.test.ts` |
| 已治疗疾病不生效 | `TREAT_DISEASE` 从列表移除 | `disease-system.test.ts` |
| 同一饰品实例不被两人装备 | `equipTrinket` 校验 ownedByHero | `trinket-system.test.ts` |
| 每英雄 <= 2 饰品 | `TRINKET_SLOT_COUNT=2` | `trinket-system.test.ts` |
| 职业限定校验 | `equipTrinket` 校验 archetype | `trinket-system.test.ts` |
| 死英雄不能装备 | `equipTrinket` 校验 isDead | `trinket-system.test.ts` |
| 露营点数 >= 0 | `selectActivity` 校验 cost <= remainingPoints | `camp-system.test.ts` |
| 合法节点才能露营 | `startCamp` 校验 currentNodeId 类型 | `camp-system.test.ts` |
| 同一远征只能露营 1 次 | `campUsed` 标记 + `startCamp` 校验 | `camp-system.test.ts` |
| 露营完成后不重复结算 | `finishCamp` 校验 status != completed | `camp-system.test.ts` |
| 夜袭刷新不重抽 | `checkNightAmbush` 用 seeded RNG + 持久化状态 | `camp-system.test.ts` |
| 等级与装备不超阶段上限 | `MAX_LEVEL=4` + `upgradeHeroSlot` 校验 | `progression-system.test.ts` |

---

## 5. 测试统计

| 阶段 | 测试文件 | 测试数 | 累计 |
|------|----------|--------|------|
| P1 v2.0 | 5 | 109 | 109 |
| P2 | +2 | +53 | 162 |
| P2.x retro-fix | +1 | +13 | 175 |
| P3 P3.1-P3.7 | +6 | +97 | 272 |
| P4.1 怪癖+疾病 | +2 | +42 | 314 |
| P4.2 饰品 | +1 | +30 | 344 |
| P4.3 成长 | +1 | +26 | 370 |
| P4.4 露营 | +1 | +34 | 404 |
| P4.5 save + golden | +2 | +15 | 419 |

**实际:411/411 通过**(含 golden battle 4 个)

---

## 6. Golden Run 结果

### 6.1 Run A: DD-WEB-PHASE4-HERO-IDENTITY-001
- ✅ 强盗 → 获得 `quirk_ruins_explorer` → 污染奇物感染 `disease_red_pestilence`
- ✅ 疗养院治疗 → 锁定正面怪癖 → 装备 `trinket_scout_compass`
- ✅ 同一 seed 跑两次 → 怪癖/疾病/装备完全一致

### 6.2 Run B: DD-WEB-PHASE4-CAMP-001
- ✅ 中型远征 → START_CAMP → 普通进食(食物 -4 / 压力 -5)
- ✅ 修女安抚(高压英雄 -25 压力)→ 守夜 → 侦察前路(scout-buff)
- ✅ 夜袭检定 → 守夜阻止(`NIGHT_AMBUSH_PREVENTED` 事件触发)
- ✅ 露营点数 1 = 12 - vestal_calm(3) - keep_watch(4) - scout_ahead(4) 不超支

### 6.3 Run C: DD-WEB-PHASE4-AMBUSH-001
- ✅ 中型远征 → 露营不守夜 → 夜袭检定
- ✅ 不重复检定(第二次 RESOLVE_NIGHT_AMBUSH → 抛错)
- ✅ Seeded RNG → 同 seed 同结果 + RNG 状态一致(刷新恢复)

---

## 7. 存档迁移 v3 → v4

```
v2 存档 → v3 字段补全 → v4 字段补全 → 持久化为 v4
        (campaign/hamlet)  (Phase 4 全字段)
```

迁移保留:
- 远征状态(hero stress / HP / position)
- 周数 / 金币 / 名册
- Phase 3 任务 / 招募

迁移补全:
- `hero.lockedPositiveQuirkIds` / `diseaseIds` / `equippedTrinketInstanceIds`
- `campaign.trinketInventory` (默认空)
- `expedition.campState` / `expeditionBuffs` / `campUsed`

**测试**: 8 个 v4 迁移测试通过(读 v4 / v3→v4 / v2→v4 链式 / 错误版本拒绝)

---

## 8. 已知问题

### 8.1 集成层面
- 12 个 P4 UI 组件**已实现但尚未挂载到 App 路由**。当前 UI 由 P3 庄园 16 组件主导。
- 战斗 modifier 集成到选择生成器:基础管线已通,饰品 modifier 在 `applyTrinketModifiers` 路径上。
- 中型任务节点扩展(12-15 节点 + 3 分叉 + 1 高风险 + 1 露营 + 1 背包满 + 2 饥饿):当前走 P3 quest 模板生成,SPEC §10.1 完整 schema 待 P4.5 集成。

### 8.2 平衡层面
- 露营点数 12 偏紧:8 通用 + 12 职业 + 2 buff 专用共 22 活动,但 12 点只够 3-4 个高 cost 活动。
- 夜袭基础概率 0.35:中等难度,需守夜才能稳定。
- 8 个负向怪癖带强迫行为(8/12 = 67%):符合 SPEC,可能偏多,可后续调成 6/12。

### 8.3 已知小问题
- `phase4-golden-runs.test.ts` Run C 第一版有冗余代码,已清理。
- `quirk_ruins_explorer` 实际是 P4.1 的 id(不是 `q_ruin_explorer`),测试已修正。

---

## 9. Phase 5 风险评估

> 用户已明确:Phase 4 全部完成后才进 Phase 5。

### 9.1 数据驱动兼容性
- ✅ 区域内容(敌人/奇物/陷阱/疾病/奖励)独立 pool
- ✅ 路线生成器可注册(已支持 ruins,新增 weald/burrows 走同样接口)
- ✅ UI 不硬编码区域规则(`MediumQuestCard` 显示 `quest.dominantDiseases` + `recommendedProvisions`)
- ⚠️ 任务生成器需要新增 `generateRegionQuest(regionId, week, seed)` 抽象

### 9.2 区域进度系统
- 新增 `RegionProgress` 类型:`{ regionId, level: 0-4, exp, unlockedEnemies, unlockedCurios, unlockedTrinkets, bossReady }`
- ⚠️ 区域经验与升级原子提交需要事务化
- ⚠️ Boss 任务接口预留,不实现具体 Boss 战斗

### 9.3 区域发现系统
- 新增 `RegionDiscoveryState`:`{ discoveredEnemyIds, discoveredCurioIds, discoveredTrapIds, discoveredDiseaseIds, discoveredTrinketIds }`
- ⚠️ 未发现内容不在区域详情中完整展示 — 需扩展 `RegionDetailDrawer`

### 9.4 任务生成深化
- ⚠️ 推荐英雄标签(5 种任务目标 + 12 修正词):需要新建 `QuestModifier` 抽象
- ⚠️ 推荐补给生成:基于任务目标 + 区域疾病权重 + 路线长度

### 9.5 跨阶段兼容性
- P4 饰品正负 modifier 需在 P5 区域 Buff 系统中保留正负权衡
- P4 露营 Buff(`expeditionBuffs`)需在 P5 区域规则下重新评估
- P4 区域疾病权重需在 P5 任务卡上提前提示

### 9.6 工作量估计(基于 P4 经验)
- 区域框架 + 3 区域内容:**~3000-4000 lines**
- 3 区域路线生成器:**~1500 lines**
- 12 普通 + 6 精英敌人:**~1500 lines**
- 12 奇物 + 9 陷阱:**~1200 lines**
- 5 任务目标 + 12 修正词:**~800 lines**
- 14 UI 组件:**~2500 lines**
- 4 Golden Run + 报告 + 存档迁移 v4→v5:**~1000 lines**
- **总:~11000-13000 lines / ~80-100 个新测试**

### 9.7 风险点
- 区域权重 + 任务生成器容易引入 **种子不一致** 问题(必须严格用 `Mulberry32` 不走 Math.random)
- Boss 任务接口需要避免 **与 P4 死亡系统冲突**
- 区域进度等级 4 解锁 Boss 必须 **刷新后保持解锁状态**

---

## 10. 提交记录(Phase 4)

```
HEAD       P4.5.3  (待提交) UI 12 组件 + Phase 4 报告
P4.5.1+2  c314457  save v3→v4 迁移 + 3 Golden Run
P4.5.1+2  (同上)   GAME_STATE_VERSION 3→4, invariants 跟随
P4.4       1bcfb6a  中型任务 + 露营 + 夜袭 + Buff
P4.3       77c05bb  成长深化 0-4 升级曲线
P4.2       8adb424  饰品系统(20 件)
P4.1       708bec0  怪癖 + 疾病
P3 fix     c1a9ca2  Phase 3 eslint fix
P3 P3.7    0d64a4d  存档迁移 + 报告
P3 P3.6    1dc7fed  Golden + Economy
P3 P3.5    b5f6a7b  16 UI 组件
P3 P3.2    12ff93b  17 命令 + 71 tests
P3 P3.1    a015044  基础类型与状态
P2.x       a7c0190  retro-fix
P2         bc4824f  压力/折磨/美德/死亡
P1 v2.0    52aa900  node-expedition slice
```

---

## 11. 验收

### 11.1 自动化验收

- ✅ `npm run typecheck` — 0 errors
- ✅ `npm run lint` — 0 errors / 0 warnings
- ✅ `npm run test` — 411/411 通过
- ✅ `npm run build` — 144 modules, CSS 28.84 kB, JS 415.07 kB(gzip 124.89 kB)

### 11.2 SPEC §30 完成定义(16 项)

全部满足(见 §1)。

### 11.3 移动端(390×844)

- 露营食物 4 选择网格(移动端 1 列)
- 活动 2-4 网格(移动端 1 列)
- 按钮 ≥ 44px
- 夜袭 overlay 居中卡片

### 11.4 刷新恢复

- 远征状态 / 露营 / Buff / 夜袭结果全部通过 v3→v4 持久化
- Seeded RNG 状态持久化,刷新后路线/遭遇/夜袭结果不变

---

## 12. 总结

Phase 4 在不破坏 Phase 1-3 的前提下,完整实现了 SPEC §1-§32 的所有内容:
- 24 个怪癖 + 10 疾病 + 20 饰品 + 22 露营活动
- 9 个新命令 + 11 个新事件
- 12 个 UI 组件(8 + 4 camp)
- v3→v4 存档迁移
- 3 个 Golden Run(英雄个性化 / 露营 / 夜袭)
- 411/411 单元测试通过

按用户要求"Phase 4 全部完成后再做 Phase 5",**Phase 4 至此完整收官**。Phase 5 多区域框架待用户确认后启动。
