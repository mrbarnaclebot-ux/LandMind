import { useState, useCallback } from 'react';
import { ThreeScene } from './scene/ThreeScene';
import { ConnectButton } from './components/wallet/ConnectButton';
import { DeployButton } from './components/agents/DeployButton';
import { AgentDashboard } from './components/agents/AgentDashboard';
import { Leaderboard } from './components/earnings/Leaderboard';
import { useCameraStore } from './stores/cameraStore';
import { hexToPixel } from './hex/hexMath';
import './styles/pixel-theme.css';

interface HeaderProps {
  onOpenAgentDashboard: () => void;
  onToggleHeatMap: () => void;
  heatMapVisible: boolean;
  onToggleEarnings: () => void;
  earningsVisible: boolean;
}

/**
 * Minecraft-style header with pixel aesthetics
 */
function Header({
  onOpenAgentDashboard,
  onToggleHeatMap,
  heatMapVisible,
  onToggleEarnings,
  earningsVisible,
}: HeaderProps) {
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
        <button
          onClick={onToggleEarnings}
          className={`pixel-btn ${earningsVisible ? 'pixel-btn-gold' : ''}`}
          style={{
            padding: '8px 12px',
            fontSize: '10px',
            opacity: 0.9,
          }}
        >
          EARNINGS
        </button>
        <button
          onClick={onToggleHeatMap}
          className={`pixel-btn ${heatMapVisible ? 'pixel-btn-primary' : ''}`}
          style={{
            padding: '8px 12px',
            fontSize: '10px',
            opacity: 0.9,
          }}
        >
          HEAT MAP
        </button>
        <button
          onClick={onOpenAgentDashboard}
          className="pixel-btn"
          style={{
            padding: '8px 12px',
            fontSize: '10px',
            opacity: 0.9,
          }}
        >
          MY AGENTS
        </button>
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
  const [isAgentDashboardOpen, setIsAgentDashboardOpen] = useState(false);
  const [heatMapVisible, setHeatMapVisible] = useState(false);
  const [earningsVisible, setEarningsVisible] = useState(false);
  const { panToPosition } = useCameraStore();

  // Camera pan callback - pans camera to hex location
  const handleLocateAgent = useCallback((q: number, r: number) => {
    // Convert hex coordinates to world position
    const { x, z } = hexToPixel(q, r);
    // Pan camera to that position (y=0 for ground level)
    panToPosition(x, 0, z);
    // Close panel after locate
    setIsAgentDashboardOpen(false);
  }, [panToPosition]);

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}>
      <Header
        onOpenAgentDashboard={() => setIsAgentDashboardOpen(true)}
        onToggleHeatMap={() => setHeatMapVisible((v) => !v)}
        heatMapVisible={heatMapVisible}
        onToggleEarnings={() => setEarningsVisible((v) => !v)}
        earningsVisible={earningsVisible}
      />
      <ThreeScene heatMapVisible={heatMapVisible} />
      <ControlsOverlay />
      <AgentDashboard
        isOpen={isAgentDashboardOpen}
        onClose={() => setIsAgentDashboardOpen(false)}
        onLocateAgent={handleLocateAgent}
      />
      {/* Earnings/Leaderboard panel */}
      {earningsVisible && (
        <div
          style={{
            position: 'absolute',
            top: '80px',
            right: '16px',
            zIndex: 100,
          }}
        >
          <Leaderboard />
        </div>
      )}
    </div>
  );
}

export default App;
