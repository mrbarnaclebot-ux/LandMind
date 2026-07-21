import { DeployButton } from '../agents/DeployButton';
import { ConnectButton } from '../wallet/ConnectButton';
import { AudioToggle } from './AudioToggle';
import { useConfigStore } from '../../stores/configStore';
import { useWalletStore } from '../../stores/walletStore';
import { useWalletSession } from '../../hooks/useWalletSession';

/**
 * TEST MODE badge + "PLAY TEST MODE" button. Only renders when the server is in
 * fake-SOL mode (GET /api/config). The button starts a lightweight test session
 * (no wallet adapter) via useWalletSession().startTestSession().
 */
function TestModeControls() {
  const fakeSolMode = useConfigStore((s) => s.fakeSolMode);
  const { isAuthenticated } = useWalletStore();
  const { startTestSession, isAuthenticating, authError } = useWalletSession();

  if (!fakeSolMode) return null;

  return (
    <>
      <span
        className="pixel-btn pixel-btn-gold"
        title="Fake-SOL test mode is active — no real SOL or wallet required"
        style={{
          padding: '8px 12px',
          fontSize: '13px',
          cursor: 'default',
          pointerEvents: 'none',
        }}
      >
        TEST MODE — FAKE SOL
      </span>
      {!isAuthenticated && (
        <button
          onClick={() => { void startTestSession(); }}
          disabled={isAuthenticating}
          className={`pixel-btn ${authError ? 'pixel-btn-danger' : 'pixel-btn-primary'}`}
          title={authError || undefined}
          style={{
            padding: '8px 12px',
            fontSize: '10px',
            opacity: isAuthenticating ? 0.7 : 1,
            cursor: isAuthenticating ? 'not-allowed' : 'pointer',
          }}
        >
          {isAuthenticating ? 'STARTING...' : authError ? 'RETRY TEST MODE' : 'PLAY TEST MODE'}
        </button>
      )}
    </>
  );
}

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
      {/* Logo - MINERUSH wordmark (hex emblem + pixel wordmark). The PNG has
          generous transparent margins, so we oversize + clip to land the
          visible mark at ~40px tall. Crisp pixels: no smoothing. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '64px',
          overflow: 'hidden',
        }}
      >
        <img
          src="/brand/minerush-wordmark.png"
          alt="MINERUSH"
          style={{
            height: '96px',
            width: 'auto',
            margin: '-28px 0 -28px -14px',
            objectFit: 'contain',
            imageRendering: 'pixelated',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
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
              background: 'var(--amber)',
              borderColor: 'var(--amber-light)',
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
        <TestModeControls />
        <DeployButton />
        <AudioToggle />
        <ConnectButton />
      </div>
    </header>
  );
}
