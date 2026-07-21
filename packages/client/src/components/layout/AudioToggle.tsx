/**
 * AudioToggle — a small pixel speaker button for the header.
 *
 *  - Click: mute / unmute (persisted to localStorage via the audio module).
 *  - Right-click (or long-press on touch): opens a compact volume popover with
 *    music + SFX sliders. Kept intentionally simple.
 *
 * Reflects live audio state by subscribing to the audio module's change events.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { audio } from '../../lib/audio';

function useAudioState() {
  return useSyncExternalStore(audio.subscribe, audio.getState, audio.getState);
}

/** Speaker glyph as pure CSS-ish inline SVG (pixel-flat, currentColor). */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" shapeRendering="crispEdges" aria-hidden="true">
      {/* speaker body */}
      <path d="M2 6h3l4-3v12l-4-3H2z" fill="currentColor" />
      {muted ? (
        // X
        <path
          d="M12 6l4 4M16 6l-4 4"
          stroke="currentColor"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="square"
        />
      ) : (
        // sound waves
        <>
          <path d="M11 6c1.4 1 1.4 5 0 6" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="M13.5 4c2.4 2 2.4 8 0 10" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </>
      )}
    </svg>
  );
}

export function AudioToggle() {
  const state = useAudioState();
  const [popover, setPopover] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close the popover on outside click.
  useEffect(() => {
    if (!popover) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPopover(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [popover]);

  const toggleMute = () => {
    audio.toggleMuted();
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={`pixel-btn ${state.muted ? '' : 'pixel-btn-gold'}`}
        data-no-uiclick
        title={state.muted ? 'Unmute (right-click for volume)' : 'Mute (right-click for volume)'}
        aria-label={state.muted ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={!state.muted}
        onClick={toggleMute}
        onContextMenu={(e) => {
          e.preventDefault();
          setPopover((v) => !v);
        }}
        onTouchStart={() => {
          pressTimer.current = setTimeout(() => setPopover(true), 450);
        }}
        onTouchEnd={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
        }}
        style={{
          padding: '7px 9px',
          fontSize: '10px',
          display: 'inline-flex',
          alignItems: 'center',
          color: state.muted ? 'var(--dusk-text-dim)' : 'var(--dusk-on-amber)',
          lineHeight: 0,
        }}
      >
        <SpeakerIcon muted={state.muted} />
      </button>

      {popover && (
        <div
          className="pixel-inventory-bg"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            padding: '12px 14px',
            width: '180px',
            zIndex: 1000,
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            color: 'var(--dusk-text)',
          }}
        >
          <label style={{ display: 'block', marginBottom: '10px' }}>
            <span style={{ display: 'block', marginBottom: '4px', color: 'var(--amber)' }}>
              MUSIC
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.musicVolume}
              onChange={(e) => audio.setMusicVolume(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--amber)' }}
            />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', marginBottom: '4px', color: 'var(--teal)' }}>SFX</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.sfxVolume}
              onChange={(e) => audio.setSfxVolume(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--teal)' }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
