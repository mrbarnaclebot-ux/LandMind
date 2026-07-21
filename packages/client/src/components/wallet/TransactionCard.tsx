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
  const statusColor = status === 'success' ? 'var(--teal)' : 'var(--ember)';
  const statusBg = status === 'success' ? 'rgba(63, 182, 168, 0.25)' : 'rgba(224, 85, 60, 0.25)';

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
            fontFamily: "var(--font-body)",
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--dusk-text)',
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
            fontFamily: "var(--font-body)",
            background: statusBg,
            color: statusColor,
            fontSize: '13px',
            lineHeight: 1.5,
            padding: '4px 8px',
            border: `2px solid ${statusColor}`,
            boxShadow: `inset 0 1px 0 0 ${status === 'success' ? 'var(--teal-light)' : 'var(--ember-light)'}`,
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
          fontFamily: "var(--font-body)",
          fontSize: '13px',
          lineHeight: 1.5,
        }}
      >
        <span style={{ color: 'var(--dusk-text-dim)' }}>
          {formatTimestamp(blockTime)}
        </span>
        {amount !== null && (
          <span
            style={{
              fontSize: '13px',
              lineHeight: 1.5,
              color: amount >= 0 ? 'var(--teal)' : 'var(--amber)',
              textShadow: amount >= 0 ? '1px 1px 0 var(--teal-dark)' : '1px 1px 0 var(--amber-dark)',
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
          fontFamily: "var(--font-body)",
          fontSize: '13px',
          lineHeight: 1.5,
          color: 'var(--dusk-text-faint)',
          letterSpacing: '0.3px',
          background: 'rgba(14, 16, 26, 0.2)',
          padding: '4px 6px',
        }}
      >
        {signature.slice(0, 8)}...{signature.slice(-8)}
      </div>
    </div>
  );
};
