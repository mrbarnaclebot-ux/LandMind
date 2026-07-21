/**
 * Weather Service — System 2 (regional, telegraphed weather fronts).
 *
 * Drifting weather cells cross the hex map. Each front's trajectory is FIXED at
 * spawn (origin + velocity), so the client can extrapolate the whole future path
 * for diegetic telegraphing ("you see the front rolling in"). Position at any
 * time t is a PURE function of the front's spawn parameters:
 *
 *     center(t) = origin + velocity * (t - spawnedAt)   // hexes/min * minutes
 *
 * Contract (see .planning/design/GAMEPLAY-DESIGN.md System 2):
 *   - max 3 concurrent fronts; typically 1-2 active
 *   - type weights: rain 40% / dust 30% / snow 20% / ember 10%
 *   - radius 3-6 (ember 2-3, shorter lifespan)
 *   - lifespan 8-16 min
 *   - origin random within radius 24 of world center; velocity random direction
 *     at 0.5-1.5 hex/min
 *   - despawn at expiresAt OR when center leaves the radius-30 bounds
 *
 * Yield join (mining calc): yield = base × phaseMod × weatherMod, where
 * weatherMod = getFrontAt(hex) resolved against the published weatherTable and
 * the hex's biome.
 *
 * The pure math (spawn param generation, position, coverage, table lookup) is
 * separated from the Redis I/O so it can be sanity-checked deterministically.
 */

import { redis } from '../lib/redis.js';
import type { Biome } from '@prisma/client';

// ---------------------------------------------------------------------------
// Pinned client-facing types (do NOT reshape — a client agent codes against this)
// ---------------------------------------------------------------------------

export type WeatherFrontType = 'rain' | 'dust' | 'snow' | 'ember';

export interface WeatherFront {
  id: string;
  type: WeatherFrontType;
  /** CURRENT position (may be fractional) — center(now) = origin + velocity*dtMin. */
  center: { q: number; r: number };
  /** Spawn position (integer). Client extrapolates future path from origin+velocity. */
  origin: { q: number; r: number };
  /** Hexes per MINUTE. Trajectory is fixed at spawn. */
  velocity: { q: number; r: number };
  /** Radius in hexes. */
  radius: number;
  /** Epoch ms when the front spawned. */
  spawnedAt: number;
  /** Epoch ms when the front despawns. */
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Published weather modifier table (exported + surfaced in GET /api/world)
// ---------------------------------------------------------------------------

/**
 * Per-front-type biome yield multipliers. A biome not listed for a type uses
 * that type's `default`. Keys are the Prisma Biome enum values (uppercase).
 * "All modifiers server-authoritative and published" — this table is the odds.
 */
export const WEATHER_TABLE: Record<
  WeatherFrontType,
  Partial<Record<Biome, number>> & { default: number }
> = {
  rain: { MARSH: 1.15, GRASSLAND: 1.15, ROCKY: 0.9, default: 1.0 },
  dust: { PLAINS: 0.8, default: 1.0 },
  snow: { ALPINE: 1.2, FOREST: 0.9, default: 1.0 },
  ember: { default: 1.5 },
} as const;

/**
 * Resolve the weather yield multiplier for a front type over a biome.
 * Pure table lookup with the type's default as fallback.
 */
export function getWeatherModifier(type: WeatherFrontType, biome: Biome): number {
  const row = WEATHER_TABLE[type];
  const specific = row[biome];
  return specific !== undefined ? specific : row.default;
}

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

const MAX_FRONTS = 3;
/** Per-tick spawn chance when below MAX_FRONTS. ~1% ⇒ avg one spawn per ~8 min at 5s ticks. */
const SPAWN_CHANCE_PER_TICK = 0.01;
/** Origin sampled uniformly within this radius of world center (0,0). */
const SPAWN_ORIGIN_RADIUS = 24;
/** Despawn once the current center leaves this bound (axial distance from center). */
const DESPAWN_BOUND_RADIUS = 30;
/** Lifespan window (minutes) for non-ember fronts. */
const LIFESPAN_MIN_MS = 8 * 60_000;
const LIFESPAN_MAX_MS = 16 * 60_000;
/** Ember: shorter lifespan window (minutes). */
const EMBER_LIFESPAN_MIN_MS = 4 * 60_000;
const EMBER_LIFESPAN_MAX_MS = 8 * 60_000;

const REDIS_KEY = 'weather:fronts';

// Module state — the currently-active fronts. Persisted to Redis so a restart
// doesn't hard-reset the weather; rehydrated on boot.
let fronts: WeatherFront[] = [];

// ---------------------------------------------------------------------------
// Pure math
// ---------------------------------------------------------------------------

/**
 * Current center of a front at time `nowMs`. Pure function of spawn params.
 * velocity is hexes/MINUTE, so we convert the elapsed ms to minutes.
 */
export function frontCenterAt(front: WeatherFront, nowMs: number): { q: number; r: number } {
  const dtMin = (nowMs - front.spawnedAt) / 60_000;
  return {
    q: front.origin.q + front.velocity.q * dtMin,
    r: front.origin.r + front.velocity.r * dtMin,
  };
}

/**
 * Fractional axial hex distance from a (possibly fractional) center to an
 * integer hex. Uses the cube-coordinate distance formula on fractional coords —
 * the same metric as hexMath.hexDistance, but without assuming integers, so a
 * front centered "between" hexes covers a sensible disc.
 */
export function fractionalHexDistance(
  a: { q: number; r: number },
  b: { q: number; r: number }
): number {
  const dq = Math.abs(a.q - b.q);
  const dr = Math.abs(a.r - b.r);
  const ds = Math.abs(a.q + a.r - (b.q + b.r));
  return (dq + dr + ds) / 2;
}

/** True if hex (q,r) is under `front` at `nowMs` (distance from current center ≤ radius). */
export function frontCovers(front: WeatherFront, q: number, r: number, nowMs: number): boolean {
  const c = frontCenterAt(front, nowMs);
  return fractionalHexDistance(c, { q, r }) <= front.radius;
}

/**
 * The strongest covering front at (q,r), or null. "Strongest" = largest absolute
 * deviation from 1.0 on this biome (ember +50% beats a rain +15%); biome is
 * needed to rank because the effect is biome-dependent.
 */
export function getFrontAt(
  q: number,
  r: number,
  biome: Biome,
  nowMs: number = Date.now(),
  activeFronts: WeatherFront[] = fronts
): { front: WeatherFront; modifier: number } | null {
  let best: { front: WeatherFront; modifier: number } | null = null;
  let bestStrength = -1;
  for (const front of activeFronts) {
    if (!frontCovers(front, q, r, nowMs)) continue;
    const modifier = getWeatherModifier(front.type, biome);
    const strength = Math.abs(modifier - 1.0);
    if (strength > bestStrength) {
      bestStrength = strength;
      best = { front, modifier };
    }
  }
  return best;
}

/** Convenience: the yield multiplier at (q,r), or 1.0 when no front covers it. */
export function getWeatherModifierAt(
  q: number,
  r: number,
  biome: Biome,
  nowMs: number = Date.now(),
  activeFronts: WeatherFront[] = fronts
): number {
  return getFrontAt(q, r, biome, nowMs, activeFronts)?.modifier ?? 1.0;
}

/** Weighted random front type (rain 40 / dust 30 / snow 20 / ember 10). */
export function pickFrontType(rand: () => number = Math.random): WeatherFrontType {
  const roll = rand();
  if (roll < 0.4) return 'rain';
  if (roll < 0.7) return 'dust';
  if (roll < 0.9) return 'snow';
  return 'ember';
}

/**
 * Build a fresh front with a fixed trajectory. Pure given `rand` + `nowMs`.
 * Exported for deterministic sanity-checking.
 */
export function makeFront(
  nowMs: number = Date.now(),
  rand: () => number = Math.random,
  idFn: () => string = () => `wf_${nowMs}_${Math.floor(rand() * 1e9)}`
): WeatherFront {
  const type = pickFrontType(rand);

  // Origin: within hex-distance SPAWN_ORIGIN_RADIUS (24) of world center. We
  // sample a Cartesian point (area-uniform) then, because axial hex distance is
  // larger than the Euclidean radius near the diagonals, scale the offset down
  // so the resulting integer hex is guaranteed within SPAWN_ORIGIN_RADIUS by the
  // hex metric. This keeps every spawn comfortably inside the radius-30 despawn
  // bound (so fronts don't despawn on the same tick they spawn).
  const angle = rand() * Math.PI * 2;
  const dist = Math.sqrt(rand()) * SPAWN_ORIGIN_RADIUS; // sqrt ⇒ area-uniform
  let originQ = Math.round(Math.cos(angle) * dist);
  let originR = Math.round(Math.sin(angle) * dist);
  const originDist = fractionalHexDistance({ q: originQ, r: originR }, { q: 0, r: 0 });
  if (originDist > SPAWN_ORIGIN_RADIUS && originDist > 0) {
    const scale = SPAWN_ORIGIN_RADIUS / originDist;
    originQ = Math.round(originQ * scale);
    originR = Math.round(originR * scale);
  }

  // Radius: ember 2-3, else 3-6.
  const radius =
    type === 'ember'
      ? 2 + Math.floor(rand() * 2) // 2..3
      : 3 + Math.floor(rand() * 4); // 3..6

  // Velocity: random direction, magnitude 0.5-1.5 hex/min (in axial q/r space).
  const vAngle = rand() * Math.PI * 2;
  const speed = 0.5 + rand() * 1.0;
  const velocity = {
    q: Math.cos(vAngle) * speed,
    r: Math.sin(vAngle) * speed,
  };

  // Lifespan: ember shorter.
  const [lo, hi] =
    type === 'ember'
      ? [EMBER_LIFESPAN_MIN_MS, EMBER_LIFESPAN_MAX_MS]
      : [LIFESPAN_MIN_MS, LIFESPAN_MAX_MS];
  const lifespanMs = lo + rand() * (hi - lo);

  return {
    id: idFn(),
    type,
    origin: { q: originQ, r: originR },
    center: { q: originQ, r: originR }, // center at spawn == origin
    velocity,
    radius,
    spawnedAt: nowMs,
    expiresAt: nowMs + lifespanMs,
  };
}

/**
 * True if a front should despawn at `nowMs`: expired, or its current center has
 * drifted outside the radius-30 world bound.
 */
export function shouldDespawn(front: WeatherFront, nowMs: number): boolean {
  if (nowMs >= front.expiresAt) return true;
  const c = frontCenterAt(front, nowMs);
  return fractionalHexDistance(c, { q: 0, r: 0 }) > DESPAWN_BOUND_RADIUS;
}

/**
 * Advance the weather simulation one step: despawn dead fronts, maybe spawn one,
 * and refresh every survivor's `center` to its position at `nowMs`. Pure — takes
 * the current fronts and returns the next set (no I/O). The tick loop persists.
 */
export function stepWeather(
  current: WeatherFront[],
  nowMs: number = Date.now(),
  rand: () => number = Math.random,
  idFn?: () => string
): WeatherFront[] {
  // Despawn.
  let next = current.filter((f) => !shouldDespawn(f, nowMs));

  // Spawn: at most one per step, only when below the concurrency cap.
  if (next.length < MAX_FRONTS && rand() < SPAWN_CHANCE_PER_TICK) {
    next.push(makeFront(nowMs, rand, idFn));
  }

  // Refresh current center for every survivor (the client-visible position).
  next = next.map((f) => ({ ...f, center: frontCenterAt(f, nowMs) }));

  return next;
}

// ---------------------------------------------------------------------------
// Stateful API (Redis-backed) used by the tick loop + routes
// ---------------------------------------------------------------------------

/** The active fronts (with `center` current as of the last tick). */
export function getActiveFronts(): WeatherFront[] {
  return fronts;
}

/**
 * Rehydrate module state from Redis on boot so a restart doesn't hard-reset the
 * weather. Prunes anything already expired/out-of-bounds. Safe if Redis is empty.
 */
export async function rehydrateWeather(nowMs: number = Date.now()): Promise<void> {
  try {
    const raw = await redis.get(REDIS_KEY);
    if (!raw) {
      fronts = [];
      return;
    }
    const parsed = JSON.parse(raw) as WeatherFront[];
    // Drop dead fronts and refresh centers to now.
    fronts = parsed
      .filter((f) => !shouldDespawn(f, nowMs))
      .map((f) => ({ ...f, center: frontCenterAt(f, nowMs) }));
    console.log(`Rehydrated ${fronts.length} weather front(s) from Redis`);
  } catch (err) {
    console.error('Failed to rehydrate weather fronts, starting empty:', err);
    fronts = [];
  }
}

/** Persist current fronts to Redis (best-effort — a failure never blocks a tick). */
async function persistWeather(): Promise<void> {
  try {
    await redis.set(REDIS_KEY, JSON.stringify(fronts));
  } catch (err) {
    console.error('Failed to persist weather fronts:', err);
  }
}

/**
 * Tick the weather forward and persist. Returns the fresh active fronts so the
 * caller can broadcast them. Uses Math.random in production.
 */
export async function tickWeather(nowMs: number = Date.now()): Promise<WeatherFront[]> {
  fronts = stepWeather(fronts, nowMs);
  await persistWeather();
  return fronts;
}
