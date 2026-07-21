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

/**
 * Public server runtime config returned by GET /api/config.
 */
export interface ServerConfig {
  /** When true, the client switches into fake-SOL test mode. */
  fakeSolMode: boolean;
  /** Solana network the server is operating against. */
  network: 'devnet' | 'mainnet-beta';
}

const DEFAULT_SERVER_CONFIG: ServerConfig = {
  fakeSolMode: false,
  network: 'devnet',
};

// Module-level cache so the config is fetched once per session and read
// synchronously afterwards by hooks/components.
let cachedConfig: ServerConfig = DEFAULT_SERVER_CONFIG;
let configFetched = false;
let inFlight: Promise<ServerConfig> | null = null;

/**
 * Fetch the public server config (GET /api/config) and cache it. Safe to call
 * repeatedly — concurrent callers share a single in-flight request, and a
 * successful result is cached for the rest of the session.
 */
export async function fetchServerConfig(): Promise<ServerConfig> {
  if (configFetched) return cachedConfig;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`, { credentials: 'include' });
      if (!res.ok) throw new Error(`config request failed: ${res.status}`);
      const data = (await res.json()) as Partial<ServerConfig>;
      cachedConfig = {
        fakeSolMode: Boolean(data.fakeSolMode),
        network: data.network === 'mainnet-beta' ? 'mainnet-beta' : 'devnet',
      };
      configFetched = true;
      return cachedConfig;
    } catch (err) {
      // Fail safe: assume production (no fake mode) if the config can't be read.
      console.error('[config] Failed to fetch server config:', err);
      return cachedConfig;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Synchronous read of the last-fetched server config (defaults until fetched). */
export function getServerConfig(): ServerConfig {
  return cachedConfig;
}

/** Convenience: whether fake-SOL test mode is active (per last fetched config). */
export function isFakeSolModeClient(): boolean {
  return cachedConfig.fakeSolMode;
}
