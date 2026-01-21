import { FC, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { useWalletSession } from '../../hooks/useWalletSession';
import { getBalance } from '../../lib/solana';
import { AccountMenu } from './AccountMenu';
import { NetworkBadge } from './NetworkBadge';
import { WalletDrawer } from './WalletDrawer';
import '../../styles/pixel-theme.css';

const BALANCE_REFRESH_INTERVAL = 30_000; // 30 seconds

/**
 * Minecraft-styled wallet connect button with voxel 3D effects.
 * Shows blocky 3D button when disconnected, inventory-slot menu when connected.
 */
export const ConnectButton: FC = () => {
  const { connection } = useConnection();
  const { publicKey, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const {
    isAuthenticated,
    isAuthenticating,
    authError,
    authenticate,
    logout
  } = useWalletSession();

  const [balance, setBalance] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Determine current network from connection endpoint
  const network = connection.rpcEndpoint.includes('devnet')
    ? WalletAdapterNetwork.Devnet
    : connection.rpcEndpoint.includes('mainnet')
      ? WalletAdapterNetwork.Mainnet
      : WalletAdapterNetwork.Devnet;

  // Fetch balance on connect and refresh periodically
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

  // Auto-authenticate when wallet connects
  useEffect(() => {
    if (connected && publicKey && !isAuthenticated && !isAuthenticating) {
      authenticate();
    }
  }, [connected, publicKey, isAuthenticated, isAuthenticating, authenticate]);

  // Show toast for auth errors
  useEffect(() => {
    if (authError) {
      console.error('Wallet auth error:', authError);
    }
  }, [authError]);

  // Container with network badge
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  // Loading state - pixel pickaxe mining animation
  if (connecting || isAuthenticating) {
    return (
      <div style={containerStyle}>
        <NetworkBadge network={network} />
        <button
          className="pixel-btn-3d"
          disabled
          style={{
            minWidth: '160px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            opacity: 0.8,
          }}
        >
          <span className="pixel-loading-enhanced pixel-pickaxe" style={{ transform: 'scale(1.2)' }} />
          <span>{connecting ? 'LINKING' : 'SIGNING'}</span>
        </button>
      </div>
    );
  }

  // Connected and authenticated - show account menu
  if (connected && publicKey && isAuthenticated) {
    return (
      <>
        <div style={containerStyle}>
          <NetworkBadge network={network} />
          <AccountMenu
            address={publicKey.toBase58()}
            balance={balance}
            onDisconnect={logout}
            onViewHistory={() => setDrawerOpen(true)}
          />
        </div>
        <WalletDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      </>
    );
  }

  // Connected but auth failed - redstone/error style with retry
  if (connected && publicKey) {
    const shortAddress = `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`;

    return (
      <div style={containerStyle}>
        <NetworkBadge network={network} />
        <button
          className={`pixel-btn-3d ${authError ? 'pixel-btn-3d-danger' : ''}`}
          onClick={authError ? () => authenticate() : undefined}
          title={authError || 'Authenticating...'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
          }}
        >
          {authError ? (
            <>
              <span className="pixel-warning" style={{ transform: 'scale(1.1)' }} />
              <span>{shortAddress}</span>
              <span
                style={{
                  fontSize: '7px',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '2px 6px',
                  marginLeft: '4px',
                }}
              >
                RETRY
              </span>
            </>
          ) : (
            <>
              <span className="pixel-loading-enhanced pixel-pickaxe" style={{ transform: 'scale(1.1)' }} />
              <span>{shortAddress}</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Disconnected - emerald green connect button with 3D depth
  return (
    <div style={containerStyle}>
      <NetworkBadge network={network} />
      <button
        className="pixel-btn-3d pixel-btn-3d-primary"
        onClick={() => setVisible(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 20px',
        }}
      >
        <span className="pixel-link" style={{ transform: 'scale(1.1)' }} />
        <span>CONNECT</span>
      </button>
    </div>
  );
};
