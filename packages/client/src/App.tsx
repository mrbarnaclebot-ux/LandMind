import { ThreeScene } from './scene/ThreeScene';
import { ConnectButton } from './components/wallet/ConnectButton';

/**
 * Header with wallet connection
 */
const headerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '60px',
  backgroundColor: 'rgba(10, 10, 20, 0.8)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
  zIndex: 100,
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
};

const logoStyle: React.CSSProperties = {
  color: 'white',
  fontSize: '20px',
  fontWeight: 'bold',
  fontFamily: 'system-ui, -apple-system, sans-serif'
};

function Header() {
  return (
    <header style={headerStyle}>
      <div style={logoStyle}>LandMind</div>
      <ConnectButton />
    </header>
  );
}

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
  pointerEvents: 'none',
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
      <Header />
      <ThreeScene />
      <ControlsOverlay />
    </div>
  );
}

export default App;
