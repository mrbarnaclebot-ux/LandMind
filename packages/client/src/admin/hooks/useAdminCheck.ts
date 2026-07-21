import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../lib/solana';
import { useWalletStore } from '../../stores/walletStore';
import { apiFetch } from '../../lib/apiFetch';

/**
 * Hook to check if current user has admin role.
 * Makes a lightweight request to admin endpoint to verify.
 */
export function useAdminCheck() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const { isAuthenticated } = useWalletStore();

  const checkAdmin = useCallback(async () => {
    // Only probe the admin endpoint when actually authenticated. `isAuthenticated`
    // can be a stale persisted value on a fresh anonymous load (localStorage says
    // authed but the session cookie is gone), so re-check the live store at call
    // time — otherwise an anonymous visitor fires GET /admin/metrics and eats a
    // 403 in the console before login.
    if (!isAuthenticated || !useWalletStore.getState().isAuthenticated) {
      setIsAdmin(false);
      return;
    }

    setIsChecking(true);
    try {
      // Try to access admin metrics endpoint. Routed through apiFetch so a stale
      // session (401) clears global auth state instead of silently failing; a
      // 403 simply means "authenticated but not an admin".
      const res = await apiFetch(`${API_BASE_URL}/admin/metrics`);

      // If 200, user is admin; if 403, user is not admin
      setIsAdmin(res.ok);
    } catch {
      setIsAdmin(false);
    } finally {
      setIsChecking(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    checkAdmin();
  }, [checkAdmin]);

  return { isAdmin, isChecking };
}
