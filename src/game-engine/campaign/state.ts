/**
 * Phase 3 庄园状态机辅助
 *
 * Expedition 结束 → hamlet-debrief
 * hamlet-debrief → hamlet-overview(ADVANCE_WEEK)
 * hamlet-overview → 任意 hamlet 子页
 * 任意 hamlet → start-selected-expedition → expedition mode
 */

import type { GameState, GameViewMode } from '../expedition/types.js';
import type { CampaignState, HamletState, HamletMode } from './types.js';

const HAMLET_MODES: ReadonlySet<GameViewMode> = new Set([
  'hamlet-overview',
  'hamlet-roster',
  'hamlet-treatment',
  'hamlet-recruit',
  'hamlet-upgrades',
  'hamlet-graveyard',
  'hamlet-quest',
  'hamlet-party',
  'hamlet-provision',
  'hamlet-summary',
  'hamlet-debrief',
]);

export function isHamletMode(mode: GameViewMode): boolean {
  return HAMLET_MODES.has(mode);
}

/**
 * 在 hamlet 内部切换 mode(不退出 hamlet)。
 * HamletMode('weekly-summary' / 'roster' / ...) → GameViewMode('hamlet-*')
 */
export function setHamletMode(state: GameState, mode: HamletMode): void {
  if (!state.hamlet) {
    throw new Error('hamlet state not initialized');
  }
  state.hamlet.mode = mode;
  // 映射表:HamletMode → GameViewMode
  const map: Record<HamletMode, GameViewMode> = {
    'weekly-summary': 'hamlet-summary',
    roster: 'hamlet-roster',
    treatment: 'hamlet-treatment',
    recruitment: 'hamlet-recruit',
    upgrades: 'hamlet-upgrades',
    graveyard: 'hamlet-graveyard',
    'quest-selection': 'hamlet-quest',
    'party-formation': 'hamlet-party',
    provisioning: 'hamlet-provision',
  };
  state.mode = map[mode];
}

export function ensureCampaign(state: GameState): CampaignState {
  if (!state.campaign) throw new Error('campaign state not initialized');
  return state.campaign;
}

export function ensureHamlet(state: GameState): HamletState {
  if (!state.hamlet) throw new Error('hamlet state not initialized');
  return state.hamlet;
}
