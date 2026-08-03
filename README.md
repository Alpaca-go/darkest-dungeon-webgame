# Darkest Dungeon Webgame

> 单页、节点推进、选择式遭遇的哥特式网页 Roguelike(原型)
> 改编自《Darkest Dungeon》核心机制,采用《赛博徒步》式单页生存推进结构
>
> **当前阶段:Phase 1 v2.0 — 节点远征与选择式遭遇垂直切片**

## 状态

- **Phase 0 — 规则原型**:✅ 完成(详见 [`docs/PHASE_0_REPORT.md`](docs/PHASE_0_REPORT.md))
- **Phase 1 v2.0 — 节点远征与选择式遭遇**:✅ 完成(详见 [`docs/PHASE_1_REPORT.md`](docs/PHASE_1_REPORT.md))
- Phase 2 — 压力与死亡:⏳
- Phase 3 — 节点远征(完整):⏳
- Phase 4 — 露营与事件:⏳
- Phase 5 — 庄园与长期战役:⏳
- Phase 6 — Boss 与战役闭环:⏳
- Phase 7 — 视觉/音频/PWA:⏳

详细开发文档见 [`docs/architecture-and-rules.md`](docs/architecture-and-rules.md)(v1.0)与 Phase 1 v2.0 开发文档。

## 核心方向(Phase 1 v2.0)

- **地牢远征是主玩法**
- 战斗是远征中的一种遭遇(选择式)
- 四名英雄、站位、技能、敌人编队和状态继续存在于规则层
- 系统根据这些规则动态生成 2-4 个战术选项
- 玩家选一个,引擎自动结算一轮
- 手机端 390×844 优先

## 快速开始

```bash
npm install              # 安装依赖
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run preview          # 预览生产版本
npm run test             # 跑全部 109 个单元测试
npm run test:e2e         # 跑 14 个 E2E 流程
npm run typecheck        # 仅类型检查
npm run lint             # ESLint
```

## 当前能力(Phase 1 v2.0)

- ✅ 单页远征(9 节点、2 分叉、固定 Seed 可复现)
- ✅ 火把 / 食物 / 时间 / 背包(16 槽)
- ✅ 路线、节点、侦察(4 等级)
- ✅ 行进方式(正常 / 谨慎 / 快速)
- ✅ 3 陷阱 + 2 路障 + 3 奇物 + 2 饥饿变体
- ✅ 2 场选择式遭遇(骸骨巡逻队 / 墓室伏击)
- ✅ 4 标准战术 + 3 条件性战术(assault / backline / control / stabilize / reform / use-item / retreat)
- ✅ 自动战斗结算(走底层 BattleContext)
- ✅ 撤退 + 任务目标 + 出口
- ✅ 远征报告 + 失败链
- ✅ 调试面板(固定 seed / 跳节点 / 改资源 / 改 HP / 改站位 / 触发事件 / 导出)
- ✅ 109 单元测试 + 14 E2E + Golden Expedition
- ✅ 移动端 390×844 优先

## 已知不做(SPEC §2.3 / §3.3)

- ❌ 完整 4v4 手动战斗界面
- ❌ 玩家逐个选择英雄、技能、敌人目标
- ❌ 完整技能栏、目标点击、行动顺序 UI
- ❌ 独立战斗页面
- ❌ 正式压力 / 折磨 / 美德
- ❌ 死亡之门 / 永久死亡
- ❌ 完整庄园 / 周循环
- ❌ Boss
- ❌ 多区域
- ❌ 后端和云存档

## 项目结构

```
src/
├── game-engine/
│   ├── rng/                          # Mulberry32 Seeded RNG
│   ├── battle/                        # 底层战斗引擎(自动结算内核)
│   ├── expedition/                    # 远征层(Phase 1 v2.0 新增)
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
├── components/expedition/               # 移动优先 UI 组件
│   ├── ExpeditionPage.tsx
│   ├── ExpeditionTopBar.tsx
│   ├── ScenePanel.tsx
│   ├── PartyStatusStrip.tsx
│   ├── SituationPanel.tsx
│   ├── ChoicePanel.tsx
│   ├── ChoiceCard.tsx
│   ├── ResolutionPanel.tsx
│   ├── InventoryDrawer.tsx
│   ├── HeroDetailDrawer.tsx
│   ├── ExpeditionLogDrawer.tsx
│   ├── RoutePreviewDrawer.tsx
│   ├── ExpeditionResultModal.tsx
│   └── DebugPanel.tsx
├── persistence/save.ts                  # GameState v2 持久化
├── store/                                # Zustand
└── styles/global.css                    # 移动优先样式
tests/                                    # 109 单元 + 14 E2E
scripts/                                  # 模拟脚本
docs/                                     # 报告与开发文档
```

## 设计原则

1. **业务规则与 UI 严格分离** — 规则层不引用 React,UI 层不直接修改 HP/压力
2. **所有随机可注入** — 不调用 `Math.random()`,所有逻辑走 seeded RNG
3. **所有变更走事件** — 状态变化都产生 `DomainEvent`,支持重放与报告生成
4. **不变量自动检查** — 每次状态提交后 `assertGameInvariants`,失败立即抛错
5. **数据驱动内容** — 英雄、技能、敌人、装备全部数据化,便于扩展
6. **选择由规则层生成** — UI 不生成战术,只读 generatedChoices 并派发 Command

## 版权与原创

本项目仅作为设计灵感学习与原创实现,不使用原版《Darkest Dungeon》的商业美术、音频、文本资源。所有英雄、怪物、技能名称均为占位,正式发布前需进行原创化(见开发文档 §27)。
