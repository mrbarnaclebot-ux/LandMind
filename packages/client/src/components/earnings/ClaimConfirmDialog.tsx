/**
 * ClaimConfirmDialog - Confirmation dialog before claiming earnings
 * Minecraft inventory-style modal
 */
import { FC, useEffect } from 'react';
import '../../styles/pixel-theme.css';

interface ClaimConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  claimableSOL: number;
  isProcessing: boolean;
}

export const ClaimConfirmDialog: FC<ClaimConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  claimableSOL,
  isProcessing,
}) => {
  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(14, 16, 26, 0.8)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'fadeIn 0.15s ease-out',
  };

  const dialogStyle: React.CSSProperties = {
    background: 'var(--pixel-inventory-dark)',
    border: '4px solid var(--pixel-obsidian)',
    boxShadow: '0 0 0 4px var(--pixel-inventory), 8px 8px 0 0 rgba(14, 16, 26, 0.4)',
    padding: '0',
    maxWidth: '340px',
    width: '90%',
    animation: 'slideUp 0.2s ease-out',
  };

  const headerStyle: React.CSSProperties = {
    padding: '12px 16px',
    background: 'var(--pixel-obsidian)',
    borderBottom: '4px solid var(--pixel-stone-dark)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: 'inset 0 4px 0 0 var(--pixel-obsidian-light)',
  };

  const contentStyle: React.CSSProperties = {
    padding: '20px 16px',
  };

  const footerStyle: React.CSSProperties = {
    padding: '12px 16px',
    background: 'var(--dusk-panel-2)',
    borderTop: '4px solid var(--pixel-stone-dark)',
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  };

  return (
    <div style={overlayStyle} onClick={isProcessing ? undefined : onClose}>
      <div
        style={dialogStyle}
        className="pixel-ui"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header style={headerStyle}>
          <span
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: '10px',
              color: 'var(--dusk-text)',
              textShadow: '2px 2px 0 var(--dusk-text-shadow)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ color: 'var(--amber)' }}>[!]</span>
            CONFIRM CLAIM
          </span>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="pixel-btn"
              style={{
                padding: '4px 8px',
                fontSize: '8px',
                minWidth: 'auto',
              }}
            >
              X
            </button>
          )}
        </header>

        {/* Content */}
        <div style={contentStyle}>
          {/* Amount display */}
          <div
            style={{
              background: 'rgba(14, 16, 26, 0.3)',
              padding: '16px',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--dusk-text-dim)',
                marginBottom: '8px',
              }}
            >
              YOU WILL RECEIVE
            </div>
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: '16px',
                color: 'var(--amber)',
                textShadow: '2px 2px 0 var(--amber-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span className="pixel-sol" style={{ width: '14px', height: '14px' }} />
              {claimableSOL.toFixed(4)} SOL
            </div>
          </div>

          {/* Warning text */}
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: '13px',
              color: 'var(--dusk-text-dim)',
              lineHeight: '1.5',
            }}
          >
            <p style={{ marginBottom: '8px' }}>
              This will transfer SOL from the LandMind treasury to your wallet.
            </p>
            <p style={{ color: 'var(--amber)' }}>
              Transaction fee: ~0.000005 SOL
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <button
            onClick={onClose}
            className="pixel-btn"
            disabled={isProcessing}
            style={{
              padding: '10px 16px',
              fontSize: '9px',
            }}
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="pixel-btn pixel-btn-gold"
            disabled={isProcessing}
            style={{
              padding: '10px 16px',
              fontSize: '9px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isProcessing ? (
              <>
                <span className="pixel-loading">[+]</span>
                PROCESSING...
              </>
            ) : (
              <>
                <span className="pixel-sol" style={{ width: '10px', height: '10px' }} />
                CLAIM NOW
              </>
            )}
          </button>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
