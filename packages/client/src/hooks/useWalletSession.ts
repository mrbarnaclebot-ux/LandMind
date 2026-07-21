import { useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { useWalletStore } from '../stores/walletStore';
import { API_BASE_URL } from '../lib/solana';

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

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setAuthError(message);
      return false;
    }
  }, [publicKey, signMessage, setSession, setAuthenticating, setAuthError]);

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
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test session failed';
      setAuthError(message);
      return false;
    }
  }, [setSession, setAuthenticating, setAuthError]);

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
