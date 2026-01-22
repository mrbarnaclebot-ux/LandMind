import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../lib/solana';
import { useWalletStore } from '../../stores/walletStore';

/**
 * Hook to check if current user has admin role.
 * Makes a lightweight request to admin endpoint to verify.
 */
export function useAdminCheck() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const { isAuthenticated } = useWalletStore();

  const checkAdmin = useCallback(async () => {
    if (!isAuthenticated) {
      setIsAdmin(false);
      return;
    }

    setIsChecking(true);
    try {
      // Try to access admin metrics endpoint
      const res = await fetch(`${API_BASE_URL}/admin/metrics`, {
        credentials: 'include',
      });

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
