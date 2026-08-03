/**
 * HamletHomePage — 庄园主路由
 *
 * 根据 state.mode 切换到对应 panel:
 *  - hamlet-overview    → WeeklyOverviewPanel
 *  - hamlet-roster      → RosterPanel
 *  - hamlet-treatment   → TreatmentPanel
 *  - hamlet-recruit     → RecruitmentPanel
 *  - hamlet-upgrades    → UpgradePanel
 *  - hamlet-graveyard   → GraveyardPanel
 *  - hamlet-quest       → QuestSelectionPanel
 *  - hamlet-party       → PartyFormationPanel
 *  - hamlet-provision   → ProvisioningPanel
 *  - hamlet-summary     → WeeklyOverviewPanel(同步)
 *  - hamlet-debrief     → WeeklySummaryModal
 */

import { useGameStore, makeCommandId } from '../../store/game-store.js';
import { useUiStore } from '../../store/ui-store.js';
import { HamletTopBar } from './HamletTopBar.js';
import { WeeklyOverviewPanel } from './WeeklyOverviewPanel.js';
import { WeeklySummaryModal } from './WeeklySummaryModal.js';
import { RosterPanel } from './RosterPanel.js';
import { TreatmentPanel } from './TreatmentPanel.js';
import { RecruitmentPanel } from './RecruitmentPanel.js';
import { UpgradePanel } from './UpgradePanel.js';
import { GraveyardPanel } from './GraveyardPanel.js';
import { QuestSelectionPanel } from './QuestSelectionPanel.js';
import { PartyFormationPanel } from './PartyFormationPanel.js';
import { ProvisioningPanel } from './ProvisioningPanel.js';
import { HamletDebugPanel } from './HamletDebugPanel.js';

export function HamletHomePage() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const debugOpen = useUiStore((s) => s.debugOpen);
  const toggleDebug = useUiStore((s) => s.toggleDebug);

  // 调试开关
  // (UI store)

  const onNavigate = (
    mode: 'roster' | 'treatment' | 'recruitment' | 'upgrades' | 'graveyard' | 'quest-selection' | 'party-formation' | 'provisioning',
  ) => {
    dispatch({ type: 'SET_HAMLET_MODE', mode, commandId: makeCommandId('nav') });
  };

  // 根据 mode 路由
  const mode = state.mode;
  let content: React.ReactNode = null;
  if (mode === 'hamlet-overview' || mode === 'hamlet-summary') {
    content = <WeeklyOverviewPanel onNavigate={onNavigate} />;
  } else if (mode === 'hamlet-roster') {
    content = <RosterPanel />;
  } else if (mode === 'hamlet-treatment') {
    content = <TreatmentPanel />;
  } else if (mode === 'hamlet-recruit') {
    content = <RecruitmentPanel />;
  } else if (mode === 'hamlet-upgrades') {
    content = <UpgradePanel />;
  } else if (mode === 'hamlet-graveyard') {
    content = <GraveyardPanel />;
  } else if (mode === 'hamlet-quest') {
    content = <QuestSelectionPanel />;
  } else if (mode === 'hamlet-party') {
    content = <PartyFormationPanel />;
  } else if (mode === 'hamlet-provision') {
    content = <ProvisioningPanel />;
  }

  return (
    <div className="app-shell">
      <HamletTopBar onToggleDebug={toggleDebug} />
      <div className="hamlet-content">
        {content ?? <p className="muted">未知庄园模式: {mode}</p>}
      </div>
      {mode === 'hamlet-debrief' && <WeeklySummaryModal />}
      {debugOpen && <HamletDebugPanel onClose={toggleDebug} />}
    </div>
  );
}
