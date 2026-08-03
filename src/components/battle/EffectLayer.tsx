import { useEffect, useState } from 'react';
import type { PresentationEffect } from '../../game-engine/presentation.js';

interface EffectLayerProps {
  effects: PresentationEffect[];
}

interface ActiveEffect extends PresentationEffect {
  /** 进入屏幕的 client-side id */
  clientId: string;
  /** 进入屏幕的时间戳 */
  enteredAt: number;
}

let clientCounter = 0;

export function EffectLayer({ effects }: EffectLayerProps) {
  const [active, setActive] = useState<ActiveEffect[]>([]);

  useEffect(() => {
    if (effects.length === 0) return;
    const newOnes: ActiveEffect[] = effects.map((e) => ({
      ...e,
      clientId: `client_${++clientCounter}`,
      enteredAt: Date.now(),
    }));
    setActive((prev) => [...prev, ...newOnes]);
    const ids = newOnes.map((e) => e.clientId);
    const timers = newOnes.map((e) =>
      window.setTimeout(() => {
        setActive((prev) => prev.filter((a) => !ids.includes(a.clientId)));
      }, e.durationMs + 50),
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [effects]);

  return (
    <div className="effect-layer">
      {active.map((e) => {
        if (e.type === 'crit-flash') {
          return <div key={e.clientId} className="crit-flash" />;
        }
        if (e.type === 'round-banner') {
          const payload = e.payload as { round: number };
          return (
            <div key={e.clientId} className="round-banner">
              第 {payload.round} 回合
            </div>
          );
        }
        if (e.type === 'damage-number') {
          const payload = e.payload as { amount: number; crit?: boolean; dot?: boolean; type?: string };
          return (
            <div
              key={e.clientId}
              className={'effect-text effect-text--damage' + (payload.crit ? ' effect-text--crit' : '')}
              style={{ left: '50%', top: '40%' }}
            >
              {payload.dot ? `·${payload.amount}·` : `-${payload.amount}`}
            </div>
          );
        }
        if (e.type === 'heal-number') {
          const payload = e.payload as { amount: number };
          return (
            <div
              key={e.clientId}
              className="effect-text effect-text--heal"
              style={{ left: '50%', top: '40%' }}
            >
              +{payload.amount}
            </div>
          );
        }
        if (e.type === 'dodge-text' || e.type === 'miss-text') {
          return (
            <div
              key={e.clientId}
              className="effect-text effect-text--miss"
              style={{ left: '50%', top: '40%' }}
            >
              MISS
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
