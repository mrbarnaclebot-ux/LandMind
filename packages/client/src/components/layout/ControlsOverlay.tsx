/**
 * Minecraft inventory-style controls overlay (desktop only)
 */
export function ControlsOverlay() {
  return (
    <div
      className="pixel-inventory-bg desktop-only"
      style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        padding: '12px 16px',
        pointerEvents: 'none',
        zIndex: 100,
        fontFamily: "var(--font-body)",
        fontSize: '13px',
        color: 'var(--dusk-text)',
        lineHeight: '1.5',
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: '13px',
          marginBottom: '8px',
          color: 'var(--amber)',
          textShadow: '2px 2px 0 var(--amber-dark)',
        }}
      >
        CONTROLS
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
        <span
          className="pixel-slot"
          style={{
            padding: '4px 8px',
            minWidth: '90px',
            textAlign: 'center',
            fontFamily: "var(--font-pixel)",
            fontSize: '13px',
          }}
        >
          LEFT-DRAG
        </span>
        <span style={{ color: 'var(--dusk-text-dim)' }}>Rotate</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
        <span
          className="pixel-slot"
          style={{
            padding: '4px 8px',
            minWidth: '90px',
            textAlign: 'center',
            fontFamily: "var(--font-pixel)",
            fontSize: '13px',
          }}
        >
          RIGHT-DRAG
        </span>
        <span style={{ color: 'var(--dusk-text-dim)' }}>Pan</span>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <span
          className="pixel-slot"
          style={{
            padding: '4px 8px',
            minWidth: '90px',
            textAlign: 'center',
            fontFamily: "var(--font-pixel)",
            fontSize: '13px',
          }}
        >
          SCROLL
        </span>
        <span style={{ color: 'var(--dusk-text-dim)' }}>Zoom</span>
      </div>
    </div>
  );
}
