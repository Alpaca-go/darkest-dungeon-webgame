/**
 * 默认遗迹路线(SPEC §7)
 *
 * 10 节点、2 次分叉、1 条高风险支路、1 次可绕过遭遇、1 个任务目标、1 个出口。
 * Golden Expedition (DD-WEB-PHASE1-EXPEDITION-001) 走:
 *   N1 → N2(左谨慎) → N3(陷阱) → N4(宝箱) → N5(巡逻) → N6(饥饿)
 *   → N7(低火把) → N8(伏击) → N9(祭坛) → N10(出口)
 *
 * 节点序号:
 *   N1   start          入口
 *   N2   route-fork     第一次分叉
 *   N3   trap           陷阱(压力板)
 *   N4   curio          宝箱(需要万能钥匙)
 *   N5   encounter      骸骨巡逻队(遭遇 A)
 *   N6   hunger         饥饿(自动触发)
 *   N7   route-fork     第二次分叉
 *   N8   encounter      墓室伏击(遭遇 B)
 *   N9   objective      任务祭坛
 *   N10  exit           出口
 */

import type { ExpeditionRoute, RouteNode, RouteEdge, RouteFork } from '../../game-engine/expedition/types.js';

const NODES: RouteNode[] = [
  {
    id: 'N1_start',
    type: 'empty-room',
    sceneId: 'scene.ruins.entry',
    title: '遗迹入口',
    description: '坍塌的拱门后是一条向下延伸的通道。风从深处吹来,带着潮湿与陈旧。',
    baseScoutLevel: 'fully-scouted',
    weight: 1,
  },
  {
    id: 'N2_fork1',
    type: 'route-fork',
    sceneId: 'scene.ruins.corridor_fork',
    title: '通道分叉',
    description: '通道在脚下分成两条路。左侧有微弱的光,右侧黑暗且更狭窄。',
    baseScoutLevel: 'category-known',
    weight: 1,
    forkId: 'fork_1',
  },
  {
    id: 'N3_trap',
    type: 'trap',
    sceneId: 'scene.ruins.trap_pressure_plate',
    title: '金属压力板',
    description: '地上有金属触发器,走廊里很暗。',
    baseScoutLevel: 'vague',
    weight: 1,
    trapId: 'trap_pressure_plate',
  },
  {
    id: 'N4_curio',
    type: 'curio',
    sceneId: 'scene.ruins.curio_locked_chest',
    title: '锁住的古老宝箱',
    description: '一只布满锈迹的宝箱,锁头是失传的机关。',
    baseScoutLevel: 'category-known',
    weight: 1,
    curioId: 'curio_locked_chest',
  },
  {
    id: 'N5_patrol',
    type: 'encounter',
    sceneId: 'scene.ruins.skeleton_patrol',
    title: '骸骨巡逻队',
    description: '前方传来盔甲摩擦声。一支骸骨巡逻队挡住了通道。',
    baseScoutLevel: 'category-known',
    weight: 1,
    encounterDefId: 'encounter.skeleton_patrol',
  },
  {
    id: 'N6_hunger',
    type: 'hunger',
    sceneId: 'scene.ruins.empty_hall',
    title: '空荡大厅',
    description: '一间巨大的空厅。脚步声回荡。',
    baseScoutLevel: 'fully-scouted',
    weight: 1,
  },
  {
    id: 'N7_fork2',
    type: 'route-fork',
    sceneId: 'scene.ruins.torch_fork',
    title: '低火把区',
    description: '通道变得狭窄,空气阴冷。远处有微光但火把只够维持低光照。',
    baseScoutLevel: 'vague',
    weight: 1,
    forkId: 'fork_2',
  },
  {
    id: 'N8_ambush',
    type: 'encounter',
    sceneId: 'scene.ruins.tomb_ambush',
    title: '墓室伏击',
    description: '墓室突然被黑暗吞没。弩箭声从墙壁的缝隙中响起。',
    baseScoutLevel: 'unknown',
    weight: 1,
    encounterDefId: 'encounter.tomb_ambush',
  },
  {
    id: 'N9_altar',
    type: 'objective',
    sceneId: 'scene.ruins.altar',
    title: '古老祭坛',
    description: '一尊残破的祭坛浮在房间正中。任务目标就在眼前。',
    baseScoutLevel: 'fully-scouted',
    weight: 1,
    objectiveId: 'objective_activate_altar',
  },
  {
    id: 'N10_exit',
    type: 'exit',
    sceneId: 'scene.ruins.exit',
    title: '遗迹出口',
    description: '一道灰光从头顶的裂隙洒下。通往地表。',
    baseScoutLevel: 'fully-scouted',
    weight: 1,
  },
];

const EDGES: RouteEdge[] = [
  {
    id: 'E_N1_N2',
    from: 'N1_start',
    to: 'N2_fork1',
    timeCost: 1,
    baseTorchCost: 6,
    description: '继续深入。',
    riskTag: 'low',
    revealLevel: 'fully-scouted',
  },
  // fork1 (left_careful) → N3
  {
    id: 'E_N2_N3_left',
    from: 'N2_fork1',
    to: 'N3_trap',
    timeCost: 2,
    baseTorchCost: 8,
    description: '左侧谨慎路线,光照更稳定。',
    riskTag: 'low',
    revealLevel: 'category-known',
  },
  // fork1 (right_fast) → N5(跳过 trap + curio)
  {
    id: 'E_N2_N5_right',
    from: 'N2_fork1',
    to: 'N5_patrol',
    timeCost: 1,
    baseTorchCost: 10,
    description: '右侧快速路线,跳过陷阱和宝箱。',
    riskTag: 'medium',
    revealLevel: 'category-known',
  },
  // N3 → N4
  {
    id: 'E_N3_N4',
    from: 'N3_trap',
    to: 'N4_curio',
    timeCost: 1,
    baseTorchCost: 4,
    description: '解除陷阱后,继续向前。',
    riskTag: 'low',
    revealLevel: 'fully-scouted',
  },
  // N4 → N5
  {
    id: 'E_N4_N5',
    from: 'N4_curio',
    to: 'N5_patrol',
    timeCost: 1,
    baseTorchCost: 4,
    description: '从宝箱房向前。',
    riskTag: 'low',
    revealLevel: 'fully-scouted',
  },
  // N5 → N6
  {
    id: 'E_N5_N6',
    from: 'N5_patrol',
    to: 'N6_hunger',
    timeCost: 1,
    baseTorchCost: 4,
    description: '战斗结束后继续前进。',
    riskTag: 'low',
    revealLevel: 'fully-scouted',
  },
  // N6 → N7
  {
    id: 'E_N6_N7',
    from: 'N6_hunger',
    to: 'N7_fork2',
    timeCost: 1,
    baseTorchCost: 4,
    description: '通过空荡大厅。',
    riskTag: 'low',
    revealLevel: 'fully-scouted',
  },
  // fork2 (low_torch) → N8
  {
    id: 'E_N7_N8_low',
    from: 'N7_fork2',
    to: 'N8_ambush',
    timeCost: 1,
    baseTorchCost: 4,
    description: '沿主通道直行,火把渐暗。',
    riskTag: 'medium',
    revealLevel: 'vague',
  },
  // fork2 (high_risk) → N8(高风险高收益)
  {
    id: 'E_N7_N8_risky',
    from: 'N7_fork2',
    to: 'N8_ambush',
    timeCost: 2,
    baseTorchCost: 8,
    description: '绕道杂物间寻找战利品。',
    riskTag: 'high',
    revealLevel: 'unknown',
    isHighReward: true,
  },
  // N8 → N9
  {
    id: 'E_N8_N9',
    from: 'N8_ambush',
    to: 'N9_altar',
    timeCost: 1,
    baseTorchCost: 4,
    description: '通过伏击点,接近任务目标。',
    riskTag: 'low',
    revealLevel: 'fully-scouted',
  },
  // N9 → N10
  {
    id: 'E_N9_N10',
    from: 'N9_altar',
    to: 'N10_exit',
    timeCost: 1,
    baseTorchCost: 4,
    description: '激活祭坛后,直接撤向出口。',
    riskTag: 'low',
    revealLevel: 'fully-scouted',
  },
];

const FORKS: RouteFork[] = [
  {
    id: 'fork_1',
    nodeId: 'N2_fork1',
    description: '通道分成两条,选择你的方向。',
    options: [
      {
        edgeId: 'E_N2_N3_left',
        title: '左侧谨慎路线',
        description: '光照更稳定,但会经过陷阱与宝箱。',
        riskTag: 'low',
        rewardTag: 'medium',
      },
      {
        edgeId: 'E_N2_N5_right',
        title: '右侧快速路线',
        description: '跳过陷阱和宝箱,直接进入遭遇。',
        riskTag: 'medium',
        rewardTag: 'low',
      },
    ],
  },
  {
    id: 'fork_2',
    nodeId: 'N7_fork2',
    description: '通道分叉,前方面向低火把区域。',
    options: [
      {
        edgeId: 'E_N7_N8_low',
        title: '直行通过',
        description: '继续沿主通道推进,火把更暗。',
        riskTag: 'medium',
        rewardTag: 'low',
      },
      {
        edgeId: 'E_N7_N8_risky',
        title: '绕道杂物间',
        description: '寻找战利品,但有更高风险。',
        riskTag: 'high',
        rewardTag: 'high',
      },
    ],
  },
];

export const RUINS_ROUTE: ExpeditionRoute = {
  id: 'route.ruins.short',
  regionId: 'ruins',
  seed: 'route-ruins-seed',
  startNodeId: 'N1_start',
  objectiveNodeId: 'N9_altar',
  exitNodeIds: ['N10_exit'],
  nodes: Object.fromEntries(NODES.map((n) => [n.id, n])),
  edges: EDGES,
  forks: FORKS,
};

export function buildRuinsRoute(seedOverride?: string): ExpeditionRoute {
  // 路线结构是固定的(可复现),seedOverride 只用来标记本次远征的 seed
  return {
    ...RUINS_ROUTE,
    seed: seedOverride ?? RUINS_ROUTE.seed,
  };
}
