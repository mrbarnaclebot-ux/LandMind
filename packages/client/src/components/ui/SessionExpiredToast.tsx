/**
 * Global "Session expired — reconnect" toast.
 *
 * Shown whenever a live session is invalidated out from under the user: any
 * authenticated API call comes back 401 while the client still believed it was
 * authenticated (stale/expired/dropped cookie). The wallet store's global 401
 * handler flips `sessionExpiredNotice`; this component surfaces it so the UI
 * never silently lies about being logged in.
 *
 * Rendered once at the app root (desktop + mobile) so it works regardless of
 * which layout is active. Auto-dismisses after a short delay, and can be
 * dismissed by clicking. A fresh login also clears the notice (see setSession).
 */
import { FC, useEffect } from 'react';
import { useWalletStore } from '../../stores/walletStore';

// Warning-severity notice: matches the standardized warning toast duration
// (see DEFAULT_TOAST_DURATION in transactionStore). Click-to-dismiss remains.
const AUTO_DISMISS_MS = 8000;

export const SessionExpiredToast: FC = () => {
  const sessionExpiredNotice = useWalletStore((s) => s.sessionExpiredNotice);
  const clearSessionExpiredNotice = useWalletStore((s) => s.clearSessionExpiredNotice);

  useEffect(() => {
    if (!sessionExpiredNotice) return;
    const timer = setTimeout(clearSessionExpiredNotice, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [sessionExpiredNotice, clearSessionExpiredNotice]);

  if (!sessionExpiredNotice) return null;

  return (
    <div
      role="status"
      onClick={clearSessionExpiredNotice}
      style={{
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 20px',
        fontFamily: 'var(--font-body)',
        fontSize: '13px',
        lineHeight: 1.5,
        color: 'var(--dusk-on-amber)',
        background: 'var(--ember)',
        boxShadow: '4px 4px 0 rgba(14, 16, 26, 0.3)',
        cursor: 'pointer',
        zIndex: 3000,
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      Session expired — please reconnect
    </div>
  );
};
