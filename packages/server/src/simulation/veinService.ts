/**
 * Rich Vein Service — System 3 (rich vein strikes).
 *
 * Periodically a single hex upgrades to a temporary ×3 "rich vein", announced
 * globally for a land-rush moment (design System 3). Additive-only, time-boxed:
 *
 *   - at most ONE active vein at a time
 *   - spawn tuned to average ~one vein per 30 min when none is active
 *   - multiplier ×3, lifespan 20 min
 *   - the vein's yield modifier joins the mining product for agents on that hex
 *
 * Redis-persisted (like weatherService) so a restart doesn't hard-reset an
 * active vein; rehydrated on boot. The pure spawn math is separated from the
 * Redis I/O so it can be sanity-checked deterministically.
 *
 * TODO(VRF): hex selection + spawn roll use Math.random for now. Migrate to
 * Chainlink VRF once on-chain so earnings-affecting RNG is verifiable (design
 * pillar 3 + anti-pattern rule 5: no hidden odds on earnings-affecting RNG).
 */

import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import type { ResourceType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Pinned client-facing type (do NOT reshape — a client agent codes against this)
// ---------------------------------------------------------------------------

export interface RichVein {
  hexId: number;
  q: number;
  r: number;
  resourceType: ResourceType;
  /** Yield multiplier while the vein is active (always 3). */
  multiplier: number;
  /** Epoch ms when the vein expires. */
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Rich-vein yield multiplier (×3, applies on top of the rest of the product). */
export const VEIN_MULTIPLIER = 3;

/** Vein lifespan: 20 minutes. */
export const VEIN_LIFESPAN_MS = 20 * 60_000;

/**
 * Per-tick spawn chance when NO vein is active. Tuned so the mean wait until a
 * spawn is ~30 min. At a 5s tick there are 360 ticks per 30 min; a geometric
 * process with per-trial probability p has mean 1/p trials, so p = 1/360 gives
 * an expected 360 ticks ≈ 30 min between the moment no vein is active and the
 * next spawn. (Lifespan is separate; while a vein is active we never roll.)
 */
export const VEIN_SPAWN_CHANCE_PER_TICK = 1 / 360;

const REDIS_KEY = 'veins:active';

// Module state — the single active vein (or null). Persisted to Redis.
let activeVein: RichVein | null = null;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** True if the vein has expired at `nowMs`. */
export function veinExpired(vein: RichVein, nowMs: number): boolean {
  return nowMs >= vein.expiresAt;
}

/** The active vein's yield multiplier at (q,r), or 1.0 if no vein covers it. */
export function getVeinModifierAt(
  q: number,
  r: number,
  nowMs: number = Date.now(),
  vein: RichVein | null = activeVein
): number {
  if (!vein) return 1.0;
  if (veinExpired(vein, nowMs)) return 1.0;
  return vein.q === q && vein.r === r ? vein.multiplier : 1.0;
}

// ---------------------------------------------------------------------------
// Stateful API (Redis-backed) used by the tick loop + routes
// ---------------------------------------------------------------------------

/** The active vein (or null). Included in GET /api/world as an array. */
export function getActiveVein(): RichVein | null {
  return activeVein;
}

/** Active veins as an array (GET /api/world contract: `veins: [...]`). */
export function getActiveVeins(): RichVein[] {
  return activeVein ? [activeVein] : [];
}

/**
 * Rehydrate module state from Redis on boot so a restart doesn't hard-reset an
 * active vein. Drops it if already expired. Safe if Redis is empty.
 */
export async function rehydrateVeins(nowMs: number = Date.now()): Promise<void> {
  try {
    const raw = await redis.get(REDIS_KEY);
    if (!raw) {
      activeVein = null;
      return;
    }
    const parsed = JSON.parse(raw) as RichVein;
    activeVein = veinExpired(parsed, nowMs) ? null : parsed;
    console.log(activeVein ? 'Rehydrated 1 rich vein from Redis' : 'No active rich vein to rehydrate');
  } catch (err) {
    console.error('Failed to rehydrate rich vein, starting empty:', err);
    activeVein = null;
  }
}

/** Persist the active vein to Redis (best-effort — never blocks a tick). */
async function persistVein(): Promise<void> {
  try {
    if (activeVein) {
      await redis.set(REDIS_KEY, JSON.stringify(activeVein));
    } else {
      await redis.del(REDIS_KEY);
    }
  } catch (err) {
    console.error('Failed to persist rich vein:', err);
  }
}

/**
 * Pick a random hex with resourceAmount > 0 to become a rich vein. Returns null
 * when the world has no mineable hexes. Uses an offset-based random pick so we
 * don't load the whole table.
 */
async function pickRandomRichHex(
  rand: () => number = Math.random
): Promise<{ id: number; q: number; r: number; resourceType: ResourceType } | null> {
  const count = await prisma.hex.count({
    where: { resourceAmount: { gt: 0 }, resourceType: { not: 'EMPTY' } },
  });
  if (count === 0) return null;

  const skip = Math.floor(rand() * count);
  const hex = await prisma.hex.findFirst({
    where: { resourceAmount: { gt: 0 }, resourceType: { not: 'EMPTY' } },
    select: { id: true, q: true, r: true, resourceType: true },
    orderBy: { id: 'asc' },
    skip,
  });
  return hex ?? null;
}

/**
 * Advance the vein simulation one step and persist.
 *
 * Returns a discriminated result so the tick loop can broadcast the right event:
 *   - { changed: 'spawned', vein } — a new vein just spawned
 *   - { changed: 'expired', hexId } — the active vein just expired
 *   - { changed: 'none' } — no change this tick
 *
 * Uses Math.random in production (logged per design; VRF migration TODO above).
 */
export async function tickVeins(
  nowMs: number = Date.now(),
  rand: () => number = Math.random
): Promise<
  | { changed: 'spawned'; vein: RichVein }
  | { changed: 'expired'; hexId: number }
  | { changed: 'none' }
> {
  // 1. Expire an active vein whose lifespan has elapsed.
  if (activeVein && veinExpired(activeVein, nowMs)) {
    const hexId = activeVein.hexId;
    console.log(
      `[vein] EXPIRED hex=${hexId} (q=${activeVein.q},r=${activeVein.r}) at ${nowMs}`
    );
    activeVein = null;
    await persistVein();
    return { changed: 'expired', hexId };
  }

  // 2. While a vein is active, never roll for a new one (max 1 active).
  if (activeVein) return { changed: 'none' };

  // 3. Roll to spawn. Logged with the roll context (design: everything logged).
  const roll = rand();
  if (roll >= VEIN_SPAWN_CHANCE_PER_TICK) return { changed: 'none' };

  const hex = await pickRandomRichHex(rand);
  if (!hex) {
    // No mineable hex to upgrade — skip this spawn silently (rare).
    return { changed: 'none' };
  }

  const vein: RichVein = {
    hexId: hex.id,
    q: hex.q,
    r: hex.r,
    resourceType: hex.resourceType,
    multiplier: VEIN_MULTIPLIER,
    expiresAt: nowMs + VEIN_LIFESPAN_MS,
  };
  activeVein = vein;
  await persistVein();

  console.log(
    `[vein] SPAWNED hex=${vein.hexId} (q=${vein.q},r=${vein.r}) ` +
      `type=${vein.resourceType} x${vein.multiplier} roll=${roll.toFixed(6)} ` +
      `p=${VEIN_SPAWN_CHANCE_PER_TICK.toFixed(6)} expiresAt=${vein.expiresAt}`
  );

  return { changed: 'spawned', vein };
}
