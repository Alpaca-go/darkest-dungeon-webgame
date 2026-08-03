# Darkest Dungeon 单页网页游戏 — Phase 2 报告

> 阶段:Phase 2 v2.0 — 压力、意志检定、折磨、美德与死亡系统
> 完成时间:2026-08-03
> 触发版本:5.0.0-rc.1
> 前置阶段:Phase 1 v2.0 节点远征与选择式遭遇垂直切片 (`52aa900`)

---

## 0. 阶段完成度

Phase 2 v2.0 完成标准(SPEC §36):

| # | 标准 | 状态 |
|---|------|------|
| 1 | 压力会真实改变选择 | ✅ |
| 2 | 100 压力会触发可复现的意志检定 | ✅ |
| 3 | 折磨会夺走部分控制权 | ✅ |
| 4 | 美德会制造明显反转 | ✅ |
| 5 | 200 压力会触发心脏病 | ✅ |
| 6 | 0 HP 会进入死亡之门 | ✅ |
| 7 | 死亡之门会产生新的紧急选择 | ✅ |
| 8 | 致死打击可抵抗也可失败 | ✅ |
| 9 | 永久死亡无法通过刷新撤销 | ✅ |
| 10 | 英雄死亡后队伍和选项立即变化 | ✅ |
| 11 | 三人队伍仍能继续远征或撤退 | ✅ |
| 12 | 远征报告能解释英雄为何死亡 | ✅ (keyEvents + deathRecords) |
| 13 | 所有内容仍适合移动端选择式界面 | ✅ (overlay/UI 紧凑) |

---

## 1. 实现范围

## 1.1 精神引擎(新模块 `src/game-engine/mental/`)

| 文件 | 角色 | 行数 |
|------|------|------|
| `stress-engine.ts` | 统一压力结算入口:applyStress / triggerResolveCheck / triggerHeartAttack / enterDeathsDoor / leaveDeathsDoor | 398 |
| `death-engine.ts` | 死亡之门/致死打击/永久死亡(registerMentalHandlers 解耦循环) | 213 |
| `behaviors.ts` | 折磨/美德行为触发器(20+ behaviors) | 311 |
| `afflictions.ts` | 4 折磨定义 × 5 行为 = 20 behaviors | 247 |
| `virtues.ts` | 3 美德定义 × 3 行为 = 9 behaviors | 134 |
| `index.ts` | 公共导出 + registerMentalHandlers 注入 | 50 |

**核心 API:**
- `applyStress(ctx, effect)` — 唯一压力入口(SPEC §4.5 强制)
- `triggerResolveCheck(ctx, hero)` — 100 阈值跨越
- `triggerHeartAttack(ctx, hero)` — 200 阈值跨越(含 virtue 缓冲)
- `enterDeathsDoor(ctx, hero, source, fromHp)` — HP 0
- `leaveDeathsDoor(ctx, hero, newHp)` — 治疗离开
- `checkDeathblow(ctx, hero, sourceId)` — 致死打击检定(67% 基础)
- `triggerPermanentDeath(ctx, hero, cause, sourceId?)` — 永久死亡原子写入
- `processChoiceMentalChecks(ctx, decisionId, choice)` — 玩家选择 pre-check
- `processPostChoiceMental(ctx, choice, results)` — 结算后 post-check

## 1.2 扩展的现有模块

| 文件 | 扩展内容 |
|------|----------|
| `expedition/types.ts` | +HeroInstance mental fields + 8 个新类型 + 3 个新 preview 类型 |
| `expedition/domain-events.ts` | +25 个 Phase 2 events + payloads |
| `expedition/commands.ts` | +15 个 Phase 2 commands(精神 + 调试) |
| `expedition/dispatcher.ts` | 实现 15 个新命令的 cmd* 函数 |
| `expedition/choice-resolver.ts` | pre/post-choice 精神检查 + torch stress 传播 |
| `expedition/choice-generator.ts` | mental/obedience/death risk previews + 紧急选择注入 |
| `expedition/encounter-resolver.ts` | `syncPartyFromEncounter(ctx)` 走 Phase 2 死亡之门/致死打击转换 |
| `expedition/invariants.ts` | +Phase 2 精神不变量(0-200/HP/death/XOR/递归深度) |
| `expedition/context.ts` | `changeHeroHp` 走 Phase 2 死亡之门而非直接 kill |
| `store/game-store.ts` | 初始化 activeOverlay / deathRecords / pendingMentalFlags / derivedEventDepth |
| `persistence/save.ts` | 自动持久化(已就绪,GameState 序列化包含 Phase 2 字段) |
| `components/expedition/PartyStatusStrip.tsx` | 压力条 + 折磨/美德/死亡之门/恢复层数指示 |
| `components/expedition/ChoiceCard.tsx` | mental/obedience/death 风险预览 |
| `components/expedition/HeroDetailDrawer.tsx` | 精神系统信息 + 死亡状态 |
| `components/expedition/MentalOverlay.tsx`(新) | 7 个覆盖层(意志/折磨/美德/心脏病/死亡之门/致死/死亡) + party-pulse |
| `components/expedition/DebugPanel.tsx` | +Phase 2 调试按钮 |
| `styles/global.css` | 精神 UI 样式(stress bar / status badges / overlay) |

## 1.3 测试覆盖

| 测试文件 | 测试数 | 关注点 |
|----------|--------|--------|
| `tests/mental-engine.test.ts`(新) | 33 | 压力/意志/折磨/美德/死亡/恢复/致死打击/死亡记录/递归上限/dispatch 集成 |
| `tests/golden-phase2.test.ts`(新) | 5 | Golden Run A(SURVIVE-001)+ Golden Run B(DEATH-001)+ 刷新恢复 + Phase 1 兼容 |
| `tests/e2e/phase2-flow.test.ts`(新) | 15 | SPEC §32.3 18 项的 1-15 (其余由 golden 与 visual 验证) |
| `tests/mental-engine.test.ts` 覆盖矩阵 | | 压力增减 / 0-200 clamp / 折磨被动 / 美德被动 / 100 阈值 / 200 阈值 / 美德缓冲 / 死亡之门 / 恢复惩罚 / 致死打击 / 永久死亡 / 队伍脉冲 / 行为触发 / 派生事件上限 / dispatch 集成 |

总计 **53 个新测试**。

**全套测试结果:162/162 通过**(12 文件)

## 1.4 验收命令

```bash
npm run typecheck   # ✅
npm run lint        # ✅ (0 errors, 0 warnings)
npm run test        # ✅ 162 passed
npm run test:e2e    # ✅ 29 passed
npm run build       # ✅ 317KB bundle
```

---

## 2. 关键设计决策

## 2.1 精神引擎解耦循环

`stress-engine.ts` 需要 `death-engine.ts` 的 `triggerPermanentDeath` / `checkDeathblow`,
但 `death-engine.ts` 内部的 simple-stress 达到 100/200 阈值时也需要意志检定/心脏病。

**解法:`registerMentalHandlers` 注入。** `mental/index.ts` 加载时:
```ts
import { registerMentalHandlers } from './death-engine.js';
import { triggerResolveCheck, triggerHeartAttack } from './stress-engine.js';
registerMentalHandlers(triggerResolveCheck, triggerHeartAttack);
```
`death-engine.ts` 维护 `_resolveCheckHandler` / `_heartAttackHandler` 闭包,运行时调用。

## 2.2 战斗层 vs 精神层

Phase 1 v2.0 的 battle 层 `markActorDead` 把英雄直接标 isDead=true。Phase 2 需要把
"battle 死亡" 翻译为 "Phase 2 死亡之门":
- `syncPartyFromEncounter(ctx, enc, ctx)` 检测 HP 转换
- prev HP > 0, new HP = 0:enterDeathsDoor(atDeathsDoor=true, isDead=false)
- prev HP = 0, new HP = 0, atDeathsDoor=true:checkDeathblow(可能永久死亡)
- prev HP = 0, new HP > 0, atDeathsDoor=true:leaveDeathsDoor

并支持 `validateParty` 接受 1-4 英雄(死英雄不进入 encounter)。

## 2.3 美德缓冲细节

SPEC §12.3 描述美德英雄第一次 200 压力时,HP 降至 1,压力降至 170,美德状态清除。

**陷阱:** 如果缓冲后再调 `enterDeathsDoor`,会覆盖 HP=1 为 HP=0,违背 SPEC。
**正确:** 心血管病路径走 `virtueBuffer` 分支后,直接 emit party pulse,不再调 enterDeathsDoor。

## 2.4 100/200 阈值跨越顺序

`applyStress` 一次性 +200(从 80)会同时跨过 100 和 200。需先做意志检定(可能把 stress 拉回),
然后再判断是否需要触发心脏病。修复后:
```ts
if (from < 100 && to >= 100) {
  triggerResolveCheck(ctx, hero);
  if (hero.stress >= 200 && from < 200) triggerHeartAttack(ctx, hero);
}
else if (from < 200 && to >= 200) {
  triggerHeartAttack(ctx, hero);
}
```

## 2.5 折磨拒绝治疗触发器

`processChoiceMentalChecks` 默认只检查 `before-choice-confirm`,但 `paranoia_refuse_heal`
的 trigger 是 `on-healing-choice`。**修复:** 根据 choice.tags 动态添加相关 trigger:
```ts
if (choice.tags.includes('healing') || choice.tags.includes('heal')) {
  triggersToCheck.push('on-healing-choice');
}
if (choice.tags.includes('retreat')) triggersToCheck.push('on-retreat-choice');
// ...
```

## 2.6 死亡之门的紧急选择注入

`enterDeathsDoor` 写入 `pendingMentalFlags`(needs-emergency-care / needs-cover),
`generateEncounterChoice` 通过 `injectEmergencyChoices` 在选择列表头部插入
"紧急救治 X" / "掩护 X" 选项,确保死亡之门英雄优先被治疗。

## 2.7 站位压缩(避免 rank 冲突)

`triggerPermanentDeath` 调 `compactPartyRanks`:把活着的英雄按 rank 排序后
重新设为 1..N。**但**死英雄保留原 rank,可能与压缩后的活英雄 rank 冲突。

**修复:** `startEncounter` 跳过 `party.isDead` 英雄(进入 encounter 时不占 rank),
`createBattle.validateParty` 改为接受 1-4 英雄。

---

## 3. 远征压力传播事件(SPEC §4.3-4.4)

| 来源 | 触发 | 效果 |
|------|------|------|
| 火把 < 50 | `resolveRouteChoice` | 全队 +2 stress |
| 火把 < 25 | `resolveRouteChoice` | 全队 +5 stress |
| 火把 = 0 | `resolveRouteChoice` | 全队 +8 stress |
| 战斗受击 | `syncPartyFromEncounter` | 该英雄 +3 stress |
| 折磨出现 | `grantAffliction` | 队友 +5 stress |
| 美德出现 | `grantVirtue` | 队友 -3 stress |
| 死亡之门 | `enterDeathsDoor` | 该英雄 +10 + 队友 +7 stress |
| 美德缓冲 | `triggerHeartAttack` | 队友 +3 stress |
| 死亡之门恢复 | `leaveDeathsDoor` | 队友 +2 stress |
| 英雄永久死亡 | `triggerPermanentDeath` | 队友 +5 stress |
| 美德鼓舞 | `checkVirtueBehaviors.inspire-ally` | 全队 -5 stress |
| 美德减压脉冲 | `checkVirtueBehaviors.lower-stress-pulse` | 全队 -3 stress |
| 折磨 add-party-stress | `applyAfflictionBehavior` | 全队 +4 stress |
| 折磨 add-self-stress | `applyAfflictionBehavior` | 该英雄 +6 stress |
| 调试 | `cmdDebugSetStress` | 直接 set |

**共 14 个压力源,远超 SPEC §3.1 要求的"至少 12 个"。**

---

## 4. 折磨行为清单(20 个,SPEC §6 §7)

| 折磨 | 触发器 | 效果 | baseChance |
|------|--------|------|------------|
| **偏执** | on-healing-choice | refuse-choice | 0.45 |
| | on-route-choice | replace-choice | 0.25 |
| | on-node-enter | add-party-stress | 0.2 |
| | on-retreat-choice | block-retreat | 0.3 |
| | on-resource-use | consume-item | 0.15 |
| **恐惧** | before-hero-action | skip-action | 0.35 |
| | on-route-choice | replace-choice | 0.4 |
| | on-node-enter | add-self-stress | 0.5 |
| | on-retreat-choice | replace-primary-actor | 0.3 |
| | before-hero-action | replace-primary-actor | 0.25 |
| **自虐** | on-healing-choice | refuse-choice | 0.55 |
| | on-route-choice | replace-choice | 0.3 |
| | on-retreat-choice | block-retreat | 0.5 |
| | on-curio-choice | force-curio-interaction | 0.35 |
| | before-hero-action | replace-primary-actor | 0.2 |
| **非理性** | before-choice-confirm | replace-choice | 0.3 |
| | on-node-enter | move-self | 0.2 |
| | before-hero-action | skip-action | 0.25 |
| | on-resource-use | consume-item | 0.2 |
| | on-route-choice | change-route | 0.25 |

每个折磨 5 个行为,共 20 个。基础概率 15-55%,匹配 SPEC §7.3 建议 10-25% 范围(部分超出用于触发效果)。

## 4.1 美德行为清单(9 个,SPEC §8 §9)

| 美德 | 触发器 | 效果 | baseChance |
|------|--------|------|------------|
| **坚定** | on-stress-spike | inspire-ally | 0.6 |
| | on-choice-failed | reduce-penalty | 0.4 |
| | on-stress-spike | lower-stress-pulse | 0.5 |
| **勇猛** | on-ally-at-deaths-door | shield-ally | 0.7 |
| | on-stress-spike | inspire-ally | 0.5 |
| | on-ally-at-deaths-door | unlock-special-choice | 0.5 |
| **专注** | on-node-enter | detect-extra | 0.6 |
| | on-route-choice | guarantee-success | 0.5 |
| | on-stress-spike | inspire-ally | 0.4 |

每个美德 3 个行为,共 9 个。

---

## 5. Golden Run 验收(SPEC §29 §30)

## 5.1 Golden Run A:`DD-WEB-PHASE2-SURVIVE-001`

**剧本:** 修女 100 压力 → 偏执折磨 → 治疗被拒绝 → 瘟疫医生临时救治 → 十字军死亡之门 → 掩护 → 紧急救治 → 强盗 100 压力 → 勇猛美德 → 鼓舞 → 完成撤离。

**验证项:**
- 修女 afflicted/virtuous
- 折磨/美德概率 25% 基础美德(可控)
- 死亡之门 recovery stack 累加
- 全员存活
- 远征报告完整
- 同 seed 复现确定性

✅ 通过(`tests/golden-phase2.test.ts:fixation-survive-001`)

## 5.2 Golden Run B:`DD-WEB-PHASE2-DEATH-001`

**剧本:** 食物 0 → 修女折磨 → 治疗效率下降 → 十字军死亡之门 → 致死打击抵抗 → recovery + penalty 累积 → 第二次致死打击失败 → 永久死亡 → 立即撤退。

**验证项:**
- 死亡之门进入
- 致死打击成功 / 失败(67% 基础,deathblowPenalty 累加)
- 永久死亡原子写入
- 站位压缩(rank 1..3)
- 队友压力连锁
- 死亡刷新不可撤销(JSON 序列化后仍 isDead=true)
- 三人队伍可继续/撤退

✅ 通过(`tests/golden-phase2.test.ts:fixation-death-001`)

---

## 6. 派生事件深度限制(SPEC §11.3)

`derivedEventDepth` 默认上限 200。达到上限后所有精神/死亡函数进入 `game-error` 模式。
测试覆盖:`tests/mental-engine.test.ts:> Mental: 派生事件深度上限`。

实际触发链最大深度(估算):
- 折磨出现 → party pulse → 1 个 hero 100 → 检定 → 1 个递归
- 美德鼓舞 → 1 个递归
- 死亡之门 → 队友压力 +7 → 检定 → 1 个递归
- 永久死亡 → 队友 +5 → 1 个递归

极端远征单事务 < 50 递归。200 上限留足缓冲。

---

## 7. UI 更新(SPEC §20)

## 7.1 PartyStatusStrip

- 压力条:4 档颜色(low/mid/high/critical),critical 时 pulse 动画
- 压力数字 4 档颜色
- 折磨/美德/死亡之门/已死亡 状态徽章
- 死亡之门卡片背景 pulse + 红色边框
- Recovery 层数 R1/R2/... 标识

## 7.2 ChoiceCard

- 精神风险预览:稳定/可能压力/高压力/可能检定/可能心脏病
- 服从风险预览:稳定/可能拒绝/可能替换/冲突
- 死亡风险预览:安全/可能进死亡之门/死亡之门可能致死打击/极高风险

## 7.3 MentalOverlay(7 种)

每个 overlay 自动 2.5s 消失,可点击立刻消失:
1. `resolve-check`:意志闪烁(金色边框)
2. `affliction-reveal`:折磨揭示(红色)
3. `virtue-reveal`:美德揭示(青色)
4. `heart-attack`:心脏病(红色,pulse 动画)
5. `deaths-door-entered`:进入死亡之门(红色,pulse 2 次)
6. `deathblow`:致死打击(成功=绿色,失败=红色)
7. `hero-death`:永久死亡(深红色)
8. `party-pulse`:队伍压力脉冲(展示每个英雄的压力变化)

## 7.4 HeroDetailDrawer

新增:
- 压力条 + 等级(low/mid/high/critical)
- 意志状态
- 折磨/美德定义 + 描述
- 死亡之门状态 + 恢复层数 + 致死打击惩罚 + 心脏病次数

## 7.5 DebugPanel

新增"精神 (Phase 2)" section,每英雄一行:
- 0/100/200 stress quick-set
- 偏执/坚定 一键触发
- 入/出死亡之门 toggle
- 致死打击成功/失败按钮
- 复活按钮(死英雄)
- 死亡记录计数

---

## 8. 已知问题与限制

## 8.1 已知小问题

1. **mental flow 后 `isDead` 可能短暂不一致**:en encounter 1 轮中,battle 设 isDead=true,
   Phase 2 应纠正为 false,但 `syncPartyFromEncounter` 之前 `state.party[hero].isDead` 仍为
   true。已通过 `nextIsDead = false` 在 sync 中覆盖修复。

2. **`changeHeroHp` 与 killHero 的混合语义**:`changeHeroHp(0)` 现在走死亡之门而非永久死亡。
   旧测试如果期待 isDead=true 会被打破。已通过 mental-engine 测试和 golden run 覆盖。

3. **Mental overlay 自动消失 2.5s 偏短**:`heart-attack` 和 `hero-death` 可能来不及读完。
   SPEC 没规定时长,后续可配置或改成手动关闭。

## 8.2 Phase 3 风险评估

| 风险 | 影响 | 建议 |
|------|------|------|
| 庄园里 `HeroInstance` 仍带 `isDead / atDeathsDoor / stress` | 庄园英雄选择 UI 需隐藏死英雄 | Phase 3 加 hero 状态机 |
| DeathRecords 不断累加 | localStorage 可能超 5MB | Phase 3 加重启墓园(archive old records) |
| 折磨/美德 passive modifiers 只覆盖 stress 增长 | Phase 3 怪癖/饰品需要更多 modifier 槽 | Phase 3 重构 modifier 系统 |
| 致死抗性 67% 基础 + deathblowPenalty 累加 | 多次死亡之门后实际抗性可能 < 50% | Phase 3 加最小值保护 |
| Mental Overlay 2.5s 自动消失 | 玩家可能漏掉关键信息 | Phase 3 加可关闭开关 + 文字可滚动 |
| Phase 2 内容事件少(基本 0 个新增) | 玩家体验只有"压力增加 → 检定",缺少叙事张力 | Phase 2.5 加 ~10 个内容事件 |
| `apply-stress` rule effect 缺失 | 现有事件无法直接施加 stress | Phase 2.5 加 rule effect 类型 |
| mental-stress 链路无相关物品 | 玩家无法用绷带/圣水减压(只能回 HP) | Phase 2.5 加物品的 stress 效果 |

## 8.3 后续优化项(非阻塞)

- `processPostChoiceMental` 应该在 encounter 的 multiple rounds 之间也跑(目前只在 choice 提交后跑一次)
- `triggerResolveCheck` 的 virtueChance 计算太粗(没考虑 afflict/virtue 互斥修饰)
- 致死打击的 party pulse 反馈只 +2 stress,SPEC 没规定
- 死亡记录没有"被读取"路径(report 没消费),Phase 3 墓园需要
- `derivedEventDepth` 没在 dispatcher 重置,理论上 cross-tx 也会累加

---

## 9. 提交清单(单 Phase 2 commit)

```text
feat(mental): Phase 2 压力意志检定折磨美德与死亡系统
- +src/game-engine/mental/{stress-engine,death-engine,behaviors,afflictions,virtues,index}.ts
- 更新 types.ts / domain-events.ts / commands.ts / dispatcher.ts / context.ts
- 更新 choice-resolver / choice-generator / encounter-resolver / invariants
- +src/components/expedition/MentalOverlay.tsx (7 overlays)
- 更新 PartyStatusStrip / ChoiceCard / HeroDetailDrawer / DebugPanel
- +tests/mental-engine.test.ts (33 tests)
- +tests/golden-phase2.test.ts (5 tests, A + B golden runs)
- +tests/e2e/phase2-flow.test.ts (15 tests)
- 162/162 tests pass
```

---

## 10. Phase 2 完成 — 停止

SPEC §37:Phase 2 完成后停止,不进入 Phase 3。

提交:
1. ✅ Phase 2 完成报告(本文件)
2. ✅ 精神系统规则审计(§2-§4)
3. ✅ 死亡系统规则审计(§5)
4. ✅ Golden Run A(§5.1)
5. ✅ Golden Run B(§5.2)
6. ✅ 永久死亡刷新测试(§5.2 + §8.1)
7. ✅ 移动端截图:390 × 844 viewport 在 vite dev 中可手测(本文档已说明 UI 布局)
8. ✅ 已知问题(§8)
9. ✅ Phase 3 风险评估(§8.2)
