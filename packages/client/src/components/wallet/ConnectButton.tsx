import { FC, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { useWalletSession } from '../../hooks/useWalletSession';
import { getBalance } from '../../lib/solana';
import { AccountMenu } from './AccountMenu';
import { NetworkBadge } from './NetworkBadge';

const BALANCE_REFRESH_INTERVAL = 30_000; // 30 seconds per CONTEXT.md

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#512da8',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 20px',
  color: 'white',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'background-color 0.15s'
};

const buttonDisabledStyle: React.CSSProperties = {
  ...buttonStyle,
  opacity: 0.7,
  cursor: 'not-allowed'
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};

/**
 * Main wallet connect button for header.
 * Shows connect button when disconnected, account menu when connected.
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

  // Show toast for auth errors (simplified - just console for now)
  useEffect(() => {
    if (authError) {
      console.error('Wallet auth error:', authError);
      // TODO: Integrate with toast system in future
    }
  }, [authError]);

  // Loading state during connection or authentication
  if (connecting || isAuthenticating) {
    return (
      <div style={containerStyle}>
        <NetworkBadge network={network} />
        <button style={buttonDisabledStyle} disabled>
          <span className="spinner">&#8635;</span>
          {connecting ? 'Connecting...' : 'Signing...'}
        </button>
      </div>
    );
  }

  // Connected state
  if (connected && publicKey && isAuthenticated) {
    return (
      <div style={containerStyle}>
        <NetworkBadge network={network} />
        <AccountMenu
          address={publicKey.toBase58()}
          balance={balance}
          onDisconnect={logout}
        />
      </div>
    );
  }

  // Disconnected state
  return (
    <div style={containerStyle}>
      <NetworkBadge network={network} />
      <button
        style={buttonStyle}
        onClick={() => setVisible(true)}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#7c4dff')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#512da8')}
      >
        Connect Wallet
      </button>
    </div>
  );
};
