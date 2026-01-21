import { FC } from 'react';
import { TransactionInfo, formatTimestamp } from '../../lib/transactions';
import { getExplorerUrl } from '../../lib/solana';
import '../../styles/pixel-theme.css';

interface TransactionCardProps {
  transaction: TransactionInfo;
}

/**
 * Minecraft inventory-slot styled transaction card with voxel 3D effects.
 * Shows transaction type, status, amount, and timestamp.
 * Clickable to open Solana Explorer.
 */
export const TransactionCard: FC<TransactionCardProps> = ({ transaction }) => {
  const { signature, blockTime, status, type, amount } = transaction;

  const handleClick = () => {
    window.open(getExplorerUrl(signature, 'tx', 'devnet'), '_blank');
  };

  // Status colors from pixel theme
  const statusColor = status === 'success' ? '#5D8C3E' : '#FF3333';
  const statusBg = status === 'success' ? 'rgba(93, 140, 62, 0.25)' : 'rgba(255, 51, 51, 0.25)';

  // Transaction type display
  const typeDisplay = {
    deploy: { icon: 'pixel-sword', label: 'DEPLOY' },
    claim: { icon: 'pixel-chest', label: 'CLAIM' },
    transfer: { icon: 'pixel-link', label: 'TRANSFER' },
    unknown: { icon: 'pixel-search', label: 'TX' }
  }[type];

  return (
    <div
      className="pixel-slot-enhanced"
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        marginBottom: '6px',
        transition: 'none',
        padding: '12px',
      }}
    >
      {/* Header row: type + status badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '9px',
            color: '#FFFFFF',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span className={typeDisplay.icon} style={{ transform: 'scale(0.9)' }} />
          {typeDisplay.label}
        </span>
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            background: statusBg,
            color: statusColor,
            fontSize: '7px',
            padding: '4px 8px',
            border: `2px solid ${statusColor}`,
            boxShadow: `inset 0 1px 0 0 ${status === 'success' ? '#7DB356' : '#FF6666'}`,
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
            style={{
              fontSize: '8px',
              color: amount >= 0 ? '#5D8C3E' : '#FFAA00',
              textShadow: amount >= 0 ? '1px 1px 0 #3D5C2E' : '1px 1px 0 #CC8800',
            }}
          >
            {amount >= 0 ? '+' : ''}{amount.toFixed(4)} SOL
          </span>
        )}
      </div>

      {/* Signature (truncated) */}
      <div
        style={{
          marginTop: '8px',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '6px',
          color: '#5F5F5F',
          letterSpacing: '0.3px',
          background: 'rgba(0, 0, 0, 0.2)',
          padding: '4px 6px',
        }}
      >
        {signature.slice(0, 8)}...{signature.slice(-8)}
      </div>
    </div>
  );
};
