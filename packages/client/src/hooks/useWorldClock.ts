/**
 * useWorldClock — wires the world clock store to its data sources.
 *
 *  1. On mount, seed the store from GET /api/world (initial load).
 *  2. Subscribe to the public `world:update` socket broadcast (every ~5s) and
 *     reconcile the store on each one. The broadcast is public/no-auth so it
 *     arrives even for anonymous visitors on the landing page.
 *
 * Mount ONCE near the app root (App.tsx). Rendering the phase HUD does not
 * require this hook — it just reads the store — but this hook must be alive for
 * the store to receive updates.
 */
import { useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { useWorldStore } from '../stores/worldStore';
import type { WorldUpdateEvent, WeatherUpdateEvent } from '../lib/socketTypes';

export function useWorldClock(): void {
  useEffect(() => {
    const { loadWorld, applyUpdate, applyWeatherUpdate } = useWorldStore.getState();

    // Initial snapshot (world clock + seed weather fronts/table from /api/world).
    void loadWorld();

    // Live reconciliation.
    const sock = getSocket();
    const onUpdate = (data: WorldUpdateEvent) => applyUpdate(data);
    const onWeather = (data: WeatherUpdateEvent) => applyWeatherUpdate(data);
    sock.on('world:update', onUpdate);
    // Weather fronts (System 2) arrive on their own ~5s public broadcast.
    sock.on('weather:update', onWeather);

    return () => {
      sock.off('world:update', onUpdate);
      sock.off('weather:update', onWeather);
    };
  }, []);
}
