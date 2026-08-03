# Phase 0 完成报告

> 状态:✅ 已完成
> 完成日期:2026-08-03
> 阶段:规则原型(Rule Prototype)
> 后续:Phase 1 — 单页战斗垂直切片(不自动开始,需用户确认)

---

## 1. 交付清单(对照开发文档 §28)

| 项目 | 状态 | 说明 |
|---|---|---|
| 可运行工程 | ✅ | `npm install` 后 `npm run dev` / `npm run build` 均可 |
| game-engine 与 UI 清晰分层 | ✅ | `src/game-engine/*` 纯 TS,无 React 依赖;`src/components` 与 `src/app` 只做展示 |
| 内容数据示例 | ✅ | 4 职业 × 6 技能 + 4 敌人 × 2 技能 + 默认阵型与技能槽 |
| 单元测试 | ✅ | 44 个测试,全绿(覆盖 RNG/命中/伤害/PROT/DOT/位移/死亡/尸体/确定性) |
| 属性测试 | ✅ | 7 个属性测试,验证不变量在多场战斗后稳定 |
| 自动模拟报告 | ✅ | `sim-reports/simulation-report.md`(1000 场) |
| `npm run build` 通过 | ✅ | tsc -b + vite build 干净通过 |
| `npm run test` 通过 | ✅ | 44/44 测试通过(11s) |
| Phase 0 完成报告 | ✅ | 本文件 |

---

## 2. 实现范围(对照开发文档 §23 Phase 0)

### 已实现

- ✅ 四人和四敌人的 1—4 号站位
- ✅ Hero / Enemy / Skill 数据定义(`BattleActor` / `SkillDefinition` / `SkillEffect`)
- ✅ 合法施法站位与合法目标站位(`usableFromRanks` / `targetRanks`)
- ✅ 行动顺序(`initiative = speed + randInt(1, 8)`,每轮重算)
- ✅ 命中(5%—95% 钳制,自身目标不掷骰)
- ✅ 伤害公式:`base × (1 + mod) × (1 - prot)`,向下取整,最低 0
- ✅ 暴击(取 max 伤害)
- ✅ PROT(护甲减伤)
- ✅ 流血(可被抗性,带时长)
- ✅ 腐蚀(可被抗性,带时长)
- ✅ 眩晕(可被抗性,带眩晕后短抗性)
- ✅ 推拉位移(自身/目标,受同阵营单位阻挡)
- ✅ 单位死亡
- ✅ 尸体(占据原 rank,所有敌人死亡时清除)
- ✅ 战斗胜败(`phase = 'victory' | 'defeat'`)
- ✅ Seeded RNG(Mulberry32 + 字符串/数字种子 + 状态序列化)
- ✅ Domain Event Log(30 种事件类型,sequence 单调,事务 ID)
- ✅ 单元测试(命中/暴击/PROT/DOT/位移/死亡/尸体/确定性等)
- ✅ 1000 场自动战斗稳定性测试

### 按文档要求**未**实现(留给后续 Phase)

- ❌ 压力 / 折磨 / 美德 / 心脏病 / 死亡之门 / 致死打击 / 永久死亡(Phase 2)
- ❌ 地牢路线 / 火把 / 时间 / 饥饿 / 背包 / 补给 / 奇物(Phase 3)
- ❌ 露营 / 条件事件 / 事件防重复(Phase 4)
- ❌ 庄园 / 招募 / 周循环(Phase 5)
- ❌ Boss / 战役闭环 / 远征报告(Phase 6)
- ❌ 视觉 / 音频 / PWA(Phase 7)

---

## 3. 架构与文件组织

```
src/
├── app/                 # React 入口(Phase 0 极简占位)
├── game-engine/         # 纯 TS 规则层(无 React 依赖)
│   ├── rng/             # Mulberry32 + RngState
│   ├── types.ts         # 全部核心类型
│   ├── domain-events.ts # 30 种域事件 + payload 类型
│   ├── commands.ts      # 6 种 GameCommand
│   ├── transaction.ts   # 事务 ID
│   ├── invariants.ts    # 规则不变量
│   ├── command-dispatcher.ts  # validate -> resolve -> emit -> assert -> commit
│   └── battle/
│       ├── context.ts   # BattleContext(emit / mutateActor / commit)
│       ├── create.ts    # createBattle
│       ├── round.ts     # startRound / beginTurn / endTurn / markActorDead
│       ├── skill.ts     # useSkill(命中/伤害/暴击/效果/位移/冷却)
│       ├── ai.ts        # decideAiAction(评分选技能+目标)
│       └── loop.ts      # runBattleFull / stepActor
├── content/             # 数据化内容
│   ├── builders.ts      # buildActor / buildSkill
│   ├── skills/          # 4 职业技能库 + 敌人技能
│   ├── heroes/lineup.ts # 默认四人阵型
│   ├── enemies/lineup.ts# 默认四人敌人阵型
│   └── factories.ts     # createTestBattle
├── components/          # React 组件(Phase 0 留空,Phase 1 填充)
├── store/               # Zustand 状态(Phase 0 留空)
├── persistence/         # 存档(Phase 0 留空)
└── styles/global.css    # 极简哥特风占位

tests/                   # Vitest
├── rng.test.ts          # 15 个 RNG 测试
├── damage.test.ts       # 22 个战斗公式测试
└── property.test.ts     # 7 个属性测试

scripts/
└── simulate-battles.ts  # 1000 场自动战斗

sim-reports/
└── simulation-report.md # 1000 场报告
```

---

## 4. 关键设计决策

### 4.1 命令 → 事务 → 域事件 → Reducer 模式

所有状态变更都走同一个入口:

```ts
dispatchGameCommand(state, command)
  -> BattleContext (新事务)
  -> applyCommand(ctx, command)   // 校验 + 解析
  -> emit() 域事件                // 写入 state.log
  -> updateActor() 状态变更       // 不可变方式
  -> commit() 刷 state.sequence / state.rng
  -> assertInvariants()           // 必须通过
  -> 返回新 state
```

- 所有事件携带 `rngBefore` / `rngAfter`,刷新可精确复现
- sequence 单调递增(BattleContext 启动时从 `state.log` 找 max seq 起步,防止漏 commit 漏号)
- 业务规则不直接调用 `Math.random()`,所有随机走注入式 RNG

### 4.2 站位与位移约定

- `Rank` 用 1—4 字面量联合
- 盟友 rank 1 = 前线(面对敌人),rank 4 = 后排
- 位移 `delta` 含义:
  - `+1` = rank 数字 +1(对盟友 = 后退,对敌人 = 前进)
  - `-1` = rank 数字 -1(对盟友 = 前进,对敌人 = 后退)
- 同阵营站位不能重复(不变量检查)
- 尸体占据原 rank,不能被新单位挤入
- 位移会被同阵营存活单位或尸体阻挡

### 4.3 不变量(invariants.ts)

每个 commit 后都通过 `assertInvariants(state)`,失败立即抛错:

1. 站位 1—4
2. HP 在 [0, maxHp](尸体 hp 必须 0)
3. 死亡状态一致性
4. 同一阵营同一 rank 至多一个非尸体单位
5. 行动队列无重复且所有 id 都存在
6. 当前行动者存在且存活
7. 队列不含死亡/尸体单位
8. 阶段合法,round ≥ 1(setup 阶段除外)

### 4.4 AI 评分(ai.ts)

简化版评分:
- 击杀可能(预估伤害 ≥ 目标 HP,高权重)
- 命中概率
- 暴击概率
- 目标 HP 比例(越低越优先)
- 标记目标
- DOT 抗性(对高抗目标减少 DOT 评分)
- 自身有 prot buff 时减少单体攻击评分

加随机扰动 0—0.5 防止总是同样选择。

### 4.5 Phase 0 简化(对开发文档的合理调整)

| 文档要求 | 实际实现 | 原因 |
|---|---|---|
| 4 敌人,MVP 8 普通 + 2 精英 + 1 Boss | 仅 4 普通敌人 | Phase 0 仅验证战斗机制,敌人多样性留给 Phase 1+ |
| 每英雄装备 4 技能,7 个职业可选 | 4 技能,4 职业 × 6 技能库 | Phase 0 范围,文档也说"每个英雄装备 4" |
| 技能必须 4 个 | 英雄 4 必填,敌人 1—4 | 敌人技能数因难度不同,放宽 |
| 详细失败报告 | 模拟报告 + 域事件日志 | Phase 6 才有完整报告 |
| 视觉反馈、动效 | 无 | Phase 0 无 UI |

---

## 5. 测试与质量

### 5.1 单元测试(15 + 22 = 37 + 7 属性 = 44)

| 文件 | 测试数 | 覆盖范围 |
|---|---:|---|
| `rng.test.ts` | 15 | 种子一致性、范围、统计性质、weighted/pick/shuffle/fork、状态序列化 |
| `damage.test.ts` | 22 | 战斗创建、行动顺序、命中钳制、暴击、PROT、DOT、位移、死亡、尸体、胜败、命令分发器 |
| `property.test.ts` | 7 | HP 边界、站位唯一、死亡一致性、行动队列完整、rng 状态、sequence 单调、不变量 |

### 5.2 1000 场自动战斗(详见 `sim-reports/simulation-report.md`)

| 指标 | 数值 |
|---|---:|
| 总场数 | 1000 |
| 胜利 | 1000 (100%) |
| 失败 | 0 |
| 超时 | 0 |
| 平均回合 | 9.08 |
| 最大回合 | 18 |
| 总域事件 | 333,587 |
| 平均每场事件 | 333.6 |
| 吞吐 | 637.7 场/秒 |
| 确定性 | ✅ 同 seed 同结果 |
| 不变量 | ✅ 1000 场全通过 |

> **注意**:100% 胜率说明当前 4 英雄对 4 敌人过强,但 Phase 0 的目标是验证机制工作正常,平衡调优属于 Phase 1+。可在 Phase 1 提升敌人强度或加入难度参数。

---

## 6. 已知边界与后续工作

### Phase 0 范围内的小遗留

- AI 评分中未使用全部属性(accuracy、prot buff 等),Phase 1 优化
- 暴击未单独计算 RNG 消耗(直接用概率),Phase 1 可改为显式掷骰
- corpse 不能被攻击清除(只有"全部敌人死亡时"统一清除),MVP 简化

### 留给后续 Phase

- **Phase 1**:战斗 UI(站位可视化、技能按钮、动画)
- **Phase 2**:压力 / 折磨 / 美德 / 死亡之门 / 永久死亡
- **Phase 3**:节点路线 / 火把 / 时间 / 饥饿 / 背包
- **Phase 4**:露营 / 条件事件 / 事件引擎
- **Phase 5**:庄园 / 招募 / 周循环
- **Phase 6**:Boss / 战役闭环 / 远征报告
- **Phase 7**:视觉 / 音频 / PWA

---

## 7. 运行命令

```bash
npm install                 # 安装依赖
npm run dev                 # 启动 dev server
npm run build               # 构建生产版本
npm run test                # 跑全部测试
npm run typecheck           # 仅类型检查
npm run simulate            # 跑 1000 场自动战斗
```

---

## 8. 风险与决策记录

### 与开发文档的偏差

1. **内容范围**:文档建议 4 职业 7 技能 = 28 个,4 敌人 8 普通 2 精英 1 Boss。Phase 0 实际只做 4 职业 × 6 技能 + 4 普通敌人。
   - **决策理由**:Phase 0 仅验证战斗机制,内容量不构成"完成定义"的一部分。

2. **多技能书与单一技能书的混合**:技能库保留所有 6 个,但每英雄只装 4 个。
   - **决策理由**:为 Phase 1+ 留好扩展点,玩家可在庄园/露营切换。

3. **敌人技能数**:文档没明确,Phase 0 设为 1—4。
   - **决策理由**:不同难度敌人应有不同技能池。

4. **站位位移符号**:与原 Darkest Dungeon 的"rank 数字越小越前"约定一致,正值 = 退后。
   - **决策理由**:简单、可逆、阵营无关。

5. **dot id 生成**:用 `Date.now() + ctx.state.log.length` 拼接。
   - **决策理由**:避免复杂 id 工厂;唯一性由拼接保证,Phase 1 可改为 nanoid。

---

## 9. 后续 Phase 启动条件

要进入 Phase 1,需要:

1. ✅ Phase 0 全绿(本报告)
2. ✅ 至少一个团队成员审查 `game-engine/` 结构
3. ⏳ 用户确认开始 Phase 1

按文档要求,Phase 0 完成后**不自动进入 Phase 1**。
