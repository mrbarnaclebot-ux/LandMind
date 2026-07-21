/**
 * worldPhases — the phase-keyframed sky/lighting table for the World Clock, plus
 * shared phase presentation metadata for the HUD.
 *
 * Colors and intensities come straight from the Phase A spec (GAMEPLAY-DESIGN
 * System 1 + ART-DIRECTION "Golden-Hour Dusk"). The scene lerps between adjacent
 * keyframes across the real phase boundaries using the smooth cycleT; the fog
 * color always tracks the current horizon color (anti-slop rule).
 */
import * as THREE from 'three';
import {
  PHASE_ORDER,
  PHASE_START_SECONDS,
  PHASE_DURATIONS,
  CYCLE_SECONDS,
} from '../stores/worldStore';
import type { WorldPhase } from '../lib/socketTypes';

/** One sky/lighting keyframe, anchored at a phase's midpoint on the cycle. */
export interface SkyKeyframe {
  /** Position on the cycle (0–1) this keyframe is anchored at. */
  t: number;
  zenith: THREE.Color;
  horizon: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  /** Sun elevation in degrees above the horizon. */
  sunElevationDeg: number;
  ambient: THREE.Color;
  ambientIntensity: number;
  /** Fog color — MUST equal horizon (kept in sync by construction). */
  fog: THREE.Color;
}

interface KeyframeSpec {
  phase: WorldPhase;
  zenith: string;
  horizon: string;
  sun: string;
  sunIntensity: number;
  sunElevationDeg: number;
  ambient: string;
  ambientIntensity: number;
}

/**
 * The keyframe table (spec §Task 2). Each is anchored at the MIDPOINT of its
 * phase so adjacent phases blend across their shared boundary.
 *  - dusk = the live anchor values from ART-DIRECTION.
 *  - golden_hour = the signature frame (peak warm amber).
 *  - day = warmer-bright, sun higher.
 *  - night = deep indigo, cool moon.
 *  - dawn = pale, low sun, thin fog.
 */
const KEYFRAME_SPECS: KeyframeSpec[] = [
  {
    phase: 'dawn',
    zenith: '#3A4468',
    horizon: '#E8C8A0',
    sun: '#FFD8A0',
    sunIntensity: 1.6,
    sunElevationDeg: 14,
    ambient: '#4A5A78',
    ambientIntensity: 0.42,
  },
  {
    phase: 'day',
    zenith: '#4A5C88',
    horizon: '#F0C890',
    sun: '#FFCE8A',
    sunIntensity: 2.2,
    sunElevationDeg: 45,
    ambient: '#5A6A88',
    ambientIntensity: 0.5,
  },
  {
    phase: 'golden_hour',
    zenith: '#2E3A5C',
    horizon: '#E08A4A', // slightly deeper amber horizon — the signature peak
    sun: '#FFB86B',
    sunIntensity: 2.6,
    sunElevationDeg: 20,
    ambient: '#4A5A78',
    ambientIntensity: 0.46,
  },
  {
    phase: 'dusk',
    zenith: '#2E3A5C',
    horizon: '#E8A26B', // live anchor keyframe
    sun: '#FFB86B',
    sunIntensity: 2.4,
    sunElevationDeg: 22,
    ambient: '#4A5A78',
    ambientIntensity: 0.45,
  },
  {
    phase: 'night',
    zenith: '#0E1220',
    horizon: '#2E3A5C',
    sun: '#8A9AC0', // cool moon
    sunIntensity: 0.5,
    sunElevationDeg: 30,
    ambient: '#232840',
    ambientIntensity: 0.35,
  },
];

/** cycleT at the midpoint of a phase. */
function phaseMidT(phase: WorldPhase): number {
  return (PHASE_START_SECONDS[phase] + PHASE_DURATIONS[phase] / 2) / CYCLE_SECONDS;
}

/** The full keyframe list, sorted by cycle position, colors pre-parsed. */
export const SKY_KEYFRAMES: SkyKeyframe[] = KEYFRAME_SPECS.map((s) => {
  const horizon = new THREE.Color(s.horizon);
  return {
    t: phaseMidT(s.phase),
    zenith: new THREE.Color(s.zenith),
    horizon,
    sun: new THREE.Color(s.sun),
    sunIntensity: s.sunIntensity,
    sunElevationDeg: s.sunElevationDeg,
    ambient: new THREE.Color(s.ambient),
    ambientIntensity: s.ambientIntensity,
    fog: horizon.clone(), // fog === horizon, always
  };
})
  .slice()
  .sort((a, b) => a.t - b.t);

/**
 * Resolve the interpolated sky state at a cycleT (0–1). Lerps between the two
 * bracketing keyframes, wrapping across the cycle seam so the transition from
 * night → dawn is smooth (no pop). Writes into `out` to avoid per-frame allocs.
 */
export function sampleSky(cycleT: number, out: SkyKeyframe): SkyKeyframe {
  const t = (((cycleT % 1) + 1) % 1);
  const kfs = SKY_KEYFRAMES;
  const n = kfs.length;

  // Find the keyframe pair (a before t, b after t), wrapping around.
  let a = kfs[n - 1];
  let b = kfs[0];
  for (let i = 0; i < n; i++) {
    if (t < kfs[i].t) {
      b = kfs[i];
      a = kfs[(i - 1 + n) % n];
      break;
    }
    if (i === n - 1) {
      // t is past the last keyframe — wrap from last to first.
      a = kfs[n - 1];
      b = kfs[0];
    }
  }

  // Fractional position between a.t and b.t, handling the wrap seam.
  let span = b.t - a.t;
  if (span <= 0) span += 1;
  let local = t - a.t;
  if (local < 0) local += 1;
  const f = span > 0 ? THREE.MathUtils.clamp(local / span, 0, 1) : 0;

  // Smoothstep for gentler ease near boundaries (still monotonic, no overshoot).
  const s = f * f * (3 - 2 * f);

  out.zenith.copy(a.zenith).lerp(b.zenith, s);
  out.horizon.copy(a.horizon).lerp(b.horizon, s);
  out.sun.copy(a.sun).lerp(b.sun, s);
  out.ambient.copy(a.ambient).lerp(b.ambient, s);
  out.fog.copy(out.horizon); // fog tracks horizon exactly
  out.sunIntensity = THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, s);
  out.ambientIntensity = THREE.MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, s);
  out.sunElevationDeg = THREE.MathUtils.lerp(a.sunElevationDeg, b.sunElevationDeg, s);
  out.t = t;
  return out;
}

/** Allocate a mutable keyframe target for `sampleSky` to write into. */
export function makeSkyTarget(): SkyKeyframe {
  return {
    t: 0,
    zenith: new THREE.Color(),
    horizon: new THREE.Color(),
    sun: new THREE.Color(),
    sunIntensity: 2.4,
    sunElevationDeg: 22,
    ambient: new THREE.Color(),
    ambientIntensity: 0.45,
    fog: new THREE.Color(),
  };
}

// ---------------------------------------------------------------------------
// HUD presentation metadata (icon + label per phase)
// ---------------------------------------------------------------------------

export interface PhaseMeta {
  phase: WorldPhase;
  label: string;
  /** Short unicode glyph rendered before the label. */
  icon: string;
  /** Accent color token used for this phase's chip / highlight. */
  accentVar: string;
}

export const PHASE_META: Record<WorldPhase, PhaseMeta> = {
  dawn: { phase: 'dawn', label: 'DAWN', icon: '◔', accentVar: 'var(--amber-light)' },
  day: { phase: 'day', label: 'DAY', icon: '☀', accentVar: 'var(--amber)' },
  golden_hour: {
    phase: 'golden_hour',
    label: 'GOLDEN HOUR',
    icon: '✦',
    accentVar: 'var(--amber)',
  },
  dusk: { phase: 'dusk', label: 'DUSK', icon: '◒', accentVar: 'var(--amber-dark)' },
  night: { phase: 'night', label: 'NIGHT', icon: '☾', accentVar: 'var(--teal)' },
};

export { PHASE_ORDER };
