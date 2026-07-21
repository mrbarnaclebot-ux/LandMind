/**
 * Transaction status toast notifications
 *
 * Displays toast notifications for transaction status changes:
 * sending, confirming, retrying, success, error, expired
 */
import { useCallback, useEffect, useState } from 'react';
import { useTransactionStore, TransactionToast, ToastType } from '../../stores/transactionStore';

/**
 * Get Solscan URL for a transaction signature
 */
function getSolscanUrl(signature: string): string {
  // Use devnet for now - could be made configurable via env
  const network = import.meta.env.VITE_SOLANA_NETWORK || 'devnet';
  const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  return `https://solscan.io/tx/${signature}${cluster}`;
}

/**
 * Truncate signature for display
 */
function truncateSignature(signature: string): string {
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
}

/**
 * Get border color class based on toast type
 */
function getBorderColor(type: ToastType): string {
  switch (type) {
    case 'info':
      return 'var(--amber)';
    case 'success':
      return 'var(--teal)';
    case 'warning':
      return 'var(--amber)';
    case 'error':
      return 'var(--ember)';
    default:
      return 'var(--dusk-panel-3)';
  }
}

/**
 * Get icon for toast type
 */
function getIcon(type: ToastType): string {
  switch (type) {
    case 'info':
      return '...';
    case 'success':
      return 'OK';
    case 'warning':
      return '!!';
    case 'error':
      return 'X';
    default:
      return '';
  }
}

interface ToastItemProps {
  toast: TransactionToast;
  onClose: () => void;
}

/**
 * Single toast notification item
 */
function TransactionToastItem({ toast, onClose }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(onClose, 200); // Wait for exit animation
  }, [onClose]);

  const borderColor = getBorderColor(toast.type);
  const icon = getIcon(toast.type);

  return (
    <div
      style={{
        background: 'var(--dusk-panel)',
        border: `4px solid ${borderColor}`,
        boxShadow: `
          inset 4px 4px 0 0 rgba(14, 16, 26, 0.5),
          4px 4px 0 0 rgba(14, 16, 26, 0.3)
        `,
        padding: '12px',
        marginBottom: '8px',
        fontFamily: "var(--font-body)",
        fontSize: '14px',
        color: 'var(--dusk-text)',
        lineHeight: '1.5',
        minWidth: '240px',
        maxWidth: '320px',
        position: 'relative',
        animation: isExiting
          ? 'toastExit 0.2s ease-out forwards'
          : 'toastEnter 0.2s ease-out forwards',
      }}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'var(--dusk-panel-lo)',
          border: 'none',
          color: 'var(--dusk-text-dim)',
          fontFamily: "var(--font-body)",
          fontSize: '13px',
          cursor: 'pointer',
          padding: '2px 6px',
          boxShadow:
            'inset -2px -2px 0 0 var(--dusk-panel-lo), inset 2px 2px 0 0 var(--dusk-panel-hi)',
        }}
      >
        X
      </button>

      {/* Title with icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            background: borderColor,
            color: 'var(--dusk-on-amber)',
            fontFamily: "var(--font-pixel)",
            padding: '2px 6px',
            fontSize: '13px',
          }}
        >
          {icon}
        </span>
        <span
          style={{
            fontFamily: "var(--font-pixel)",
            color: borderColor,
            textShadow: `2px 2px 0 var(--dusk-text-shadow)`,
          }}
        >
          {toast.title.toUpperCase()}
        </span>
      </div>

      {/* Message */}
      <div
        style={{
          color: 'var(--dusk-text-dim)',
          wordBreak: 'break-word',
        }}
      >
        {toast.message}
      </div>

      {/* Signature link (for success toasts) */}
      {toast.signature && toast.type === 'success' && (
        <a
          href={getSolscanUrl(toast.signature)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: '8px',
            color: 'var(--teal)',
            textDecoration: 'none',
            fontSize: '13px',
          }}
        >
          VIEW: {truncateSignature(toast.signature)}
        </a>
      )}
    </div>
  );
}

/**
 * Toast container - renders all active toasts
 */
export function TransactionToastContainer() {
  const { toasts, removeToast } = useTransactionStore();

  // Add keyframe animation styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes toastEnter {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes toastExit {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100%);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        // Above the full HUD stack (RelocationBanner 3200, PhaseClock 3000,
        // SessionExpiredToast 3000, DeployButton menu 2000) so bottom/side
        // strips never cover toasts.
        zIndex: 3300,
        display: 'flex',
        flexDirection: 'column-reverse', // Newest at bottom
      }}
    >
      {toasts.map((toast) => (
        <TransactionToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

/**
 * Hook for showing transaction-related toasts
 * Provides convenience methods for common transaction states
 */
export function useTransactionToast() {
  const { addToast, removeToast, updateToast } = useTransactionStore();

  const showSending = useCallback(() => {
    return addToast({
      type: 'info',
      title: 'Sending',
      message: 'Sending transaction...',
      // Transaction-flow status toast: sticky, replaced by the flow.
      autoHide: null,
    });
  }, [addToast]);

  const showConfirming = useCallback(
    (signature: string, existingId?: string) => {
      if (existingId) {
        updateToast(existingId, {
          title: 'Confirming',
          message: 'Waiting for confirmation...',
          signature,
        });
        return existingId;
      }
      return addToast({
        type: 'info',
        title: 'Confirming',
        message: 'Waiting for confirmation...',
        signature,
        // Transaction-flow status toast: sticky, replaced by the flow.
        autoHide: null,
      });
    },
    [addToast, updateToast]
  );

  const showRetrying = useCallback(
    (attempt: number, priorityFee: number) => {
      return addToast({
        type: 'warning',
        title: 'Retrying',
        message: `Attempt ${attempt + 1} with ${priorityFee} microLamport fee`,
        autoHide: 3000,
      });
    },
    [addToast]
  );

  const showSuccess = useCallback(
    (signature: string, existingId?: string) => {
      if (existingId) {
        removeToast(existingId);
      }
      return addToast({
        type: 'success',
        title: 'Confirmed',
        message: 'Transaction confirmed!',
        signature,
        // Inherits central success default (6500ms).
      });
    },
    [addToast, removeToast]
  );

  const showError = useCallback(
    (error: string, existingId?: string) => {
      if (existingId) {
        removeToast(existingId);
      }
      return addToast({
        type: 'error',
        title: 'Failed',
        message: error,
        // Inherits central error default (10000ms).
      });
    },
    [addToast, removeToast]
  );

  const showExpired = useCallback(
    (existingId?: string) => {
      if (existingId) {
        removeToast(existingId);
      }
      return addToast({
        type: 'error',
        title: 'Expired',
        message: 'Transaction expired. Please try again.',
        // Inherits central error default (10000ms).
      });
    },
    [addToast, removeToast]
  );

  return {
    showSending,
    showConfirming,
    showRetrying,
    showSuccess,
    showError,
    showExpired,
    removeToast,
  };
}
