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
import { useTransactionStore } from '../stores/transactionStore';
import type {
  WorldUpdateEvent,
  WeatherUpdateEvent,
  VeinSpawnedEvent,
  VeinExpiredEvent,
  GoldRushUpdateEvent,
} from '../lib/socketTypes';

/** Human resource name from the resourceType code (fallback: as-given, lowercased). */
function resourceLabel(type: string): string {
  const map: Record<string, string> = {
    GOLD: 'gold',
    SILVER: 'silver',
    COPPER: 'copper',
    IRON: 'iron',
  };
  return map[type?.toUpperCase?.() ?? ''] ?? (type ? type.toLowerCase() : 'ore');
}

/** mm:ss from a millisecond duration (clamped at 0). */
function fmtRemaining(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function useWorldClock(): void {
  useEffect(() => {
    const {
      loadWorld,
      applyUpdate,
      applyWeatherUpdate,
      applyVeinSpawned,
      applyVeinExpired,
      applyGoldRushUpdate,
    } = useWorldStore.getState();

    // Track the prior goldrush.achieved so we only celebrate the moment it flips
    // true (the broadcast repeats every ~5s while achieved).
    let prevAchieved = useWorldStore.getState().goldrush?.achieved ?? false;

    // Initial snapshot (world clock + seed weather fronts/table + veins/hazard
    // table from /api/world).
    void loadWorld();

    // Live reconciliation.
    const sock = getSocket();
    const onUpdate = (data: WorldUpdateEvent) => applyUpdate(data);
    const onWeather = (data: WeatherUpdateEvent) => applyWeatherUpdate(data);

    // System 3: rich-vein strikes (public broadcast). Store the vein AND fire a
    // brief global land-rush toast.
    const onVeinSpawned = (data: VeinSpawnedEvent) => {
      applyVeinSpawned(data);
      const remaining = fmtRemaining(data.expiresAt - Date.now());
      useTransactionStore.getState().addToast({
        type: 'success',
        title: 'RICH VEIN STRUCK',
        message: `×${data.multiplier} ${resourceLabel(data.resourceType)} at (${data.q}, ${data.r}) — ${remaining} remaining`,
        // Inherits central success default (6500ms).
      });
    };
    const onVeinExpired = (data: VeinExpiredEvent) => applyVeinExpired(data);

    // System 4: Gold Rush community event (public broadcast). Store the state
    // and, on the achieved edge, fire a one-shot celebration toast.
    const onGoldRush = (data: GoldRushUpdateEvent) => {
      applyGoldRushUpdate(data);
      if (data.achieved && !prevAchieved) {
        const hoursText = data.boostUntil
          ? `${Math.max(1, Math.round((data.boostUntil - Date.now()) / 3_600_000))}h`
          : '2h';
        useTransactionStore.getState().addToast({
          type: 'success',
          title: 'GOLD RUSH ACHIEVED',
          message: `Community goal met — ×1.15 for ${hoursText}`,
          // Inherits central success default (6500ms).
        });
      }
      prevAchieved = data.achieved;
    };

    sock.on('world:update', onUpdate);
    // Weather fronts (System 2) arrive on their own ~5s public broadcast.
    sock.on('weather:update', onWeather);
    // Rich veins (System 3) — public broadcasts.
    sock.on('vein:spawned', onVeinSpawned);
    sock.on('vein:expired', onVeinExpired);
    // Gold Rush (System 4) — public broadcast.
    sock.on('goldrush:update', onGoldRush);

    return () => {
      sock.off('world:update', onUpdate);
      sock.off('weather:update', onWeather);
      sock.off('vein:spawned', onVeinSpawned);
      sock.off('vein:expired', onVeinExpired);
      sock.off('goldrush:update', onGoldRush);
    };
  }, []);
}
