/**
 * RelocationBanner — the top-center prompt shown while an agent is in MOVE mode
 * (System 2 relocation flow).
 *
 * When the relocation store has an `activeAgentId`, this banner appears:
 *   'SELECT A HEX FOR AGENT #N — ESC to cancel'
 * ESC (or the CANCEL button) leaves MOVE mode. The actual hex pick is handled in
 * the 3D scene (useHexPick on the ground plane). While a submit is in flight the
 * banner switches to a 'MOVING…' state so the player knows it's working.
 *
 * Dusk tokens, flat amber fill + hard pixel bevel (the earned amber accent),
 * no gradients / glass (anti-slop). App-level so it works in desktop + mobile.
 */
import { FC, useEffect } from 'react';
import { useRelocationStore } from '../../stores/relocationStore';

export const RelocationBanner: FC = () => {
  const activeAgentId = useRelocationStore((s) => s.activeAgentId);
  const activeAgentLabel = useRelocationStore((s) => s.activeAgentLabel);
  const submitting = useRelocationStore((s) => s.submitting);
  const cancelRelocation = useRelocationStore((s) => s.cancelRelocation);

  // ESC cancels MOVE mode (unless a submit is mid-flight).
  useEffect(() => {
    if (!activeAgentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) cancelRelocation();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeAgentId, submitting, cancelRelocation]);

  if (!activeAgentId) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: '84px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        fontFamily: 'var(--font-body)',
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '0.03em',
        color: 'var(--dusk-on-amber)',
        background: 'var(--amber)',
        // Hard-stepped pixel bevel — the earned amber accent, no gaussian glow.
        boxShadow:
          'inset -2px -2px 0 0 var(--amber-dark), inset 2px 2px 0 0 var(--amber-light), 0 0 0 2px rgba(240,166,60,0.5), 4px 4px 0 rgba(14,16,26,0.3)',
        zIndex: 3200,
        animation: 'dusk-panel-in 0.2s ease-out',
      }}
    >
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px' }}>
        {submitting ? 'MOVING…' : `SELECT A HEX FOR AGENT ${activeAgentLabel ?? ''}`}
      </span>
      {!submitting && (
        <button
          type="button"
          onClick={cancelRelocation}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            color: 'var(--dusk-on-amber)',
            background: 'var(--amber-light)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: 'inset 1px 1px 0 0 rgba(255,255,255,0.4), inset -1px -1px 0 0 rgba(14,16,26,0.3)',
          }}
        >
          ESC · CANCEL
        </button>
      )}
    </div>
  );
};

export default RelocationBanner;
