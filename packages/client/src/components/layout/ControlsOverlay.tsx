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
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '8px',
        color: 'white',
        lineHeight: '2',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          marginBottom: '8px',
          color: '#FFAA00',
          textShadow: '2px 2px 0 #CC8800',
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
            fontSize: '7px',
          }}
        >
          LEFT-DRAG
        </span>
        <span style={{ color: '#8B8B8B' }}>Rotate</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
        <span
          className="pixel-slot"
          style={{
            padding: '4px 8px',
            minWidth: '90px',
            textAlign: 'center',
            fontSize: '7px',
          }}
        >
          RIGHT-DRAG
        </span>
        <span style={{ color: '#8B8B8B' }}>Pan</span>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <span
          className="pixel-slot"
          style={{
            padding: '4px 8px',
            minWidth: '90px',
            textAlign: 'center',
            fontSize: '7px',
          }}
        >
          SCROLL
        </span>
        <span style={{ color: '#8B8B8B' }}>Zoom</span>
      </div>
    </div>
  );
}
