/**
 * VeinStrip — HUD row for System 3 rich-vein strikes.
 *
 * A sibling widget rendered directly below the WeatherForecast strip. Lists each
 * active rich vein as a row:
 *   - an amber sparkle glyph (matte, no bloom)
 *   - the multiplier + resource + coords ('×3 GOLD at (4, -2)')
 *   - a live mm:ss countdown to expiry
 * If a vein sits on one of MY agents' hexes, the row is tagged 'YOUR HEX' amber.
 *
 * Reads worldStore.veins reactively and ticks every second for the countdown.
 * Dusk tokens, flat + hard bevel only (anti-slop): no gradients, no glass, no
 * gaussian shadow. Reuses the weatherForecast.css classes for a matched look.
 */
import { FC, useEffect, useMemo, useState } from 'react';
import { useWorldStore } from '../../stores/worldStore';
import { useAgentStore } from '../../stores/agentStore';
import './weatherForecast.css';

/** mm:ss from a millisecond duration (clamped at 0). */
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const RESOURCE_LABEL: Record<string, string> = {
  GOLD: 'GOLD',
  SILVER: 'SILVER',
  COPPER: 'COPPER',
  IRON: 'IRON',
};

export const VeinStrip: FC = () => {
  const veins = useWorldStore((s) => s.veins);
  const agents = useAgentStore((s) => s.agents);

  // 1s tick for the live countdown.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const myHexes = useMemo(
    () =>
      new Set(
        agents
          .filter((a) => a.hex && a.hex.q !== undefined && a.hex.r !== undefined)
          .map((a) => `${a.hex!.q},${a.hex!.r}`),
      ),
    [agents],
  );

  // Only veins that haven't expired, soonest-to-expire first.
  const active = veins
    .filter((v) => v.expiresAt > now)
    .sort((a, b) => a.expiresAt - b.expiresAt);

  if (active.length === 0) return null;

  return (
    <div className="wx-forecast wx-forecast--vein">
      <div className="wx-forecast__head" style={{ cursor: 'default' }}>
        <span className="wx-forecast__title" style={{ color: 'var(--amber)' }}>
          RICH VEINS
        </span>
        <span className="wx-forecast__count">
          {active.length} STRIKE{active.length > 1 ? 'S' : ''}
        </span>
      </div>

      <div className="wx-forecast__rows">
        {active.map((vein) => {
          const mine = myHexes.has(`${vein.q},${vein.r}`);
          const label = RESOURCE_LABEL[vein.resourceType?.toUpperCase?.() ?? ''] ??
            (vein.resourceType || 'ORE').toUpperCase();
          return (
            <div key={vein.hexId} className={`wx-row${mine ? ' wx-row--mine' : ''}`}>
              <span className="wx-row__icon" style={{ color: 'var(--amber)' }} aria-hidden>
                ✦
              </span>
              <div className="wx-row__body">
                <div className="wx-row__line">
                  <span className="wx-row__type" style={{ color: 'var(--amber)' }}>
                    ×{vein.multiplier} {label}
                  </span>
                  <span className="wx-row__effect">— ({vein.q}, {vein.r})</span>
                </div>
                <div className="wx-row__sub">
                  <span className="wx-row__heading">{fmtCountdown(vein.expiresAt - now)} left</span>
                  {mine && <span className="wx-row__tag">YOUR HEX</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VeinStrip;
