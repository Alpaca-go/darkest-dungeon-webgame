# Darkest Dungeon Webgame

> 单页、节点推进、选择式遭遇的哥特式网页 Roguelike  
> 改编自《Darkest Dungeon》核心机制,采用《赛博徒步》式单页生存推进结构  
>
> **当前阶段:Phase 5 — 多区域、区域规则、专属敌人与任务生成深化(已收官)**
> **版本:5.0.0-rc.1 · 存档 schema v5**

## 状态

- ✅ **Phase 0 — 规则原型**(详见 [`docs/PHASE_0_REPORT.md`](docs/PHASE_0_REPORT.md))
- ✅ **Phase 1 v2.0 — 节点远征与选择式遭遇垂直切片**(详见 [`docs/PHASE_1_REPORT.md`](docs/PHASE_1_REPORT.md))
- ✅ **Phase 2 — 压力/意志检定/折磨/美德/死亡系统**(详见 [`docs/PHASE_2_REPORT.md`](docs/PHASE_2_REPORT.md))
- ✅ **Phase 3 — 庄园周循环与英雄长期经营**(详见 [`docs/PHASE_3_REPORT.md`](docs/PHASE_3_REPORT.md))
- ✅ **Phase 4 — 怪癖/疾病/饰品/英雄成长/中型任务与露营**(详见 [`docs/PHASE_4_REPORT.md`](docs/PHASE_4_REPORT.md))
- ✅ **Phase 5 — 多区域/区域规则/专属敌人/任务生成深化**(详见 [`docs/PHASE_5_REPORT.md`](docs/PHASE_5_REPORT.md))
- ⏳ **Phase 6 — 区域 Boss 与任务链与战役威胁推进**(待开始)
- ⏳ **Phase 7 — 视觉/音频/PWA/发布准备**(待开始)

详细开发文档见 [`docs/architecture-and-rules.md`](docs/architecture-and-rules.md)(SPEC v2.0)与各 Phase 报告。

## 核心方向(Phase 5 收官)

- **地牢远征是主玩法** —— 战斗只是远征中的一种选择式遭遇
- **四名英雄、站位、技能、敌人编队和状态继续存在于规则层**
- **每一步是 2-4 个情境选择**,引擎自动结算
- **三个区域**(遗迹 / 腐败林地 / 地下兽穴)有各自专属的敌人、奇物、陷阱、疾病倾向、奖励倾向与路线结构
- **庄园周循环**支撑英雄长期经营、招募、补给、设施升级
- **怪癖/疾病/饰品/死亡之门/永久死亡**贯穿远征全程
- **手机端 390×844 优先**

## 快速开始

```bash
npm install              # 安装依赖
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run preview          # 预览生产版本
npm run test             # 跑全部 484 个单元测试
npm run test:e2e         # 跑 E2E 流程
npm run typecheck        # 仅类型检查
npm run lint             # ESLint
```

## 当前能力(Phase 5 收官)

### 远征层
- ✅ 单页远征(9 节点、2 分叉、固定 Seed 可复现)
- ✅ 三个区域(linear / branching / narrow 三套独立生成器)
- ✅ 火把 / 食物 / 时间 / 背包(16 槽)/ 行进方式(正常/谨慎/快速)
- ✅ 3 陷阱 + 2 路障 + 3 奇物 + 2 饥饿变体
- ✅ 2 场选择式遭遇(骸骨巡逻队 / 墓室伏击)
- ✅ 4 标准战术 + 3 条件性战术(assault / backline / control / stabilize / reform / use-item / retreat)
- ✅ 中型任务(露营 + 夜袭 + Buff)
- ✅ 自动战斗结算(走底层 BattleContext)
- ✅ 撤退 + 任务目标 + 出口 + 远征报告 + 失败链

### 区域层(Phase 5)
- ✅ 12 普通敌人(4/区域)+ 6 精英敌人(2/区域)
- ✅ 12 区域奇物 + 9 区域陷阱 + 3 区域疾病权重 + 3 战利品表
- ✅ 18 任务修正词 + 6 任务目标 + 任务生成器
- ✅ 区域等级 0-4 + 区域经验 + 解锁精英/稀有奖励
- ✅ Boss 任务接口(`bossQuestReady` 标记,Phase 6 落地)

### 庄园与长期经营(Phase 3)
- ✅ 周推进(3 周 Golden Campaign 验证)
- ✅ 16 庄园 UI 组件 + 经济压力测试
- ✅ 设施 / 招募 / 任务 / 补给命令

### 角色成长(Phase 2-4)
- ✅ 4 英雄 + 4 敌人
- ✅ 压力 / 意志检定 / 折磨 / 美德 / 死亡之门 / 永久死亡
- ✅ 怪癖(quirk)/ 疾病 / 饰品(trinket)/ 0-4 成长曲线

### 工具
- ✅ 调试面板(固定 seed / 跳节点 / 改资源 / 改 HP / 改站位 / 触发事件 / 区域调试 / 导出)
- ✅ 484 单元测试 + Golden Run(远征/战斗/压力/经济/Phase 4/Phase 5)
- ✅ 存档 schema v5(支持 v2→v3→v4→v5 链式迁移)
- ✅ 移动端 390×844 优先

## 已知不做(SPEC §2.3 / §3.3 / Phase 6 §3.2)

- ❌ 完整 4v4 手动战斗界面
- ❌ 玩家逐个选择英雄、技能、敌人目标
- ❌ 完整技能栏、目标点击、行动顺序 UI
- ❌ 独立战斗页面
- ❌ 自由移动地图
- ❌ 最终地牢 / 最终 Boss / 多 Boss 连战
- ❌ 第四区域
- ❌ 大量新职业
- ❌ 角色关系系统
- ❌ 在线功能 / 云存档 / 排行榜
- ❌ 原版商业美术和音频

## 项目结构

```
src/
├── game-engine/
│   ├── rng/                          # Mulberry32 Seeded RNG
│   ├── battle/                        # 底层战斗引擎(自动结算内核)
│   ├── expedition/                    # 远征层(Phase 1 v2.0)
│   │   ├── types.ts                   # GameState / ExpeditionState / Route / Encounter / TacticalChoice
│   │   ├── commands.ts                # SPEC §28 命令
│   │   ├── domain-events.ts           # SPEC §30 事件
│   │   ├── context.ts                 # ExpeditionContext(emit / apply / commit)
│   │   ├── rule-engine.ts             # RuleCondition + RuleEffect
│   │   ├── choice-generator.ts        # SPEC §24
│   │   ├── choice-resolver.ts         # SPEC §29
│   │   ├── encounter-resolver.ts      # 自动跑 1 轮
│   │   ├── dispatcher.ts              # 唯一入口
│   │   ├── report.ts                  # 远征报告 + 失败链
│   │   └── invariants.ts              # assertGameInvariants
│   ├── mental/                        # 压力/意志/折磨/美德/死亡(Phase 2)
│   ├── progression/                   # 英雄成长 0-4 升级曲线(Phase 4)
│   ├── quirks/                        # 怪癖(Phase 4)
│   ├── diseases/                      # 疾病(Phase 4)
│   ├── trinkets/                      # 饰品(Phase 4)
│   ├── campaign/                      # 庄园周循环(Phase 3)
│   ├── camps/                         # 露营(Phase 4)
│   ├── regions/                       # 多区域(Phase 5)
│   │   ├── types.ts                   # RegionDefinition / RegionProgress / RegionDiscoveryState
│   │   ├── registry.ts                # 3 区域 / 18 敌人 / 12 奇物 / 9 陷阱 / 18 修正词 / 6 目标
│   │   ├── manager.ts                 # 路线生成 / 任务生成 / 经验升级
│   │   └── index.ts
│   ├── types.ts                        # 底层 BattleActor / SkillDefinition
│   └── ...
├── content/
│   ├── items.ts                        # 物品注册表
│   ├── route/ruins.ts                  # 默认遗迹路线
│   ├── events.ts                        # 事件定义(20+)
│   ├── encounters.ts                    # 遭遇定义
│   ├── heroes/lineup.ts                 # 4 英雄
│   ├── enemies/lineup.ts                # 4 敌人
│   ├── skills/                          # 4 职业技能
│   └── ...
├── app/App.tsx
├── components/
│   ├── expedition/                     # 远征 UI(12 组件)
│   ├── hamlet/                         # 庄园 UI(16 组件,Phase 3)
│   ├── camp/                           # 露营 UI(Phase 4)
│   ├── phase4/                         # Phase 4 通用 UI(12 组件)
│   └── region/                         # 区域 UI(14 组件,Phase 5)
├── persistence/save.ts                  # GameState v5 持久化(支持 v2→v5 链式迁移)
├── store/                                # Zustand
└── styles/global.css                    # 移动优先样式
tests/                                    # 27 单元 + 2 E2E 文件,共 484 测试
scripts/                                  # 模拟脚本(battle / expedition)
docs/                                     # 报告与开发文档(SPEC v2.0 + 6 份 Phase 报告)
```

## 设计原则

1. **业务规则与 UI 严格分离** — 规则层不引用 React,UI 层不直接修改 HP/压力
2. **所有随机可注入** — 不调用 `Math.random()`,所有逻辑走 seeded RNG
3. **所有变更走事件** — 状态变化都产生 `DomainEvent`,支持重放与报告生成
4. **不变量自动检查** — 每次状态提交后 `assertGameInvariants`,失败立即抛错
5. **数据驱动内容** — 英雄、技能、敌人、装备、区域、Boss 全部数据化,便于扩展
6. **选择由规则层生成** — UI 不生成战术,只读 generatedChoices 并派发 Command
7. **命令 → 事务 → 领域事件 → Reducer** — 状态变更原子提交,刷新不重抽

## 版权与原创

本项目仅作为设计灵感学习与原创实现,不使用原版《Darkest Dungeon》的商业美术、音频、文本资源。所有英雄、怪物、技能、Boss 名称均为占位,正式发布前需进行原创化(见开发文档 §27)。
