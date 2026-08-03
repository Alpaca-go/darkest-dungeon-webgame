/**
 * BattlePage - 单页战斗主组件
 *
 * 把 UI 状态(选择/悬停)与游戏状态(battle)分离。
 * 不直接修改 battle state,只 dispatch 命令。
 */

import { useEffect, useMemo, useRef } from 'react';
import { useGameStore, makeCommandId } from '../../store/game-store.js';
import { useUiStore } from '../../store/ui-store.js';
import { buildBattleScreenViewModel } from '../../game-engine/selectors.js';
import { mapEventsToEffects } from '../../game-engine/presentation.js';
import { newCommandId } from '../../game-engine/commands.js';
import { decideAiAction } from '../../game-engine/battle/ai.js';
import { useSkill } from '../../game-engine/battle/skill.js';
import { BattleContext } from '../../game-engine/battle/context.js';
import { endTurn } from '../../game-engine/battle/round.js';
import { exportDebugPackage, saveBattle } from '../../persistence/save.js';

import { TopBar } from './TopBar.js';
import { ActorCard } from './ActorCard.js';
import { SkillBar } from './SkillBar.js';
import { InitiativePanel } from './InitiativePanel.js';
import { LogPanel } from './LogPanel.js';
import { ActiveActorPanel } from './ActiveActorPanel.js';
import { ResultModal } from './ResultModal.js';
import { EffectLayer } from './EffectLayer.js';
import { DebugPanel } from './DebugPanel.js';

const AI_DELAY_MS = 800;

export function BattlePage() {
  const battle = useGameStore((s) => s.battle);
  const seed = useGameStore((s) => s.seed);
  const dispatch = useGameStore((s) => s.dispatch);
  const startBattle = useGameStore((s) => s.startBattle);
  const restartSame = useGameStore((s) => s.restartWithSameSeed);
  const restartNew = useGameStore((s) => s.restartWithNewSeed);
  const startBattleWithState = useGameStore((s) => s.startBattleWithState);
  const lastError = useGameStore((s) => s.lastError);
  const clearError = useGameStore((s) => s.clearError);

  const selectedSkillId = useUiStore((s) => s.selectedSkillId);
  const setSelectedSkill = useUiStore((s) => s.setSelectedSkill);
  const debugOpen = useUiStore((s) => s.debugOpen);
  const toggleDebug = useUiStore((s) => s.toggleDebug);
  const autoAiPaused = useUiStore((s) => s.autoAiPaused);

  // 计算 ViewModel
  const vm = useMemo(() => {
    if (!battle) return null;
    return buildBattleScreenViewModel({ state: battle, selectedSkillId, seed });
  }, [battle, selectedSkillId, seed]);

  // Presentation Effects:基于已处理 event id 计算增量
  const lastEventIdRef = useRef<string | null>(null);
  const effects = useMemo(() => {
    if (!battle) return [];
    const out = mapEventsToEffects(battle, lastEventIdRef.current);
    lastEventIdRef.current = battle.log.length > 0 ? battle.log[battle.log.length - 1]!.id : null;
    return out;
  }, [battle]);

  // 自动回合推进
  useEffect(() => {
    if (!battle || !vm) return;
    if (vm.phase === 'victory' || vm.phase === 'defeat') return;

    // 1. setup 阶段 -> 开始第一回合,然后 beginTurn
    if (vm.phase === 'setup') {
      dispatch({ type: 'START_ROUND', commandId: makeCommandId('auto') });
      return;
    }

    // 2. round-start 阶段但没有 activeActor -> 启动第一个行动者
    if (vm.phase === 'round-start' && !vm.activeActor && battle.initiativeQueue.length > 0) {
      const next = battle.initiativeQueue[0]!;
      dispatch({ type: 'BEGIN_TURN', actorId: next, commandId: makeCommandId('auto') });
      return;
    }

    // 3. round-end 阶段 -> 开始下一回合
    if (vm.phase === 'round-end') {
      dispatch({ type: 'START_ROUND', commandId: makeCommandId('auto') });
      return;
    }

    // 4. actor-turn 阶段,敌人在行动,无人为暂停
    if (vm.phase === 'actor-turn' && vm.activeActor?.side === 'enemy' && !autoAiPaused) {
      const id = vm.activeActor.id;
      const timer = window.setTimeout(() => {
        const ctx = new BattleContext(battle);
        const dec = decideAiAction(ctx, id);
        if (dec) {
          try {
            useSkill(ctx, id, dec.skillId, dec.targetId ? [dec.targetId] : []);
          } catch {
            // ignore
          }
        }
        endTurn(ctx);
        startBattleWithState(ctx.state);
      }, AI_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.activeActorId, battle?.phase, battle?.round]);

  // 自动存档
  useEffect(() => {
    if (battle) saveBattle(battle);
  }, [battle]);

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        toggleDebug();
        return;
      }
      if (e.key === 'Escape') {
        if (selectedSkillId) {
          setSelectedSkill(null);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedSkillId, setSelectedSkill, toggleDebug]);

  if (!battle || !vm) {
    return (
      <div className="battle-page">
        <TopBar
          round={0}
          phase="setup"
          seed={seed}
          onRestartSame={restartSame}
          onRestartNew={restartNew}
          onToggleDebug={toggleDebug}
          onExportDebug={() => {}}
          debugOpen={debugOpen}
        />
        <div style={{ padding: 32, textAlign: 'center' }}>
          <button className="btn btn--primary" onClick={() => startBattle()}>
            开始战斗
          </button>
        </div>
      </div>
    );
  }

  const handleTargetClick = (targetId: string) => {
    if (!selectedSkillId || !vm.activeActor || !vm.canPlayerInteract) return;
    if (!vm.validTargetIds.includes(targetId)) return;
    dispatch({
      type: 'USE_SKILL',
      actorId: vm.activeActor.id,
      skillId: selectedSkillId,
      targetIds: [targetId],
      commandId: newCommandId('ui'),
    });
    setSelectedSkill(null);
    // 玩家施放技能后自动结束回合
    dispatch({ type: 'END_TURN', commandId: makeCommandId('ui') });
  };

  const handleExportDebug = () => {
    const pkg = exportDebugPackage(battle, seed);
    const blob = new Blob([pkg], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-${seed}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedSkill = vm.skills.find((s) => s.id === selectedSkillId);

  return (
    <div className="battle-page">
      <TopBar
        round={vm.round}
        phase={vm.phase}
        seed={seed}
        onRestartSame={restartSame}
        onRestartNew={restartNew}
        onToggleDebug={toggleDebug}
        onExportDebug={handleExportDebug}
        debugOpen={debugOpen}
      />
      <div className="battle-main">
        <div className="battle-scene">
          <div className="formation">
            <div className="formation__divider">
              <span className="formation__divider-text">敌人</span>
            </div>
            <div className="formation__row formation__row--enemies">
              {[4, 3, 2, 1].map((r) => {
                const a = vm.enemies.find((e) => e.rank === r);
                if (!a) return <div key={r} />;
                const isValid = vm.validTargetIds.includes(a.id);
                const isInvalid = !isValid && selectedSkill !== undefined && selectedSkill.targetSide === 'enemy';
                return (
                  <ActorCard
                    key={a.id}
                    actor={a}
                    isValidTarget={isValid}
                    isInvalidTarget={isInvalid}
                    invalidReason={vm.invalidTargetReasons[a.id]}
                    onClick={handleTargetClick}
                  />
                );
              })}
            </div>
            <div className="formation__divider">
              <span className="formation__divider-text">友军</span>
            </div>
            <div className="formation__row formation__row--heroes">
              {[1, 2, 3, 4].map((r) => {
                const a = vm.heroes.find((h) => h.rank === r);
                if (!a) return <div key={r} />;
                const isValid = vm.validTargetIds.includes(a.id);
                const isInvalid = !isValid && selectedSkill !== undefined && selectedSkill.targetSide === 'ally';
                return (
                  <ActorCard
                    key={a.id}
                    actor={a}
                    isValidTarget={isValid}
                    isInvalidTarget={isInvalid}
                    invalidReason={vm.invalidTargetReasons[a.id]}
                    onClick={handleTargetClick}
                  />
                );
              })}
            </div>
            {vm.corpses.length > 0 && (
              <>
                <div className="formation__divider">
                  <span className="formation__divider-text">尸体</span>
                </div>
                <div className="formation__row">
                  {vm.corpses.map((c) => (
                    <ActorCard
                      key={c.id}
                      actor={c}
                      isValidTarget={false}
                      isInvalidTarget={false}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          <EffectLayer effects={effects} />
        </div>
        <div className="battle-side-panel">
          <ActiveActorPanel
            actor={vm.activeActor}
            selectedSkillName={selectedSkill?.name}
            validTargetCount={vm.validTargetIds.length}
          />
          <InitiativePanel items={vm.initiative} round={vm.round} />
          <LogPanel events={vm.recentEvents} />
        </div>
      </div>
      <SkillBar
        skills={vm.skills}
        selectedSkillId={selectedSkillId}
        onSelect={setSelectedSkill}
        canPlayerInteract={vm.canPlayerInteract}
      />
      {vm.result && (
        <ResultModal
          result={vm.result}
          onRestartSame={restartSame}
          onRestartNew={restartNew}
        />
      )}
      {debugOpen && <DebugPanel state={battle} />}
      {lastError && (
        <div className="error-toast" onClick={clearError}>
          {lastError}
        </div>
      )}
    </div>
  );
}
