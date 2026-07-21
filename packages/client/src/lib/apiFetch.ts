/**
 * Thin fetch wrapper for authenticated API calls.
 *
 * Every request goes out with `credentials: 'include'` so the session cookie
 * rides along. The one behaviour it adds on top of `fetch` is GLOBAL 401
 * handling: if the server rejects an authenticated request with 401 while the
 * client still believes it is authenticated, the session in localStorage/zustand
 * is stale (missing/expired cookie, or a cookie set with an old SameSite that the
 * browser now drops). We clear the session and surface a small "session expired"
 * signal so the UI stops lying (DeployButton disappears, CONNECT/PLAY TEST MODE
 * come back) instead of every call silently 401ing behind an "authenticated" UI.
 *
 * The actual store-clearing is injected via `registerUnauthorizedHandler` to
 * avoid an import cycle (walletStore -> ... -> apiFetch -> walletStore). The
 * store registers its handler once at module load.
 */

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Register the callback invoked whenever an authenticated API call 401s.
 * Called once by the wallet store module so this layer has no direct store
 * dependency (keeps the import graph acyclic).
 */
export function registerUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

/**
 * fetch() with credentials included and centralized 401 handling.
 *
 * On a 401 response we invoke the registered unauthorized handler (which clears
 * session state + raises the "session expired" notice) BEFORE returning the
 * response, so callers that inspect `response.ok` still behave normally but the
 * global UI has already been corrected.
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
  });

  if (response.status === 401) {
    // Session is stale server-side but the client thought it was authenticated.
    // Clear it globally so the UI reflects the logged-out reality.
    onUnauthorized?.();
  }

  return response;
}
