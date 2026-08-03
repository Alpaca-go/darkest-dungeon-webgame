/**
 * 事件定义(SPEC §23)
 *
 * Phase 1 内容(对照 SPEC §23 建议量):
 *   3 路线事件(本文件以 trap+curio 事件为主,corridor flavour 走单独 quick event)
 *   2 饥饿变体(全队进食 / 节省口粮)
 *   3 陷阱
 *   2 路障
 *   3 奇物
 *   2 遭遇
 *   2 火把
 *   2 背包
 *   1 任务目标
 *   1 撤退
 *
 * 注:trap/curio/obstacle/torch/inventory/objective/retreat 事件在本文件统一管理,
 * 节点上按 id 引用。遭遇事件由 encounter-resolver 处理(不走 choice 流程)。
 */

import type { EventDef, RuleCondition } from '../game-engine/expedition/types.js';

// ---------- helpers ----------

const always: RuleCondition = { kind: 'and', conditions: [] };
const condTorchLt = (n: number): RuleCondition => ({ kind: 'torch-lt', value: n });
const condTorchGte = (n: number): RuleCondition => ({ kind: 'torch-gte', value: n });
const condFoodLt = (n: number): RuleCondition => ({ kind: 'food-lt', value: n });
const condFoodGte = (n: number): RuleCondition => ({ kind: 'food-gte', value: n });
const condHas = (itemId: string): RuleCondition => ({ kind: 'has-item', itemId: itemId as any });
const condTag = (heroId: string, tag: string): RuleCondition => ({ kind: 'tag-has', heroId, tags: [tag] });

// =====================================================================
// 陷阱(SPEC §11.1)
// =====================================================================

/** 压力板:基础陷阱,英雄可能受伤,可能触发流血 */
const TRAP_PRESSURE_PLATE: EventDef = {
  id: 'trap_pressure_plate',
  trigger: 'node-enter',
  title: '金属压力板',
  description: '地上有金属触发器,走廊里很暗。',
  sceneId: 'scene.ruins.trap.pressure_plate',
  conditions: [always],
  weight: 10,
  risk: 'medium',
  choices: [
    {
      id: 'trap.disarm',
      title: '让前排英雄小心拆除',
      description: '让十字军或强盗尝试拆除陷阱。',
      riskPreview: [{ kind: 'trap', severity: 'low', description: '可能被刺伤。' }],
      costs: [{ kind: 'consume-time', amount: 2 }],
      outcomeTable: [
        {
          weight: 7,
          effects: [{ kind: 'reveal-next-node' }],
          narrativeHint: '陷阱被安全拆除。',
        },
        {
          weight: 3,
          effects: [
            { kind: 'hp-delta', amount: -3 },
            { kind: 'consume-time', amount: 1 },
          ],
          narrativeHint: '拆除失败,英雄受轻伤。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'trap.use-bandage',
      title: '用绷带做标记后绕行',
      description: '标记位置,远距离观察后绕行。',
      conditions: [condHas('bandage')],
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 绷带。' }],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [{ kind: 'reveal-next-node' }],
          narrativeHint: '成功绕行。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'trap.bypass',
      title: '绕行',
      description: '原路返回,从另一条路通过。',
      riskPreview: [{ kind: 'lost-time', severity: 'low', description: '损失 1 时间。' }],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [{ kind: 'reveal-next-node' }],
          narrativeHint: '安全绕开。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'trap.sprint',
      title: '快速通过',
      description: '冒险硬冲。',
      riskPreview: [{ kind: 'injury', severity: 'medium', description: '可能受伤。' }],
      costs: [],
      outcomeTable: [
        {
          weight: 4,
          effects: [{ kind: 'reveal-next-node' }],
          narrativeHint: '运气好,没触发。',
        },
        {
          weight: 6,
          effects: [
            { kind: 'hp-delta', amount: -5 },
            { kind: 'apply-status', statusType: 'bleed', count: 2, duration: 2 },
            { kind: 'consume-time', amount: 1 },
          ],
          narrativeHint: '触发陷阱,英雄流血。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 弩箭机关:可绕过或硬冲 */
const TRAP_ARROW: EventDef = {
  id: 'trap_arrow_wall',
  trigger: 'node-enter',
  title: '墙壁弩箭机关',
  description: '墙上有一排弩箭发射口,似乎仍在运作。',
  sceneId: 'scene.ruins.trap.arrow',
  conditions: [always],
  weight: 8,
  risk: 'medium',
  choices: [
    {
      id: 'trap.arrow.bypass',
      title: '趴低通过',
      description: '贴地爬过弩箭射击区。',
      riskPreview: [{ kind: 'injury', severity: 'low', description: '可能被划伤。' }],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        { weight: 8, effects: [{ kind: 'reveal-next-node' }], narrativeHint: '成功通过。' },
        { weight: 2, effects: [{ kind: 'hp-delta', amount: -2 }], narrativeHint: '背部被划伤。' },
      ],
      terminatesEvent: true,
    },
    {
      id: 'trap.arrow.sprint',
      title: '全速冲刺',
      description: '队伍狂奔,弩箭跟在后面。',
      riskPreview: [{ kind: 'injury', severity: 'high', description: '可能多人受伤。' }],
      costs: [],
      outcomeTable: [
        { weight: 5, effects: [{ kind: 'reveal-next-node' }], narrativeHint: '侥幸没被射中。' },
        {
          weight: 5,
          effects: [
            { kind: 'hp-delta', amount: -7 },
            { kind: 'consume-time', amount: 1 },
          ],
          narrativeHint: '弩箭擦过,多人轻伤。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'trap.arrow.shovel',
      title: '用铲子卡住机关',
      description: '把铲子塞进弩箭发射口。',
      conditions: [condHas('shovel')],
      riskPreview: [{ kind: 'consume', severity: 'medium', description: '消耗 1 铲子。' }],
      costs: [],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'take-item', itemId: 'shovel', count: 1 },
            { kind: 'reveal-next-node' },
          ],
          narrativeHint: '机关被卡住。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 地面塌陷:需要铲子或绕行 */
const TRAP_PITFALL: EventDef = {
  id: 'trap_pitfall',
  trigger: 'node-enter',
  title: '地面塌陷',
  description: '一段石板地面显得不稳定,可能随时塌陷。',
  sceneId: 'scene.ruins.trap.pitfall',
  conditions: [always],
  weight: 6,
  risk: 'high',
  choices: [
    {
      id: 'trap.pit.shovel',
      title: '用铲子架桥',
      description: '用铲子做临时的桥。',
      conditions: [condHas('shovel')],
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 铲子。' }],
      costs: [],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'take-item', itemId: 'shovel', count: 1 },
            { kind: 'reveal-next-node' },
          ],
          narrativeHint: '安全通过。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'trap.pit.careful',
      title: '小心通过',
      description: '让前排探路,逐个通过。',
      riskPreview: [{ kind: 'injury', severity: 'medium', description: '可能有人跌落。' }],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        { weight: 7, effects: [{ kind: 'reveal-next-node' }], narrativeHint: '安全通过。' },
        { weight: 3, effects: [{ kind: 'hp-delta', amount: -4 }], narrativeHint: '前排跌了一跤。' },
      ],
      terminatesEvent: true,
    },
    {
      id: 'trap.pit.back',
      title: '返回',
      description: '放弃这条路,原路返回。',
      riskPreview: [{ kind: 'lost-time', severity: 'low', description: '损失时间与火把。' }],
      costs: [
        { kind: 'consume-time', amount: 1 },
        { kind: 'torch-delta', amount: -3 },
      ],
      outcomeTable: [
        { weight: 10, effects: [{ kind: 'reveal-next-node' }], narrativeHint: '返回上一节点。' },
      ],
      terminatesEvent: true,
    },
  ],
};

// =====================================================================
// 奇物(SPEC §12)
// =====================================================================

/** 被亵渎的祭坛:供修女/圣水使用 */
const CURIO_ALTAR: EventDef = {
  id: 'curio_desecrated_altar',
  trigger: 'node-enter',
  title: '被亵渎的祭坛',
  description: '一尊腐朽的祭坛发出不祥的红光,触摸它可能有未知后果。',
  sceneId: 'scene.ruins.curio.altar',
  conditions: [always],
  weight: 10,
  oncePerExpedition: true,
  risk: 'high',
  choices: [
    {
      id: 'curio.altar.touch',
      title: '直接触碰',
      description: '未知结果。',
      riskPreview: [{ kind: 'injury', severity: 'extreme', description: '可能重伤或诅咒。' }],
      costs: [],
      outcomeTable: [
        { weight: 4, effects: [{ kind: 'give-item', itemId: 'gold', count: 2 }], narrativeHint: '祭坛赐予金块。' },
        { weight: 4, effects: [{ kind: 'hp-delta', amount: -8 }], narrativeHint: '灼热的反噬。' },
        {
          weight: 2,
          effects: [
            { kind: 'hp-delta', amount: -3 },
            { kind: 'apply-status', statusType: 'bleed', count: 2, amount: 1 },
          ],
          narrativeHint: '轻微反噬。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'curio.altar.holy-water',
      title: '使用圣水净化',
      description: '消耗圣水,稳定获得正面结果。',
      conditions: [condHas('holy-water')],
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 圣水。' }],
      costs: [{ kind: 'take-item', itemId: 'holy-water', count: 1 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'heal-percent', amount: 30 },
            { kind: 'give-item', itemId: 'gold', count: 1 },
          ],
          narrativeHint: '圣水生效,队伍受到祝福。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'curio.altar.vestal',
      title: '让修女检查',
      description: '修女上前检查祭坛。',
      conditions: [condTag('hero.vestal', 'curio-religious')],
      riskPreview: [{ kind: 'injury', severity: 'low', description: '可能受轻微反噬。' }],
      costs: [],
      outcomeTable: [
        { weight: 8, effects: [{ kind: 'heal-percent', amount: 25 }], narrativeHint: '修女安抚了祭坛。' },
        {
          weight: 2,
          effects: [
            { kind: 'hp-delta', heroId: 'hero.vestal', amount: -3 },
          ],
          narrativeHint: '修女被反噬。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'curio.altar.leave',
      title: '离开',
      description: '放弃收益。',
      riskPreview: [],
      costs: [],
      outcomeTable: [{ weight: 1, effects: [] }],
      terminatesEvent: true,
    },
  ],
};

/** 锁住的古老宝箱 */
const CURIO_LOCKED_CHEST: EventDef = {
  id: 'curio_locked_chest',
  trigger: 'node-enter',
  title: '锁住的古老宝箱',
  description: '一只布满锈迹的宝箱,锁头是失传的机关。',
  sceneId: 'scene.ruins.curio.chest',
  conditions: [always],
  weight: 10,
  risk: 'low',
  choices: [
    {
      id: 'curio.chest.key',
      title: '使用万能钥匙',
      description: '消耗万能钥匙,直接打开。',
      conditions: [condHas('skeleton-key')],
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 万能钥匙。' }],
      costs: [{ kind: 'take-item', itemId: 'skeleton-key', count: 1 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'give-item', itemId: 'gold', count: 2 },
            { kind: 'give-item', itemId: 'bandage', count: 1 },
          ],
          narrativeHint: '打开宝箱,获得金块和绷带。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'curio.chest.force',
      title: '暴力撬开',
      description: '让强盗或十字军强行撬开。',
      riskPreview: [{ kind: 'injury', severity: 'medium', description: '可能夹伤。' }, { kind: 'consume', severity: 'low', description: '消耗时间。' }],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        { weight: 6, effects: [{ kind: 'give-item', itemId: 'gold', count: 1 }], narrativeHint: '撬开,只拿到金块。' },
        {
          weight: 4,
          effects: [
            { kind: 'give-item', itemId: 'gold', count: 1 },
            { kind: 'hp-delta', amount: -2 },
          ],
          narrativeHint: '撬开时夹伤手指。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'curio.chest.leave',
      title: '离开',
      description: '不要冒险。',
      riskPreview: [],
      costs: [],
      outcomeTable: [{ weight: 1, effects: [] }],
      terminatesEvent: true,
    },
  ],
};

/** 发霉的书架(可选 curio,内容是 supply grant) */
const CURIO_BOOKSHELF: EventDef = {
  id: 'curio_moldy_bookshelf',
  trigger: 'node-enter',
  title: '发霉的书架',
  description: '墙边一排腐朽的书架,也许还有未被虫蛀的东西。',
  sceneId: 'scene.ruins.curio.bookshelf',
  conditions: [always],
  weight: 8,
  risk: 'low',
  choices: [
    {
      id: 'curio.book.search',
      title: '翻找',
      description: '让修女或瘟疫医生检查。',
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 时间。' }],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        { weight: 6, effects: [{ kind: 'give-item', itemId: 'bandage', count: 1 }], narrativeHint: '找到绷带。' },
        { weight: 4, effects: [{ kind: 'give-item', itemId: 'antivenom', count: 1 }], narrativeHint: '找到解毒剂。' },
      ],
      terminatesEvent: true,
    },
    {
      id: 'curio.book.leave',
      title: '离开',
      description: '不要浪费时间。',
      riskPreview: [],
      costs: [],
      outcomeTable: [{ weight: 1, effects: [] }],
      terminatesEvent: true,
    },
  ],
};

// =====================================================================
// 路障(SPEC §11.2)
// =====================================================================

const OBSTACLE_DEBRIS: EventDef = {
  id: 'obstacle_debris',
  trigger: 'node-enter',
  title: '坍塌碎石',
  description: '通道被碎石堵住,需要清理。',
  sceneId: 'scene.ruins.obstacle.debris',
  conditions: [always],
  weight: 8,
  risk: 'medium',
  choices: [
    {
      id: 'obstacle.debris.shovel',
      title: '用铲子清理',
      description: '安全通过。',
      conditions: [condHas('shovel')],
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 铲子。' }],
      costs: [],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'take-item', itemId: 'shovel', count: 1 },
            { kind: 'reveal-next-node' },
          ],
          narrativeHint: '碎石被清开。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'obstacle.debris.hands',
      title: '徒手清理',
      description: '增加时间,消耗火把并伤害队伍。',
      riskPreview: [
        { kind: 'injury', severity: 'medium', description: '可能受伤。' },
        { kind: 'consume', severity: 'low', description: '消耗火把与时间。' },
      ],
      costs: [
        { kind: 'consume-time', amount: 2 },
        { kind: 'torch-delta', amount: -4 },
      ],
      outcomeTable: [
        {
          weight: 6,
          effects: [{ kind: 'reveal-next-node' }],
          narrativeHint: '费时但清开了。',
        },
        {
          weight: 4,
          effects: [
            { kind: 'reveal-next-node' },
            { kind: 'hp-delta', amount: -2 },
          ],
          narrativeHint: '被碎片划伤。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'obstacle.debris.bypass',
      title: '寻找绕路',
      description: '可能进入一条临时支路。',
      riskPreview: [{ kind: 'lost-time', severity: 'low', description: '损失时间。' }],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'reveal-next-node' },
            { kind: 'give-item', itemId: 'gold', count: 1 },
          ],
          narrativeHint: '绕路时在地上发现散落金块。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'obstacle.debris.back',
      title: '返回',
      description: '回到上一节点。',
      riskPreview: [{ kind: 'lost-time', severity: 'low', description: '损失时间与火把。' }],
      costs: [
        { kind: 'consume-time', amount: 1 },
        { kind: 'torch-delta', amount: -3 },
      ],
      outcomeTable: [{ weight: 1, effects: [{ kind: 'reveal-next-node' }] }],
      terminatesEvent: true,
    },
  ],
};

const OBSTACLE_PRESSURE_DOOR: EventDef = {
  id: 'obstacle_pressure_door',
  trigger: 'node-enter',
  title: '压力门',
  description: '一道沉重的石门,没有把手,只能从另一侧推开。',
  sceneId: 'scene.ruins.obstacle.pressure_door',
  conditions: [always],
  weight: 5,
  risk: 'low',
  choices: [
    {
      id: 'obstacle.door.crusader',
      title: '十字军推动',
      description: '前排用盾推开。',
      riskPreview: [{ kind: 'injury', severity: 'low', description: '可能受轻伤。' }],
      costs: [],
      outcomeTable: [
        { weight: 9, effects: [{ kind: 'reveal-next-node' }], narrativeHint: '门被推开。' },
        {
          weight: 1,
          effects: [
            { kind: 'hp-delta', heroId: 'hero.crusader', amount: -2 },
            { kind: 'reveal-next-node' },
          ],
          narrativeHint: '门反弹,十字军受轻伤。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'obstacle.door.bypass',
      title: '寻找侧道',
      description: '浪费时间。',
      riskPreview: [{ kind: 'lost-time', severity: 'low', description: '消耗 2 时间。' }],
      costs: [{ kind: 'consume-time', amount: 2 }],
      outcomeTable: [
        { weight: 10, effects: [{ kind: 'reveal-next-node' }], narrativeHint: '找到侧道。' },
      ],
      terminatesEvent: true,
    },
  ],
};

// =====================================================================
// 饥饿(SPEC §10)
// =====================================================================

const HUNGER_FULL_MEAL: EventDef = {
  id: 'hunger_full_meal',
  trigger: 'manual',
  title: '队伍饥饿',
  description: '队伍走得太久,该吃点东西了。',
  sceneId: 'scene.ruins.hunger',
  conditions: [condFoodGte(4)],
  weight: 1,
  risk: 'low',
  choices: [
    {
      id: 'hunger.feed_all',
      title: '全员进食',
      description: '每名存活英雄消耗 1 食物,少量恢复 HP。',
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗每人 1 食物。' }],
      costs: [{ kind: 'food-delta', amount: -4 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'food-delta', amount: -4 },
            { kind: 'heal-percent', amount: 15 },
          ],
          narrativeHint: '所有人恢复精神。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'hunger.save',
      title: '节省口粮',
      description: '只消耗 2 食物,优先照顾状态最差英雄。',
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 2 食物。' }],
      costs: [{ kind: 'food-delta', amount: -2 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'food-delta', amount: -2 },
            { kind: 'heal-percent', amount: 10 },
            { kind: 'set-flag', flagName: 'short-meal', flagValue: true },
          ],
          narrativeHint: '勉强撑过去。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

const HUNGER_STARVE: EventDef = {
  id: 'hunger_starve',
  trigger: 'manual',
  title: '队伍极度饥饿',
  description: '食物已耗尽,继续前进会严重损耗队伍。',
  sceneId: 'scene.ruins.hunger.starve',
  conditions: [condFoodLt(1)],
  weight: 1,
  risk: 'high',
  choices: [
    {
      id: 'hunger.starve.push',
      title: '忍饥前进',
      description: '不消耗食物,全队损失最大 HP 百分比。',
      riskPreview: [{ kind: 'injury', severity: 'high', description: '全员 HP 大幅下降。' }],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'hp-delta', amount: -5 },
            { kind: 'set-flag', flagName: 'starving', flagValue: true },
          ],
          narrativeHint: '队伍精疲力竭。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'hunger.starve.retreat',
      title: '撤退',
      description: '返回地表。',
      riskPreview: [{ kind: 'lost-time', severity: 'low', description: '放弃任务。' }],
      costs: [],
      outcomeTable: [
        {
          weight: 1,
          effects: [{ kind: 'request-retreat' }],
          narrativeHint: '放弃任务。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

// =====================================================================
// 火把(SPEC §9.2)
// =====================================================================

const TORCH_LOW: EventDef = {
  id: 'torch_low',
  trigger: 'torch-low',
  title: '火把渐暗',
  description: '火把只剩下一丝光亮。继续前进会更容易被伏击。',
  sceneId: 'scene.ruins.torch_low',
  conditions: [condTorchLt(26), condTorchGte(1)],
  weight: 1,
  risk: 'medium',
  choices: [
    {
      id: 'torch.low.light',
      title: '点燃火把',
      description: '消耗 1 火把,恢复 25 点光照。',
      conditions: [condHas('torch')],
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 火把。' }],
      costs: [{ kind: 'take-item', itemId: 'torch', count: 1 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'take-item', itemId: 'torch', count: 1 },
            { kind: 'torch-delta', amount: 25 },
          ],
          narrativeHint: '火把重新燃起。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'torch.low.careful',
      title: '小心前进',
      description: '不消耗火把,伏击风险提高。',
      riskPreview: [{ kind: 'ambush', severity: 'medium', description: '伏击风险提高。' }],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'consume-time', amount: 1 },
            { kind: 'set-flag', flagName: 'torch-low-risk', flagValue: true },
          ],
          narrativeHint: '放慢脚步。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'torch.low.rush',
      title: '冒险快速通过',
      description: '伏击与伤害风险提高。',
      riskPreview: [{ kind: 'ambush', severity: 'high', description: '高伏击风险。' }],
      costs: [],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'set-flag', flagName: 'torch-low-risk', flagValue: 2 },
          ],
          narrativeHint: '在黑暗中狂奔。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

const TORCH_BLACKOUT: EventDef = {
  id: 'torch_blackout',
  trigger: 'torch-low',
  title: '火把熄灭',
  description: '火把彻底熄灭,陷入完全的黑暗。',
  sceneId: 'scene.ruins.torch_blackout',
  conditions: [condTorchLt(1)],
  weight: 1,
  risk: 'extreme',
  choices: [
    {
      id: 'torch.black.light',
      title: '立刻点燃火把',
      description: '消耗 1 火把。',
      conditions: [condHas('torch')],
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 火把。' }],
      costs: [{ kind: 'take-item', itemId: 'torch', count: 1 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'take-item', itemId: 'torch', count: 1 },
            { kind: 'torch-delta', amount: 25 },
          ],
          narrativeHint: '火把重新燃起。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'torch.black.sacrifice',
      title: '用绷带做临时火把',
      description: '消耗 1 绷带,只恢复 10 点光照。',
      conditions: [condHas('bandage')],
      riskPreview: [{ kind: 'consume', severity: 'medium', description: '消耗 1 绷带。' }],
      costs: [{ kind: 'take-item', itemId: 'bandage', count: 1 }],
      outcomeTable: [
        {
          weight: 10,
          effects: [
            { kind: 'take-item', itemId: 'bandage', count: 1 },
            { kind: 'torch-delta', amount: 10 },
          ],
          narrativeHint: '临时火光。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

// =====================================================================
// 背包取舍(SPEC §21.4)
// =====================================================================

const INVENTORY_FULL_DROP: EventDef = {
  id: 'inventory_full_drop',
  trigger: 'manual',
  title: '背包已满',
  description: '背包已经没有空间。需要决定取舍。',
  sceneId: 'scene.ruins.inventory_full',
  conditions: [],
  weight: 1,
  risk: 'low',
  choices: [
    {
      id: 'inv.drop.gold',
      title: '丢弃金块',
      description: '放弃金块腾出空间。',
      riskPreview: [{ kind: 'consume', severity: 'low', description: '丢失金块。' }],
      costs: [{ kind: 'item-delta', itemId: 'gold', amount: -2 }],
      outcomeTable: [
        {
          weight: 1,
          effects: [{ kind: 'item-delta', itemId: 'gold', amount: -2 }],
          narrativeHint: '丢下金块。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'inv.drop.food',
      title: '丢弃 1 食物',
      description: '丢一份口粮。',
      riskPreview: [{ kind: 'consume', severity: 'low', description: '丢失 1 食物。' }],
      costs: [{ kind: 'item-delta', itemId: 'food', amount: -1 }],
      outcomeTable: [
        {
          weight: 1,
          effects: [{ kind: 'item-delta', itemId: 'food', amount: -1 }],
          narrativeHint: '丢掉一份口粮。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'inv.use.bandage',
      title: '立刻使用绷带',
      description: '在原地使用绷带治疗。',
      conditions: [condHas('bandage')],
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 绷带。' }],
      costs: [{ kind: 'take-item', itemId: 'bandage', count: 1 }],
      outcomeTable: [
        {
          weight: 1,
          effects: [
            { kind: 'take-item', itemId: 'bandage', count: 1 },
            { kind: 'heal-percent', amount: 20 },
          ],
          narrativeHint: '绷带被用掉。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

const INVENTORY_OVERFLOW_CURIO: EventDef = {
  id: 'inventory_overflow_curio',
  trigger: 'manual',
  title: '奇物太多',
  description: '在书架上找到一些补给,但背包已满。',
  sceneId: 'scene.ruins.inventory_overflow',
  conditions: [],
  weight: 1,
  risk: 'low',
  choices: [
    {
      id: 'inv.overflow.drop',
      title: '丢弃绷带',
      description: '腾出空间给新物品。',
      riskPreview: [{ kind: 'consume', severity: 'low', description: '丢失 1 绷带。' }],
      costs: [{ kind: 'item-delta', itemId: 'bandage', amount: -1 }],
      outcomeTable: [
        {
          weight: 1,
          effects: [
            { kind: 'item-delta', itemId: 'bandage', amount: -1 },
            { kind: 'give-item', itemId: 'antivenom', count: 1 },
          ],
          narrativeHint: '腾出空间,获得解毒剂。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'inv.overflow.leave',
      title: '放弃战利品',
      description: '不要了。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 1,
          effects: [],
          narrativeHint: '空着手离开。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

// =====================================================================
// 任务目标(SPEC §22)
// =====================================================================

const OBJECTIVE_ACTIVATE_ALTAR: EventDef = {
  id: 'objective_activate_altar',
  trigger: 'node-enter',
  title: '激活古老祭坛',
  description: '祭坛等待被激活。',
  sceneId: 'scene.ruins.altar_activate',
  conditions: [],
  weight: 1,
  oncePerExpedition: true,
  risk: 'low',
  choices: [
    {
      id: 'objective.activate',
      title: '激活祭坛',
      description: '主要任务完成。',
      riskPreview: [],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        {
          weight: 1,
          effects: [
            { kind: 'complete-objective', targetId: 'objective_activate_altar' },
            { kind: 'give-item', itemId: 'gold', count: 2 },
          ],
          narrativeHint: '祭坛被激活。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'objective.skip',
      title: '搜刮后离开',
      description: '不激活,直接撤。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 1,
          effects: [],
          narrativeHint: '直接离开。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

// =====================================================================
// 撤退(SPEC §1.5)
// =====================================================================

const RETREAT_CONFIRM: EventDef = {
  id: 'retreat_confirm',
  trigger: 'manual',
  title: '确认撤退',
  description: '放弃任务,带着队伍返回地表。',
  sceneId: 'scene.ruins.retreat',
  conditions: [],
  weight: 1,
  risk: 'low',
  choices: [
    {
      id: 'retreat.yes',
      title: '确认撤退',
      description: '返回入口,任务失败但队伍安全。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 1,
          effects: [{ kind: 'request-retreat' }],
          narrativeHint: '队伍转身。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'retreat.no',
      title: '继续前进',
      description: '不撤退。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 1,
          effects: [],
          narrativeHint: '继续。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

// =====================================================================
// 遭遇战术选择(SPEC §14 §15)
// =====================================================================

/** 正面突破 */
const TACTICAL_ASSAULT: EventDef = {
  id: 'tactical_assault',
  trigger: 'manual',
  title: '正面突破',
  description: '让前排英雄发动直攻,主要执行者:十字军或前排。',
  sceneId: 'scene.ruins.tactical.assault',
  conditions: [],
  weight: 10,
  risk: 'medium',
  choices: [
    {
      id: 'tactical.assault.commit',
      title: '执行正面突破',
      description: '自动结算 1 轮。',
      riskPreview: [
        { kind: 'enemy-react', severity: 'medium', description: '敌方前排获得反击机会。' },
      ],
      costs: [],
      outcomeTable: [{ weight: 1, effects: [{ kind: 'reveal-next-node' }] }],
      terminatesEvent: true,
    },
  ],
};

/** 压制后排 */
const TACTICAL_BACKLINE: EventDef = {
  id: 'tactical_backline',
  trigger: 'manual',
  title: '压制后排',
  description: '让强盗或瘟疫医生优先攻击后排。',
  sceneId: 'scene.ruins.tactical.backline',
  conditions: [],
  weight: 10,
  risk: 'medium',
  choices: [
    {
      id: 'tactical.backline.commit',
      title: '执行压制后排',
      description: '自动结算 1 轮。',
      riskPreview: [
        { kind: 'enemy-react', severity: 'medium', description: '敌方前排获得行动机会。' },
      ],
      costs: [],
      outcomeTable: [{ weight: 1, effects: [{ kind: 'reveal-next-node' }] }],
      terminatesEvent: true,
    },
  ],
};

/** 控制 */
const TACTICAL_CONTROL: EventDef = {
  id: 'tactical_control',
  trigger: 'manual',
  title: '控制敌方',
  description: '瘟疫医生或带眩晕技能英雄施加 DOT 与眩晕。',
  sceneId: 'scene.ruins.tactical.control',
  conditions: [],
  weight: 8,
  risk: 'low',
  choices: [
    {
      id: 'tactical.control.commit',
      title: '执行控制方案',
      description: '自动结算 1 轮。',
      riskPreview: [
        { kind: 'enemy-react', severity: 'low', description: '直接伤害较低。' },
      ],
      costs: [],
      outcomeTable: [{ weight: 1, effects: [{ kind: 'reveal-next-node' }] }],
      terminatesEvent: true,
    },
  ],
};

/** 稳住队伍 */
const TACTICAL_STABILIZE: EventDef = {
  id: 'tactical_stabilize',
  trigger: 'manual',
  title: '稳住队伍',
  description: '让修女治疗或清除状态。',
  sceneId: 'scene.ruins.tactical.stabilize',
  conditions: [],
  weight: 8,
  risk: 'low',
  choices: [
    {
      id: 'tactical.stabilize.commit',
      title: '执行稳住队伍',
      description: '自动结算 1 轮。',
      riskPreview: [
        { kind: 'enemy-react', severity: 'medium', description: '敌方获得较完整行动。' },
      ],
      costs: [],
      outcomeTable: [{ weight: 1, effects: [{ kind: 'reveal-next-node' }] }],
      terminatesEvent: true,
    },
  ],
};

/** 调整阵型 */
const TACTICAL_REFORM: EventDef = {
  id: 'tactical_reform',
  trigger: 'manual',
  title: '调整阵型',
  description: '恢复关键英雄合法站位,敌方可能获得低强度反应。',
  sceneId: 'scene.ruins.tactical.reform',
  conditions: [],
  weight: 6,
  risk: 'low',
  choices: [
    {
      id: 'tactical.reform.commit',
      title: '执行调整阵型',
      description: '自动结算 1 轮。',
      riskPreview: [
        { kind: 'formation-break', severity: 'low', description: '阵型已乱,需要时间恢复。' },
      ],
      costs: [],
      outcomeTable: [{ weight: 1, effects: [{ kind: 'reveal-next-node' }] }],
      terminatesEvent: true,
    },
  ],
};

/** 使用补给 */
const TACTICAL_USE_ITEM: EventDef = {
  id: 'tactical_use_item',
  trigger: 'manual',
  title: '使用补给',
  description: '使用绷带 / 解毒剂等改变本轮结果。',
  sceneId: 'scene.ruins.tactical.use_item',
  conditions: [],
  weight: 4,
  risk: 'low',
  choices: [
    {
      id: 'tactical.use_item.bandage',
      title: '使用绷带',
      description: '消耗 1 绷带,治疗 20% HP。',
      conditions: [condHas('bandage')],
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 绷带。' }],
      costs: [{ kind: 'take-item', itemId: 'bandage', count: 1 }],
      outcomeTable: [
        {
          weight: 1,
          effects: [
            { kind: 'take-item', itemId: 'bandage', count: 1 },
            { kind: 'heal-percent', amount: 20 },
          ],
          narrativeHint: '绷带被使用。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'tactical.use_item.antivenom',
      title: '使用解毒剂',
      description: '消耗 1 解毒剂,清除腐蚀。',
      conditions: [condHas('antivenom')],
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 解毒剂。' }],
      costs: [{ kind: 'take-item', itemId: 'antivenom', count: 1 }],
      outcomeTable: [
        {
          weight: 1,
          effects: [{ kind: 'take-item', itemId: 'antivenom', count: 1 }],
          narrativeHint: '腐蚀被清除。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 尝试撤离 */
const TACTICAL_RETREAT: EventDef = {
  id: 'tactical_retreat',
  trigger: 'manual',
  title: '尝试撤离',
  description: '根据速度、火把、敌人控制结算撤离成功率。',
  sceneId: 'scene.ruins.tactical.retreat',
  conditions: [],
  weight: 3,
  risk: 'high',
  choices: [
    {
      id: 'tactical.retreat.commit',
      title: '执行撤离',
      description: '自动结算撤离。',
      riskPreview: [
        { kind: 'injury', severity: 'high', description: '可能有人掉队。' },
      ],
      costs: [],
      outcomeTable: [
        {
          weight: 1,
          effects: [
            { kind: 'consume-time', amount: 2 },
            { kind: 'torch-delta', amount: -10 },
          ],
          narrativeHint: '尝试撤离。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

// =====================================================================
// Phase 2 内容事件(SPEC §28.3)
//
// 11 个精神/死亡相关事件:
//   - 2 low-torch mental events(torch-low trigger)
//   - 2 party dispute events(manual trigger)
//   - 2 virtue inspiration events(manual trigger)
//   - 1 heart attack event(manual trigger)
//   - 2 deaths-door scenarios(manual trigger)
//   - 2 hero death follow-up(manual trigger)
//
// 触发说明:Phase 2.x 注册到 EVENT_REGISTRY 但不自动派发。
// Phase 3 庄园周循环接入后,根据条件自动 fire;目前可由 DEBUG_FIRE_EVENT 触发。
// =====================================================================

/** 低火把 - 听见低语 */
const MENTAL_LOW_TORCH_WHISPERS: EventDef = {
  id: 'mental_low_torch_whispers',
  trigger: 'torch-low',
  title: '走廊里的低语',
  description: '火光摇曳,墙缝里传出细碎的呢喃。',
  sceneId: 'scene.ruins.mental.whispers',
  conditions: [always],
  weight: 8,
  risk: 'medium',
  choices: [
    {
      id: 'mental.whispers.investigate',
      title: '仔细听辨',
      description: '停下脚步,屏息倾听。',
      riskPreview: [{ kind: 'trap', severity: 'medium', description: '可能被幻觉迷惑。' }],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        {
          weight: 5,
          effects: [],
          narrativeHint: '只是风穿过裂缝,松了口气。',
        },
        {
          weight: 5,
          effects: [{ kind: 'apply-stress', heroId: 'hero.vestal', amount: 8, narrativeHint: '低语幻觉' }],
          narrativeHint: '低语变得清晰——是同伴的名字,声音充满了悔恨。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'mental.whispers.ignore',
      title: '继续前进',
      description: '不回头,加快脚步。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 1,
          effects: [],
          narrativeHint: '你选择不去相信。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 低火把 - 蜡烛摇曳 */
const MENTAL_LOW_TORCH_CANDLE: EventDef = {
  id: 'mental_low_torch_candle',
  trigger: 'torch-low',
  title: '蜡烛摇曳',
  description: '手中的蜡烛突然自行熄灭,只剩烟气。',
  sceneId: 'scene.ruins.mental.candle',
  conditions: [always],
  weight: 6,
  risk: 'medium',
  choices: [
    {
      id: 'mental.candle.relight',
      title: '用火把重新点燃',
      description: '消耗一点火把,让队伍镇定。',
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 5 火把。' }],
      costs: [{ kind: 'torch-delta', amount: -5, narrativeHint: '重新点燃蜡烛' }],
      outcomeTable: [
        {
          weight: 7,
          effects: [{ kind: 'apply-stress', heroId: 'hero.vestal', amount: -3, narrativeHint: '镇定队员' }],
          narrativeHint: '光亮回来,队伍情绪稳定。',
        },
        {
          weight: 3,
          effects: [{ kind: 'apply-stress', heroId: 'hero.vestal', amount: 5, narrativeHint: '阴影注视' }],
          narrativeHint: '光再次亮起时,似乎有什么东西在墙角缩回去。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'mental.candle.darkness',
      title: '在黑暗中前进',
      description: '不再点火,凭记忆摸索。',
      riskPreview: [{ kind: 'ambush', severity: 'high', description: '黑暗中容易被伏击。' }],
      costs: [],
      outcomeTable: [
        {
          weight: 4,
          effects: [],
          narrativeHint: '在黑暗中摸索,但安全走过。',
        },
        {
          weight: 6,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.plague_doctor', amount: 10, narrativeHint: '黑暗恐惧' },
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: 6, narrativeHint: '黑暗恐惧' },
          ],
          narrativeHint: '黑暗压迫着所有人,瘟疫医生开始颤抖。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 队伍争执 - 谁该负责 */
const PARTY_DISPUTE_BLAME: EventDef = {
  id: 'party_dispute_blame',
  trigger: 'manual',
  title: '互相指责',
  description: '队伍在前一个房间险些陷入陷阱,十字军与强盗开始互相推诿。',
  sceneId: 'scene.ruins.mental.dispute',
  conditions: [always],
  weight: 4,
  risk: 'low',
  choices: [
    {
      id: 'mental.dispute.mediate',
      title: '修女出面调解',
      description: '让修女以信念缓解对峙。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 6,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.crusader', amount: -3, narrativeHint: '修女调解' },
            { kind: 'apply-stress', heroId: 'hero.highwayman', amount: -3, narrativeHint: '修女调解' },
          ],
          narrativeHint: '修女以柔和的言语让两人冷静。',
        },
        {
          weight: 4,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.crusader', amount: 5, narrativeHint: '争执升级' },
            { kind: 'apply-stress', heroId: 'hero.highwayman', amount: 5, narrativeHint: '争执升级' },
          ],
          narrativeHint: '修女的劝解反而激怒了双方。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'mental.dispute.ignore',
      title: '让他们自己消化',
      description: '不介入,相信老兵会自己解决。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 7,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.crusader', amount: -2, narrativeHint: '自我消化' },
            { kind: 'apply-stress', heroId: 'hero.highwayman', amount: -2, narrativeHint: '自我消化' },
          ],
          narrativeHint: '短暂的沉默后,两人相视一笑,回到各自岗位。',
        },
        {
          weight: 3,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: 4, narrativeHint: '目睹争执' },
            { kind: 'apply-stress', heroId: 'hero.plague_doctor', amount: 4, narrativeHint: '目睹争执' },
          ],
          narrativeHint: '队友的冲突被其他人看在眼里,士气下降。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 队伍争执 - 路线分歧 */
const PARTY_DISPUTE_ROUTE: EventDef = {
  id: 'party_dispute_route',
  trigger: 'manual',
  title: '路线分歧',
  description: '前方分叉,十字军要走左边的窄道,强盗坚持走右边的通道。',
  sceneId: 'scene.ruins.mental.route',
  conditions: [always],
  weight: 4,
  risk: 'low',
  choices: [
    {
      id: 'mental.route.crusader',
      title: '跟十字军走窄道',
      description: '信任前排战士的直觉。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 6,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.highwayman', amount: 4, narrativeHint: '路线被否决' },
          ],
          narrativeHint: '强盗嘟囔着,勉强跟上了十字军。',
        },
        {
          weight: 4,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.crusader', amount: 2, narrativeHint: '路线成功' },
            { kind: 'apply-stress', heroId: 'hero.highwayman', amount: -2, narrativeHint: '路线成功' },
          ],
          narrativeHint: '窄道通向一个隐藏房间,里面有补给。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'mental.route.highwayman',
      title: '听强盗的建议',
      description: '强盗的判断往往更贴近实际。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 6,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.crusader', amount: 4, narrativeHint: '路线被否决' },
          ],
          narrativeHint: '十字军咬着牙接受了强盗的方案。',
        },
        {
          weight: 4,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.crusader', amount: -2, narrativeHint: '路线成功' },
            { kind: 'apply-stress', heroId: 'hero.highwayman', amount: 2, narrativeHint: '路线成功' },
          ],
          narrativeHint: '通道里安全通过,强盗吹起了口哨。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 美德激励 - 坚定 */
const VIRTUE_STEADFAST_INSPIRE: EventDef = {
  id: 'virtue_steadfast_inspire',
  trigger: 'manual',
  title: '坚定的话语',
  description: '修女在队伍中念诵经文,声音平静而有力。',
  sceneId: 'scene.ruins.virtue.steadfast',
  conditions: [always],
  weight: 3,
  risk: 'low',
  choices: [
    {
      id: 'virtue.steadfast.join',
      title: '一起祈祷',
      description: '所有人加入,稳定团队。',
      riskPreview: [],
      costs: [{ kind: 'consume-time', amount: 1 }],
      outcomeTable: [
        {
          weight: 8,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.crusader', amount: -10, narrativeHint: '坚定祈祷' },
            { kind: 'apply-stress', heroId: 'hero.highwayman', amount: -10, narrativeHint: '坚定祈祷' },
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: -8, narrativeHint: '坚定祈祷' },
            { kind: 'apply-stress', heroId: 'hero.plague_doctor', amount: -10, narrativeHint: '坚定祈祷' },
          ],
          narrativeHint: '每个人的心里都安定了些。',
        },
        {
          weight: 2,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: 3, narrativeHint: '反思信仰' },
          ],
          narrativeHint: '修女在经文中反思自己,一时更加沉重。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 美德激励 - 勇猛 */
const VIRTUE_VALOROUS_SHOUT: EventDef = {
  id: 'virtue_valorous_shout',
  trigger: 'manual',
  title: '勇猛的呼喊',
  description: '强盗在战斗间歇高举拳头,激励队友。',
  sceneId: 'scene.ruins.virtue.valorous',
  conditions: [always],
  weight: 3,
  risk: 'low',
  choices: [
    {
      id: 'virtue.valorous.respond',
      title: '响应号召',
      description: '所有人为之一振。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 9,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.crusader', amount: -8, narrativeHint: '勇猛激励' },
            { kind: 'apply-stress', heroId: 'hero.highwayman', amount: -5, narrativeHint: '勇猛激励' },
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: -8, narrativeHint: '勇猛激励' },
            { kind: 'apply-stress', heroId: 'hero.plague_doctor', amount: -8, narrativeHint: '勇猛激励' },
          ],
          narrativeHint: '团队士气高涨,准备迎接下一次挑战。',
        },
        {
          weight: 1,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.highwayman', amount: 4, narrativeHint: '空洞' },
          ],
          narrativeHint: '强盗的呼喊在回声中显得空洞,反而让人压抑。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 心脏病 - 英雄踉跄 */
const HEART_ATTACK_STUMBLE: EventDef = {
  id: 'heart_attack_stumble',
  trigger: 'manual',
  title: '英雄突然倒下',
  description: '修女捂住胸口,突然倒在地上。',
  sceneId: 'scene.ruins.mental.heart_attack',
  conditions: [always],
  weight: 2,
  risk: 'high',
  choices: [
    {
      id: 'heart.stumble.stabilize',
      title: '队友立刻围上',
      description: '让瘟疫医生紧急处理,十字军警戒。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 5,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: 25, narrativeHint: '心脏病触发' },
          ],
          narrativeHint: '修女的心脏剧烈跳动——她已经很久没承受过这种压力。',
        },
        {
          weight: 5,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: 30, narrativeHint: '心脏病+1' },
          ],
          narrativeHint: '修女当场心脏病发作,跪倒在地,只能勉强呼吸。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 死亡之门 - 紧急救治 */
const DEATHS_DOOR_EMERGENCY: EventDef = {
  id: 'deaths_door_emergency',
  trigger: 'manual',
  title: '紧急救治',
  description: '十字军倒下了——他还有呼吸,但很微弱。任何治疗都可能救他一命。',
  sceneId: 'scene.ruins.deaths_door.emergency',
  conditions: [always],
  weight: 1,
  risk: 'extreme',
  choices: [
    {
      id: 'deaths_door.emergency.heal',
      title: '立刻使用绷带',
      description: '消耗 1 绷带,把他从死亡之门拉回来。',
      riskPreview: [{ kind: 'consume', severity: 'low', description: '消耗 1 绷带。' }],
      conditions: [condHas('bandage')],
      costs: [{ kind: 'take-item', itemId: 'bandage', count: 1 }],
      outcomeTable: [
        {
          weight: 1,
          effects: [],
          narrativeHint: '绷带覆盖了伤口,十字军恢复了一些血量。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'deaths_door.emergency.watch',
      title: '观望等待',
      description: '不立刻治疗,看他是否能自己撑过来。',
      riskPreview: [{ kind: 'injury', severity: 'extreme', description: '可能再次受击致死。' }],
      costs: [],
      outcomeTable: [
        {
          weight: 3,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: 5, narrativeHint: '观望焦虑' },
            { kind: 'apply-stress', heroId: 'hero.plague_doctor', amount: 5, narrativeHint: '观望焦虑' },
          ],
          narrativeHint: '十字军仍然在呼吸,所有人都捏了一把汗。',
        },
        {
          weight: 7,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: 8, narrativeHint: '十字军濒死' },
            { kind: 'apply-stress', heroId: 'hero.plague_doctor', amount: 8, narrativeHint: '十字军濒死' },
          ],
          narrativeHint: '十字军的呼吸越来越弱,死亡随时降临。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 死亡之门 - 掩护 */
const DEATHS_DOOR_COVER: EventDef = {
  id: 'deaths_door_cover',
  trigger: 'manual',
  title: '掩护伤员',
  description: '十字军倒下了,强盗挡在他前面。',
  sceneId: 'scene.ruins.deaths_door.cover',
  conditions: [always],
  weight: 1,
  risk: 'high',
  choices: [
    {
      id: 'deaths_door.cover.stand',
      title: '强盗坚守',
      description: '让强盗吸引火力。',
      riskPreview: [{ kind: 'injury', severity: 'high', description: '强盗可能受伤。' }],
      costs: [],
      outcomeTable: [
        {
          weight: 6,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.highwayman', amount: 3, narrativeHint: '掩护压力' },
          ],
          narrativeHint: '强盗成功吸引了敌人的注意力,十字军暂时安全。',
        },
        {
          weight: 4,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.highwayman', amount: 8, narrativeHint: '掩护受击' },
            { kind: 'apply-stress', heroId: 'hero.crusader', amount: 3, narrativeHint: '连累十字军' },
          ],
          narrativeHint: '强盗挡住了大部分攻击,但自己也中了一刀。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 英雄死亡后续 - 拾取遗物 */
const HERO_DEATH_PICKUP: EventDef = {
  id: 'hero_death_pickup',
  trigger: 'manual',
  title: '拾取遗物',
  description: '十字军倒下的地方散落着他的武器和圣徽。',
  sceneId: 'scene.ruins.death.pickup',
  conditions: [always],
  weight: 1,
  risk: 'low',
  choices: [
    {
      id: 'death.pickup.take',
      title: '拾取并带走',
      description: '把十字军的遗物收进背包,带走他的记忆。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 1,
          effects: [
            { kind: 'give-item', itemId: 'gold', count: 2, narrativeHint: '十字军遗物' },
          ],
          narrativeHint: '你收下了他的徽章——它将在下次冒险中带来好运。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'death.pickup.leave',
      title: '不带任何东西',
      description: '让十字军安息。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 1,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: 4, narrativeHint: '留物之痛' },
          ],
          narrativeHint: '修女低头祈祷,所有人默默注视十字军。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};

/** 英雄死亡后续 - 放弃遗体 */
const HERO_DEATH_ABANDON: EventDef = {
  id: 'hero_death_abandon',
  trigger: 'manual',
  title: '放弃遗体',
  description: '十字军的遗体沉重,带走会拖慢队伍。',
  sceneId: 'scene.ruins.death.abandon',
  conditions: [always],
  weight: 1,
  risk: 'medium',
  choices: [
    {
      id: 'death.abandon.carry',
      title: '坚持带走',
      description: '即使再慢,也要带他回家。',
      riskPreview: [{ kind: 'lost-time', severity: 'medium', description: '更多时间消耗。' }],
      costs: [{ kind: 'consume-time', amount: 2 }],
      outcomeTable: [
        {
          weight: 1,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: -3, narrativeHint: '陪伴慰藉' },
            { kind: 'apply-stress', heroId: 'hero.plague_doctor', amount: -3, narrativeHint: '陪伴慰藉' },
          ],
          narrativeHint: '所有人为十字军送行,心中多了一份慰藉。',
        },
      ],
      terminatesEvent: true,
    },
    {
      id: 'death.abandon.leave',
      title: '就地掩埋',
      description: '完成一个简单的仪式后,继续前进。',
      riskPreview: [],
      costs: [],
      outcomeTable: [
        {
          weight: 1,
          effects: [
            { kind: 'apply-stress', heroId: 'hero.crusader', amount: 4, narrativeHint: '老兵哀伤' },
            { kind: 'apply-stress', heroId: 'hero.vestal', amount: 5, narrativeHint: '修道哀伤' },
          ],
          narrativeHint: '十字架被插在坟墓上,每个人都低下头。',
        },
      ],
      terminatesEvent: true,
    },
  ],
};



export const EVENT_REGISTRY: Record<string, EventDef> = {
  // 陷阱
  trap_pressure_plate: TRAP_PRESSURE_PLATE,
  trap_arrow_wall: TRAP_ARROW,
  trap_pitfall: TRAP_PITFALL,
  // 奇物
  curio_desecrated_altar: CURIO_ALTAR,
  curio_locked_chest: CURIO_LOCKED_CHEST,
  curio_moldy_bookshelf: CURIO_BOOKSHELF,
  // 路障
  obstacle_debris: OBSTACLE_DEBRIS,
  obstacle_pressure_door: OBSTACLE_PRESSURE_DOOR,
  // 饥饿
  hunger_full_meal: HUNGER_FULL_MEAL,
  hunger_starve: HUNGER_STARVE,
  // 火把
  torch_low: TORCH_LOW,
  torch_blackout: TORCH_BLACKOUT,
  // 背包
  inventory_full_drop: INVENTORY_FULL_DROP,
  inventory_overflow_curio: INVENTORY_OVERFLOW_CURIO,
  // 任务
  objective_activate_altar: OBJECTIVE_ACTIVATE_ALTAR,
  // 撤退
  retreat_confirm: RETREAT_CONFIRM,
  // 战术
  tactical_assault: TACTICAL_ASSAULT,
  tactical_backline: TACTICAL_BACKLINE,
  tactical_control: TACTICAL_CONTROL,
  tactical_stabilize: TACTICAL_STABILIZE,
  tactical_reform: TACTICAL_REFORM,
  tactical_use_item: TACTICAL_USE_ITEM,
  tactical_retreat: TACTICAL_RETREAT,
  // Phase 2 内容事件
  mental_low_torch_whispers: MENTAL_LOW_TORCH_WHISPERS,
  mental_low_torch_candle: MENTAL_LOW_TORCH_CANDLE,
  party_dispute_blame: PARTY_DISPUTE_BLAME,
  party_dispute_route: PARTY_DISPUTE_ROUTE,
  virtue_steadfast_inspire: VIRTUE_STEADFAST_INSPIRE,
  virtue_valorous_shout: VIRTUE_VALOROUS_SHOUT,
  heart_attack_stumble: HEART_ATTACK_STUMBLE,
  deaths_door_emergency: DEATHS_DOOR_EMERGENCY,
  deaths_door_cover: DEATHS_DOOR_COVER,
  hero_death_pickup: HERO_DEATH_PICKUP,
  hero_death_abandon: HERO_DEATH_ABANDON,
};

export function getEventDef(id: string): EventDef | undefined {
  return EVENT_REGISTRY[id];
}

/** 标准战术选项 id(遭遇生成时使用) */
export const STANDARD_TACTICAL_CHOICE_IDS = [
  'tactical_assault',
  'tactical_backline',
  'tactical_control',
  'tactical_stabilize',
];

/** 条件性注入的战术选项 */
export const CONDITIONAL_TACTICAL_CHOICE_IDS = [
  'tactical_reform',
  'tactical_use_item',
  'tactical_retreat',
];

/** SPEC §14 列出 7 类;这里 4+3 = 7,符合 */
