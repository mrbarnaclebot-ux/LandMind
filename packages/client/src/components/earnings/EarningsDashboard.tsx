/**
 * EarningsDashboard - Side panel showing user's earnings
 * Slides from right, mirrors AgentDashboard pattern from left
 */
import { FC, useEffect, useState } from 'react';
import { useEarnings } from '../../hooks/useEarnings';
import { useClaimEarnings } from '../../hooks/useClaimEarnings';
import { useWalletStore } from '../../stores/walletStore';
import { ClaimButton } from './ClaimButton';
import { ClaimConfirmDialog } from './ClaimConfirmDialog';
import { getExplorerUrl } from '../../lib/solana';
import '../../styles/pixel-theme.css';

interface EarningsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

// Format large numbers for display
function formatScore(value: string): string {
  const num = BigInt(value);
  if (num >= 1_000_000_000n) return `${Number(num / 1_000_000_000n).toFixed(1)}B`;
  if (num >= 1_000_000n) return `${Number(num / 1_000_000n).toFixed(1)}M`;
  if (num >= 1_000n) return `${Number(num / 1_000n).toFixed(1)}K`;
  return num.toString();
}

// Format rank with suffix
function formatRank(rank: number | null): string {
  if (rank === null) return '--';
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = rank % 100;
  return rank + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

export const EarningsDashboard: FC<EarningsDashboardProps> = ({
  isOpen,
  onClose,
}) => {
  const { isAuthenticated } = useWalletStore();
  const {
    claimableSOL,
    totalClaimedSOL,
    minClaimSOL,
    weightedScore,
    sharePercent,
    rank,
    percentile,
    canClaim,
    isLoading,
    error,
    reload,
  } = useEarnings();

  const {
    status: claimStatus,
    error: claimError,
    txSignature,
    isProcessing,
    claim,
    reset: resetClaim,
  } = useClaimEarnings();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showConfirmDialog) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, showConfirmDialog]);

  // Reset claim state when panel closes
  useEffect(() => {
    if (!isOpen) {
      resetClaim();
      setShowConfirmDialog(false);
    }
  }, [isOpen, resetClaim]);

  if (!isAuthenticated) {
    return null;
  }

  const handleClaimClick = () => {
    if (canClaim && claimStatus === 'idle') {
      setShowConfirmDialog(true);
    } else if (claimStatus === 'error') {
      resetClaim();
    }
  };

  const handleConfirmClaim = async () => {
    setShowConfirmDialog(false);
    await claim();
  };

  // Panel styles (mirror WalletDrawer, but from right)
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 999,
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    transition: 'opacity 0.2s, visibility 0.2s',
  };

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '320px',
    maxWidth: '100vw',
    zIndex: 1000,
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.25s ease-out',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--pixel-inventory-dark)',
    border: '4px solid var(--pixel-obsidian)',
    boxShadow: '-8px 0 0 0 var(--pixel-inventory), inset 4px 4px 0 0 rgba(0, 0, 0, 0.5)',
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px',
    background: 'var(--pixel-obsidian)',
    borderBottom: '4px solid var(--pixel-stone-dark)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: 'inset 0 4px 0 0 var(--pixel-obsidian-light)',
  };

  return (
    <>
      {/* Overlay */}
      <div style={overlayStyle} onClick={onClose} />

      {/* Panel */}
      <div style={panelStyle} className="pixel-ui">
        {/* Header */}
        <header style={headerStyle}>
          <span
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '12px',
              color: '#FFFFFF',
              textShadow: '2px 2px 0 #3F3F3F',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ color: '#FFAA00' }}>[+]</span>
            EARNINGS
          </span>
          <button
            onClick={onClose}
            className="pixel-btn"
            style={{
              padding: '6px 10px',
              fontSize: '10px',
              minWidth: 'auto',
            }}
          >
            X
          </button>
        </header>

        {/* Main Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {/* Loading State */}
          {isLoading && (
            <div
              style={{
                textAlign: 'center',
                padding: '32px',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '8px',
                color: '#8B8B8B',
              }}
            >
              <span className="pixel-loading" style={{ fontSize: '16px', display: 'block', marginBottom: '12px' }}>
                [+]
              </span>
              LOADING EARNINGS...
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div
              style={{
                padding: '16px',
                background: 'rgba(255, 51, 51, 0.1)',
                border: '2px solid var(--pixel-redstone)',
                marginBottom: '16px',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '7px',
                color: '#FF6666',
              }}
            >
              {error}
              <button
                onClick={reload}
                className="pixel-btn"
                style={{
                  marginTop: '8px',
                  padding: '6px 10px',
                  fontSize: '7px',
                  width: '100%',
                }}
              >
                RETRY
              </button>
            </div>
          )}

          {/* Content */}
          {!isLoading && !error && (
            <>
              {/* Claimable SOL - Hero Section */}
              <section
                style={{
                  background: 'linear-gradient(180deg, #3D3D41 0%, #2D2D31 100%)',
                  padding: '20px 16px',
                  marginBottom: '16px',
                  border: '2px solid var(--pixel-obsidian)',
                  boxShadow: 'inset 2px 2px 0 0 #4D4D51, inset -2px -2px 0 0 #1D1D21',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '7px',
                    color: '#8B8B8B',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  CLAIMABLE
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#4CAF50',
                      fontSize: '6px',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#4CAF50',
                        animation: 'pulse 2s infinite',
                      }}
                    />
                    LIVE
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '20px',
                    color: '#FFAA00',
                    textShadow: '2px 2px 0 #CC8800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span className="pixel-sol" style={{ width: '16px', height: '16px' }} />
                  {claimableSOL.toFixed(4)}
                </div>
                <div
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '7px',
                    color: '#6B6B6B',
                    marginTop: '4px',
                  }}
                >
                  SOL
                </div>
              </section>

              {/* Claim Button */}
              <section style={{ marginBottom: '16px' }}>
                <ClaimButton
                  claimableSOL={claimableSOL}
                  minClaimSOL={minClaimSOL}
                  canClaim={canClaim}
                  status={claimStatus}
                  onClaim={handleClaimClick}
                />

                {/* Claim error */}
                {claimError && (
                  <div
                    style={{
                      marginTop: '8px',
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: '6px',
                      color: '#FF6666',
                      textAlign: 'center',
                    }}
                  >
                    {claimError}
                  </div>
                )}

                {/* Success message with explorer link */}
                {claimStatus === 'success' && txSignature && (
                  <div
                    style={{
                      marginTop: '8px',
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: '7px',
                      color: '#4CAF50',
                      textAlign: 'center',
                    }}
                  >
                    Claim successful!
                    <a
                      href={getExplorerUrl(txSignature, 'tx', 'devnet')}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        marginTop: '4px',
                        color: '#55CDFC',
                        textDecoration: 'none',
                      }}
                    >
                      VIEW TX [+]
                    </a>
                  </div>
                )}
              </section>

              {/* Stats Grid */}
              <section
                style={{
                  background: '#2D2D31',
                  padding: '12px',
                  border: '2px solid var(--pixel-obsidian)',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '7px',
                  }}
                >
                  {/* Total Claimed */}
                  <div>
                    <div style={{ color: '#8B8B8B', marginBottom: '4px' }}>CLAIMED</div>
                    <div style={{ color: '#55CDFC', fontSize: '10px' }}>
                      {totalClaimedSOL.toFixed(4)}
                    </div>
                    <div style={{ color: '#5B5B5B', fontSize: '6px' }}>SOL</div>
                  </div>

                  {/* Mining Score */}
                  <div>
                    <div style={{ color: '#8B8B8B', marginBottom: '4px' }}>SCORE</div>
                    <div style={{ color: '#7DB356', fontSize: '10px' }}>
                      {formatScore(weightedScore)}
                    </div>
                    <div style={{ color: '#5B5B5B', fontSize: '6px' }}>WEIGHTED</div>
                  </div>

                  {/* Pool Share */}
                  <div>
                    <div style={{ color: '#8B8B8B', marginBottom: '4px' }}>SHARE</div>
                    <div style={{ color: '#FFAA00', fontSize: '10px' }}>
                      {sharePercent.toFixed(2)}%
                    </div>
                    <div style={{ color: '#5B5B5B', fontSize: '6px' }}>OF POOL</div>
                  </div>

                  {/* Rank */}
                  <div>
                    <div style={{ color: '#8B8B8B', marginBottom: '4px' }}>RANK</div>
                    <div style={{ color: '#55CDFC', fontSize: '10px' }}>
                      {formatRank(rank)}
                    </div>
                    <div style={{ color: '#5B5B5B', fontSize: '6px' }}>
                      TOP {percentile > 0 ? Math.ceil(100 - percentile) : '--'}%
                    </div>
                  </div>
                </div>
              </section>

              {/* Info Section */}
              <section
                style={{
                  padding: '12px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '6px',
                  color: '#6B6B6B',
                  lineHeight: '1.8',
                }}
              >
                <p style={{ marginBottom: '8px' }}>
                  Earnings accumulate from platform fees. Your share is based on weighted mining score.
                </p>
                <p>
                  <span style={{ color: '#FFD700' }}>Au</span> 4x |{' '}
                  <span style={{ color: '#C0C0C0' }}>Ag</span> 2x |{' '}
                  <span style={{ color: '#B87333' }}>Cu</span> 1.5x |{' '}
                  <span style={{ color: '#708090' }}>Fe</span> 1x
                </p>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--pixel-obsidian)',
            borderTop: '4px solid var(--pixel-stone-dark)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px',
            color: '#5F5F5F',
            textAlign: 'center',
          }}
        >
          MIN CLAIM: {minClaimSOL} SOL
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ClaimConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmClaim}
        claimableSOL={claimableSOL}
        isProcessing={isProcessing}
      />
    </>
  );
};
