import { FC, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { getBalance, formatAddress } from '../../lib/solana';
import { TransactionHistory } from './TransactionHistory';
import '../../styles/pixel-theme.css';

interface WalletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const BALANCE_REFRESH_INTERVAL = 30_000; // 30 seconds

/**
 * Minecraft inventory-style wallet side panel with voxel 3D effects.
 * Slides in from right with balance display and transaction history.
 */
export const WalletDrawer: FC<WalletDrawerProps> = ({ isOpen, onClose }) => {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  // Fetch balance
  useEffect(() => {
    if (!connected || !publicKey) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const bal = await getBalance(connection, publicKey);
        setBalance(bal);
      } catch (err) {
        console.error('Failed to fetch balance:', err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, BALANCE_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [connection, publicKey, connected]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!connected || !publicKey) {
    return null;
  }

  // Overlay styles
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 999,
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    transition: 'opacity 0.2s, visibility 0.2s',
  };

  // Drawer styles - Minecraft inventory panel with enhanced depth
  const drawerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '360px',
    maxWidth: '100vw',
    zIndex: 1000,
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.25s ease-out',
    display: 'flex',
    flexDirection: 'column',
    // Enhanced Minecraft inventory styling
    background: `
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 2px,
        rgba(0, 0, 0, 0.03) 2px,
        rgba(0, 0, 0, 0.03) 4px
      ),
      var(--pixel-inventory-dark)
    `,
    borderLeft: '4px solid var(--pixel-obsidian)',
    boxShadow: '-8px 0 0 0 var(--pixel-inventory), -12px 0 20px rgba(0, 0, 0, 0.5), inset 4px 4px 0 0 rgba(0, 0, 0, 0.5)',
  };

  // Header styles
  const headerStyle: React.CSSProperties = {
    padding: '18px 16px',
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

      {/* Drawer */}
      <div style={drawerStyle} className="pixel-ui">
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
              gap: '10px',
            }}
          >
            <span className="pixel-chest" style={{ transform: 'scale(1.2)' }} />
            <span>WALLET</span>
          </span>
          <button
            onClick={onClose}
            className="pixel-btn-3d"
            style={{
              padding: '6px 12px',
              fontSize: '10px',
              minWidth: 'auto',
            }}
          >
            X
          </button>
        </header>

        {/* Balance Section */}
        <section
          style={{
            padding: '20px 16px',
            borderBottom: '4px solid var(--pixel-stone-dark)',
          }}
        >
          <div className="pixel-slot-enhanced" style={{ padding: '16px', textAlign: 'center' }}>
            <div
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '8px',
                color: '#8B8B8B',
                textTransform: 'uppercase',
                marginBottom: '14px',
                letterSpacing: '0.5px',
              }}
            >
              BALANCE
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '14px',
              }}
            >
              <span className="pixel-sol" style={{ transform: 'scale(1.4)' }} />
              <span
                className="pixel-balance"
                style={{
                  fontSize: '22px',
                  fontFamily: "'Press Start 2P', monospace",
                }}
              >
                {balance !== null ? balance.toFixed(4) : '---'}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: '#FFAA00',
                  fontFamily: "'Press Start 2P', monospace",
                  textShadow: '1px 1px 0 #CC8800',
                }}
              >
                SOL
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '8px',
                color: '#8B8B8B',
                padding: '8px 12px',
                background: 'rgba(0, 0, 0, 0.4)',
                boxShadow: 'inset 2px 2px 0 0 rgba(0, 0, 0, 0.3)',
              }}
            >
              {formatAddress(publicKey.toBase58(), 8)}
            </div>
          </div>
        </section>

        {/* Content - Transaction History */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 16px 16px',
          }}
        >
          <TransactionHistory filterLandMind={false} />
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--pixel-obsidian)',
            borderTop: '4px solid var(--pixel-stone-dark)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px',
            color: '#5F5F5F',
            textAlign: 'center',
            letterSpacing: '0.3px',
          }}
        >
          CLICK TX TO VIEW IN EXPLORER
        </div>
      </div>
    </>
  );
};
