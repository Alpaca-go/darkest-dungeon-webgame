/**
 * 精神事件覆盖层(SPEC §20.2)
 *
 * 7 种覆盖层:
 *  - resolve-check:意志检定
 *  - affliction-reveal:折磨揭示
 *  - virtue-reveal:美德揭示
 *  - heart-attack:心脏病
 *  - deaths-door-entered:进入死亡之门
 *  - deathblow:致死打击
 *  - hero-death:英雄死亡
 *  - party-pulse:队伍压力脉冲
 *
 * 由 state.activeOverlay 驱动。覆盖层按钮触发 DISMISS_OVERLAY。
 */

import { useEffect } from 'react';
import { useGameStore } from '../../store/game-store.js';
import { newCommandId } from '../../game-engine/expedition/commands.js';
import { getAfflictionDef } from '../../game-engine/mental/afflictions.js';
import { getVirtueDef } from '../../game-engine/mental/virtues.js';
import type { MentalOverlay as MentalOverlayType, GameState } from '../../game-engine/expedition/types.js';

function getHeroName(state: GameState, heroId: string): string {
  return state.party[heroId]?.name ?? heroId;
}

function ResolveCheckOverlay({ overlay, state }: { overlay: { kind: 'resolve-check'; heroId: string; fromStress: number }; state: GameState }) {
  const hero = state.party[overlay.heroId];
  if (!hero) return null;
  return (
    <div className="mental-overlay resolve-check">
      <div className="overlay-icon">🧠</div>
      <div className="overlay-title">{hero.name} 的意志在闪烁...</div>
      <div className="overlay-detail">压力: {overlay.fromStress}</div>
    </div>
  );
}

function AfflictionRevealOverlay({ overlay, state }: { overlay: { kind: 'affliction-reveal'; heroId: string; afflictionId: string }; state: GameState }) {
  const def = getAfflictionDef(overlay.afflictionId);
  if (!def) return null;
  return (
    <div className="mental-overlay affliction-reveal">
      <div className="overlay-icon">🩸</div>
      <div className="overlay-title">{getHeroName(state, overlay.heroId)} 陷入折磨:{def.name}</div>
      <div className="overlay-detail">{def.description}</div>
      <div className="overlay-tendency">倾向:{def.coreTendency.join('、')}</div>
    </div>
  );
}

function VirtueRevealOverlay({ overlay, state }: { overlay: { kind: 'virtue-reveal'; heroId: string; virtueId: string }; state: GameState }) {
  const def = getVirtueDef(overlay.virtueId);
  if (!def) return null;
  return (
    <div className="mental-overlay virtue-reveal">
      <div className="overlay-icon">✨</div>
      <div className="overlay-title">{getHeroName(state, overlay.heroId)} 觉悟美德:{def.name}</div>
      <div className="overlay-detail">{def.description}</div>
      <div className="overlay-tendency">天赋:{def.coreTendency.join('、')}</div>
    </div>
  );
}

function HeartAttackOverlay({ overlay, state }: { overlay: { kind: 'heart-attack'; heroId: string; fromStress: number }; state: GameState }) {
  return (
    <div className="mental-overlay heart-attack">
      <div className="overlay-icon">💔</div>
      <div className="overlay-title">{getHeroName(state, overlay.heroId)} 心脏病发作!</div>
      <div className="overlay-detail">压力: {overlay.fromStress}</div>
    </div>
  );
}

function DeathsDoorOverlay({ overlay, state }: { overlay: { kind: 'deaths-door-entered'; heroId: string; cause: string }; state: GameState }) {
  return (
    <div className="mental-overlay deaths-door-entered">
      <div className="overlay-icon">⚰️</div>
      <div className="overlay-title">{getHeroName(state, overlay.heroId)} 倒下了</div>
      <div className="overlay-detail">现在处于死亡之门。任何后续伤害都可能致命。</div>
      <div className="overlay-cause">原因:{overlay.cause}</div>
    </div>
  );
}

function DeathblowOverlay({ overlay, state }: { overlay: { kind: 'deathblow'; heroId: string; resisted: boolean; cause: string }; state: GameState }) {
  return (
    <div className={`mental-overlay deathblow ${overlay.resisted ? 'resisted' : 'failed'}`}>
      <div className="overlay-icon">{overlay.resisted ? '🛡️' : '☠️'}</div>
      {overlay.resisted ? (
        <>
          <div className="overlay-title">{getHeroName(state, overlay.heroId)} 抵抗了致死打击</div>
          <div className="overlay-detail">仍在死亡之门,继续坚持。</div>
        </>
      ) : (
        <>
          <div className="overlay-title">{getHeroName(state, overlay.heroId)} 永久死亡</div>
          <div className="overlay-detail">致死打击检定失败。无法挽回。</div>
        </>
      )}
    </div>
  );
}

function HeroDeathOverlay({ overlay, state }: { overlay: { kind: 'hero-death'; heroId: string; cause: string }; state: GameState }) {
  return (
    <div className="mental-overlay hero-death">
      <div className="overlay-icon">🪦</div>
      <div className="overlay-title">{getHeroName(state, overlay.heroId)} 永久死亡</div>
      <div className="overlay-detail">原因:{overlay.cause}</div>
      <div className="overlay-detail">他的身影永远留在了这里。</div>
    </div>
  );
}

function PartyPulseOverlay({ overlay, state }: { overlay: { kind: 'party-pulse'; sourceHeroId?: string; deltas: { heroId: string; amount: number }[]; reason: string }; state: GameState }) {
  return (
    <div className="mental-overlay party-pulse">
      <div className="overlay-icon">🌊</div>
      <div className="overlay-title">精神冲击波</div>
      <div className="overlay-detail">{overlay.reason}</div>
      <div className="overlay-deltas">
        {overlay.deltas.map((d, i) => (
          <div key={i} className="delta">
            {getHeroName(state, d.heroId)}: {d.amount > 0 ? '+' : ''}{d.amount}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderOverlay(overlay: MentalOverlayType, state: GameState) {
  switch (overlay.kind) {
    case 'resolve-check': return <ResolveCheckOverlay overlay={overlay} state={state} />;
    case 'affliction-reveal': return <AfflictionRevealOverlay overlay={overlay} state={state} />;
    case 'virtue-reveal': return <VirtueRevealOverlay overlay={overlay} state={state} />;
    case 'heart-attack': return <HeartAttackOverlay overlay={overlay} state={state} />;
    case 'deaths-door-entered': return <DeathsDoorOverlay overlay={overlay} state={state} />;
    case 'deathblow': return <DeathblowOverlay overlay={overlay} state={state} />;
    case 'hero-death': return <HeroDeathOverlay overlay={overlay} state={state} />;
    case 'party-pulse': return <PartyPulseOverlay overlay={overlay} state={state} />;
  }
}

/** 自动消失时长(按 overlay kind,ms)。null = 不自动消失(必须手动点击) */
const OVERLAY_DURATION_MS: Record<string, number | null> = {
  'resolve-check': 1800,
  'affliction-reveal': 3500,
  'virtue-reveal': 3500,
  'heart-attack': 6000,
  'deaths-door-entered': 5000,
  'deathblow': 5000,
  'hero-death': null, // 必须手动关闭
  'party-pulse': 2500,
};

export function MentalOverlayHost() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const overlay = state.activeOverlay;

  useEffect(() => {
    if (!overlay) return;
    const duration = OVERLAY_DURATION_MS[overlay.kind] ?? 2500;
    if (duration == null) return; // 不自动消失(hero-death)
    const timeout = setTimeout(() => {
      dispatch({ type: 'DISMISS_OVERLAY', commandId: newCommandId('overlay') });
    }, duration);
    return () => clearTimeout(timeout);
  }, [overlay, dispatch]);

  if (!overlay) return null;
  return (
    <div className="mental-overlay-host" role="dialog" aria-modal="true" onClick={() => {
      dispatch({ type: 'DISMISS_OVERLAY', commandId: newCommandId('overlay') });
    }}>
      {renderOverlay(overlay, state)}
    </div>
  );
}
