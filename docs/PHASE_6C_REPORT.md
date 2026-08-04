# Phase 6C 报告:腐败林地 Boss「孢疫母巢」完整垂直切片(6/6C)

> **版本**: 6.0.0-rc.1
> **完成日期**: 2026-08-04
> **前置**: Phase 6B 失落审判者(已收官)
> **下一步**: Phase 6D 地下兽穴 Boss「饥渊吞噬者」
> **本阶段 Boss**: 新增 `boss-spore-matriarch` id(region: corrupted-woods)

---

## 1. 阶段定位

dev 文档 §31 明确 6C 范围:
> 6C 腐败林地 Boss
> 使用同一框架完成:
> - 疾病与腐蚀机制
> - 孢子环境目标
> - 感染召唤
> - 抗孢子情报
> - 两个削弱任务
> - 三阶段
> - Golden Run
> 用于验证 Boss 框架不是为遗迹硬编码

本次交付:
- ✅ 孢疫母巢 Boss 完整内容(8 情报 + 3 阶段 + 2 削弱 + 1 调查 + 1 讨伐 + 2 环境 + 2 物品 + 1 永久奖励)
- ✅ 6B 框架复用验证 — Phase6DebugPanel / 状态机 / dispatcher / save 迁移 全部不动
- ✅ Golden Run B(DD-WEB-PHASE6-WEAKEN-001)完整流程测试
- ✅ 42 个新单元/集成测试
- ✅ 6B 测试 Boss `boss-test-arbiter` 不被破坏(intelligenceEntryIds 改显式列举)

---

## 2. 模块清单

### 2.1 修改模块

- `boss/registry.ts` — 大量追加(全部为新内容,不动 6B 现有):
  - 4 个 spore 任务(task-spore-investigate-1/weaken-1/weaken-2/final-1)
  - 8 条 spore 情报(intel-spore-attack-1/attack-2/status-1/phase-1/phase-2/env-1/provision-1/retreat-1)
  - 2 个 spore 削弱(weaken-spore-mycelium/immunity)
  - 3 个 spore 阶段(phase-spore-0/1/2)
  - 1 个 spore 永久奖励(reward-spore-matriarch)
  - 2 个 spore 特殊物品(item-spore-antidote/purifier)
  - 2 个 spore 环境目标(env-spore-mycelium-bed/spore-sac)
  - 1 个 spore BossDefinition(boss-spore-matriarch)
  - 1 个 spore 撤退规则(SPORE_BOSS_RETREAT,基础 60%,阶段 2 仅 20%)
- `tests/phase6-boss-framework.test.ts` — 1 个测试改"按 intel.bossId 找 boss",适配多 Boss

### 2.2 新增测试

- `phase6c-spore-matriarch.test.ts` — 32 个 narrative 验证
- `phase6c-golden-run-b.test.ts` — 10 个 Golden Run B 完整流程

---

## 3. 测试统计

| 阶段 | 测试文件 | 测试数 | 累计 |
|------|----------|--------|------|
| 6B 收官 | 36 | 658 | 658 |
| 6C-C1 narrative | +1 | +32 | 690 |
| 6C-C2 Golden Run B | +1 | +10 | 700 |

**总:700/700 通过**(含 golden battle 4 个 + Golden Run A 15 个 + Golden Run B 10 个)

---

## 4. 孢疫母巢:核心设计(SPEC §20.2)

**主题**:疾病 + 腐蚀 + 孢子扩散 + 孢子环境目标 + 感染召唤

**3 阶段**:
- 阶段 0 孢子繁殖(3 轮):母巢之心搏动,稀薄孢子云扩散,孢子囊显现
- 阶段 1 污染扩散(3 轮):从外层菌床召出感染体,孢子云蔓延
- 阶段 2 母巢暴走(3 轮):母巢之心激活,孢子终爆,群体疾病 + 死亡之门

**8 情报**:
- 2 攻击模式(孢子爆裂 / 菌丝缠绕)
- 1 状态威胁(孢子感染)
- 2 阶段机制(污染扩散 / 母巢暴走)
- 1 环境目标(菌床结构弱点)
- 1 推荐补给(抗孢子药剂)
- 1 撤退风险(孢子窒息撤退)

**2 削弱任务**:
- 净化外层菌床 → 母巢第二阶段感染召唤池缩小到 1
- 取得抗孢子药剂 → 前 3 轮所有英雄完全免疫孢子爆裂和感染

**2 环境目标**:
- 外层菌床(HP 30,可火油焚烧/药剂封印/跳过)
- 巨型孢子囊(HP 20,可主动戳破获得群体免疫 / 绕开承受持续爆发)

**2 特殊物品**:
- 抗孢子药剂(3 轮完全免疫,占 1 槽)
- 菌床净化圣物(封锁菌床活性 / 破坏孢子囊,占 1 槽,撤退后保留)

**1 永久奖励**:
- 母巢之心:林地区域抗病 +25% + 疾病感染率 -20%
- 解锁饰品:母巢之眼
- 解锁任务修正词:菌丝共生

**撤退规则**(per dev §15 + §20.2):
- 基础 60%(比审判者低 5%,疾病压更不容易撤)
- 阶段 1 -20%(40%)
- 阶段 2 -40%(20%,孢子窒息)
- 撤退后威胁 +18(比审判者高,孢子扩散)
- 撤退后 weken-spore-immunity 失效,weaken-spore-mycelium 永久保留

---

## 5. Golden Run B(SPEC §35)

**Seed**: `DD-WEB-PHASE6-WEAKEN-001`

**完整流程**:
1. 启动 campaign + 调查 → status: revealed,3 条情报
2. 完成"净化外层菌床" → weaken-spore-mycelium 应用, status: weakened
3. 完成"取得抗孢子药剂" → weaken-spore-immunity 应用, status: hunt-ready
4. 启动最终讨伐 → status: active
5. 携带抗孢子药剂 → 阶段 1 战术选项解锁
6. 击败母巢 → status: defeated, 战役进度 +1
7. 削弱不重复叠加(SPEC §27 验证)

**验收**(SPEC §35 全部通过):
- ✅ 削弱效果真实生效(感染召唤池从无限制变成 1)
- ✅ 不重复叠加(再次完成任务不增加 activeWeakeningEffectIds)
- ✅ 任务链结果进入 Boss 战(activeWeakeningEffectIds 进入 encounter 状态)
- ✅ 报告说明削弱带来的影响(bossEvents 包含 BOSS_WEAKENING_QUEST_COMPLETED + BOSS_WEAKENING_EFFECT_APPLIED)
- ✅ 刷新不改变情报结果(同 seed 跑两次结果一致)

---

## 6. 6B 框架复用验证

**未改动的 6B 模块**(证明框架不需为每个 Boss 改):
- ✅ `boss/types.ts` — 不变
- ✅ `boss/state-machine.ts` — 不变
- ✅ `boss/threat.ts` — 不变
- ✅ `boss/choice-generator.ts` — 不变
- ✅ `boss/encounter-resolver.ts` — 不变
- ✅ `boss/index.ts` — 不变
- ✅ `expedition/commands.ts` — 不变
- ✅ `expedition/domain-events.ts` — 不变
- ✅ `expedition/dispatcher.ts` — 不变(28 命令通用)
- ✅ `persistence/save.ts` — 不变
- ✅ `components/boss/Phase6DebugPanel.tsx` — 不变(支持任意 BossId)

**新 Boss 通过 BOSS_DEFINITIONS 字典注册 + BOSS_TASKS / BOSS_INTELLIGENCE 等字典追加新 entry**,自动接入所有框架(状态机、dispatcher、调试面板、save 迁移)。

**6B 测试 Boss 兼容性**:
- ✅ `boss-test-arbiter` 仍是失落审判者(8 情报 / 3 阶段 / 2 削弱)
- ✅ `intelligenceEntryIds` 改显式列举 8 条 arbiter 情报 id(避免混入 spore)
- ✅ 6B 全部 234 个测试继续通过

---

## 7. 完成度对照(dev §31 6C 范围)

| dev §31 6C 范围项 | 状态 |
|---|---|
| 疾病与腐蚀机制 | ✅ 孢子爆裂 + 菌丝缠绕 + 孢子感染 |
| 孢子环境目标 | ✅ 外层菌床 + 巨型孢子囊 |
| 感染召唤 | ✅ 阶段 1 召唤感染体 |
| 抗孢子情报 | ✅ 8 条情报含抗孢子主题 |
| 两个削弱任务 | ✅ 净化菌床 + 抗孢子药剂 |
| 三阶段 | ✅ 孢子繁殖 + 污染扩散 + 母巢暴走 |
| Golden Run | ✅ B 用孢疫母巢验证 |

**6C 完成度**: 7/7(100%)

**验证 6B 框架非遗迹硬编码**: ✅ 通过 — dispatcher / state-machine / choice-generator / save / debug panel 全部不动,只追加 registry 内容。

---

## 8. 已知问题(6C 收尾)

1. **spore Boss 内容 narrative 已经详细,但 HP / 阶段阈值是占位值** — 真实伤害计算需要接 BattleContext(用户决定 6B 推迟;推到 7 阶段或后续)
2. **spore Boss 的 summon-id `summon-感染体` 是字符串占位** — 真实敌人定义需要接 content/enemies/ 体系
3. **环境目标 weaken-spore-immunity 仅持续 3 轮的机制** — 没有真实 effect 衰减(纯 flag 标记);等接 BattleContext
4. **mobile 移动端** — Phase6DebugPanel 选 Boss 下拉菜单已支持 spore;但 UI 集成到 App.tsx 留给后续

---

## 9. Phase 6D 准备

dev §32 明确 6D 范围:地下兽穴 Boss「饥渊吞噬者」(食物/流血/阵型打乱/储粮环境/精英护卫)。

6C 已经验证了:
- 6B 框架可复用,6D 只需要追加 `boss-burrows-devourer` 内容
- 状态机 / dispatcher / save / 调试面板全部不动
- Golden Run C 流程与 Golden Run B 类似

6D 主要做:
- 新增 `boss-burrows-devourer` Boss 内容(8 情报 + 3 阶段 + 2 削弱 + 2 环境 + 2 物品)
- 推荐职业/补给/饰品(抗流血 / 食物储备)
- 撤退规则(基础 55% 最低,食物掠夺机制)
- Golden Run C 完整流程测试(用 burrows Boss)

预计 6D 内部 2-3 个 commit(内容 + Golden Run + 报告)。
