/**
 * ClaimButton - Pixel-themed button for claiming earnings
 * Shows loading states and disabled when below minimum
 */
import { FC } from 'react';
import { ClaimStatus } from '../../hooks/useClaimEarnings';
import '../../styles/pixel-theme.css';

interface ClaimButtonProps {
  claimableSOL: number;
  minClaimSOL: number;
  canClaim: boolean;
  status: ClaimStatus;
  onClaim: () => void;
  disabled?: boolean;
}

// Status text mapping
const statusText: Record<ClaimStatus, string> = {
  idle: 'CLAIM SOL',
  building: 'BUILDING...',
  signing: 'SIGN TX...',
  sending: 'SENDING...',
  confirming: 'CONFIRMING...',
  success: 'CLAIMED!',
  error: 'TRY AGAIN',
};

export const ClaimButton: FC<ClaimButtonProps> = ({
  claimableSOL,
  minClaimSOL,
  canClaim,
  status,
  onClaim,
  disabled = false,
}) => {
  const isProcessing = ['building', 'signing', 'sending', 'confirming'].includes(status);
  const isDisabled = disabled || !canClaim || isProcessing;
  const isSuccess = status === 'success';
  const isError = status === 'error';

  // Button text
  const buttonText = status === 'idle'
    ? `CLAIM ${claimableSOL.toFixed(4)} SOL`
    : statusText[status];

  // Button class based on state
  let buttonClass = 'pixel-btn';
  if (isSuccess) {
    buttonClass += ' pixel-btn-primary';
  } else if (isError) {
    buttonClass += ' pixel-btn-danger';
  } else if (canClaim && !isProcessing) {
    buttonClass += ' pixel-btn-gold';
  }

  return (
    <div style={{ width: '100%' }}>
      <button
        className={buttonClass}
        onClick={onClaim}
        disabled={isDisabled}
        style={{
          width: '100%',
          padding: '14px 16px',
          fontSize: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {/* SOL icon */}
        {status === 'idle' && canClaim && (
          <span className="pixel-sol" style={{ width: '12px', height: '12px' }} />
        )}

        {/* Loading pickaxe animation */}
        {isProcessing && (
          <span className="pixel-loading" style={{ fontSize: '12px' }}>
            [+]
          </span>
        )}

        {/* Success checkmark */}
        {isSuccess && (
          <span style={{ color: '#7DB356' }}>[OK]</span>
        )}

        {/* Error indicator */}
        {isError && (
          <span style={{ color: '#FF6666' }}>[!]</span>
        )}

        {buttonText}
      </button>

      {/* Minimum claim notice */}
      {!canClaim && status === 'idle' && (
        <div
          style={{
            marginTop: '8px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px',
            color: '#8B8B8B',
            textAlign: 'center',
          }}
        >
          MIN: {minClaimSOL} SOL
        </div>
      )}
    </div>
  );
};
