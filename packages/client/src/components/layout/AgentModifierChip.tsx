/**
 * AgentModifierChip — a per-agent chip showing the COMBINED phase × weather
 * yield multiplier at the agent's hex (System 2, Phase A × B).
 *
 * The server's mining calc is `yield = base × phaseMod × weatherMod × …`. This
 * chip mirrors the phase and weather factors the client can see and multiplies
 * them, so the card shows the same combined number (e.g. '×1.38'). The tooltip
 * breaks it down: 'Golden Hour ×1.25 · Rain (marsh) ×1.15 = ×1.44'.
 *
 * When no weather front covers the hex it degrades to the phase-only value; when
 * the phase is neutral AND there's no weather it renders nothing (the chip only
 * appears when it matters). Dusk tokens, flat + hard bevel (anti-slop).
 */
import { FC, useEffect, useState } from 'react';
import { useWorldStore } from '../../stores/worldStore';
import { PHASE_META } from '../../scene/worldPhases';
import type { WeatherFront, WeatherTable } from '../../lib/socketTypes';
import type { Biome } from '../../terrain/biomes';
import {
  weatherMultiplierAtHex,
  dominantFrontAtHex,
  FRONT_STYLES,
} from '../../scene/weather';

interface AgentModifierChipProps {
  hex: { q: number; r: number };
  biome: Biome;
  fronts: WeatherFront[];
  weatherTable: WeatherTable;
}

/** Trim trailing zeros: 1.20 → 1.2, 1.00 → 1. */
function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

export const AgentModifierChip: FC<AgentModifierChipProps> = ({
  hex,
  biome,
  fronts,
  weatherTable,
}) => {
  const ready = useWorldStore((s) => s.ready);
  const phase = useWorldStore((s) => s.phase);
  const modifiers = useWorldStore((s) => s.modifiers);

  // Re-evaluate coverage on a light tick as fronts drift.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!ready) return null;

  // Phase factor: surface variant (agent cards don't know deep vs surface here).
  const phaseMod = modifiers.surface;
  const weatherMod = weatherMultiplierAtHex(fronts, weatherTable, hex, biome, now);
  const combined = phaseMod * weatherMod;

  const phaseNeutral = Math.abs(phaseMod - 1) < 1e-6;
  const weatherNeutral = Math.abs(weatherMod - 1) < 1e-6;
  if (phaseNeutral && weatherNeutral) return null;

  const dominant = dominantFrontAtHex(fronts, weatherTable, hex, biome, now);

  // Color: amber for a net boost, ember for a net penalty, teal if weather-driven
  // positive at night-deep-neutral phases. Keep it simple: boost=amber, else ember.
  const bg = combined >= 1 ? 'var(--amber)' : 'var(--ember)';
  const fg = combined >= 1 ? 'var(--dusk-on-amber)' : 'var(--dusk-text)';

  // Tooltip breakdown.
  const parts: string[] = [];
  if (!phaseNeutral) parts.push(`${PHASE_META[phase].label} ×${trim(phaseMod)}`);
  if (dominant) {
    const style = FRONT_STYLES[dominant.front.type];
    parts.push(`${style.label} (${biome}) ×${trim(dominant.multiplier)}`);
  } else if (!weatherNeutral) {
    parts.push(`Weather ×${trim(weatherMod)}`);
  }
  const tooltip =
    parts.length > 0 ? `${parts.join(' · ')} = ×${trim(combined)}` : `×${trim(combined)}`;

  return (
    <span
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        fontFamily: 'var(--font-body)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: fg,
        background: bg,
        boxShadow:
          'inset 1px 1px 0 0 rgba(255,255,255,0.35), inset -1px -1px 0 0 rgba(14,16,26,0.35)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '10px' }}>{PHASE_META[phase].icon}</span>
      {dominant && (
        <span style={{ fontSize: '10px' }}>{FRONT_STYLES[dominant.front.type].glyph}</span>
      )}
      ×{trim(combined)}
    </span>
  );
};

export default AgentModifierChip;
