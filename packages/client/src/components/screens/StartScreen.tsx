/**
 * StartScreen — full-viewport loading + start overlay (the audio unlock gate).
 *
 * Shown on every full page load. Two stages:
 *
 *  1. LOADING — a pixel segmented progress bar fed by REAL readiness signals
 *     (config / world / socket / render from readinessStore). A Manrope stage
 *     label names the signal currently in flight. Amber ember particles drift
 *     up behind the wordmark (pure CSS, stepped, no gaussian glow).
 *
 *  2. START — once all signals are ready AND a minimum display time has passed,
 *     the bar swaps to a big amber START button (Press Start 2P). Clicking it
 *     (or ESC / Enter) unlocks audio, starts the generative music, then fades
 *     the overlay out (400ms CSS) and unmounts.
 *
 * The overlay sits above everything (z 4000, above toasts at 3000+). If the app
 * loads faster than MIN_DISPLAY_MS it still lingers briefly so it never flashes.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  useReadinessStore,
  READINESS_ORDER,
  READINESS_LABELS,
  type ReadinessSignal,
} from '../../stores/readinessStore';
import { audio } from '../../lib/audio';
import './StartScreen.css';

/** Never flash: keep the screen up at least this long even on warm loads. */
const MIN_DISPLAY_MS = 1200;
/** Overlay fade-out duration — must match the CSS .start-screen.leaving transition. */
const FADE_MS = 400;

export function StartScreen() {
  const readiness = useReadinessStore();
  const [minElapsed, setMinElapsed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(true);
  const dismissedRef = useRef(false);

  // How many signals are ready (0..4) and which one is currently in flight.
  const readyCount = READINESS_ORDER.reduce(
    (n, sig) => n + (readiness[sig] ? 1 : 0),
    0,
  );
  const total = READINESS_ORDER.length;
  const allReady = readyCount === total;

  const inFlight: ReadinessSignal =
    READINESS_ORDER.find((sig) => !readiness[sig]) ?? 'render';
  const label = allReady ? 'ready' : READINESS_LABELS[inFlight];

  // Minimum display timer (anti-flash).
  useEffect(() => {
    const id = setTimeout(() => setMinElapsed(true), MIN_DISPLAY_MS);
    return () => clearTimeout(id);
  }, []);

  const canStart = allReady && minElapsed;

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    // Unlock audio + start generative music from this user gesture.
    void audio.unlock().then(() => {
      audio.music.start();
    });
    setLeaving(true);
    setTimeout(() => setMounted(false), FADE_MS);
  }, []);

  // ESC / Enter also trigger START (only once startable).
  useEffect(() => {
    if (!canStart) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canStart, dismiss]);

  if (!mounted) return null;

  return (
    <div
      className={`start-screen${leaving ? ' start-screen--leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="MINERUSH — loading"
    >
      {/* Amber ember particles (stepped CSS, no gaussian glow). */}
      <div className="start-embers" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className={`start-ember start-ember--${i % 7}`} />
        ))}
      </div>

      <div className="start-content">
        <img
          className="start-wordmark"
          src="/brand/minerush-wordmark.png"
          alt="MINERUSH"
          draggable={false}
        />

        {!canStart ? (
          <div className="start-loading">
            <div
              className="start-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={readyCount}
            >
              {READINESS_ORDER.map((sig, i) => (
                <span
                  key={sig}
                  className={`start-seg${readiness[sig] ? ' start-seg--on' : ''}${
                    !readiness[sig] && i === readyCount ? ' start-seg--active' : ''
                  }`}
                />
              ))}
            </div>
            <div className="start-label">{label}</div>
          </div>
        ) : (
          <button
            type="button"
            className="start-btn"
            data-no-uiclick
            onClick={dismiss}
            autoFocus
          >
            START
          </button>
        )}
      </div>

      <div className="start-hint" aria-hidden="true">
        {canStart ? 'press ENTER' : ''}
      </div>
    </div>
  );
}
