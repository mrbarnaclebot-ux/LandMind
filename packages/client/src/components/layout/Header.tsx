import { DeployButton } from '../agents/DeployButton';
import { ConnectButton } from '../wallet/ConnectButton';

export interface HeaderProps {
  onOpenAgentDashboard: () => void;
  onToggleHeatMap: () => void;
  heatMapVisible: boolean;
  onToggleEarnings: () => void;
  earningsVisible: boolean;
  onOpenAdmin?: () => void;
  isAdmin?: boolean;
}

/**
 * Minecraft-style header with pixel aesthetics (desktop only)
 */
export function Header({
  onOpenAgentDashboard,
  onToggleHeatMap,
  heatMapVisible,
  onToggleEarnings,
  earningsVisible,
  onOpenAdmin,
  isAdmin,
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
        {isAdmin && onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="pixel-btn"
            style={{
              padding: '8px 12px',
              fontSize: '10px',
              opacity: 0.9,
              background: '#5D8C3E',
              borderColor: '#7DB356',
            }}
          >
            ADMIN
          </button>
        )}
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
