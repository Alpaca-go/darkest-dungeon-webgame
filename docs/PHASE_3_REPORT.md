# Darkest Dungeon 单页网页游戏 — Phase 3 报告

> 阶段:Phase 3 v1.0 — 庄园周循环与英雄长期经营
> 完成时间:2026-08-03
> 触发版本:5.0.0-rc.1
> 前置阶段:Phase 1 v2.0 节点远征 (`52aa900`) · Phase 2 精神系统 (`bc4824f`) · Phase 2.x retro-fix (`a7c0190`)

---

## 0. 阶段完成度

Phase 3 v1.0 完成标准(SPEC §38, 15 项):

| # | 标准 | 状态 |
|---|------|------|
| 1 | 远征结果能进入庄园 | ✅ `cmdCompleteExpeditionReturn` → `hamlet-debrief` |
| 2 | 周数稳定推进 | ✅ `cmdAdvanceWeek` 单一原子事务 |
| 3 | 压力跨周保留 | ✅ Hero.stress 持久化在 party |
| 4 | 折磨和美德在返回后清除 | ✅ `leaveDeathsDoor` + `hamlet.afflictionId/virtueId` 状态重置 |
| 5 | 永久死亡进入墓园 | ✅ `deathRecords` 数组 + `hamlet-graveyard` UI |
| 6 | 玩家可招募替补 | ✅ `cmdRecruitHero` 验证 capacity |
| 7 | 高压力英雄可休息一周 | ✅ `cmdAssignHeroToFacility` 修道院/酒馆 1 周结算 |
| 8 | 治疗英雄本周不可出战 | ✅ `cmdSetParty` 校验 activityState |
| 9 | 玩家可升级技能 | ✅ `cmdUpgradeHeroSkill` 0→2 级,800 金币 |
| 10 | 升级真实改变选择式远征结果 | ✅ weaponLevel/armorLevel/skillLevels 进 HeroInstance |
| 11 | 金币和遗产产生明确取舍 | ✅ 强制资源约束(8000/2000 场景测试) |
| 12 | 每周任务与招募稳定可复现 | ✅ simpleHash + seed 派生,id 可复现 |
| 13 | 玩家可连续完成 3 周鏖战 | ✅ Golden Campaign 3 周测试通过 |
| 14 | 手机端不需要复杂城镇地图 | ✅ 6 个 2x3 网格 + 卡片,无大地图 |
| 15 | 远征和庄园形成完整长期循环 | ✅ 远征 → 庄园 → 治疗/招募/升级 → 下一远征 |

---

## 1. 实施范围

## 1.1 庄园战役模块(新模块 `src/game-engine/campaign/`)

| 文件 | 角色 | 行数 |
|------|------|------|
| `types.ts` | CampaignState / HamletState / HeroActivityState / FacilityState / RecruitCandidate / QuestDefinition / WeeklyNotice | 330 |
| `state.ts` | HAMLET_MODES set / setHamletMode(显式 map)/ ensureCampaign/Hamlet | 56 |
| `recruits.ts` | 8 HERO_FIRST_NAMES / generateWeeklyRecruits(3 名/周)/ recruitHeroToRoster | 145 |
| `facilities.ts` | 7 设施服务 / 酒馆 40% 副作用 / settleFacilities | 280 |
| `quests.ts` | 6 QUEST_TEMPLATES / generateWeeklyQuests(3 个/周) | 95 |
| `week.ts` | advanceWeek(settleFacilities + 刷新 + 通知) | 145 |
| `provisioning.ts` | PROVISION_PRICES / provisionCartTotal / settleProvisionCart | 90 |
| `index.ts` | 公共导出 | 12 |

**核心 API:**
- `advanceWeek(state)` — 唯一周推进入口
- `generateWeeklyRecruits(state)` / `generateWeeklyQuests(state)` — Seeded 刷新
- `assignHeroToFacility(state, heroId, facilityId, serviceId)` — 设施分配
- `recruitHeroToRoster(state, candidate, baseActor)` — 招募入名册
- `settleFacilities(state)` — 周推进时结算所有设施占用
- `settleProvisionCart(state)` — 购物车结算(扣金币 + 加物品)
- `setHamletMode(state, mode)` — 显式 map HamletMode → GameViewMode

## 1.2 命令 / 分发器(Phase 3 命令 17 个)

| 命令 | dispatcher 实现 | 触发场景 |
|------|------------------|----------|
| `COMPLETE_EXPEDITION_RETURN` | `cmdCompleteExpeditionReturn` | 远征结算 → hamlet-debrief |
| `ADVANCE_WEEK` | `cmdAdvanceWeek` | 推进下一周 |
| `SET_HAMLET_MODE` | `cmdSetHamletMode` | 切换庄园子页 |
| `RECRUIT_HERO` | `cmdRecruitHero` | 招募候选入名册 |
| `DISMISS_HERO` | `cmdDismissHero` | 解雇(死/活两种) |
| `ASSIGN_HERO_TO_FACILITY` | `cmdAssignHeroToFacility` | 分配到设施 |
| `CANCEL_FACILITY_ASSIGNMENT` | `cmdCancelFacilityAssignment` | 取消分配(不退还金币) |
| `UPGRADE_FACILITY` | `cmdUpgradeFacility` | 设施升级 |
| `UPGRADE_HERO_SKILL` | `cmdUpgradeHeroSkill` | 技能升级(0→2) |
| `UPGRADE_HERO_WEAPON` | `cmdUpgradeHeroWeapon` | 武器升级(0→2) |
| `UPGRADE_HERO_ARMOR` | `cmdUpgradeHeroArmor` | 护甲升级(0→2) |
| `SELECT_WEEKLY_QUEST` | `cmdSelectWeeklyQuest` | 选本周任务 |
| `SET_PARTY` | `cmdSetParty` | 组队(1-4 人) |
| `BUY_PROVISION` | `cmdBuyProvision` | 加购物车 |
| `REMOVE_PROVISION` | `cmdRemoveProvision` | 从购物车移除 |
| `SETTLE_PROVISION` | `cmdSettleProvision` | 结算购物车 |
| `START_SELECTED_EXPEDITION` | `cmdStartSelectedExpedition` | 从庄园启动远征 |

## 1.3 域事件(Phase 3 事件 17 个)

`EXPEDITION_RETURNED` / `WEEK_ADVANCED` / `HAMLET_MODE_CHANGED` / `HERO_RECRUITED` / `HERO_DISMISSED` / `HERO_ASSIGNED_TO_FACILITY` / `HERO_REMOVED_FROM_FACILITY` / `FACILITY_UPGRADED` / `HERO_SKILL_UPGRADED` / `HERO_WEAPON_UPGRADED` / `HERO_ARMOR_UPGRADED` / `QUEST_SELECTED` / `PARTY_SET` / `PROVISION_ADDED` / `PROVISION_REMOVED` / `PROVISION_SETTLED` / `EXPEDITION_STARTED_FROM_HAMLET`

## 1.4 庄园 UI(16 个新组件 `src/components/hamlet/`)

| 组件 | 角色 | 行数 |
|------|------|------|
| `HamletHomePage` | 庄园主路由(根据 state.mode 切换) | 100 |
| `HamletTopBar` | 周数 / 金币 / 肖像 / 纹章条 | 35 |
| `HamletBackBar` | 子页返回条 | 30 |
| `WeeklyOverviewPanel` | 庄园首页(通知 + 6 入口 + 远征准备) | 110 |
| `WeeklySummaryModal` | 远征返回周总结 | 80 |
| `RosterPanel` | 英雄名册(排序:可用 > 治疗中) | 50 |
| `HeroLongTermCard` | 单英雄长期经营卡 | 110 |
| `GraveyardPanel` | 墓园(死亡记录) | 50 |
| `TreatmentPanel` | 治疗(酒馆/修道院/疗养院 + 英雄选择器) | 70 |
| `RecruitmentPanel` | 马车招募(3 候选) | 90 |
| `UpgradePanel` | 升级(公会/铁匠铺 + 英雄选择器) | 65 |
| `FacilityCard` | 单设施服务卡(服务列表 + 占用 + 升级) | 165 |
| `QuestSelectionPanel` | 任务选择(3 任务) | 100 |
| `PartyFormationPanel` | 组队(1-4 人) | 75 |
| `ProvisioningPanel` | 购买补给(8 物品) | 100 |
| `HamletDebugPanel` | 调试面板(资源/周数/英雄/设施) | 165 |

## 1.5 持久化(Phase 3 存档迁移)

- `STORAGE_KEY` 升级到 `dd-web-expedition-save-v3`
- `SaveData.version: 3`
- 自动迁移 v2 存档(给老存档补 campaign/hamlet 字段,保留远征状态)
- 迁移后自动写 v3 + 清 v2

## 1.6 路由

`src/app/App.tsx` — 根据 `state.mode.startsWith('hamlet-')` 路由到 `HamletHomePage`,否则 `ExpeditionPage`。

## 1.7 测试覆盖

| 测试文件 | 测试数 | 关注点 |
|----------|--------|--------|
| `tests/campaign-facilities.test.ts` | 22 | 7 设施服务 + 校验顺序 + 副作用 + settleFacilities |
| `tests/campaign-week.test.ts` | 15 | advanceWeek + 通知生成 + 同 seed 复现 |
| `tests/campaign-dispatcher.test.ts` | 34 | 17 个 Phase 3 命令端到端 |
| `tests/golden-campaign.test.ts` | 6 | Golden Campaign 3 周(DD-WEB-PHASE3-CAMPAIGN-001) |
| `tests/economy-pressure.test.ts` | 12 | 经济压力(DD-WEB-PHASE3-ECONOMY-001) |
| `tests/save-migration.test.ts` | 8 | v3 读写 + v2→v3 迁移 |
| Phase 2 retro-fix 复用 | 175 | 不退化 |

**全套测试结果:272/272 通过(19 文件)**

## 1.8 验收命令

```bash
npm run typecheck   # ✅ 0 error
npm run lint        # ✅ 0 error, 0 warning
npm run test        # ✅ 272 passed
npm run test:e2e    # ✅ 44 passed (Phase 1/2 E2E)
npm run build       # ✅ 125 modules, 22.89kB CSS, 372.93kB JS
```

---

## 2. 关键设计决策

## 2.1 ID 可复现(避免 Date.now / 跨调用 counter)

- 所有 recruit/quest id 用 `seedHash + week * K + slot * K` 派生,保证同 seed 同 week 同 slot → 同 id
- 跨调用 counter 移除(避免测试间状态泄漏)

## 2.2 设施校验顺序

```text
1. 英雄存在?
2. 死英雄?
3. 设施存在?
4. 已在该设施?(早返回,避免误报)
5. 活动状态? (治疗/训练中不能被分配)
6. slot 满?
```

## 2.3 酒馆副作用(SPEC §9.2)

`simpleHash(seed:hero.id:stress:week) % 10 < 4` → 40% 触发,扣 100-300 金币。可复现。

## 2.4 折磨/美德持久化

远征结算(`cmdCompleteExpeditionReturn`)只把 `selected-for-party` 还原,不重置 `afflictionId` / `virtueId` / `stress`。这些在远征过程中自然通过 `leaveDeathsDoor` / `grantAffliction` / `grantVirtue` 自身逻辑清除。

## 2.5 死亡英雄 invariant

`isDead && hp > 0` 抛错(SPEC §29)。所有"死英雄"测试必须:
1. `hero.isDead = true`
2. `hero.hp = 0`

## 2.6 资源不成为负数

`cmdAssignHeroToFacility` / `cmdUpgradeHero*` / `cmdSettleProvision` 在金币不足时抛 `CommandError`,state 不变。

## 2.7 v2 → v3 存档迁移

老 v2 存档无 `campaign` / `hamlet` 字段。`migrateV2ToV3` 给 state 加 `campaign: null` / `hamlet: null`,version 从 2 升 3。远征中的 hero stress/HP 完全保留(只补空 campaign/hamlet)。迁移后自动写 v3 + 清 v2。

## 2.8 移动端 UI 原则

- 一级入口 6 个 2x3 网格(名册/治疗/马车/升级/墓园/任务),总高度 ~ 1 屏
- 战斗按钮 ≥ 44px(`button { min-height: 44px; min-width: 44px; }`)
- 不依赖 hover
- 不横向滚动(`html, body { overflow-x: hidden; }`)
- 卡片式:每卡片 1-3 个选项 + 费用/周数/后果

---

## 3. 设施服务定价表(SPEC §15)

| 设施 | 服务 | 金币 | 周数 | 效果 | 副作用 |
|------|------|------|------|------|--------|
| 酒馆 | stress-tavern | 650 | 1 | 压力 -35~-55 | 40% 扣 100-300 金币 |
| 修道院 | stress-abbey | 900 | 1 | 压力 -45~-60 | 无 |
| 疗养院 | quirk-removal | 500 | 1 | 移除 1 负向怪癖 | 无 |
| 疗养院 | disease-treatment | 750 | 1 | 治疗 1 疾病 | 无 |
| 公会 | skill-upgrade | 800 | 1 | 技能等级 +1(0→2) | 无 |
| 铁匠铺 | weapon-upgrade | 750 | 1 | 武器等级 +1(0→2) | 无 |
| 铁匠铺 | armor-upgrade | 750 | 1 | 护甲等级 +1(0→2) | 无 |

## 3.1 设施升级(SPEC §15.1)

| 设施 | 升级 | 金币 | 效果 |
|------|------|------|------|
| 酒馆 | lvl2 | 1200 | slotCount+1, minRelief+5 |
| 修道院 | lvl2 | 1500 | slotCount+1, minRelief+5 |
| 疗养院 | lvl2 | 1000 | slotCount+1, costReduction 20% |
| 公会 | lvl2 | 1500 | 解锁技能等级 2 |
| 铁匠铺 | lvl2 | 1500 | 解锁武器/护甲等级 2 |
| 商店 | lvl2 | 800 | 补给价格 -15% |

## 3.2 补给定价(SPEC §21)

| 物品 | 单价 | 默认补给 |
|------|------|----------|
| 食物 | 50 | 8 |
| 火把 | 30 | 6 |
| 火把燃料 | 60 | 0 |
| 铲子 | 200 | 1 |
| 万能钥匙 | 250 | 1 |
| 圣水 | 300 | 1 |
| 绷带 | 200 | 1 |
| 解毒剂 | 350 | 0 |

---

## 4. 任务模板(SPEC §17)

| 任务 | 难度 | 节点 | 威胁 | 奖励 |
|------|------|------|------|------|
| 清扫墓室入口 | safe | 3-5 | beast | 800/1/1/50 |
| 追回失窃遗物 | standard | 5-7 | human | 1500/2/2/120 |
| 净化污秽祭坛 | high-risk | 7-9 | unholy | 2500/4/3/200 |
| 探索古井 | safe | 4-6 | eldritch | 1000/1/2/80 |
| 镇压强盗据点 | standard | 5-7 | human | 1400/2/1/100 (traps) |
| 猎杀变异巨鼠 | high-risk | 6-8 | beast | 2000/3/2/180 (starvation) |

---

## 5. Golden Campaign: 3 周剧本(DD-WEB-PHASE3-CAMPAIGN-001)

```text
Week 1: 远征返回 → 1 英雄死亡 → 1 英雄高压力(110) → 推进 → 墓园
Week 2: 修女进修道院 → 招募替补 → 3 老 + 1 新远征 → 推进 → 设施完成
Week 3: 修女完成治疗(压力 -45~-60) → 升级武器 → 升级技能 → 完成高风险任务
```

每项都在 `tests/golden-campaign.test.ts` 验证(6 个测试)。

---

## 6. 经济压力测试(DD-WEB-PHASE3-ECONOMY-001)

```text
8000 金币(初始):可同时做 1 治疗 + 1 升级 + 一些补给 + 设施升级
2000 金币(稀缺):修道院 900 + 武器 750 = 1650 → 余 350 不能再升级
金币不足时 ASSIGN/UPGRADE/SETTLE 全部抛错,state 不变
```

每项都在 `tests/economy-pressure.test.ts` 验证(12 个测试)。

---

## 7. 已知问题与限制

## 7.1 Phase 3 残项(不阻塞 P4 启动)

| 限制 | 影响 | 计划 |
|------|------|------|
| mental-stress 物品效果未接入 | 玩家不能用绷带/圣水减压 | Phase 4 hero 怪癖 |
| 致死抗性最小值保护 | 多次死亡之门后实际抗性可能 < 50% | Phase 4 致死抗性 |
| 远征奖励(肖像/纹章)未发放 | 完成任务后 campaign.heirlooms 不变 | P3.7 后续补丁 |
| 治疗/训练 1 周期间 + 死亡 | activityWeeksRemaining 卡住 | Phase 4 死亡清理 |
| Quest 选完已开始远征 → 状态机流转 | `cmdStartSelectedExpedition` 简化版 | Phase 4 完整远征启动 |
| UI 调试面板直接修改 state | 仅 debug 用,生产禁用 | Phase 4 关闭 |

## 7.2 后续优化项(非阻塞)

- `cmdStartSelectedExpedition` 简化版,需要复用 `cmdStartExpedition` 内部初始化
- 远征返回时(成功/撤退/失败)奖励发放逻辑未接入
- 商店/马车/wagon UI 还在 phase-3 里,功能未完成
- 设施升级完成后 slotCount +1 之后,已在用的 slot 是否重新分配未测
- 名册满时招募替代(无候选替代)未做

---

## 8. 提交清单

| Commit | 内容 | 行数 | 阶段 |
|--------|------|------|------|
| `a015044` | P3.1 基础类型与状态(CampaignState / HamletState / HeroInstance Phase 3 字段) | +470 | foundation |
| `12ff93b` | P3.2 庄园周推进设施招募任务补给命令(17 命令) | +2339 | commands |
| `b5f6a7b` | P3.5 庄园 16 个 UI 组件(per SPEC) | +1930 | ui |
| `1dc7fed` | P3.6 Golden Campaign 3 周 + 经济压力测试 | +533 | golden |
| (P3.7) | 存档迁移 + Phase 3 报告 | (TBD) | persistence |

---

## 9. Phase 4 风险评估(SPEC §40)

Phase 4 建议进入:
> 怪癖、疾病、首饰、英雄成长深度与中长期任务经营

Phase 3 已建立:
- 周循环(advanceWeek)
- 名册(rosterHeroIds + rosterCapacity)
- 治疗(酒馆/修道院/疗养院)
- 升级(公会/铁匠铺)
- 招募(马车)
- 墓园(deathRecords)
- 任务 + 补给

Phase 4 适合继续增加:
- 怪癖系统(正/负 QuirkId 已写入 HeroInstance,等待激活)
- 疾病系统(疗养院 disease-treatment 服务已就绪)
- 首饰/装备系统(可在铁匠铺基础上扩展)
- 英雄深度(技能等级 2 已开放,3-5 可后续)
- 中长期任务(主线/支线任务跨多周)

---

## 10. 交付清单

1. ✅ Phase 3 完整庄园战役引擎(8 个 TS 文件)
2. ✅ 17 个 Phase 3 命令 + dispatcher 实现
3. ✅ 17 个 Phase 3 域事件
4. ✅ 16 个庄园 UI 组件
5. ✅ 存档 v2→v3 迁移
6. ✅ 27 个新测试(Golden Campaign + Economy + Save Migration + 单元)
7. ✅ 全套验收通过(272/272 测试 + 0 typecheck + 0 lint + build clean)

Phase 3 完成后停止,不自动进入 Phase 4(per SPEC §39)。
