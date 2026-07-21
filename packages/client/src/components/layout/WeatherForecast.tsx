/**
 * WeatherForecast — HUD forecast strip for System 2 (weather fronts).
 *
 * A sibling widget rendered directly below the PhaseClock. Lists each active
 * front as a row:
 *   - a pixel-style type icon (CSS box-shadow glyph technique, re-paletted to the
 *     front's accent — no bloom, matte)
 *   - the biome effect summary from the published weatherTable
 *     (e.g. 'RAIN — marsh +15% rocky −10%')
 *   - the heading (e.g. 'moving NE')
 * If a front currently covers — or its 3-minute telegraph path will cover — any
 * of MY agents' hexes, the row is highlighted amber and tagged 'YOUR AGENTS'.
 *
 * Clicking the strip header opens a popover with the full published weatherTable
 * (all front types × biome multipliers) — the "published odds" surface.
 *
 * Reads worldStore.fronts / weatherTable reactively and re-flags coverage on a
 * light interval (fronts drift; store fields only change every ~5s).
 * Dusk tokens, flat + hard bevel only (anti-slop): no gradients, no glass.
 */
import { FC, useEffect, useMemo, useState } from 'react';
import { useWorldStore } from '../../stores/worldStore';
import { useAgentStore } from '../../stores/agentStore';
import type { WeatherFront, WeatherFrontType } from '../../lib/socketTypes';
import {
  FRONT_STYLES,
  frontFade,
  frontHeading,
  frontEffectSummary,
  hexUnderFrontOrPath,
} from '../../scene/weather';
import './weatherForecast.css';

const FRONT_ORDER: WeatherFrontType[] = ['ember', 'rain', 'dust', 'snow'];

export const WeatherForecast: FC = () => {
  const fronts = useWorldStore((s) => s.fronts);
  const weatherTable = useWorldStore((s) => s.weatherTable);
  const agents = useAgentStore((s) => s.agents);

  const [open, setOpen] = useState(false);
  // Tick so coverage flags refresh as fronts drift (store only updates ~5s).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
    return () => window.clearInterval(id);
  }, []);

  // My deployed agents' hexes (integer axial).
  const myHexes = useMemo(
    () =>
      agents
        .filter((a) => a.hex && a.hex.q !== undefined && a.hex.r !== undefined)
        .map((a) => ({ q: a.hex!.q, r: a.hex!.r })),
    [agents],
  );

  const now = Date.now();
  // Only fronts that are actually visible (faded in, not expired), sorted with
  // ember (rare, dramatic) first.
  const active = fronts
    .filter((f) => frontFade(f, now) > 0)
    .sort(
      (a, b) => FRONT_ORDER.indexOf(a.type) - FRONT_ORDER.indexOf(b.type),
    );

  if (active.length === 0) return null;

  const coversMine = (front: WeatherFront): boolean =>
    myHexes.some((h) => hexUnderFrontOrPath(front, h, now));

  return (
    <div className="wx-forecast">
      <button
        type="button"
        className="wx-forecast__head"
        onClick={() => setOpen((v) => !v)}
        title="Published weather effects"
      >
        <span className="wx-forecast__title">FORECAST</span>
        <span className="wx-forecast__count">{active.length} FRONT{active.length > 1 ? 'S' : ''}</span>
      </button>

      <div className="wx-forecast__rows">
        {active.map((front) => {
          const style = FRONT_STYLES[front.type];
          const summary = frontEffectSummary(front.type, weatherTable);
          const mine = coversMine(front);
          return (
            <div
              key={front.id}
              className={`wx-row${mine ? ' wx-row--mine' : ''}`}
            >
              <span
                className="wx-row__icon"
                style={{ color: style.accentVar }}
                aria-hidden
              >
                {style.glyph}
              </span>
              <div className="wx-row__body">
                <div className="wx-row__line">
                  <span className="wx-row__type" style={{ color: style.accentVar }}>
                    {style.label}
                  </span>
                  {summary && <span className="wx-row__effect">— {summary}</span>}
                </div>
                <div className="wx-row__sub">
                  <span className="wx-row__heading">{frontHeading(front)}</span>
                  {mine && <span className="wx-row__tag">YOUR AGENTS</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <WeatherTablePopover onClose={() => setOpen(false)} />
      )}
    </div>
  );
};

/** Popover: the full published weatherTable (front type × biome multipliers). */
const WeatherTablePopover: FC<{ onClose: () => void }> = ({ onClose }) => {
  const weatherTable = useWorldStore((s) => s.weatherTable);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = FRONT_ORDER.filter((t) => weatherTable[t]).map((type) => {
    const effects = weatherTable[type]!;
    const cells = Object.entries(effects)
      .filter(([, v]) => typeof v === 'number')
      .map(([biome, v]) => {
        const pct = Math.round(((v as number) - 1) * 100);
        const name = biome === 'default' ? 'all' : biome.toLowerCase();
        return { name, pct };
      });
    return { type, cells };
  });

  return (
    <div className="wx-forecast__popover pixel-dropdown">
      <div className="wx-forecast__popover-title">WEATHER EFFECTS</div>
      <table className="wx-forecast__table">
        <tbody>
          {rows.map(({ type, cells }) => (
            <tr key={type}>
              <td className="wx-forecast__table-type" style={{ color: FRONT_STYLES[type].accentVar }}>
                <span style={{ marginRight: 4 }}>{FRONT_STYLES[type].glyph}</span>
                {FRONT_STYLES[type].label}
              </td>
              <td className="wx-forecast__table-cells">
                {cells.length === 0 ? (
                  <span className="wx-forecast__table-none">no effect</span>
                ) : (
                  cells.map((c) => (
                    <span
                      key={c.name}
                      className="wx-forecast__chip"
                      style={{
                        color:
                          c.pct > 0 ? 'var(--teal)' : c.pct < 0 ? 'var(--ember)' : 'var(--dusk-text-dim)',
                      }}
                    >
                      {c.name} {c.pct > 0 ? '+' : c.pct < 0 ? '−' : ''}
                      {Math.abs(c.pct)}%
                    </span>
                  ))
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="wx-forecast__popover-foot">Published odds · server-authoritative</div>
    </div>
  );
};

export default WeatherForecast;
