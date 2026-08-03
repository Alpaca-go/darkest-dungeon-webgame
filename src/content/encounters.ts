/**
 * 遭遇定义(SPEC §20)
 *
 * Phase 1 至少 2 场:
 *   A 骸骨巡逻队(encounter.skeleton_patrol)
 *   B 墓室伏击(encounter.tomb_ambush)
 *
 * 敌阵使用旧版 enemies/lineup 的 actor id。遭遇自动结算时根据 formation
 * 创建临时 BattleActor 副本,挂在 GameState.encounter.actors 上。
 */

import type { EncounterDef } from '../game-engine/expedition/types.js';

export const ENCOUNTER_REGISTRY: Record<string, EncounterDef> = {
  'encounter.skeleton_patrol': {
    id: 'encounter.skeleton_patrol',
    name: '骸骨巡逻队',
    sceneId: 'scene.ruins.skeleton_patrol',
    description: '一支骸骨巡逻队挡住了通道。',
    enemyFormation: [
      'enemy.skeleton_defender',
      'enemy.skeleton_soldier',
      'enemy.cultist_acolyte',
      'enemy.crossbowman',
    ],
    tags: ['patrol', 'teaching'],
    expectedRounds: [2, 3],
    maxRounds: 4,
    difficulty: 'easy',
  },
  'encounter.tomb_ambush': {
    id: 'encounter.tomb_ambush',
    name: '墓室伏击',
    sceneId: 'scene.ruins.tomb_ambush',
    description: '墓室突然被黑暗吞没。弩箭声从墙壁的缝隙中响起。',
    enemyFormation: [
      'enemy.skeleton_defender',
      'enemy.skeleton_soldier',
      'enemy.cultist_acolyte',
      'enemy.crossbowman',
    ],
    tags: ['ambush', 'low-torch', 'formation-shake'],
    expectedRounds: [2, 4],
    maxRounds: 5,
    difficulty: 'medium',
  },
};

export function getEncounterDef(id: string): EncounterDef | undefined {
  return ENCOUNTER_REGISTRY[id];
}
