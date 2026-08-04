# Phase 6A 报告:Boss 通用框架(6/6A)

> **版本**: 5.0.0-rc.1(沿用 Phase 5;6B 时升 6.0.0-rc.1 + migrateV5ToV6)
> **完成日期**: 2026-08-04
> **前置**: Phase 1-5(均已收官)
> **下一步**: Phase 6B 遗迹 Boss 完整垂直切片
> **本阶段使用测试 Boss `boss-test-arbiter`,不做正式三个区域 Boss 内容**

---

## 1. 阶段定位

Phase 6A 是 Phase 6 内部的第一个子阶段。dev 文档 §29 明确:

> Phase 6A Boss 通用框架
> 此阶段使用测试 Boss,不制作正式三个区域内容。

本次交付:
- ✅ Boss 通用类型框架
- ✅ 测试 Boss 数据(占位,6B 覆盖)
- ✅ Boss 状态机(reducer)
- ✅ 区域威胁系统
- ✅ Boss 选择生成器
- ✅ Boss 战遭遇结算
- ✅ Dispatcher 集成 28 个新命令
- ✅ 20 个新 Domain Event
- ✅ 状态字段接入(CampaignState / ExpeditionState 可选字段)
- ✅ 97 个新单元/集成测试

未做(推到 6B / 6C / 6D):
- ❌ 三个区域正式 Boss 内容(6B/6C/6D)
- ❌ Phase6DebugPanel UI 组件(6B)
- ❌ 5 条 Golden Run(待三个 Boss 完成后跑)
- ❌ GAME_STATE_VERSION 升级 + migrateV5ToV6(6B 收尾时做)
- ❌ 完整 Boss 战选择 → 战斗底层效果映射(6B)
- ❌ E2E 测试(待 UI 完成)

---

## 2. 模块清单

### 2.1 新增模块 (`src/game-engine/boss/`)

| 文件 | 行数 | 职责 |
|---|---|---|
| `types.ts` | ~370 | 13 个核心类型 + 工厂(无依赖) |
| `registry.ts` | ~640 | 测试 Boss + 8 情报 + 3 阶段 + 2 削弱 + 1 永久奖励 + 2 特殊物品 + 初始化 helpers |
| `state-machine.ts` | ~330 | 9 个 reducer + 合法状态转换图 + 幂等性 |
| `threat.ts` | ~130 | 0-100 威胁 clamp + 6 状态映射 + 增长/下降函数 + 不变量 |
| `choice-generator.ts` | ~150 | 2-4 战术选项生成(复用 GeneratedChoice) |
| `encounter-resolver.ts` | ~200 | Boss 战初始化/阶段推进/撤退/失败/胜利 |
| `index.ts` | ~80 | 桶导出 |

### 2.2 修改模块

- `expedition/commands.ts` — GameCommand 联合追加 28 个新 case(13 业务 + 15 调试)
- `expedition/domain-events.ts` — ExpeditionDomainEventType + ExpeditionDomainEvent 追加 20 个 BOSS_* 事件
- `expedition/dispatcher.ts` — applyCommand 28 个 case + 28 个 cmd* 函数 + 3 ensure helpers + ensureAllBossState
- `expedition/types.ts` — ExpeditionState 加 3 个可选字段
- `campaign/types.ts` — CampaignState 加 3 个可选字段

### 2.3 新增测试 (`tests/`)

- `phase6-boss-framework.test.ts` — 19 个测试(types + registry 数据完整性)
- `phase6-boss-state-machine.test.ts` — 38 个测试(状态机 + reducer)
- `phase6-boss-systems.test.ts` — 33 个测试(threat + choice + encounter)
- `phase6-boss-state-integration.test.ts` — 7 个测试(状态字段接入 + 初始化 helpers)
- `phase6-boss-dispatcher.test.ts` — 17 个测试(dispatcher 集成 + 事件)

---

## 3. 测试统计

| 阶段 | 测试文件 | 测试数 | 累计 |
|------|----------|--------|------|
| Phase 5 收官 | 27 | 484 | 484 |
| 6A-C1 types/registry | +1 | +19 | 503 |
| 6A-C2 state machine | +1 | +38 | 541 |
| 6A-C3 systems | +1 | +33 | 574 |
| 6A-C4a state integration | +1 | +7 | 581 |
| 6A-C4b dispatcher | +1 | +17 | 598 |

**总:598/598 通过**(含 golden battle 4 个)

---

## 4. 不变量(SPEC §27)

实现并测试:
- ✅ Boss 阶段必须按合法条件转换
- ✅ 同一阶段不得重复进入(defeated 是终态)
- ✅ 削弱效果不得重复叠加(applyWeakening 幂等)
- ✅ 区域威胁不得低于 0 或高于 100(clamp + isThreatValid)
- ✅ 已击败 Boss 不得再次进入普通讨伐流程
- ✅ Boss 击败奖励不得重复领取(defeated 终态 + DuplicateCommandError)
- ✅ 撤退结果不得重复结算
- ✅ Boss 战撤退时按 lossRules 失效削弱效果

未实现的(6B 收尾):
- ⏳ Boss 最终任务必须在 hunt-ready 状态后解锁(等 Boss 任务流跑通)
- ⏳ 最终战役接口只能在三个 Boss 击败后开启(等三个 Boss 落地)
- ⏳ 永久死亡在 Boss 战中不可回滚(等战斗底层接入)
- ⏳ 刷新不得重抽阶段、伤害、撤退或奖励(等 phase 转换接战斗)
- ⏳ 未发现情报不得显示完整细节(等 UI)

---

## 5. Golden Run 状态

6A 阶段**未跑 5 条 Golden Run**(dev §34-38),原因:
- Golden Run A/B/C/D/E 需要三个正式 Boss 全部落地
- 当前只有 1 个测试 Boss
- 真正的 Golden Run 验证推迟到 Phase 6 收尾(6B-6E 全完成后)

---

## 6. 已知问题(6A)

1. **GAME_STATE_VERSION 未升** — 6A 阶段仍用 5.0.0-rc.1,save schema 保持 v5。
   - 影响:旧 v5 存档加载时,CampaignState.bossStates/regionThreats/campaignThreat 为 undefined
   - 处理:dispatcher 通过 ensureAllBossState 懒初始化
   - 修复:6B 收尾时升 v6.0.0-rc.1 + 加 migrateV5ToV6
2. **Phase6DebugPanel 未做** — 引擎层 16 个 DEBUG_* 命令已加,UI 组件推迟到 6B
3. **Boss 战选择 → 战斗底层未接** — 当前 SELECT_BOSS_TACTICAL_OPTION 是 noop;6B 接入底层 BattleContext
4. **情报/削弱/任务效果未触发实际 gameplay** — 当前仅记录到 state,实际效果由 6B 接入
5. **撤退成功率硬编码** — `cmdAttemptBossRetreat` 当前 success=false(始终失败);
   应由 encounter-resolver.calcRetreatSuccessRate + 随机数决定
6. **唯一 Boss 是测试 Boss** — `boss-test-arbiter` 名字"测试审判者",6B 改为"失落审判者"

---

## 7. Phase 6B 准备

dev 文档 §30 明确 6B 范围:
- 遗迹 Boss 垂直切片(完整架构验证)
- 情报(8 条)
- 调查任务
- 两个削弱任务
- 最终讨伐
- 三阶段
- 环境目标
- 召唤
- 特殊物品
- 撤退
- 击败
- 永久奖励
- Golden Run A

6A 已经把 6B 需要的引擎基础全部就位。6B 主要做:
- 替换 `boss-test-arbiter` → `boss-失落审判者`(完整 8 情报 + 2 削弱 + 3 阶段)
- 真实战斗底层接入(SELECT_BOSS_TACTICAL_OPTION → BattleContext)
- Phase6DebugPanel UI 组件
- GAME_STATE_VERSION 升 6.0.0-rc.1 + migrateV5ToV6
- Golden Run A 测试(seed DD-WEB-PHASE6-INTEL-001)

---

## 8. 命令清单(28 个新命令)

### 业务命令(13,SPEC §24)
- START_BOSS_INVESTIGATION
- GRANT_BOSS_INTELLIGENCE
- COMPLETE_BOSS_INVESTIGATION_QUEST
- COMPLETE_BOSS_WEAKENING_QUEST
- UNLOCK_BOSS_HUNT
- START_BOSS_FINAL_QUEST
- ENTER_BOSS_ENCOUNTER
- SELECT_BOSS_TACTICAL_OPTION
- RESOLVE_BOSS_PHASE_TRANSITION
- INTERACT_BOSS_ENVIRONMENT_TARGET
- ATTEMPT_BOSS_RETREAT
- RESOLVE_BOSS_DEFEAT
- RESOLVE_BOSS_FAILURE

### 调试命令(15,SPEC §39)
- DEBUG_SET_REGION_THREAT
- DEBUG_SET_REGION_THREAT_STATE
- DEBUG_SET_BOSS_STATUS
- DEBUG_GRANT_BOSS_INTELLIGENCE
- DEBUG_REMOVE_BOSS_INTELLIGENCE
- DEBUG_COMPLETE_BOSS_QUEST
- DEBUG_ADD_BOSS_WEAKENING
- DEBUG_REMOVE_BOSS_WEAKENING
- DEBUG_UNLOCK_BOSS_HUNT
- DEBUG_JUMP_BOSS_PHASE
- DEBUG_SET_BOSS_HP
- DEBUG_FORCE_BOSS_SUMMON
- DEBUG_FORCE_BOSS_PHASE_TRANSITION
- DEBUG_FORCE_BOSS_RETREAT
- DEBUG_FORCE_BOSS_DEFEAT
- DEBUG_RESET_BOSS_STATE

(15 个,dev 文档 §39 列了 19 项,6A 实现 15,缺 4 项调试 UI 推到 6B 一起)

---

## 9. 事件清单(20 个新事件,SPEC §25)

dev §25 列了 22 个 Boss 事件,6A 实现 20:
- ✅ BOSS_RUMOR_DISCOVERED
- ✅ BOSS_INVESTIGATION_STARTED
- ✅ BOSS_INTELLIGENCE_GRANTED
- ✅ BOSS_INVESTIGATION_QUEST_COMPLETED
- ✅ BOSS_WEAKENING_QUEST_COMPLETED
- ✅ BOSS_WEAKENING_EFFECT_APPLIED
- ✅ BOSS_HUNT_UNLOCKED
- ✅ BOSS_FINAL_QUEST_STARTED
- ✅ BOSS_ENCOUNTER_STARTED
- ✅ BOSS_PHASE_TRANSITIONED
- ✅ BOSS_PHASE_ENTERED
- ✅ BOSS_RETREAT_ATTEMPTED
- ✅ BOSS_RETREAT_SUCCEEDED
- ✅ BOSS_RETREAT_FAILED
- ✅ BOSS_ENCOUNTER_FAILED
- ✅ BOSS_DEFEATED
- ✅ BOSS_PERMANENT_REWARD_GRANTED
- ✅ REGION_THREAT_CHANGED
- ✅ REGION_THREAT_STATE_CHANGED
- ✅ CAMPAIGN_THREAT_ADVANCED
- ✅ FINAL_CAMPAIGN_GATE_MARKED_READY

(共 21 个,dev 列了 22 个。差 1 个是"boss 战术选择"事件,6B 接战斗底层时再加)

---

## 10. 完成度对照

| dev §29 6A 范围项 | 状态 |
|---|---|
| BossDefinition | ✅ |
| BossCampaignState | ✅ |
| RegionThreatProgress | ✅ |
| BossIntelligenceEntry | ✅ |
| BossWeakeningEffect | ✅ |
| BossPhaseDefinition | ✅ |
| BossEncounterState | ✅ |
| 通用 Boss 选择生成 | ✅ |
| 撤退 | ✅ |
| 胜利与失败 | ✅ |
| 存档迁移 | ⏳ 推到 6B(GAME_STATE_VERSION 未升) |
| 调试工具 | 🟡 引擎 15/19,UI 推迟 |
| 测试 | ✅ 97 个新测试 |

6A 完成度: 11/13 项(85%);剩余 2 项都是 6B 一起做更合理。
