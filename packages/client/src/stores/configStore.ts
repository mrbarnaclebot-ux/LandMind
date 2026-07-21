/**
 * Reactive store for the public server runtime config (GET /api/config).
 *
 * Components read `fakeSolMode` from here to switch UI into test mode. Call
 * `loadConfig()` once on app mount; it delegates to fetchServerConfig() (which
 * caches at the module level) and mirrors the result into reactive state.
 */
import { create } from 'zustand';
import { fetchServerConfig, type ServerConfig } from '../lib/config';
import { markReady } from './readinessStore';

interface ConfigState {
  fakeSolMode: boolean;
  network: ServerConfig['network'];
  loaded: boolean;
  loadConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  fakeSolMode: false,
  network: 'devnet',
  loaded: false,

  loadConfig: async () => {
    if (get().loaded) return;
    try {
      const config = await fetchServerConfig();
      set({
        fakeSolMode: config.fakeSolMode,
        network: config.network,
        loaded: true,
      });
    } finally {
      // Readiness signal fires even on failure so the loading bar never hangs
      // on a config fetch error (fake-SOL defaults still let the app run).
      markReady('config');
    }
  },
}));
