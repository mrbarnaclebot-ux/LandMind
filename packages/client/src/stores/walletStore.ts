import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface WalletSession {
  // Session state
  isAuthenticated: boolean;
  walletAddress: string | null;
  userId: string | null;
  sessionExpiry: number | null; // Unix timestamp in ms

  // UI state
  isAuthenticating: boolean;
  authError: string | null;

  // Actions
  setSession: (address: string, userId: string, expiry: number) => void;
  clearSession: () => void;
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

      // Set session after successful authentication
      setSession: (address, userId, expiry) => set({
        isAuthenticated: true,
        walletAddress: address,
        userId,
        sessionExpiry: expiry,
        isAuthenticating: false,
        authError: null
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
        // accessToken is in httpOnly cookie, not stored here
      })
    }
  )
);
