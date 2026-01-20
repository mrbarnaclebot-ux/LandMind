import { ThreeScene } from './scene/ThreeScene';

/**
 * Controls overlay styles - positioned in bottom-left corner
 */
const controlsOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '16px',
  left: '16px',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  color: 'white',
  padding: '12px 16px',
  borderRadius: '8px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '13px',
  lineHeight: '1.5',
  pointerEvents: 'none', // Don't interfere with canvas events
  zIndex: 100,
};

const controlsHeaderStyle: React.CSSProperties = {
  fontWeight: 'bold',
  marginBottom: '8px',
  fontSize: '14px',
};

const controlRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '4px',
};

const keyStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  padding: '2px 6px',
  borderRadius: '4px',
  fontWeight: 'bold',
  minWidth: '90px',
  textAlign: 'center',
};

function ControlsOverlay() {
  return (
    <div style={controlsOverlayStyle}>
      <div style={controlsHeaderStyle}>Controls</div>
      <div style={controlRowStyle}>
        <span style={keyStyle}>Left-drag</span>
        <span>Rotate view</span>
      </div>
      <div style={controlRowStyle}>
        <span style={keyStyle}>Right-drag</span>
        <span>Pan camera</span>
      </div>
      <div style={controlRowStyle}>
        <span style={keyStyle}>Scroll</span>
        <span>Zoom in/out</span>
      </div>
    </div>
  );
}

function App() {
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}>
      <ThreeScene />
      <ControlsOverlay />
    </div>
  );
}

export default App;
