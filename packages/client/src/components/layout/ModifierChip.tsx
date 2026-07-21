/**
 * ModifierChip — a small amber/teal chip surfacing the active World Clock yield
 * modifier. Used in the earnings panel / agent cards so the "when" is visible
 * where the "how much" is. Minimal, dusk-token, flat + hard bevel (anti-slop).
 *
 *  - Golden hour → amber chip "GOLDEN ×1.25"
 *  - Night       → teal chip   "NIGHT DEEP ×1.2" (deep is the night upside)
 *  - Dawn (ramp) → amber-light chip
 *  - Neutral phases render nothing (chip only appears when it matters), unless
 *    `variant="deep"` is requested by a deep-deployed agent context.
 */
import { FC } from 'react';
import { useWorldStore } from '../../stores/worldStore';
import { PHASE_META } from '../../scene/worldPhases';

interface ModifierChipProps {
  /**
   * Which modifier to reflect. `surface` (default) for normal hexes, `deep` for
   * pit/cave-adjacent agents (night's upside).
   */
  variant?: 'surface' | 'deep';
  /** Force-render even on neutral (×1.0) phases. */
  showNeutral?: boolean;
}

export const ModifierChip: FC<ModifierChipProps> = ({
  variant = 'surface',
  showNeutral = false,
}) => {
  const ready = useWorldStore((s) => s.ready);
  const phase = useWorldStore((s) => s.phase);
  const modifiers = useWorldStore((s) => s.modifiers);

  if (!ready) return null;

  const value = variant === 'deep' ? modifiers.deep : modifiers.surface;
  const neutral = Math.abs(value - 1) < 1e-6;
  if (neutral && !showNeutral) return null;

  // Color: amber for boosts, teal for the night-deep upside, ember for penalties.
  let bg = 'var(--amber)';
  let fg = 'var(--dusk-on-amber)';
  if (phase === 'night' && variant === 'deep') {
    bg = 'var(--teal)';
  } else if (value < 1) {
    bg = 'var(--ember)';
    fg = 'var(--dusk-text)';
  } else if (phase === 'golden_hour') {
    bg = 'var(--amber)';
  }

  const label =
    phase === 'golden_hour'
      ? `GOLDEN ×${value}`
      : `${PHASE_META[phase].label}${variant === 'deep' ? ' DEEP' : ''} ×${value}`;

  return (
    <span
      title="Active World Clock yield modifier"
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
        // Flat fill + hard bevel, no gradient.
        boxShadow:
          'inset 1px 1px 0 0 rgba(255,255,255,0.35), inset -1px -1px 0 0 rgba(14,16,26,0.35)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '10px' }}>{PHASE_META[phase].icon}</span>
      {label}
    </span>
  );
};

export default ModifierChip;
