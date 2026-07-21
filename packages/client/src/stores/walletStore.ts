import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { registerUnauthorizedHandler } from '../lib/apiFetch';

interface WalletSession {
  // Session state
  isAuthenticated: boolean;
  walletAddress: string | null;
  userId: string | null;
  sessionExpiry: number | null; // Unix timestamp in ms

  // UI state
  isAuthenticating: boolean;
  authError: string | null;
  /**
   * Set when a live session is invalidated out from under the user (any API
   * 401 while 'authenticated'). Drives a small "Session expired — reconnect"
   * toast. Cleared on the next successful login. NOT persisted.
   */
  sessionExpiredNotice: boolean;

  // Actions
  setSession: (address: string, userId: string, expiry: number) => void;
  clearSession: () => void;
  /**
   * Clear the session because the server rejected us (401) while we believed we
   * were authenticated. Same as clearSession() but also raises the
   * "session expired" notice so the UI can explain why the state changed.
   */
  expireSession: () => void;
  clearSessionExpiredNotice: () => void;
  setAuthenticating: (value: boolean) => void;
  setAuthError: (error: string | null) => void;
  isSessionValid: () => boolean;
}

export const useWalletStore = create<WalletSession>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      walletAddress: null,
      userId: null,
      sessionExpiry: null,
      isAuthenticating: false,
      authError: null,
      sessionExpiredNotice: false,

      // Set session after successful authentication
      setSession: (address, userId, expiry) => set({
        isAuthenticated: true,
        walletAddress: address,
        userId,
        sessionExpiry: expiry,
        isAuthenticating: false,
        authError: null,
        // A fresh successful login clears any stale "session expired" notice.
        sessionExpiredNotice: false
      }),

      // Clear session on logout or auth failure
      clearSession: () => set({
        isAuthenticated: false,
        walletAddress: null,
        userId: null,
        sessionExpiry: null,
        isAuthenticating: false,
        authError: null
      }),

      // Clear session AND flag that it expired unexpectedly (drives the toast).
      // Guarded so a burst of concurrent 401s (deploy + agents + earnings) only
      // raises the notice once and doesn't thrash if already logged out.
      expireSession: () => {
        if (!get().isAuthenticated) return;
        set({
          isAuthenticated: false,
          walletAddress: null,
          userId: null,
          sessionExpiry: null,
          isAuthenticating: false,
          authError: null,
          sessionExpiredNotice: true
        });
      },

      clearSessionExpiredNotice: () => set({ sessionExpiredNotice: false }),

      // Loading state during auth
      setAuthenticating: (value) => set({ isAuthenticating: value }),

      // Error state
      setAuthError: (error) => set({
        authError: error,
        isAuthenticating: false
      }),

      // Check if session is still valid (not expired)
      isSessionValid: () => {
        const { sessionExpiry, isAuthenticated } = get();
        if (!isAuthenticated || !sessionExpiry) return false;
        // Add 30 second buffer to account for clock skew
        return Date.now() < (sessionExpiry - 30000);
      }
    }),
    {
      name: 'landmind-wallet-session',
      storage: createJSONStorage(() => localStorage),
      // Only persist session metadata, not loading/error states
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        walletAddress: state.walletAddress,
        userId: state.userId,
        sessionExpiry: state.sessionExpiry
        // accessToken is in httpOnly cookie, not stored here.
        // sessionExpiredNotice is transient UI state — intentionally not persisted.
      })
    }
  )
);

// Wire the API layer's global 401 handler to the store. Any authenticated API
// call that comes back 401 (stale/expired/dropped cookie) invalidates the
// session here so the UI stops showing authenticated-only controls. Registered
// at module load — the store singleton exists for the app's lifetime.
registerUnauthorizedHandler(() => {
  useWalletStore.getState().expireSession();
});
