# Darkest Dungeon 单页网页游戏改编
## 游戏架构设计与游戏规则开发文档 v1.0

> 项目性质：基于《Darkest Dungeon》电子游戏核心体验，采用《赛博徒步之生死鳌太线》式单页生存推进结构的网页端原型  
> 文档用途：产品定义、系统架构、规则设计、MVP 开发、Codex 执行依据  
> 平台：桌面浏览器优先，兼容移动端，支持 PWA 与本地存档  
> 核心命题：**把“自由走格子的地牢探索”压缩成节点式生存远征，但保留暗黑地牢最不可替代的压力、站位、永久死亡与长期经营。**

---

# 0. 项目结论

本项目不应制作成《Darkest Dungeon》电子游戏的浏览器复刻版，也不应沿用桌游规则。

正确方向是：

```text
《赛博徒步》的单页状态驱动体验
+
《Darkest Dungeon》的四人站位战斗
+
压力 / 折磨 / 美德 / 死亡之门
+
补给、火把、饥饿与撤退决策
+
英雄永久死亡与庄园长期经营
```

最终产品是一款：

> **单页、节点推进、回合战斗、资源管理、失败可复盘、可长期经营的哥特式网页 Roguelike。**

玩家大部分时间不直接操纵角色在地图中移动，而是面对一个持续变化的远征界面，通过“继续前进、侦察、调查、扎营、使用补给、撤退”等行动推进游戏。

战斗发生时，当前场景无缝切换为四对四站位战斗，不进入第二套独立页面。

---

# 1. 设计目标

## 1.1 必须保留的《Darkest Dungeon》身份

以下系统属于不可删除的核心身份：

1. 四人队伍与 1—4 号站位；
2. 技能受到自身站位和目标站位限制；
3. 生命值与压力值并存；
4. 100 压力触发意志检定；
5. 折磨会使英雄不再完全服从玩家；
6. 0 HP 进入死亡之门，而不是立即死亡；
7. 死亡之门上的后续伤害可能触发致死打击；
8. 英雄永久死亡；
9. 怪癖、疾病、饰品与职业差异；
10. 火把、食物和露营形成远征消耗；
11. 可以撤退，但撤退要付出代价；
12. 庄园负责招募、治疗、升级与下一周准备；
13. 失败原因可以从此前决策中追溯；
14. 高风险、高损耗、不可完美控制。

## 1.2 从《赛博徒步》继承的产品结构

继承的是交互形式和信息组织方式，不复制其题材：

1. 单页主界面；
2. 全屏场景背景；
3. 顶部固定关键状态；
4. 路线节点依次推进；
5. 状态变化实时反馈；
6. 事件以底部卡片出现；
7. 事件由环境条件与当前状态共同触发；
8. 玩家每次只面对少量明确选择；
9. 失败后生成完整复盘；
10. 适合手机浏览器和 PWA；
11. 无需复杂角色行走动画；
12. 内容和规则深度高于美术制作成本。

《赛博徒步》公开说明强调真实路线节点、动态环境、资源管理和条件随机事件。本项目将同一结构改写为“地牢节点、火把环境、补给消耗、英雄精神状态与遭遇事件”。

## 1.3 明确不做

MVP 不做：

- 原版全部英雄、地图、怪物和 DLC；
- 地牢房间自由走格子；
- 角色实时移动；
- 复杂路径寻路；
- 多人联机；
- PvP；
- 后端账号；
- 云存档；
- 商城；
- 抽卡；
- 3D 场景；
- 复杂骨骼动画；
- 原版全部城镇设施；
- MOD 编辑器；
- 直接使用原版商业美术、音乐、旁白和字体资源。

---

# 2. 产品定位

## 2.1 游戏时长

推荐三层时长：

| 层级 | 时长 | 内容 |
|---|---:|---|
| 单次遭遇 | 1—4 分钟 | 事件、房间或战斗 |
| 单次远征 | 20—40 分钟 | 8—16 个节点 |
| 完整战役 | 8—15 小时 | 多周经营、区域推进、Boss 与最终地牢 |

支持任意节点自动存档并退出。

## 2.2 目标玩家

- 喜欢《Darkest Dungeon》的系统与氛围，但不想操作复杂地图；
- 喜欢资源管理、风险判断和失败复盘；
- 接受英雄死亡和不可逆损失；
- 希望在手机或浏览器中进行短时游玩；
- 喜欢文字事件、数值策略和阵容构筑。

## 2.3 核心体验句

> 你不是在控制四个完美战士，而是在带领四个会恐惧、会患病、会违抗命令、也可能在绝境中挺身而出的普通人，尽可能深入黑暗并活着回来。

---

# 3. 核心循环

## 3.1 长期战役循环

```text
新的一周
→ 查看庄园事件
→ 招募与整理英雄
→ 治疗压力、疾病和怪癖
→ 升级技能与装备
→ 选择区域和任务
→ 组建四人队伍
→ 购买补给
→ 开始远征
→ 节点推进 / 事件 / 战斗 / 露营
→ 完成任务或撤退或团灭
→ 结算战利品、经验、死亡和创伤
→ 庄园进入下一周
```

## 3.2 单次远征循环

```text
查看下一个节点线索
→ 选择前进方式
→ 消耗火把、时间与食物
→ 结算环境压力
→ 触发房间 / 战斗 / 奇物 / 陷阱 / 饥饿 / 剧情
→ 处理英雄状态
→ 判断继续、扎营或撤退
→ 推进至目标节点
```

## 3.3 单次战斗循环

```text
进入战斗并确定双方站位
→ 生成本轮行动顺序
→ 当前单位行动
→ 选择技能
→ 校验施法站位与目标站位
→ 命中、伤害、暴击和状态结算
→ 压力 / 死亡之门 / 折磨行为插入
→ 下一单位
→ 一方全灭或成功撤退
```

---

# 4. 单页游戏模式

## 4.1 主界面结构

桌面版建议采用以下结构：

```text
┌─────────────────────────────────────────────────────────────┐
│ 周数 / 区域 / 任务 / 节点进度 / 火把 / 金币 / 设置          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                 当前场景主视觉区域                          │
│         地牢背景、敌人、环境特效、叙事字幕                  │
│                                                             │
├──────────────┬──────────────────────────────┬───────────────┤
│ 四名英雄状态 │ 当前事件、战斗技能或行动卡   │ 背包与路线预览 │
│ HP / 压力    │ 继续 / 调查 / 使用 / 扎营    │ 补给 / 战利品  │
└──────────────┴──────────────────────────────┴───────────────┘
```

移动版按顺序折叠：

```text
顶部状态
→ 场景
→ 当前行动卡
→ 四名英雄横向卡片
→ 背包 / 路线抽屉
```

## 4.2 页面模式

整个项目只需要一个主路由，内部通过状态切换：

```ts
type GameViewMode =
  | 'title'
  | 'hamlet'
  | 'provisioning'
  | 'expedition'
  | 'battle'
  | 'camp'
  | 'result'
  | 'campaign-ending';
```

禁止为每种事件建立独立业务页面。

## 4.3 顶部状态栏

远征中固定显示：

- 区域；
- 任务目标；
- 当前节点 / 总节点；
- 火把亮度；
- 队伍平均压力；
- 背包已用槽位；
- 露营次数；
- 当前存档状态。

## 4.4 英雄状态卡

每名英雄卡显示：

- 头像与职业；
- 当前站位；
- HP / 最大 HP；
- 压力 0—200；
- Death’s Door；
- 流血 / 腐蚀 / 眩晕 / 标记；
- 当前折磨或美德；
- 两件饰品；
- 关键怪癖；
- 可展开技能详情。

英雄在折磨状态下拒绝治疗、擅自行动、辱骂队友或改变站位时，卡片直接产生抖动、遮罩、红色文本和语音字幕反馈。

## 4.5 当前行动卡

非战斗时只显示 2—5 个动作：

- 继续前进；
- 谨慎前进；
- 快速推进；
- 侦察；
- 调查奇物；
- 使用指定补给；
- 扎营；
- 重整队形；
- 撤退。

战斗时替换为：

- 当前英雄的 4 个已装备技能；
- 合法目标高亮；
- 移动；
- 跳过；
- 撤退。

---

# 5. 网页化后的地牢规则

## 5.1 节点路线

一场远征由有向节点图组成，不采用房间自由移动。

```ts
interface ExpeditionRoute {
  id: string;
  regionId: string;
  length: 'short' | 'medium' | 'long';
  nodes: RouteNode[];
  edges: RouteEdge[];
  objectiveNodeId: string;
  extractionNodeIds: string[];
}
```

节点类型：

```ts
type RouteNodeType =
  | 'corridor'
  | 'battle'
  | 'curio'
  | 'trap'
  | 'hunger'
  | 'treasure'
  | 'camp'
  | 'story'
  | 'elite'
  | 'boss'
  | 'objective'
  | 'exit';
```

## 5.2 路线可见度

节点分为三种信息状态：

- `unknown`：完全未知；
- `hinted`：显示危险类型，不显示具体内容；
- `scouted`：显示节点类型、敌人规模或奇物类别。

侦察来源：

- 英雄怪癖；
- 职业被动；
- 火把亮度；
- 侦察行动；
- 特殊事件；
- 饰品。

## 5.3 前进方式

### 正常前进

- 时间 +1；
- 火把 -6；
- 标准事件权重；
- 无额外修正。

### 谨慎前进

- 时间 +2；
- 火把 -9；
- 陷阱发现率提高；
- 被伏击概率降低；
- 全队小概率获得 1 压力。

### 快速推进

- 时间 +1；
- 火把 -4；
- 饥饿检查延后；
- 陷阱与伏击概率提高；
- 低压力英雄可能获得短暂速度增益；
- 高压力英雄可能额外获得压力。

## 5.4 时间

“时间”不是现实倒计时，而是远征内部的压力计量单位。

时间影响：

- 饥饿检查；
- 火把消耗；
- 某些事件出现；
- 敌人增援；
- 长任务中的疲劳；
- 任务评级。

每推进一个标准节点增加 1 时间。

## 5.5 火把

火把范围：`0—100`。

建议分段：

| 火把 | 状态 | 主要效果 |
|---:|---|---|
| 76—100 | 光耀 | 侦察、命中与抗压更稳定，战利品较少 |
| 51—75 | 明亮 | 标准规则 |
| 26—50 | 昏暗 | 敌人伤害和压力事件略增，战利品增加 |
| 1—25 | 黑暗 | 伏击、压力和敌方暴击显著增加，战利品高 |
| 0 | 漆黑 | 极高风险、特殊事件池、最大收益倍率 |

节点基础火把消耗建议为 6。

使用火把道具：

```text
火把 +25
不超过 100
```

部分环境、怪癖和事件可改变实际恢复量。

## 5.6 食物与饥饿

食物既是远征资源，也是露营资源。

饥饿检查通过条件事件触发：

```text
基础检查间隔：3—5 时间
连续快速推进可延后一次
长任务后半段权重上升
部分怪癖与疾病提高触发率
```

饥饿事件选项：

### 进食

每名存活英雄消耗 1 食物：

- 不受伤；
- 少量恢复 HP；
- 部分英雄降低压力。

### 忍饥

食物不足或主动拒绝：

- 每名英雄失去最大 HP 的 10%；
- 每名英雄获得 8—15 压力；
- 可能触发队伍争执事件。

## 5.7 背包

不使用真实重量，使用原作风格的槽位制。

默认：

```text
16 个背包槽
同类补给可堆叠
战利品与补给竞争槽位
任务物品占用固定槽位
```

关键决策：

- 丢弃火把换取金币；
- 丢弃食物换取饰品；
- 保留钥匙应对后续宝箱；
- 保留铲子规避路障；
- 为任务物品预留空间。

## 5.8 补给

MVP 补给：

| 补给 | 主要用途 |
|---|---|
| 食物 | 饥饿、露营、少量治疗 |
| 火把 | 提高光照 |
| 铲子 | 清除路障、部分奇物 |
| 万能钥匙 | 宝箱、密门 |
| 圣水 | 净化奇物、提高抗性 |
| 绷带 | 清除流血 |
| 解毒剂 | 清除腐蚀 |
| 药草 | 清除减益、处理污染奇物 |
| 火木 | 中长任务露营 |

## 5.9 路障

遇到路障：

- 使用铲子：安全通过；
- 徒手清理：时间 +2、火把 -12、全队获得压力，并可能受伤；
- 绕路：仅部分节点允许，增加额外节点。

## 5.10 奇物

奇物由“奇物定义 + 交互道具 + 随机结果”组成。

```ts
interface CurioDefinition {
  id: string;
  name: string;
  regionIds: string[];
  interactions: CurioInteraction[];
  defaultOutcomes: WeightedOutcome[];
}
```

玩家可：

- 直接触碰；
- 使用特定补给；
- 放弃；
- 某些强迫症怪癖会迫使英雄擅自互动。

## 5.11 扎营

仅中型和长型任务默认拥有火木。

进入露营：

1. 选择进食量；
2. 恢复 HP；
3. 获得露营点数；
4. 使用英雄露营技能；
5. 结算夜间伏击；
6. 返回路线。

建议：

```text
基础露营点数：12
露营技能消耗：1—5
同一技能存在每次露营次数限制
```

露营技能类别：

- 治疗；
- 降低压力；
- 防止夜袭；
- 提高侦察；
- 下一场战斗增益；
- 清除疾病或减益；
- 队友关系事件。

## 5.12 撤退

玩家可在非强制 Boss 节点撤退。

撤退结果：

- 已获得战利品按比例保留；
- 任务失败；
- 全队获得压力；
- 部分英雄获得负面怪癖；
- 周数推进；
- 死亡英雄不会复活；
- Boss 任务撤退可能提高区域威胁。

战斗中撤退需要检定；失败后敌方获得一次额外行动机会。

---

# 6. 英雄系统

## 6.1 英雄实例

职业定义与英雄实例必须分离。

```ts
interface HeroDefinition {
  id: string;
  name: string;
  baseStatsByResolveLevel: HeroStats[];
  skillIds: string[];
  campingSkillIds: string[];
  allowedRanks: number[];
  tags: string[];
}

interface HeroInstance {
  id: string;
  definitionId: string;
  generatedName: string;
  resolveLevel: number;
  xp: number;
  hp: number;
  stress: number;
  equippedSkillIds: string[];
  equippedTrinketIds: string[];
  positiveQuirkIds: string[];
  negativeQuirkIds: string[];
  diseaseIds: string[];
  afflictionId: string | null;
  virtueId: string | null;
  deathState: HeroDeathState;
  activityState: HeroActivityState;
}
```

## 6.2 基础属性

```ts
interface HeroStats {
  maxHp: number;
  dodge: number;
  protection: number;
  speed: number;
  accuracy: number;
  crit: number;
  bleedResist: number;
  blightResist: number;
  stunResist: number;
  moveResist: number;
  debuffResist: number;
  diseaseResist: number;
  deathblowResist: number;
}
```

## 6.3 站位

双方均有 1—4 号位：

```text
己方：4  3  2  1 | 1  2  3  4：敌方
                 前线
```

规则：

- 1 号位最前；
- 4 号位最后；
- 技能定义自身合法站位；
- 技能定义目标合法站位；
- 推、拉和位移会改变站位；
- 单位死亡后自动向前补位；
- 部分技能同时造成伤害和位移；
- 队伍混乱是重要风险，不应自动恢复理想阵型。

## 6.4 技能

```ts
interface SkillDefinition {
  id: string;
  heroClassId?: string;
  name: string;
  usableFromRanks: number[];
  targetRanks: number[];
  targetSide: 'ally' | 'enemy' | 'self';
  targetMode: 'single' | 'all' | 'adjacent' | 'random';
  accuracy: number;
  damageModifier: number;
  critModifier: number;
  moveSelf?: number;
  moveTarget?: number;
  effects: SkillEffectDefinition[];
}
```

每名英雄在远征前装备 4 个战斗技能。

远征中默认不能随意更换；扎营或特定安全节点允许调整一次。

## 6.5 MVP 首发职业

建议只做四个职业，形成完整战术闭环：

### 十字军

- 前排；
- 稳定伤害；
- 眩晕；
- 少量治疗；
- 少量压力治疗；
- 可从后排前冲。

### 强盗

- 中前排；
- 高伤害；
- 反击；
- 前后位移；
- 擅长处决后排。

### 修女

- 后排；
- 单体和群体治疗；
- 眩晕；
- 对邪秽敌人增伤；
- 输出较低。

### 瘟疫医生

- 后排；
- 腐蚀；
- 双目标眩晕；
- 清除流血和腐蚀；
- 低直接伤害。

后续加入职业时，不得先追求数量，应优先增加新的站位关系和队伍构筑可能。

---

# 7. 战斗规则

## 7.1 战斗开始

1. 读取当前英雄站位；
2. 根据节点生成敌方编队；
3. 判断伏击；
4. 应用房间效果；
5. 建立第一轮行动顺序；
6. 进入 `round-start`。

## 7.2 行动顺序

建议采用可复现的速度随机：

```text
initiative = speed + randomInteger(1, 8)
```

按结果从高到低行动。

平局时：

1. Boss 优先级；
2. 当前单位稳定 ID；
3. RNG 次级值。

每轮重新计算。

## 7.3 命中

建议公式：

```text
命中率 = 技能基础命中 + 攻击者命中修正 - 目标闪避
最终限制在 5%—95%
```

命中后才处理：

- 伤害；
- 暴击；
- 流血；
- 腐蚀；
- 眩晕；
- 标记；
- 位移；
- 减益。

## 7.4 伤害

```text
基础伤害 = 在技能伤害区间内随机
技能伤害 = 基础伤害 × (1 + 技能修正 + Buff - Debuff)
承受伤害 = 技能伤害 × (1 - 目标 PROT)
最终伤害向下取整，最低为 0
```

暴击建议：

- 直接使用伤害区间最大值；
- 应用暴击倍率；
- 攻击者小幅减压；
- 目标获得额外压力；
- 流血或腐蚀持续时间增加 1。

## 7.5 流血与腐蚀

每个状态包含：

```ts
interface DamageOverTime {
  type: 'bleed' | 'blight';
  damagePerTurn: number;
  remainingTurns: number;
  sourceId: string;
}
```

结算时机统一为单位回合开始。

抵抗成功则不施加。

## 7.6 眩晕

- 眩晕单位跳过下一次行动；
- 眩晕结束后获得短暂眩晕抗性；
- 连续控制必须存在递减收益；
- Boss 可有额外抗性，不应完全免疫所有控制。

## 7.7 标记

标记本身不造成伤害。

其他技能可：

- 对标记目标增伤；
- 提高暴击；
- 忽略保护；
- 改变敌方 AI 目标权重。

## 7.8 守护

守护者替被守护者承受合法单体攻击。

不转移：

- 全体攻击；
- 地面效果；
- 自伤；
- 心脏病；
- 非目标型环境伤害。

## 7.9 尸体

为了保留原作站位压力，但降低 MVP 复杂度，建议分两阶段：

### MVP

普通敌人死亡后留下 1 个尸体单位：

- 占据原宽度；
- 低 HP；
- 无行动；
- 可被攻击清除；
- 全体敌人死亡时自动清除。

### 后续

加入：

- 尸体腐烂；
- 食尸技能；
- 召唤；
- 特殊尸体；
- 无尸体死亡标签。

## 7.10 敌方 AI

敌人技能通过评分选择，不允许 UI 组件自行决定。

```text
合法技能过滤
→ 合法目标过滤
→ 根据 AI 标签评分
→ 加入少量随机扰动
→ 选择最高分
```

评分因素：

- 能否造成击杀；
- 目标是否在死亡之门；
- 目标压力是否接近 100 或 200；
- 标记；
- 抗性；
- 当前站位；
- 是否需要恢复阵型；
- 技能冷却；
- AI 性格标签。

## 7.11 战斗结束

胜利：

- 清除临时状态；
- 生成战利品；
- 结算战斗压力；
- 恢复到路线节点；
- 允许整理背包；
- 继续远征。

失败：

- 全员永久死亡；
- 远征结束；
- 失去未带回的战利品；
- 进入庄园；
- 若无可用英雄且无法招募，战役失败。

---

# 8. 压力、折磨与美德

## 8.1 压力范围

```text
0—200
```

压力来源：

- 黑暗；
- 敌方压力技能；
- 暴击；
- 队友进入死亡之门；
- 队友死亡；
- 饥饿；
- 徒手清理路障；
- 陷阱；
- 撤退；
- 折磨英雄发言；
- 特定怪癖和疾病；
- 任务失败。

## 8.2 100 压力意志检定

英雄首次达到 100 压力：

```text
进行 Resolve Check
→ 美德 或 折磨
```

MVP 建议基础概率：

```text
美德 25%
折磨 75%
```

概率可被饰品、怪癖、职业和事件修正。

## 8.3 折磨

MVP 首发四种：

- 偏执；
- 恐惧；
- 自虐；
- 非理性。

折磨行为通过“行动前、受击后、队友行动后、房间进入时”触发。

可能行为：

- 拒绝治疗；
- 拒绝增益；
- 擅自攻击；
- 擅自移动；
- 跳过行动；
- 给队友增加压力；
- 强迫触碰奇物；
- 拒绝扎营技能；
- 抢占战利品槽位；
- 阻止撤退。

重要原则：

> 折磨不能只是数值 Debuff，必须降低玩家对英雄的控制权。

## 8.4 美德

MVP 首发三种：

- 坚定；
- 勇猛；
- 专注。

效果：

- 属性提升；
- 行动时鼓舞队友；
- 降低压力；
- 抵抗部分折磨行为；
- 不拒绝玩家命令。

美德不能让英雄完全免疫 200 压力风险。

## 8.5 200 压力与心脏病

达到 200 压力：

- 若当前 HP > 0：HP 降至 0，进入死亡之门；
- 若已在死亡之门：立即死亡；
- 压力降低到高危值；
- 对全队造成压力冲击；
- 触发事件日志和旁白。

## 8.6 远征结束

返回庄园后：

- 折磨和美德状态清除；
- 压力保留；
- 怪癖和疾病保留；
- 需要使用酒馆、修道院或特殊事件减压。

---

# 9. 死亡之门与永久死亡

## 9.1 进入死亡之门

英雄 HP 降至 0：

```text
HP 固定为 0
atDeathsDoor = true
获得即时压力
触发队友压力
```

## 9.2 死亡之门上的治疗

任何有效治疗：

```text
HP > 0
→ 离开死亡之门
→ 获得 Death’s Door Recovery Debuff
```

恢复减益持续至战斗结束或任务结束，具体由平衡决定。

## 9.3 致死打击

死亡之门上的英雄再次受到大于 0 的伤害：

```text
进行 Deathblow Resist 检定
成功：存活在 0 HP
失败：永久死亡
```

默认职业可使用 67% 作为 MVP 初始值，最终应由职业数据决定。

连续抵抗可叠加临时惩罚，防止无限赖在死亡之门。

## 9.4 永久死亡

死亡后：

- 从当前队伍移除；
- 记录墓园；
- 装备进入可拾取状态；
- 队友获得大量压力；
- 本次远征无法补员；
- 存档立即写入；
- 刷新页面不能撤销死亡。

---

# 10. 怪癖、疾病与饰品

## 10.1 怪癖

每名英雄建议：

```text
最多 5 个正面怪癖
最多 5 个负面怪癖
```

MVP 可先限制为各 3 个。

怪癖可影响：

- 区域伤害；
- 敌人类型伤害；
- 火把区间；
- 压力；
- 命中；
- 闪避；
- 奇物强迫行为；
- 庄园设施限制；
- 补给消耗；
- 侦察；
- 疾病抗性。

## 10.2 疾病

疾病以持续被动效果存在。

来源：

- 敌方技能；
- 奇物；
- 饥饿；
- 腐败环境；
- 任务结算。

可在疗养院治疗，治疗需要一周且占用英雄。

## 10.3 饰品

每名英雄装备两件。

饰品必须有明显取舍：

```text
+15% 伤害
-10% 最大 HP
```

比“纯粹全面变强”更符合项目设计。

---

# 11. 庄园规则

## 11.1 周循环

每次远征结束，周数 +1。

进入新周时：

1. 结算治疗中的英雄；
2. 刷新马车招募；
3. 生成城镇事件；
4. 刷新商店；
5. 更新区域进度；
6. 处理 Boss 威胁；
7. 玩家开始准备下一次远征。

## 11.2 MVP 设施

### 马车

- 招募新英雄；
- 英雄带有随机怪癖；
- 招募免费或低成本；
- 名额受升级限制。

### 公会

- 升级战斗技能；
- 解锁技能；
- 消耗金币。

### 铁匠铺

- 升级武器与护甲；
- 提高基础伤害和生命；
- 消耗金币。

### 酒馆

- 降低压力；
- 英雄占用一周；
- 部分怪癖限制可用项目；
- 存在副作用事件。

### 修道院

- 降低压力；
- 更稳定但费用不同；
- 部分职业或怪癖限制项目。

### 疗养院

- 治疗疾病；
- 移除负面怪癖；
- 锁定正面怪癖；
- 占用一周。

### 商店

- 远征补给；
- 可升级价格或初始库存。

## 11.3 英雄状态

```ts
type HeroActivityState =
  | 'available'
  | 'in-party'
  | 'stress-treatment'
  | 'disease-treatment'
  | 'quirk-treatment'
  | 'missing'
  | 'dead';
```

处于设施中的英雄不能参加当周远征。

---

# 12. 任务与区域

## 12.1 MVP 区域

只开发“遗迹”一张区域。

区域特征：

- 骷髅与邪教敌人；
- 流血抗性较高；
- 腐蚀相对有效；
- 圣水和钥匙价值高；
- 压力型后排敌人；
- 路障和书架类奇物。

## 12.2 任务类型

### 清理

完成一定比例战斗节点。

### 探索

抵达并揭示指定比例节点。

### 激活

找到并处理多个任务奇物。

### Boss

路线终点固定为 Boss，无法从战斗中安全撤退。

## 12.3 任务长度

| 长度 | 节点 | 露营 | 推荐时间 |
|---|---:|---:|---:|
| 短 | 8—10 | 0 | 15—25 分钟 |
| 中 | 12—14 | 1 | 25—40 分钟 |
| 长 | 16—20 | 2 | 40—60 分钟 |

MVP 可先只做短任务。

---

# 13. 条件事件引擎

## 13.1 事件不是纯随机弹窗

事件候选必须由当前上下文过滤：

```text
区域
+ 节点类型
+ 火把
+ 时间
+ 食物
+ 队伍 HP
+ 队伍压力
+ 英雄职业
+ 怪癖
+ 疾病
+ 已发生事件
+ 任务阶段
```

## 13.2 数据结构

```ts
interface GameEventDefinition {
  id: string;
  category: string;
  trigger: EventTrigger;
  conditions: RuleCondition[];
  weight: number;
  oncePerExpedition?: boolean;
  oncePerCampaign?: boolean;
  choices: EventChoiceDefinition[];
}

interface EventChoiceDefinition {
  id: string;
  label: string;
  requirements?: RuleCondition[];
  costs?: RuleEffect[];
  outcomes: WeightedEventOutcome[];
}
```

## 13.3 事件示例

```json
{
  "id": "ruins-whispers-in-dark",
  "category": "travel",
  "trigger": "after-node-travel",
  "conditions": [
    { "type": "torch-below", "value": 26 },
    { "type": "average-stress-above", "value": 45 }
  ],
  "weight": 12,
  "oncePerExpedition": true,
  "choices": [
    {
      "id": "press-on",
      "label": "无视低语，继续前进",
      "outcomes": [
        {
          "weight": 70,
          "effects": [
            { "type": "party-stress", "min": 3, "max": 7 }
          ]
        },
        {
          "weight": 30,
          "effects": [
            { "type": "grant-scout", "nodes": 1 }
          ]
        }
      ]
    },
    {
      "id": "light-torch",
      "label": "点燃一支火把",
      "requirements": [
        { "type": "inventory-has", "itemId": "torch", "count": 1 }
      ],
      "costs": [
        { "type": "consume-item", "itemId": "torch", "count": 1 }
      ],
      "outcomes": [
        {
          "weight": 100,
          "effects": [
            { "type": "torch-change", "value": 25 },
            { "type": "party-stress", "value": -3 }
          ]
        }
      ]
    }
  ]
}
```

## 13.4 事件防重复

必须保存：

- 已触发事件 ID；
- 一次性选择；
- 当前远征事件冷却；
- 当前战役永久事件；
- 根事务 ID。

刷新页面不得重新抽取结果。

---

# 14. 失败复盘系统

这是《赛博徒步》式结构中最值得继承的部分。

每次远征结束生成“远征报告”。

## 14.1 报告内容

- 任务结果；
- 最深节点；
- 使用时间；
- 最低火把；
- 触发战斗数；
- 击杀敌人数；
- 最高英雄压力；
- 死亡英雄；
- 心脏病次数；
- 死亡之门次数；
- 致死打击抵抗次数；
- 使用补给；
- 丢弃战利品；
- 撤退原因；
- 关键决策时间线；
- 主要失败链；
- 获得金币、遗产与经验。

## 14.2 失败链生成

系统根据事件日志自动归纳：

```text
火把储备不足
→ 中段进入黑暗
→ 敌方暴击率与压力增加
→ 修女受到折磨
→ 两次拒绝治疗
→ 十字军进入死亡之门
→ 队友死亡压力触发心脏病
→ 队伍崩溃
```

报告不应只写“战斗失败”。

## 14.3 可分享结果卡

生成独立结果卡：

- 队伍头像；
- 任务；
- 最深节点；
- 死亡人数；
- 最黑暗时刻；
- 一句旁白式总结；
- 随机种子；
- 战绩编号。

---

# 15. 技术架构

## 15.1 推荐技术栈

```text
Vite
React
TypeScript
Zustand
Zod
Vitest
Playwright
IndexedDB（Dexie 可选）
Howler.js 或 Web Audio API
CSS Modules / Tailwind 二选一
```

不建议：

- Unity WebGL；
- 大型后端；
- ECS；
- Three.js；
- 复杂 Canvas 战斗；
- 将规则写在 React 组件中。

## 15.2 分层

```text
Presentation
↓
Application Commands
↓
Game Engine
↓
Domain State
↓
Content Definitions
↓
Persistence / RNG / Audio Adapters
```

### Presentation

只负责：

- 显示；
- 动画；
- 输入；
- 高亮；
- 音效调用；
- 无障碍信息。

不得直接修改 HP、压力、背包或任务状态。

### Application

把用户操作转换为命令：

```ts
type GameCommand =
  | { type: 'START_CAMPAIGN' }
  | { type: 'SELECT_QUEST'; questId: string }
  | { type: 'FORM_PARTY'; heroIds: string[] }
  | { type: 'BUY_PROVISION'; itemId: string; count: number }
  | { type: 'ADVANCE_ROUTE'; edgeId: string; pace: TravelPace }
  | { type: 'CHOOSE_EVENT_OPTION'; eventId: string; choiceId: string }
  | { type: 'USE_SKILL'; actorId: string; skillId: string; targetIds: string[] }
  | { type: 'USE_ITEM'; itemId: string; targetId?: string }
  | { type: 'CAMP' }
  | { type: 'RETREAT' };
```

### Game Engine

统一入口：

```ts
dispatchGameCommand(state, command, context)
  -> validate
  -> resolve
  -> emit domain events
  -> reduce state
  -> assert invariants
  -> append log
  -> autosave
```

### Content Definitions

英雄、技能、敌人、事件、任务、奇物、饰品全部数据化。

### Persistence

保存：

- 当前快照；
- 事件日志；
- RNG 状态；
- 内容版本；
- 存档版本；
- 当前事务 ID。

## 15.3 根状态

```ts
interface GameState {
  version: number;
  campaign: CampaignState;
  hamlet: HamletState;
  roster: Record<string, HeroInstance>;
  expedition: ExpeditionState | null;
  battle: BattleState | null;
  pendingDecision: PendingDecision | null;
  eventLog: DomainEvent[];
  rng: RngState;
  contentVersion: string;
  lastTransactionId: string | null;
}
```

## 15.4 Campaign State

```ts
interface CampaignState {
  id: string;
  seed: string;
  week: number;
  difficulty: 'standard';
  gold: number;
  heirlooms: Record<string, number>;
  regionProgress: Record<string, RegionProgress>;
  bossProgress: Record<string, BossProgress>;
  deadHeroIds: string[];
  completedQuestIds: string[];
  status: 'active' | 'victory' | 'failed' | 'abandoned';
}
```

## 15.5 Expedition State

```ts
interface ExpeditionState {
  id: string;
  questId: string;
  regionId: string;
  partyHeroIds: string[];
  route: ExpeditionRoute;
  currentNodeId: string;
  visitedNodeIds: string[];
  scoutedNodeIds: string[];
  time: number;
  torch: number;
  inventory: InventoryState;
  campUsesRemaining: number;
  objectiveProgress: Record<string, number>;
  triggeredEventIds: string[];
  status:
    | 'preparing'
    | 'travel'
    | 'event'
    | 'battle'
    | 'camp'
    | 'objective-complete'
    | 'retreating'
    | 'success'
    | 'failed';
}
```

## 15.6 Battle State

```ts
interface BattleState {
  id: string;
  round: number;
  phase:
    | 'setup'
    | 'round-start'
    | 'actor-turn'
    | 'resolution'
    | 'round-end'
    | 'victory'
    | 'defeat'
    | 'retreat';
  heroActorIds: string[];
  enemyActorIds: string[];
  actors: Record<string, BattleActorState>;
  initiativeQueue: string[];
  activeActorId: string | null;
  pendingTargetSelection: PendingTargetSelection | null;
  roomEffectIds: string[];
  log: BattleEvent[];
}
```

---

# 16. 状态机

## 16.1 战役状态机

```text
title
→ campaign-create
→ hamlet
→ quest-selection
→ party-formation
→ provisioning
→ expedition
→ expedition-result
→ hamlet
```

终局：

```text
最终 Boss 胜利 → campaign-victory
无法继续战役 → campaign-failed
玩家主动结束 → campaign-abandoned
```

## 16.2 远征状态机

```text
preparing
→ travel
→ node-resolution
→ event / battle / camp
→ travel
→ objective-complete
→ extraction
→ success
```

失败分支：

```text
party-wipe → failed
retreat → retreating → failed-with-survivors
```

## 16.3 战斗状态机

```text
setup
→ round-start
→ actor-turn
→ resolution
→ actor-turn
→ round-end
→ round-start
```

退出：

```text
all-enemies-defeated → victory
all-heroes-dead → defeat
retreat-success → retreat
```

## 16.4 精神状态机

```text
stress < 100
→ stress >= 100
→ resolve-check
→ afflicted 或 virtuous
→ stress >= 200
→ heart-attack
```

---

# 17. 规则事件管线

所有数值变化走统一事件管线。

```text
Command
→ Before Rules
→ Main Resolution
→ Resistance / Dodge / Crit
→ Damage / Healing / Stress
→ Death’s Door / Deathblow / Resolve
→ Passive Reactions
→ Derived Events
→ Invariant Check
→ Commit
```

示例：

```text
敌人技能命中修女
→ 造成 8 伤害
→ HP 降至 0
→ 进入死亡之门
→ 修女获得压力
→ 三名队友获得压力
→ 强盗达到 100 压力
→ 意志检定
→ 获得偏执
→ 偏执发言使十字军增加压力
→ 整个事务一次性提交
```

禁止 React 组件分段修改这些状态。

---

# 18. RNG 与可复盘性

## 18.1 Seeded RNG

每个战役生成固定 Seed。

所有随机结果必须经过注入式 RNG：

- 路线；
- 事件；
- 命中；
- 暴击；
- 伤害；
- 意志检定；
- 死亡抗性；
- 战利品；
- 怪癖；
- 疾病；
- 敌方 AI 随机扰动。

## 18.2 不得使用

业务规则中禁止直接调用：

```ts
Math.random()
Date.now()  // 作为随机来源
crypto.randomUUID() // 作为规则随机来源
```

## 18.3 事件日志

```ts
interface DomainEvent {
  id: string;
  transactionId: string;
  sequence: number;
  type: string;
  payload: unknown;
  rngBefore: string;
  rngAfter: string;
  createdAt: string;
}
```

目标：

- 刷新不重抽；
- 存档恢复一致；
- Bug 可复现；
- 结果报告可生成；
- Golden Run 可自动测试。

---

# 19. 存档

## 19.1 存档策略

- 每个命令结算后自动保存；
- 关键不可逆事件前后保存；
- 只允许一个活动战役存档；
- 可保留若干历史远征报告；
- 支持导出 / 导入 JSON；
- 支持 PWA 离线。

## 19.2 不可逆事件

以下事件必须立即保存：

- 英雄死亡；
- 怪癖获得或锁定；
- 疾病获得或治疗；
- 饰品丢失；
- 任务完成；
- 撤退；
- Boss 胜利；
- 庄园升级；
- 周数推进。

## 19.3 防刷新作弊

刷新后：

- 当前事件选项保持；
- 随机结果保持；
- 当前行动者保持；
- 英雄死亡保持；
- 背包丢弃保持；
- 不重新生成路线；
- 不重新生成战利品。

---

# 20. 内容目录

```text
src/
  app/
    App.tsx
    routes.ts
    providers.tsx

  game-engine/
    command-dispatcher.ts
    transaction.ts
    invariants.ts
    rng/
    campaign/
    hamlet/
    expedition/
    battle/
    stress/
    death/
    inventory/
    events/
    rewards/

  content/
    heroes/
    skills/
    enemies/
    encounters/
    regions/
    quests/
    events/
    curios/
    quirks/
    diseases/
    trinkets/
    hamlet/
    localization/

  store/
    game-store.ts
    selectors.ts
    ui-store.ts

  persistence/
    save-repository.ts
    migrations/
    export-import.ts

  components/
    layout/
    scene/
    heroes/
    battle/
    event-card/
    inventory/
    route/
    hamlet/
    result/

  audio/
  styles/
  tests/
```

---

# 21. UI 与美术方向

## 21.1 视觉原则

- 黑、灰、暗红、赭黄；
- 大面积地牢场景；
- 高对比剪影；
- 信息卡片采用半透明黑底；
- 伤害、压力和死亡反馈强烈；
- 常态 UI 克制；
- 不模仿或复制原版插画线条；
- 建立自有角色造型和图标系统。

## 21.2 动效优先级

高优先：

- 命中抖动；
- 暴击闪白；
- 压力冲击；
- 意志检定；
- 折磨遮罩；
- 死亡之门；
- 致死打击；
- 英雄死亡；
- 火把环境变化；
- 事件卡进入；
- 战利品进入背包。

低优先：

- 角色完整攻击动画；
- 场景角色行走；
- 粒子堆叠；
- 复杂镜头运动。

## 21.3 声音

需要建立自己的声音资产：

- 环境底噪；
- 火把燃烧；
- 武器命中；
- 压力心跳；
- 低语；
- UI 确认；
- 死亡冲击；
- 自有旁白或纯字幕系统。

不得直接提取原游戏音频。

---

# 22. MVP 内容范围

## 22.1 推荐内容量

```text
1 个区域：遗迹
4 个英雄职业
4 × 7 个职业技能定义
每个英雄装备 4 个技能
8 个普通敌人
2 个精英敌人
1 个 Boss
3 种任务
3 套短路线模板
30—40 个条件事件
10 个奇物
12 个正面怪癖
12 个负面怪癖
6 个疾病
20 个饰品
8 个露营技能
6 个庄园设施
1 套完整结算报告
```

## 22.2 MVP 玩法边界

MVP 必须完成：

```text
庄园
→ 招募
→ 组队
→ 买补给
→ 短任务
→ 节点推进
→ 战斗
→ 奇物
→ 火把
→ 饥饿
→ 压力
→ 折磨 / 美德
→ 死亡之门
→ 永久死亡
→ 撤退
→ 任务结算
→ 下一周
```

缺少其中任意一环，都不能证明产品方向成立。

---

# 23. 开发阶段

## Phase 0：规则原型

目标：

- 纯 TypeScript；
- 无正式 UI；
- 四名英雄对四名敌人；
- 站位、技能、命中、伤害、死亡；
- 可注入 RNG；
- 事件日志。

验收：

- 1000 场自动战斗不产生非法状态；
- 不出现重复站位；
- 死亡单位不能行动；
- 同 Seed 同命令得到同结果。

## Phase 1：单页战斗垂直切片

目标：

- 完整战斗 UI；
- 四个首发职业；
- 四个敌人；
- 状态和动画；
- 战斗胜败；
- 自动存档。

## Phase 2：压力与死亡

目标：

- 压力；
- 意志检定；
- 四种折磨；
- 三种美德；
- 心脏病；
- 死亡之门；
- 致死打击；
- 永久死亡。

这是产品第一关键里程碑。

## Phase 3：节点远征

目标：

- 路线生成；
- 节点推进；
- 火把；
- 时间；
- 饥饿；
- 背包；
- 补给；
- 奇物；
- 撤退。

这是“赛博徒步式”结构成立的里程碑。

## Phase 4：露营与事件引擎

目标：

- 条件事件；
- 事件选择；
- 露营；
- 强迫交互怪癖；
- 事件防重复；
- 失败链日志。

## Phase 5：庄园与长期战役

目标：

- 周循环；
- 招募；
- 治疗；
- 技能和装备升级；
- 商店；
- 区域进度；
- 英雄长期状态。

## Phase 6：Boss 与战役闭环

目标：

- Boss；
- 威胁升级；
- 任务链；
- 战役胜利 / 失败；
- 完整远征报告；
- Golden Run。

## Phase 7：视觉、音频与 PWA

目标：

- 自有视觉资产；
- 环境音；
- 动效；
- 移动端；
- PWA；
- 性能优化；
- 发布前版权审计。

---

# 24. 测试策略

## 24.1 单元测试

必须覆盖：

- 站位合法性；
- 技能合法性；
- 命中；
- 暴击；
- 伤害；
- PROT；
- 抗性；
- DOT；
- 眩晕；
- 位移；
- 压力；
- 意志检定；
- 心脏病；
- 死亡之门；
- 致死打击；
- 折磨插入行为；
- 背包；
- 火把；
- 饥饿；
- 事件条件；
- RNG 确定性；
- 存档迁移。

## 24.2 属性测试

持续验证：

```text
HP 不低于 0
压力保持 0—200 或规则允许的结算中间态
同一站位不能存在两个单格单位
死亡单位不能作为合法行动者
背包使用量不能超过容量
火把保持 0—100
同一事件一次性标记不能重复
当前行动者必须存在于行动队列
```

## 24.3 E2E

至少包含：

1. 新战役到完成首个任务；
2. 饥饿导致队伍状态恶化；
3. 100 压力触发折磨；
4. 100 压力触发美德；
5. 心脏病进入死亡之门；
6. 死亡之门抵抗；
7. 致死打击永久死亡；
8. 战斗撤退；
9. 远征撤退；
10. 刷新后随机结果不变；
11. 英雄进入设施后不可出战；
12. 庄园下一周正常推进；
13. Boss 胜利；
14. 团灭；
15. 结果报告失败链正确。

---

# 25. Golden Run

建立固定 Seed：

```text
DD-WEB-GOLDEN-001
```

固定操作：

```text
创建战役
→ 招募四名英雄
→ 选择遗迹短任务
→ 购买食物、火把、铲子和钥匙
→ 正常前进
→ 处理奇物
→ 完成两场战斗
→ 一名英雄达到 100 压力并折磨
→ 一名英雄进入死亡之门并被治疗
→ 背包装满后丢弃补给
→ 完成任务
→ 返回庄园
→ 治疗压力
→ 进入下一周
```

必须验证：

- 所有结果固定；
- 可刷新恢复；
- 无规则泄漏；
- 日志完整；
- 结算报告可解释；
- 下一周状态正确。

另建失败 Golden Run：

```text
DD-WEB-FAIL-001
```

验证：

```text
低火把
→ 压力累积
→ 折磨
→ 拒绝治疗
→ 死亡
→ 队友心脏病
→ 撤退失败或团灭
→ 报告生成完整失败链
```

---

# 26. 完成定义

本项目第一版完成必须同时满足：

1. 单页完成庄园到远征的主循环；
2. 不需要自由走格子也有明确地牢推进感；
3. 四人站位与技能目标关系完整；
4. 压力不仅是第二条生命值；
5. 折磨会改变控制权；
6. 美德能产生绝境反转；
7. 死亡之门产生真实风险；
8. 英雄死亡不可通过刷新撤销；
9. 火把、食物、补给和背包产生取舍；
10. 事件由状态条件驱动；
11. 玩家可以主动撤退；
12. 失败可以从日志中追溯；
13. 庄园让远征结果影响后续周；
14. 同 Seed 可复现；
15. 移动端可正常游玩；
16. 无后端也可完整运行；
17. 不使用原版受版权保护的美术、音频和文本资源。

---

# 27. 版权与发布边界

《Darkest Dungeon》名称、角色、怪物、视觉、音乐、旁白和具体文本属于原权利方。

建议分为两种用途：

## 内部学习原型

可使用职业代号和临时占位数据研究机制，但不要公开分发原版资源。

## 对外发布

必须进行原创化：

- 更换游戏名称；
- 更换世界观；
- 重新设计职业；
- 重新命名技能；
- 自行绘制角色与怪物；
- 使用原创音乐和声音；
- 改写文本；
- 保留“压力 + 站位 + 永久死亡 + 节点远征”的抽象玩法组合。

玩法机制可作为设计参考，但不应把产品包装成未经授权的《Darkest Dungeon》网页版。

---

# 28. Codex 首阶段执行命令

```text
请创建一个全新的网页游戏项目，不读取或继承任何此前的 Darkest Dungeon 桌游项目代码和开发文档。

本项目只参考：
1. Darkest Dungeon 电子游戏的核心体验；
2. 赛博徒步之生死鳌太线的单页节点推进形式；
3. 本开发文档。

当前只执行 Phase 0：规则原型。

技术要求：
- Vite
- React
- TypeScript
- Vitest
- Playwright 可先完成配置
- 游戏规则不得写进 React 组件
- 所有随机必须使用可注入 Seeded RNG
- 所有状态变化必须通过 Command → Transaction → Domain Event → Reducer
- 必须建立规则不变量检查

本阶段只实现：
- 四人和四敌人的 1—4 号站位
- Hero / Enemy / Skill 数据定义
- 合法施法站位与合法目标站位
- 行动顺序
- 命中
- 伤害
- 暴击
- PROT
- 流血
- 腐蚀
- 眩晕
- 推拉位移
- 单位死亡
- 尸体
- 战斗胜败
- Seeded RNG
- Domain Event Log
- 单元测试
- 1000 场自动模拟稳定性测试

本阶段禁止实现：
- 压力
- 折磨
- 美德
- 死亡之门
- 永久英雄死亡
- 地牢路线
- 火把
- 食物
- 背包
- 奇物
- 庄园
- 正式美术
- 后端

交付：
1. 可运行工程；
2. game-engine 与 UI 清晰分层；
3. 内容数据示例；
4. 单元测试；
5. 自动模拟报告；
6. npm run build 通过；
7. npm run test 通过；
8. Phase 0 完成报告。

完成后停止，不自动进入 Phase 1。
```

---

# 29. 参考依据

- 《赛博徒步之生死鳌太线》官网与“关于游戏”：单页生存模拟、路线节点、动态环境、资源管理、条件随机事件与安全教育定位。
- Darkest Dungeon Steam 官方页面：压力、疾病、黑暗、折磨系统、回合制战斗、露营、城镇减压、永久死亡和程序化地牢。
- Darkest Dungeon 日本版官方网站：变化的地牢、英雄编组、设施与压力导致英雄不服从控制。
- Official Darkest Dungeon Wiki：100 / 200 压力阈值、折磨、美德、心脏病、死亡之门与致死打击等电子游戏规则核对。

参考链接：

- https://cyberhiking.cn/
- https://cyberhiking.cn/about
- https://store.steampowered.com/app/262060/Darkest_Dungeon/
- https://darkestdungeon.jp/
- https://darkestdungeon.wiki.gg/wiki/Stress_(Darkest_Dungeon)
- https://darkestdungeon.wiki.gg/wiki/Affliction
- https://darkestdungeon.wiki.gg/wiki/Death%27s_Door_(Darkest_Dungeon)

---

# 30. 最终设计判断

这个项目最有价值的地方，不是“把暗黑地牢做小”，而是把它重新组织成适合网页传播的体验：

```text
原版的地牢移动复杂度
→ 压缩为路线节点与事件卡

原版的核心压力
→ 完整保留为英雄失控与长期损耗

原版的战斗辨识度
→ 完整保留四人站位、目标限制与位移

原版的长战役
→ 压缩成清晰的周循环与区域进度

原版的死亡反馈
→ 扩展为可分享、可解释的失败报告
```

只要“折磨会夺走控制权、死亡不可撤销、补给会在深处耗尽、撤退永远是一个痛苦但合理的选项”这四件事成立，它就仍然具有《Darkest Dungeon》的精神。

而节点化、单页化、条件事件化和结果报告，则让它成为一个真正适合浏览器的新产品，而不是低配复刻。
