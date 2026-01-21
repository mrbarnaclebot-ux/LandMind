import { FC, useEffect, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { fetchTransactionHistory, TransactionInfo, TransactionFetchError, RpcErrorCode } from '../../lib/transactions';
import { TransactionCard } from './TransactionCard';
import '../../styles/pixel-theme.css';

interface TransactionHistoryProps {
  filterLandMind?: boolean;
}

interface ErrorState {
  message: string;
  code: RpcErrorCode | 'UNKNOWN';
  retryable: boolean;
}

/**
 * Get user-friendly error message based on error code.
 */
function getErrorMessage(code: string): string {
  switch (code) {
    case 'RATE_LIMIT':
      return 'Server busy';
    case 'NETWORK':
      return 'Connection failed';
    default:
      return 'Failed to load';
  }
}

/**
 * Minecraft inventory-style transaction history list with voxel 3D effects.
 * Shows recent transactions with pixel-themed loading/empty states.
 */
export const TransactionHistory: FC<TransactionHistoryProps> = ({
  filterLandMind = false // Default to showing all transactions until LandMind program is deployed
}) => {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [transactions, setTransactions] = useState<TransactionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const txs = await fetchTransactionHistory(
        connection,
        publicKey,
        20,
        filterLandMind
      );
      setTransactions(txs);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      if (err instanceof TransactionFetchError) {
        setError({
          message: getErrorMessage(err.code),
          code: err.code,
          retryable: err.retryable
        });
      } else {
        setError({
          message: 'Failed to load',
          code: 'UNKNOWN',
          retryable: true
        });
      }
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, filterLandMind]);

  useEffect(() => {
    if (!connected || !publicKey) {
      setTransactions([]);
      return;
    }

    loadTransactions();
  }, [connected, publicKey, loadTransactions]);

  if (!connected) {
    return null;
  }

  // Container styles
  const containerStyle: React.CSSProperties = {
    padding: '16px 0',
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '10px',
    color: '#FFFFFF',
    marginBottom: '14px',
    textShadow: '2px 2px 0 #3F3F3F',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  };

  // Loading state - pixel pickaxe mining animation
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={titleStyle}>
          <span className="pixel-scroll" style={{ transform: 'scale(1.1)' }} />
          <span>ACTIVITY</span>
        </div>
        <div
          className="pixel-slot-enhanced"
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '10px',
            color: '#8B8B8B',
          }}
        >
          <span
            className="pixel-loading-enhanced pixel-pickaxe"
            style={{
              display: 'block',
              margin: '0 auto 14px',
              transform: 'scale(1.4)',
            }}
          />
          MINING TX...
        </div>
      </div>
    );
  }

  // Error state - redstone style with retry button
  if (error) {
    return (
      <div style={containerStyle}>
        <div style={titleStyle}>
          <span className="pixel-scroll" style={{ transform: 'scale(1.1)' }} />
          <span>ACTIVITY</span>
        </div>
        <div
          className="pixel-slot-enhanced"
          style={{
            textAlign: 'center',
            padding: '20px 16px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '9px',
          }}
        >
          <span className="pixel-warning" style={{ display: 'block', margin: '0 auto 12px', transform: 'scale(1.3)' }} />
          <div style={{ color: '#FF3333', marginBottom: '12px' }}>
            {error.message}
          </div>
          {error.retryable && (
            <button
              onClick={loadTransactions}
              disabled={loading}
              className="pixel-btn-3d pixel-btn-3d-primary"
              style={{
                fontSize: '8px',
                padding: '8px 16px',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? '...' : 'RETRY'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empty state
  if (transactions.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={titleStyle}>
          <span className="pixel-scroll" style={{ transform: 'scale(1.1)' }} />
          <span>ACTIVITY</span>
        </div>
        <div
          className="pixel-slot-enhanced"
          style={{
            textAlign: 'center',
            padding: '28px 16px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '9px',
            color: '#8B8B8B',
          }}
        >
          <span className="pixel-chest" style={{ display: 'block', margin: '0 auto 12px', transform: 'scale(1.4)' }} />
          {filterLandMind
            ? 'NO LANDMIND TX YET'
            : 'NO TX YET'}
        </div>
      </div>
    );
  }

  // Transaction list
  return (
    <div style={containerStyle}>
      <div style={titleStyle}>
        <span className="pixel-scroll" style={{ transform: 'scale(1.1)' }} />
        <span>ACTIVITY</span>
        <span
          style={{
            fontSize: '8px',
            color: '#8B8B8B',
            marginLeft: 'auto',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '4px 8px',
          }}
        >
          [{transactions.length}]
        </span>
      </div>
      <div className="pixel-inventory-panel" style={{ padding: '6px' }}>
        {transactions.map((tx) => (
          <TransactionCard key={tx.signature} transaction={tx} />
        ))}
      </div>
    </div>
  );
};
