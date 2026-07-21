/**
 * Single source of truth for API / socket configuration.
 *
 * Reads the API URL from `import.meta.env.VITE_API_URL`. In production builds
 * a missing value is a misconfiguration, so we surface it loudly instead of
 * silently defaulting to localhost (which would break the deployed client).
 * In dev we fall back to the local server for a friction-free workflow.
 */

const DEV_FALLBACK_API_URL = 'http://localhost:3001';

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_API_URL;

  if (configured) {
    return configured;
  }

  if (import.meta.env.PROD) {
    // Deployed builds must have VITE_API_URL set. Fail loudly so the
    // misconfiguration is obvious rather than silently hitting localhost.
    console.error(
      '[config] VITE_API_URL is not set in a production build. ' +
        'API and socket requests will fail. Set VITE_API_URL at build time.'
    );
    // Return an empty string so requests fail visibly (same-origin/relative)
    // instead of masking the problem by pointing at a dev-only localhost.
    return '';
  }

  return DEV_FALLBACK_API_URL;
}

/**
 * Base URL for all HTTP + WebSocket traffic to the LandMind server.
 */
export const API_URL = resolveApiUrl();
