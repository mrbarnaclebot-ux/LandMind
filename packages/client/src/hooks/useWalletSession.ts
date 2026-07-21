import { useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { useWalletStore } from '../stores/walletStore';
import { API_BASE_URL } from '../lib/solana';
import { reconnectSocket } from '../lib/socket';

/**
 * Hook for managing wallet session authentication.
 * Handles SIWS flow, session persistence, and wallet change detection.
 */
export function useWalletSession() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const {
    isAuthenticated,
    walletAddress,
    isAuthenticating,
    authError,
    setSession,
    clearSession,
    setAuthenticating,
    setAuthError,
    isSessionValid
  } = useWalletStore();

  /**
   * Session reconcile probe. After a login (real SIWS or test-session) the JWT
   * lives in an httpOnly cookie we cannot read. Optimistically trusting the
   * login response means the UI shows "authenticated"/"LIVE" even if the cookie
   * never reached the browser (e.g. cross-site SameSite issues), in which case
   * every subsequent API call 401s. To avoid fake-authenticated UI, make one
   * authenticated probe against GET /auth/session with credentials. Returns
   * true only if the server confirms the cookie is valid; on 401/failure the
   * caller clears session state and surfaces an error.
   */
  const reconcileSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/session`, {
        credentials: 'include',
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data.authenticated === true;
    } catch {
      return false;
    }
  }, []);

  /**
   * Authenticate with the server using SIWS flow.
   * 1. Get nonce from server
   * 2. Sign message with wallet
   * 3. Send signature to server for verification
   * 4. Server returns JWT in httpOnly cookie
   */
  const authenticate = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setAuthError('Wallet not connected or does not support signing');
      return false;
    }

    setAuthenticating(true);
    setAuthError(null);

    try {
      const address = publicKey.toBase58();

      // 1. Get nonce from server
      const nonceResponse = await fetch(
        `${API_BASE_URL}/auth/nonce?address=${address}`,
        { credentials: 'include' }
      );

      if (!nonceResponse.ok) {
        throw new Error('Failed to get nonce from server');
      }

      const { nonce, message } = await nonceResponse.json();

      // 2. Sign the message with wallet
      const messageBytes = new TextEncoder().encode(message);
      let signature: Uint8Array;
      try {
        signature = await signMessage(messageBytes);
      } catch (err) {
        // User rejected signature
        setAuthError('Signature required to continue');
        return false;
      }

      // 3. Send signature to server for verification
      const verifyResponse = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important for cookies
        body: JSON.stringify({
          address,
          signature: bs58.encode(signature),
          message,
          nonce
        })
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.error || 'Authentication failed');
      }

      // 4. Store session info (JWT is in httpOnly cookie)
      const { userId, expiresAt } = await verifyResponse.json();
      setSession(address, userId, expiresAt);

      // 5. Reconcile: verify the session cookie actually took effect. If the
      // cookie never reached the browser, this probe 401s and we must not show
      // fake-authenticated UI.
      const reconciled = await reconcileSession();
      if (!reconciled) {
        clearSession();
        setAuthError('Session could not be established. Please try again.');
        return false;
      }

      // The shared socket was opened anonymously on app mount, so its handshake
      // carried no session cookie and the server never attached our identity.
      // Reconnect now that the cookie is set so the fresh handshake authenticates
      // the socket; the data hooks re-subscribe on the 'connect' event.
      reconnectSocket();

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setAuthError(message);
      return false;
    }
  }, [publicKey, signMessage, setSession, clearSession, reconcileSession, setAuthenticating, setAuthError]);

  /**
   * TEST MODE ONLY: start a fake-SOL session with no wallet extension.
   * Calls POST /auth/test-session (credentials included so the JWT cookie is
   * set), then stores the returned test wallet address in the session store so
   * the rest of the app treats the user as authenticated. The server returns 404
   * when FAKE_SOL_MODE is off, so this is a no-op in production.
   */
  const startTestSession = useCallback(async (): Promise<boolean> => {
    setAuthenticating(true);
    setAuthError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/test-session`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Test session unavailable');
      }

      const { address, userId, expiresAt } = await response.json();
      setSession(address, userId, expiresAt);

      // Reconcile: confirm the cookie is actually usable cross-site before
      // treating the user as authenticated (avoids fake "LIVE" state).
      const reconciled = await reconcileSession();
      if (!reconciled) {
        clearSession();
        setAuthError('Session could not be established. Please try again.');
        return false;
      }

      // Reconnect the shared socket so its handshake carries the new test-session
      // cookie and the server authenticates it; hooks re-subscribe on 'connect'.
      reconnectSocket();

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test session failed';
      setAuthError(message);
      return false;
    }
  }, [setSession, clearSession, reconcileSession, setAuthenticating, setAuthError]);

  /**
   * Logout - clear session and disconnect wallet.
   */
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch {
      // Ignore server errors on logout
    }

    clearSession();
    await disconnect();

    // Reconnect the socket so its handshake no longer carries a session cookie —
    // this drops the server-side identity and removes us from our user room.
    reconnectSocket();
  }, [clearSession, disconnect]);

  /**
   * Check session status with server.
   */
  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/session`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.authenticated) {
        setSession(data.address, data.userId, data.expiresAt);
        return true;
      } else {
        clearSession();
        return false;
      }
    } catch {
      clearSession();
      return false;
    }
  }, [setSession, clearSession]);

  // Effect: Detect wallet change (user switched wallets in extension)
  useEffect(() => {
    if (!connected || !publicKey) return;

    const currentAddress = publicKey.toBase58();

    // If we have a stored session but wallet address changed
    if (walletAddress && walletAddress !== currentAddress) {
      // Clear session - user needs to re-authenticate with new wallet
      clearSession();
    }
  }, [connected, publicKey, walletAddress, clearSession]);

  // Effect: Check session validity on mount
  useEffect(() => {
    if (isAuthenticated && !isSessionValid()) {
      // Session expired - clear it
      clearSession();
    }
  }, [isAuthenticated, isSessionValid, clearSession]);

  return {
    // State
    isAuthenticated,
    isAuthenticating,
    authError,
    walletAddress,

    // Wallet adapter state
    connected,
    publicKey,

    // Actions
    authenticate,
    startTestSession,
    logout,
    checkSession,

    // Helpers
    isSessionValid
  };
}
