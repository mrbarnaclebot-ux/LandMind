/**
 * weather — shared client helpers for System 2 (weather fronts).
 *
 * The server broadcasts each front's authoritative `center` every ~5s, but the
 * client extrapolates position locally each frame from `origin + velocity*(t -
 * spawnedAt)` so fronts DRIFT smoothly and we can TELEGRAPH where they're going
 * (project the center forward N minutes and show the path). All the math and
 * presentation constants live here so WeatherLayer (3D), WeatherForecast (HUD)
 * and AgentCard (combined modifier chip) agree on one source of truth.
 *
 * Anti-slop: front tints come from the LOCKED accent family — teal/amber/ember
 * plus a pale cool for snow. Every overlay is MATTE (no bloom); only the agent
 * amber core may glow (ART-DIRECTION rule 2).
 */
import type {
  WeatherFront,
  WeatherFrontType,
  FractionalHex,
  WeatherTable,
  WeatherBiomeEffects,
} from '../lib/socketTypes';
import type { Biome } from '../terrain/biomes';

// ---------------------------------------------------------------------------
// Presentation constants (per front type)
// ---------------------------------------------------------------------------

export interface FrontStyle {
  /** Base overlay tint (hex). */
  color: string;
  /** Overlay opacity at full coverage (matte, subtle). */
  opacity: number;
  /** Telegraph path opacity (fainter than the body). */
  pathOpacity: number;
  /** Whether this front kicks up cheap falling-streak particles (quality-gated). */
  particles: boolean;
  /** Short label + pixel-style glyph for the HUD. */
  label: string;
  glyph: string;
  /** CSS accent var used by the forecast strip row. */
  accentVar: string;
}

/**
 * Front styling. Colors sit inside the Golden-Hour Dusk palette:
 *  - rain  → cool teal-blue (#3FB6A8 family)
 *  - dust  → warm haze (#C98A6E)
 *  - snow  → pale cool (#C4CBD6, the alpine mid ramp)
 *  - ember → amber (#F0A63C) but MATTE — no bloom
 */
export const FRONT_STYLES: Record<WeatherFrontType, FrontStyle> = {
  rain: {
    color: '#3FB6A8',
    opacity: 0.18,
    pathOpacity: 0.1,
    particles: true,
    label: 'RAIN',
    glyph: '☂',
    accentVar: 'var(--teal)',
  },
  dust: {
    color: '#C98A6E',
    opacity: 0.22,
    pathOpacity: 0.12,
    particles: false,
    label: 'DUST',
    glyph: '≋',
    accentVar: 'var(--amber-dark)',
  },
  snow: {
    color: '#C4CBD6',
    opacity: 0.2,
    pathOpacity: 0.11,
    particles: true,
    label: 'SNOW',
    glyph: '❄',
    accentVar: 'var(--dusk-text-dim)',
  },
  ember: {
    color: '#F0A63C',
    opacity: 0.25,
    pathOpacity: 0.14,
    particles: true,
    label: 'EMBER',
    glyph: '✦',
    accentVar: 'var(--amber)',
  },
};

/** Fade window (ms) applied at spawn and before expiry so overlays ease in/out. */
export const FRONT_FADE_MS = 2500;

/** How far ahead (minutes) the telegraph path projects the front. */
export const TELEGRAPH_MINUTES = 3;

/** Steps in the telegraph path (dashed/stepped hexes ahead of the front). */
export const TELEGRAPH_STEPS = 6;

// ---------------------------------------------------------------------------
// Extrapolation
// ---------------------------------------------------------------------------

/**
 * The front center at an arbitrary wall-clock time, extrapolated from the pinned
 * anchor `origin + velocity*(t - spawnedAt)`. velocity is hexes/MINUTE.
 *
 * We deliberately re-derive from origin rather than trusting the broadcast
 * `center` for in-between frames: it keeps motion perfectly smooth and matches
 * whatever the server will report on its next tick (same formula).
 */
export function frontCenterAt(front: WeatherFront, nowMs: number): FractionalHex {
  const minutes = (nowMs - front.spawnedAt) / 60000;
  return {
    q: front.origin.q + front.velocity.q * minutes,
    r: front.origin.r + front.velocity.r * minutes,
  };
}

/** The telegraphed future center, `TELEGRAPH_MINUTES` ahead of `nowMs`. */
export function frontFutureCenterAt(front: WeatherFront, nowMs: number): FractionalHex {
  return frontCenterAt(front, nowMs + TELEGRAPH_MINUTES * 60000);
}

/** Axial hex distance between two fractional coordinates (cube distance). */
export function axialDistance(a: FractionalHex, b: FractionalHex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

/** Whether an integer hex is currently under the front (within its radius). */
export function hexUnderFront(
  front: WeatherFront,
  hex: FractionalHex,
  nowMs: number,
): boolean {
  return axialDistance(frontCenterAt(front, nowMs), hex) <= front.radius;
}

/**
 * Whether a hex is under the front NOW or will be within its telegraphed
 * 3-minute path (used to flag "YOUR AGENTS" rows and highlight agent chips).
 */
export function hexUnderFrontOrPath(
  front: WeatherFront,
  hex: FractionalHex,
  nowMs: number,
): boolean {
  if (hexUnderFront(front, hex, nowMs)) return true;
  const future = frontFutureCenterAt(front, nowMs);
  return axialDistance(future, hex) <= front.radius;
}

/**
 * Fade factor (0–1) for a front at `nowMs`: ramps up over FRONT_FADE_MS after
 * spawn and back down over FRONT_FADE_MS before expiry. Zero outside its life.
 */
export function frontFade(front: WeatherFront, nowMs: number): number {
  if (nowMs <= front.spawnedAt || nowMs >= front.expiresAt) return 0;
  const inT = Math.min(1, (nowMs - front.spawnedAt) / FRONT_FADE_MS);
  const outT = Math.min(1, (front.expiresAt - nowMs) / FRONT_FADE_MS);
  return Math.max(0, Math.min(inT, outT));
}

// ---------------------------------------------------------------------------
// Biome effect resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the multiplier a front applies to a given biome. Biome keys in the
 * published table are UPPER-CASE biome names; `default` (if present) applies to
 * any biome not explicitly listed. Missing → 1.0 (no effect).
 */
export function frontBiomeMultiplier(
  effects: WeatherBiomeEffects | undefined,
  biome: Biome,
): number {
  if (!effects) return 1;
  const key = biome.toUpperCase();
  if (typeof effects[key] === 'number') return effects[key] as number;
  if (typeof effects.default === 'number') return effects.default as number;
  return 1;
}

/**
 * The combined weather multiplier at a hex from ALL live fronts covering it. The
 * server multiplies per-front effects together in the mining calc; we mirror
 * that so the client's combined chip matches the authoritative product.
 */
export function weatherMultiplierAtHex(
  fronts: WeatherFront[],
  table: WeatherTable,
  hex: FractionalHex,
  biome: Biome,
  nowMs: number,
): number {
  let mult = 1;
  for (const front of fronts) {
    if (frontFade(front, nowMs) <= 0) continue;
    if (!hexUnderFront(front, hex, nowMs)) continue;
    mult *= frontBiomeMultiplier(table[front.type], biome);
  }
  return mult;
}

/**
 * The most-relevant front covering a hex (for the agent card chip label/tooltip),
 * plus its multiplier. Returns null if none cover the hex. Picks the front whose
 * effect deviates most from 1.0 (the one the player most needs to know about).
 */
export function dominantFrontAtHex(
  fronts: WeatherFront[],
  table: WeatherTable,
  hex: FractionalHex,
  biome: Biome,
  nowMs: number,
): { front: WeatherFront; multiplier: number } | null {
  let best: { front: WeatherFront; multiplier: number } | null = null;
  for (const front of fronts) {
    if (frontFade(front, nowMs) <= 0) continue;
    if (!hexUnderFront(front, hex, nowMs)) continue;
    const m = frontBiomeMultiplier(table[front.type], biome);
    if (!best || Math.abs(m - 1) > Math.abs(best.multiplier - 1)) {
      best = { front, multiplier: m };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Heading / summary text for the HUD
// ---------------------------------------------------------------------------

const COMPASS_8 = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'] as const;

/**
 * A cardinal heading label ('moving NE') from the front's velocity. Uses the
 * world-space direction of drift: axial velocity → world dx/dz (flat-top) →
 * 8-point compass. Returns 'stationary' for negligible velocity.
 */
export function frontHeading(front: WeatherFront): string {
  const { q, r } = front.velocity;
  if (Math.abs(q) < 1e-4 && Math.abs(r) < 1e-4) return 'stationary';
  // Flat-top axial → world (matches hexToPixel): x = 1.5q, z = sqrt3*(q/2 + r).
  const dx = 1.5 * q;
  const dz = Math.sqrt(3) * (q / 2 + r);
  // World: +x = East, +z = South (screen). Compass angle from East, CCW toward North (-z).
  const ang = Math.atan2(-dz, dx); // radians, East=0, North=+PI/2
  let idx = Math.round((ang / (Math.PI / 4)));
  idx = ((idx % 8) + 8) % 8;
  return `moving ${COMPASS_8[idx]}`;
}

/**
 * A one-line biome effect summary for a front, e.g. 'marsh +15% rocky −10%'.
 * Reads the published table for that front type. Empty string if no effects.
 */
export function frontEffectSummary(
  type: WeatherFrontType,
  table: WeatherTable,
): string {
  const effects = table[type];
  if (!effects) return '';
  const parts: string[] = [];
  for (const [rawKey, val] of Object.entries(effects)) {
    if (typeof val !== 'number') continue;
    const pct = Math.round((val - 1) * 100);
    if (pct === 0) continue;
    const sign = pct > 0 ? '+' : '−'; // real minus glyph
    const name = rawKey === 'default' ? 'all' : rawKey.toLowerCase();
    parts.push(`${name} ${sign}${Math.abs(pct)}%`);
  }
  return parts.join('  ');
}
