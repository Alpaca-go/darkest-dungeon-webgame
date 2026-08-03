# Darkest Dungeon Webgame

> 单页、节点推进、回合战斗、资源管理的哥特式网页 Roguelike(原型)
> 改编自《Darkest Dungeon》核心机制,采用《赛博徒步》式单页生存推进结构

## 状态

- **Phase 0 — 规则原型**:✅ 完成(详见 [`docs/PHASE_0_REPORT.md`](docs/PHASE_0_REPORT.md))
- **Phase 1 — 单页战斗垂直切片**:⏳ 待启动
- **Phase 2 — 压力与死亡**:⏳
- **Phase 3 — 节点远征**:⏳
- **Phase 4 — 露营与事件**:⏳
- **Phase 5 — 庄园与长期战役**:⏳
- **Phase 6 — Boss 与战役闭环**:⏳
- **Phase 7 — 视觉/音频/PWA**:⏳

详细开发文档见 [`docs/architecture-and-rules.md`](docs/architecture-and-rules.md)(基于《Darkest Dungeon 单页网页游戏架构与规则开发文档 v1.0》)。

## 快速开始

```bash
npm install              # 安装依赖
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run test             # 跑全部测试(44 个)
npm run simulate         # 跑 1000 场自动战斗
npm run typecheck        # 仅类型检查
```

## 当前能力(Phase 0)

- ✅ 4v4 站位战斗引擎
- ✅ 命中 / 暴击 / PROT / 流血 / 腐蚀 / 眩晕 / 位移 / 尸体
- ✅ Seeded RNG(同 seed 同结果)
- ✅ 命令 → 事务 → 域事件 → Reducer 模式
- ✅ 规则不变量自动检查
- ✅ 敌人 AI(评分选技能)
- ✅ 44 个单元/属性测试
- ✅ 1000 场自动战斗模拟
- ❌ 暂不包含:压力、折磨、美德、死亡之门、永久死亡、地牢路线、火把/食物/背包/奇物、庄园、Boss、视觉/音频

## 项目结构

```
src/
├── app/                  # React 入口(Phase 0 仅占位)
├── game-engine/          # 纯 TS 规则层(无 React 依赖)
│   ├── rng/              # Mulberry32 RNG
│   ├── types.ts          # 核心类型
│   ├── domain-events.ts  # 30 种域事件
│   ├── commands.ts       # GameCommand 类型
│   ├── invariants.ts     # 规则不变量
│   ├── command-dispatcher.ts
│   └── battle/           # 战斗引擎(context/round/skill/ai/loop)
├── content/              # 数据化内容
│   ├── skills/           # 4 职业 + 敌人技能库
│   ├── heroes/           # 默认阵型
│   ├── enemies/          # 敌人阵型
│   └── factories.ts      # createTestBattle
├── components/           # React 组件(Phase 1 填充)
├── store/                # Zustand 状态
├── persistence/          # 存档
└── styles/global.css

tests/                    # Vitest 单元/属性测试
scripts/simulate-battles.ts  # 1000 场自动战斗
sim-reports/              # 模拟报告
docs/                     # 报告与开发文档
```

## 设计原则

1. **业务规则与 UI 严格分离** — 规则层不引用 React,UI 层不直接修改 HP/压力
2. **所有随机可注入** — 不调用 `Math.random()`,所有逻辑走 seeded RNG
3. **所有变更走事件** — 状态变化都产生 `DomainEvent`,支持重放与报告生成
4. **不变量自动检查** — 每次状态提交后 `assertInvariants`,失败立即抛错
5. **数据驱动内容** — 英雄、技能、敌人、装备全部数据化,便于扩展

## 版权与原创

本项目仅作为设计灵感学习与原创实现,不使用原版《Darkest Dungeon》的商业美术、音频、文本资源。所有英雄、怪物、技能名称均为占位,正式发布前需进行原创化(见开发文档 §27)。
