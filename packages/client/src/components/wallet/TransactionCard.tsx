import { FC } from 'react';
import { TransactionInfo, formatTimestamp } from '../../lib/transactions';
import { getExplorerUrl } from '../../lib/solana';
import '../../styles/pixel-theme.css';

interface TransactionCardProps {
  transaction: TransactionInfo;
}

/**
 * Minecraft inventory-slot styled transaction card.
 * Shows transaction type, status, amount, and timestamp.
 * Clickable to open Solana Explorer.
 */
export const TransactionCard: FC<TransactionCardProps> = ({ transaction }) => {
  const { signature, blockTime, status, type, amount } = transaction;

  const handleClick = () => {
    window.open(getExplorerUrl(signature, 'tx', 'devnet'), '_blank');
  };

  // Transaction type icon mapping (pixel style)
  const typeIcon = {
    deploy: '[]',
    claim: '{}',
    transfer: '->',
    unknown: '??'
  }[type];

  // Status colors from pixel theme
  const statusColor = status === 'success' ? '#5D8C3E' : '#FF3333';
  const statusBg = status === 'success' ? 'rgba(93, 140, 62, 0.2)' : 'rgba(255, 51, 51, 0.2)';

  return (
    <div
      className="pixel-slot"
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        marginBottom: '4px',
        transition: 'none',
      }}
    >
      {/* Header row: type + status badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '10px',
            color: '#FFFFFF',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ color: '#55CDFC' }}>{typeIcon}</span>
          {type}
        </span>
        <span
          className="pixel-badge"
          style={{
            background: statusBg,
            color: statusColor,
            fontSize: '6px',
            padding: '2px 6px',
            boxShadow: `inset -2px -2px 0 0 ${statusColor}40, inset 2px 2px 0 0 ${statusColor}80`,
          }}
        >
          {status === 'success' ? 'OK' : 'FAIL'}
        </span>
      </div>

      {/* Details row: timestamp + amount */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '8px',
        }}
      >
        <span style={{ color: '#8B8B8B' }}>
          {formatTimestamp(blockTime)}
        </span>
        {amount !== null && (
          <span
            className="pixel-balance"
            style={{
              fontSize: '8px',
              color: amount >= 0 ? '#5D8C3E' : '#FFAA00',
            }}
          >
            {amount >= 0 ? '+' : ''}{amount.toFixed(4)} SOL
          </span>
        )}
      </div>

      {/* Signature (truncated) */}
      <div
        style={{
          marginTop: '6px',
          fontFamily: "monospace",
          fontSize: '8px',
          color: '#5F5F5F',
          letterSpacing: '-0.5px',
        }}
      >
        {signature.slice(0, 8)}...{signature.slice(-8)}
      </div>
    </div>
  );
};
