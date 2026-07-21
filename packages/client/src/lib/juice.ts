/**
 * juice.ts - Motion & "game-feel" utilities for the agent visual rework.
 *
 * Provides:
 *  - A tiny trauma-based camera-shake store (Perlin-ish, trauma², decays over time).
 *    Consumed locally by AgentLayer via a `<CameraShake/>` component using useFrame on
 *    the r3f camera, and exported so ThreeScene could later drive shake from one place.
 *  - Deterministic per-instance hashing (no Math.random in render) for phase offsets
 *    and subtle body tint jitter.
 *  - Easing helpers (easeOutBack for the deploy squash-land).
 *  - A small value-noise sampler for smooth shake displacement.
 *
 * This file is standalone (no React imports at module scope beyond the store lib) so it
 * can be consumed by any component in the tree.
 */

// ---------------------------------------------------------------------------
// Trauma store (framework-agnostic subscribe/getSnapshot; usable via useSyncExternalStore)
// ---------------------------------------------------------------------------

/**
 * Trauma model (Squirrel Eiserloh "juicing"): callers ADD trauma (0..1, clamped).
 * Actual shake amount = trauma². Trauma decays linearly each frame. Keeping the raw
 * trauma value + squaring on read gives the characteristic "big hit fades fast, then
 * lingers subtly" feel.
 */
let _trauma = 0;
let _maxTrauma = 0; // remembers the peak of the current burst (used for decay pacing)
const _listeners = new Set<() => void>();

function _emit() {
  for (const l of _listeners) l();
}

/** Add trauma from an impulse (e.g. a deploy landing). Clamped to [0,1]. */
export function addTrauma(amount: number): void {
  _trauma = Math.min(1, _trauma + amount);
  _maxTrauma = Math.max(_maxTrauma, _trauma);
  _emit();
}

/** Current raw trauma (0..1). Prefer getShake() for a displacement magnitude. */
export function getTrauma(): number {
  return _trauma;
}

/**
 * Advance trauma decay by dt seconds. `decaySeconds` is the time for a full-trauma
 * (1.0) burst to reach zero; the spec asks for a ~100-250ms decay, so we default the
 * consumer to a value in that band. Returns the new trauma.
 */
export function decayTrauma(dt: number, decaySeconds: number): number {
  if (_trauma <= 0) {
    _maxTrauma = 0;
    return 0;
  }
  const rate = 1 / Math.max(0.001, decaySeconds);
  _trauma = Math.max(0, _trauma - rate * dt);
  if (_trauma <= 0) _maxTrauma = 0;
  _emit();
  return _trauma;
}

/** Shake magnitude for this frame = trauma² (0..1). */
export function getShake(): number {
  return _trauma * _trauma;
}

/** Subscribe for React's useSyncExternalStore. */
export function subscribeTrauma(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/** Reset (mainly for tests / scene teardown). */
export function resetTrauma(): void {
  _trauma = 0;
  _maxTrauma = 0;
  _emit();
}

// ---------------------------------------------------------------------------
// Deterministic hashing — stable per-agent-id variation, no Math.random in render
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hash of a string. Deterministic and fast. */
export function hashStringToUint(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts to stay in int range
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic float in [0,1) from an id + optional salt (for independent channels). */
export function hash01(id: string, salt = 0): number {
  const h = hashStringToUint(id + '#' + salt);
  return (h % 100000) / 100000;
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

/**
 * easeOutBack matching cubic-bezier(0.34, 1.56, 0.64, 1) intent — overshoots past 1
 * then settles. Standard c1=1.70158, c3=c1+1 formulation. t in [0,1].
 */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}

/** Linear clamp helper. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------------------
// Value noise — smooth 1D noise for camera shake displacement (Perlin-ish).
// Deterministic, seeded, cheap. Sampling at high frequency gives jittery-but-smooth
// motion rather than random per-frame teleporting.
// ---------------------------------------------------------------------------

function _fade(t: number): number {
  return t * t * (3 - 2 * t); // smoothstep
}

function _grad(i: number, seed: number): number {
  // hash lattice point -> pseudo-random gradient in [-1,1]
  let h = (i * 374761393 + seed * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h % 20001) / 10000) - 1; // [-1,1]
}

/** 1D value noise in ~[-1,1]. */
export function noise1D(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = _grad(i, seed);
  const b = _grad(i + 1, seed);
  return a + (b - a) * _fade(f);
}
