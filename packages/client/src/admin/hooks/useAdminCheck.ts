import { useWalletStore } from '../../stores/walletStore';

/**
 * Hook to check if the current user has the admin role.
 *
 * Admin status is learned through the normal session flow — captured from the
 * login responses (/auth/verify, /auth/test-session) and the /auth/session
 * reconcile in useWalletSession, then stored on the wallet store. This hook is
 * a pure selector on that flag; it performs NO network request (previously it
 * probed GET /admin/metrics, which logged a 403 resource error for non-admins).
 *
 * Public API is unchanged so the ADMIN button code does not need to change.
 * `isChecking` is retained for API compatibility and is always false since the
 * value is read synchronously from the store.
 */
export function useAdminCheck() {
  const isAdmin = useWalletStore((state) => state.isAdmin && state.isAuthenticated);
  return { isAdmin, isChecking: false };
}
