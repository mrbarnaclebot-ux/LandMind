import { FC, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { fetchTransactionHistory, TransactionInfo } from '../../lib/transactions';
import { TransactionCard } from './TransactionCard';
import '../../styles/pixel-theme.css';

interface TransactionHistoryProps {
  filterLandMind?: boolean;
}

/**
 * Minecraft inventory-style transaction history list.
 * Shows recent transactions with pixel-themed loading/empty states.
 */
export const TransactionHistory: FC<TransactionHistoryProps> = ({
  filterLandMind = false // Default to showing all transactions until LandMind program is deployed
}) => {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [transactions, setTransactions] = useState<TransactionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      setTransactions([]);
      return;
    }

    const loadTransactions = async () => {
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
        setError('Failed to load');
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [connection, publicKey, connected, filterLandMind]);

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
    marginBottom: '12px',
    textShadow: '2px 2px 0 #3F3F3F',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  // Loading state - pickaxe animation
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={titleStyle}>
          <span style={{ color: '#55CDFC' }}>[]</span>
          ACTIVITY
        </div>
        <div
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '10px',
            color: '#8B8B8B',
          }}
        >
          <span className="pixel-loading" style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>
            []
          </span>
          MINING TX...
        </div>
      </div>
    );
  }

  // Error state - redstone style
  if (error) {
    return (
      <div style={containerStyle}>
        <div style={titleStyle}>
          <span style={{ color: '#55CDFC' }}>[]</span>
          ACTIVITY
        </div>
        <div
          style={{
            textAlign: 'center',
            padding: '16px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '8px',
            color: '#FF3333',
          }}
        >
          !! {error} !!
        </div>
      </div>
    );
  }

  // Empty state
  if (transactions.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={titleStyle}>
          <span style={{ color: '#55CDFC' }}>[]</span>
          ACTIVITY
        </div>
        <div
          className="pixel-slot"
          style={{
            textAlign: 'center',
            padding: '24px 16px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '8px',
            color: '#8B8B8B',
          }}
        >
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
        <span style={{ color: '#55CDFC' }}>[]</span>
        ACTIVITY
        <span style={{ fontSize: '8px', color: '#8B8B8B', marginLeft: 'auto' }}>
          [{transactions.length}]
        </span>
      </div>
      <div className="pixel-inventory-bg" style={{ padding: '4px' }}>
        {transactions.map((tx) => (
          <TransactionCard key={tx.signature} transaction={tx} />
        ))}
      </div>
    </div>
  );
};
