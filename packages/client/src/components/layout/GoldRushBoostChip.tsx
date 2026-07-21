/**
 * GoldRushBoostChip — a small persistent chip surfacing an ACTIVE Gold Rush
 * ×1.15 yield boost (System 4). Sits next to the phase ModifierChip in the
 * earnings panel so the "when a community event boost is live" is visible where
 * the "how much" is.
 *
 * Renders nothing unless a Gold Rush boost is currently active (achieved +
 * boostUntil in the future). Ticks lightly so it self-hides when the boost
 * lapses. Dusk tokens, flat + hard bevel (anti-slop).
 */
import { FC, useEffect, useState } from 'react';
import { useWorldStore } from '../../stores/worldStore';

export const GoldRushBoostChip: FC = () => {
  const goldrush = useWorldStore((s) => s.goldrush);
  const engagementTable = useWorldStore((s) => s.engagementTable);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const boostActive =
    !!goldrush?.achieved && goldrush.boostUntil != null && goldrush.boostUntil > now;
  if (!boostActive) return null;

  const boost = engagementTable?.goldRushBoost ?? 1.15;

  return (
    <span
      title="Gold Rush community boost active"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        fontFamily: 'var(--font-body)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: 'var(--dusk-on-amber)',
        background: 'var(--amber)',
        boxShadow:
          'inset 1px 1px 0 0 rgba(255,255,255,0.35), inset -1px -1px 0 0 rgba(14,16,26,0.35)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '10px' }} aria-hidden>
        ✦
      </span>
      ×{boost}
    </span>
  );
};

export default GoldRushBoostChip;
