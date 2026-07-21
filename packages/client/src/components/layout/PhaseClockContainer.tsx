/**
 * PhaseClockContainer — mounts the World Clock HUD widget and owns the
 * golden-hour one-shot toast. Kept separate from PhaseClock so the toast can be
 * positioned/centered independently of the widget, with no screen takeover.
 *
 * The toast is a subtle, non-blocking banner that auto-dismisses. The amber
 * pulse of the widget itself lives in PhaseClock (CSS, hard-stepped glow).
 */
import { FC, useCallback, useState } from 'react';
import { PhaseClock } from './PhaseClock';
import { WeatherForecast } from './WeatherForecast';

const TOAST_MS = 3600;

export const PhaseClockContainer: FC = () => {
  const [toast, setToast] = useState(false);

  const onEnterGoldenHour = useCallback(() => {
    setToast(true);
    window.setTimeout(() => setToast(false), TOAST_MS);
  }, []);

  return (
    <>
      <PhaseClock onEnterGoldenHour={onEnterGoldenHour} />

      {/* System 2: active-weather forecast strip, stacked under the phase clock. */}
      <WeatherForecast />

      {toast && (
        <div
          role="status"
          onClick={() => setToast(false)}
          style={{
            position: 'fixed',
            top: '84px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 18px',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.03em',
            color: 'var(--dusk-on-amber)',
            background: 'var(--amber)',
            // Hard-stepped pixel bloom (no gaussian) — the earned amber glow.
            boxShadow:
              'inset -2px -2px 0 0 var(--amber-dark), inset 2px 2px 0 0 var(--amber-light), 0 0 0 2px rgba(240,166,60,0.55), 0 0 0 4px rgba(240,166,60,0.25), 4px 4px 0 rgba(14,16,26,0.3)',
            cursor: 'pointer',
            zIndex: 3000,
            animation: 'dusk-panel-in 0.2s ease-out',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: '10px',
              marginRight: '8px',
            }}
          >
            ✦ GOLDEN HOUR
          </span>
          yields ×1.25
        </div>
      )}
    </>
  );
};

export default PhaseClockContainer;
