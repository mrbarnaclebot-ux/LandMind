import { ThreeScene } from './scene/ThreeScene';
import { ConnectButton } from './components/wallet/ConnectButton';
import { DeployButton } from './components/agents/DeployButton';
import './styles/pixel-theme.css';

/**
 * Minecraft-style header with pixel aesthetics
 */
function Header() {
  return (
    <header
      className="pixel-header"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 100,
      }}
    >
      {/* Logo - pixel font with emerald glow */}
      <div
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '16px',
          color: '#5D8C3E',
          textShadow: `
            2px 2px 0 #3D5C2E,
            -1px -1px 0 #7DB356,
            0 0 20px rgba(93, 140, 62, 0.5)
          `,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '20px' }}>⬡</span>
        <span>LANDMIND</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <DeployButton />
        <ConnectButton />
      </div>
    </header>
  );
}

/**
 * Minecraft inventory-style controls overlay
 */
function ControlsOverlay() {
  return (
    <div
      className="pixel-inventory-bg"
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
