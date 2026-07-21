/**
 * Procedural terrain generation using noise functions — "Sunken Ember Hollows".
 *
 * Generates HexData arrays with:
 *  - biome assignment (UNCHANGED contract: deterministic per (q,r), drives
 *    tooltip + resource map)
 *  - a separate VISUAL elevation tier (0-6) for dramatic terraforming derived
 *    from a fixed-seed multi-channel noise keyed only by (q,r):
 *      * base fBm  — smooth landmasses
 *      * ridged noise (abs-value fBm) — ridgelines, mesas, sharp highlands
 *      * plateau quantization in the highlands — stepped tabletops
 *      * a very-low-frequency valley channel — winding valley lines; valley
 *        floors below the waterline become water/marsh
 *  - deterministic PITS (sinkholes) that drop a hex 2-3 tiers below its rim
 *  - deterministic CAVE mouths on tall cliff faces (set dressing metadata)
 *
 * The visual elevation is layered on top of biomes; it does NOT change which
 * biome a hex is. Same input (q,r) => same world across sessions/clients.
 */

import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import alea from 'alea';
import { getBiome, type Biome } from './biomes';
import { hexToPixel, hexDistance, hexNeighbors } from '../hex/hexMath';

/**
 * Visual elevation tiers for terraforming (v2 — 7 tiers).
 * These indices are stored in HexData.elevation and used for column height:
 *   y = tier * ELEVATION_STEP.
 *
 * Named anchors are kept for readability + biome-ramp mapping; the full range
 * is 0..6 (TIER_MAX).
 */
export const TIER_WATER = 0;
export const TIER_SHORE = 1;
export const TIER_LOWLAND = 2;
export const TIER_MIDLAND = 3;
export const TIER_HIGHLAND = 4;
export const TIER_MOUNTAIN = 5;
export const TIER_PEAK = 6;

/** Highest visual tier index. */
export const TIER_MAX = TIER_PEAK;

/** Number of distinct visual tiers (0..6). */
export const ELEVATION_TIER_COUNT = TIER_MAX + 1;

/** Waterline tier — tiles at or below this render as water. */
export const WATERLINE_TIER = TIER_WATER;

/**
 * Data for a single hex tile
 */
export interface HexData {
  q: number; // Axial coordinate q
  r: number; // Axial coordinate r
  /** Visual elevation tier 0..6 (water..peak). Drives column height + agent Y. */
  elevation: number;
  /** Continuous normalized height 0..1 (for ramp value + jitter). */
  height: number;
  /** Small deterministic per-hex vertical jitter within the tier (world units). */
  jitter: number;
  biome: Biome; // Biome type (unchanged contract)
  /**
   * If this hex is a sinkhole/pit, its rim tier (the surface tier before the
   * pit dropped it). Undefined for normal hexes. Used for pit wall/floor
   * dressing. `elevation` already reflects the dropped floor tier.
   */
  pitRim?: number;
  /** True when this hex is a pit floor (gets ember speckles). */
  isPit?: boolean;
}

/**
 * A cave-mouth placement (set dressing). Deterministic per (q,r) + face.
 * Positioned on a cliff face where a neighbour is >= CAVE_MIN_DELTA tiers lower.
 */
export interface CaveMouth {
  /** Owning hex axial coords (the taller side of the cliff). */
  q: number;
  r: number;
  /** Neighbour direction index (0..5, matches AXIAL_DIRECTIONS). */
  dir: number;
  /** Tier of the owning (tall) hex. */
  tier: number;
  /** Tier of the lower neighbour. */
  neighborTier: number;
}

/**
 * Seeds for deterministic terrain generation.
 * `elevation` + `moisture` preserve the ORIGINAL biome contract byte-for-byte.
 * `terraform` seeds the new visual height field only.
 */
export interface TerrainSeed {
  elevation: string;
  moisture: string;
  terraform?: string;
}

/**
 * Default seeds. `elevation`/`moisture` unchanged from the original so existing
 * (q,r) keep the exact same biome. `terraform` is fixed so the visual world is
 * stable across sessions/clients.
 */
const DEFAULT_SEED: Required<TerrainSeed> = {
  elevation: 'elevation-default',
  moisture: 'moisture-default',
  terraform: 'landmind-terraform-v1',
};

/**
 * Noise configuration.
 */
const ELEVATION_SCALE = 0.15; // biome-band noise scale (unchanged)
const MOISTURE_SCALE = 0.1; // moisture noise scale (unchanged)
const TERRAFORM_SCALE = 0.085; // visual height — larger, smoother landmasses
const RIDGE_SCALE = 0.11; // ridged-noise channel — sharper ridgelines/mesas
const VALLEY_SCALE = 0.028; // very-low-frequency valley carving channel

/**
 * Biome-band thresholds (UNCHANGED — preserve biome contract).
 */
const BIOME_BAND_THRESHOLDS = {
  low: 0.4, // Below this = band 0
  mid: 0.7, // Below this = band 1, above = band 2
};

/**
 * Visual elevation tier thresholds on the normalized terraform height (0..1),
 * for the 7-tier v2 range. Tuned so ~18-22% of the world is water and relief
 * climbs to rare peaks/mesas.
 */
const TIER_THRESHOLDS = [
  0.26, // < 0.26  -> water   (tier 0)
  0.37, // < 0.37  -> shore   (tier 1)
  0.48, // < 0.48 -> lowland (tier 2)
  0.6, // < 0.60 -> midland (tier 3)
  0.72, // < 0.72 -> highland(tier 4)
  0.84, // < 0.84 -> mountain(tier 5)
  // >= 0.84 -> peak (tier 6)
];

/** Highland plateau quantization: heights above this get stepped into mesas. */
const PLATEAU_START = 0.66;
/** Plateau step size (in normalized-height units) for the mesa tabletops. */
const PLATEAU_STEP = 0.06;

/** Valley carving strength (normalized-height units subtracted at valley cores). */
const VALLEY_DEPTH = 0.22;
/** Valley channel width control — narrower ridged valley lines. */
const VALLEY_SHARPNESS = 2.2;

/** Pits ----------------------------------------------------------------- */
/** Fraction of land hexes that seed a pit cluster centre (~1.5%). */
const PIT_RATE = 0.015;
/** Max pit clusters kept (budget). */
export const PIT_CLUSTER_BUDGET = 60;

/** Caves ---------------------------------------------------------------- */
/** Minimum tier delta between neighbours to expose a cliff face. */
export const CAVE_MIN_DELTA = 2;
/** Fraction of qualifying cliff faces that get a cave mouth (~10%). */
const CAVE_RATE = 0.1;
/** Max cave mouths kept (budget). */
export const CAVE_MOUTH_BUDGET = 80;

/**
 * Biome-elevation band via 3-octave fBm (UNCHANGED — feeds getBiome).
 */
function generateBiomeBand(x: number, z: number, noise: NoiseFunction2D): number {
  const e1 = 1.0 * noise(1 * x * ELEVATION_SCALE, 1 * z * ELEVATION_SCALE);
  const e2 = 0.5 * noise(2 * x * ELEVATION_SCALE, 2 * z * ELEVATION_SCALE);
  const e3 = 0.25 * noise(4 * x * ELEVATION_SCALE, 4 * z * ELEVATION_SCALE);

  const raw = (e1 + e2 + e3) / (1 + 0.5 + 0.25);
  const normalized = (raw + 1) / 2;

  if (normalized < BIOME_BAND_THRESHOLDS.low) return 0;
  if (normalized < BIOME_BAND_THRESHOLDS.mid) return 1;
  return 2;
}

/**
 * Moisture (single octave, unchanged — feeds getBiome).
 */
function generateMoisture(x: number, z: number, noise: NoiseFunction2D): number {
  const raw = noise(x * MOISTURE_SCALE, z * MOISTURE_SCALE);
  return (raw + 1) / 2;
}

/** Base smooth fBm, 4 octaves, normalized 0..1. */
function baseFbm(x: number, z: number, noise: NoiseFunction2D): number {
  let amp = 1.0;
  let freq = 1.0;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * noise(x * TERRAFORM_SCALE * freq, z * TERRAFORM_SCALE * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return (sum / norm + 1) / 2; // 0..1
}

/**
 * Ridged multifractal (abs-value fBm). Produces sharp ridgelines/mesas: value
 * peaks along noise zero-crossings. Returned 0..1 with 1 at the ridge crest.
 */
function ridgedFbm(x: number, z: number, noise: NoiseFunction2D): number {
  let amp = 1.0;
  let freq = 1.0;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    const n = noise(x * RIDGE_SCALE * freq, z * RIDGE_SCALE * freq);
    const ridge = 1 - Math.abs(n); // crest where n ~ 0
    sum += amp * ridge * ridge; // square sharpens the ridge
    norm += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return sum / norm; // 0..1
}

/**
 * Very-low-frequency valley channel. Returns a 0..1 "valleyness" that is 1
 * along winding valley cores and 0 away from them (ridged, so valleys are
 * narrow winding lines rather than broad basins).
 */
function valleyChannel(x: number, z: number, noise: NoiseFunction2D): number {
  const n = noise(x * VALLEY_SCALE, z * VALLEY_SCALE);
  const line = 1 - Math.abs(n); // ridge along zero-crossing = valley core
  return Math.pow(Math.max(0, line), VALLEY_SHARPNESS);
}

/**
 * Visual terraform height (v2). Blends base fBm with ridged noise for relief,
 * quantizes highland tops into plateau steps, and carves valley lines.
 * Returns a normalized 0..1 continuous height keyed only by world (x,z).
 */
function generateTerraformHeight(x: number, z: number, noise: NoiseFunction2D): number {
  const base = baseFbm(x, z, noise);
  const ridge = ridgedFbm(x, z, noise);

  // Blend: ridges dominate the highlands, base dominates the lowlands. Weight
  // the ridge contribution by the base height so ridgelines rise from high
  // ground (mesas/mountain spines) rather than floating over water.
  const ridgeWeight = 0.55 * base; // 0 at sea, up to 0.55 in highlands
  let h = base * (1 - ridgeWeight) + ridge * ridgeWeight;

  // Plateau quantization in the highlands: snap tops into flat mesa steps.
  if (h > PLATEAU_START) {
    const over = h - PLATEAU_START;
    const stepped = Math.floor(over / PLATEAU_STEP) * PLATEAU_STEP + PLATEAU_STEP * 0.5;
    // Blend 70% toward the stepped value so plateaus read as tabletops but keep
    // a little organic variation on their faces.
    h = PLATEAU_START + (over * 0.3 + stepped * 0.7);
  }

  // Valley carving: subtract along winding valley lines. Deepest carve where
  // valleyness is high AND the land is low-to-mid (so we don't slice peaks).
  const valley = valleyChannel(x, z, noise);
  const carveMask = 1 - Math.min(1, Math.max(0, (h - 0.5) / 0.4)); // 1 low, 0 high
  h -= valley * VALLEY_DEPTH * carveMask;

  // Gentle contrast curve so midland dominates and peaks stay rare.
  h = Math.pow(Math.max(0, h), 1.1);
  return Math.max(0, Math.min(1, h));
}

/**
 * Quantize a continuous 0..1 height into a visual tier 0..6.
 */
function heightToTier(h: number): number {
  for (let t = 0; t < TIER_THRESHOLDS.length; t++) {
    if (h < TIER_THRESHOLDS[t]) return t;
  }
  return TIER_MAX;
}

/**
 * Deterministic hash of (q,r) -> 0..1. Stable across sessions/clients.
 */
export function hashQR(q: number, r: number): number {
  // 2D integer hash (based on a common wanghash mix).
  let h = (q * 374761393 + r * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = (h * 1274126177) | 0;
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

/**
 * Generate hex data for a circular grid of specified radius.
 *
 * @param gridRadius - Radius of the hex grid (in hex units)
 * @param seed - Optional seeds for deterministic generation
 * @returns Array of HexData for all hexes in the grid
 */
export function generateHexData(
  gridRadius: number,
  seed: TerrainSeed = DEFAULT_SEED
): HexData[] {
  return generateWorld(gridRadius, seed).hexes;
}

/**
 * Full terrain generation result: hex data + cave-mouth set-dressing list.
 * (generateHexData wraps this for the common case that only needs the hexes.)
 */
export interface WorldData {
  hexes: HexData[];
  caves: CaveMouth[];
}

export function generateWorld(
  gridRadius: number,
  seed: TerrainSeed = DEFAULT_SEED
): WorldData {
  const s: Required<TerrainSeed> = {
    elevation: seed.elevation ?? DEFAULT_SEED.elevation,
    moisture: seed.moisture ?? DEFAULT_SEED.moisture,
    terraform: seed.terraform ?? DEFAULT_SEED.terraform,
  };

  const biomeBandNoise = createNoise2D(alea(s.elevation));
  const moistureNoise = createNoise2D(alea(s.moisture));
  const terraformNoise = createNoise2D(alea(s.terraform));

  const hexes: HexData[] = [];
  const byKey = new Map<string, HexData>();
  const center = { q: 0, r: 0 };

  // --- Pass 1: base surface (biome + terraform tier) ---
  for (let q = -gridRadius; q <= gridRadius; q++) {
    for (let r = -gridRadius; r <= gridRadius; r++) {
      if (hexDistance({ q, r }, center) > gridRadius) continue;

      const { x, z } = hexToPixel(q, r);

      // --- Biome (unchanged contract) ---
      const biomeBand = generateBiomeBand(x, z, biomeBandNoise);
      const moisture = generateMoisture(x, z, moistureNoise);
      const biome = getBiome(biomeBand, moisture);

      // --- Visual terraforming (v2) ---
      const height = generateTerraformHeight(x, z, terraformNoise);
      const elevation = heightToTier(height);
      // Per-hex jitter within tier: ±40% of a step, deterministic by (q,r).
      const jitter = (hashQR(q, r) - 0.5) * 0.8; // -0.4..0.4 (in step units)

      const hex: HexData = { q, r, elevation, height, jitter, biome };
      hexes.push(hex);
      byKey.set(`${q},${r}`, hex);
    }
  }

  // --- Pass 2: pits (deterministic sinkhole clusters on land) ---
  applyPits(hexes, byKey);

  // --- Pass 3: cave mouths on tall cliff faces (set dressing) ---
  const caves = collectCaves(hexes, byKey);

  return { hexes, caves };
}

/**
 * Deterministically place sinkhole pits: ~1.5% of land hexes seed a cluster of
 * 1-3 hexes whose floor drops 2-3 tiers below the surrounding rim. Budget-capped.
 */
function applyPits(hexes: HexData[], byKey: Map<string, HexData>): void {
  // Collect candidate centres first (deterministic scan order = array order).
  const centres: HexData[] = [];
  for (const h of hexes) {
    if (h.elevation <= TIER_SHORE) continue; // need real land with a rim to drop below
    // Deterministic gate.
    if (hashQR(h.q * 7 + 31, h.r * 13 - 17) >= PIT_RATE) continue;
    centres.push(h);
    if (centres.length >= PIT_CLUSTER_BUDGET) break;
  }

  for (const centre of centres) {
    const rim = centre.elevation;
    const drop = 2 + Math.floor(hashQR(centre.q + 5, centre.r + 9) * 2); // 2..3
    const floor = Math.max(TIER_WATER + 1, rim - drop);
    const clusterSize = 1 + Math.floor(hashQR(centre.q - 3, centre.r + 7) * 3); // 1..3

    const members: HexData[] = [centre];
    if (clusterSize > 1) {
      const neigh = hexNeighbors(centre.q, centre.r);
      for (const n of neigh) {
        if (members.length >= clusterSize) break;
        const nh = byKey.get(`${n.q},${n.r}`);
        // Only pit neighbours that are real land near the same height.
        if (nh && nh.elevation > TIER_SHORE && !nh.isPit) members.push(nh);
      }
    }

    for (const m of members) {
      // Only lower it (never raise); keep the tallest neighbour context as rim.
      if (m.isPit) continue;
      m.pitRim = m.elevation;
      m.isPit = true;
      m.elevation = Math.min(m.elevation, floor);
    }
  }
}

/**
 * Collect cave-mouth placements. For each hex, check its 6 neighbours; where a
 * neighbour is >= CAVE_MIN_DELTA tiers lower (a real cliff face), a ~10% hashed
 * subset gets a cave mouth on that face. Budget-capped and de-duplicated so a
 * given cliff face only spawns one mouth.
 */
function collectCaves(hexes: HexData[], byKey: Map<string, HexData>): CaveMouth[] {
  const caves: CaveMouth[] = [];
  const dirs = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];

  for (const h of hexes) {
    if (h.elevation < TIER_MIDLAND) continue; // caves only in real relief
    for (let d = 0; d < 6; d++) {
      const n = byKey.get(`${h.q + dirs[d].q},${h.r + dirs[d].r}`);
      if (!n) continue;
      const delta = h.elevation - n.elevation;
      if (delta < CAVE_MIN_DELTA) continue;
      // Deterministic ~10% gate keyed by (q,r,dir).
      if (hashQR(h.q * 17 + d * 101, h.r * 19 - d * 53) >= CAVE_RATE) continue;
      caves.push({ q: h.q, r: h.r, dir: d, tier: h.elevation, neighborTier: n.elevation });
      if (caves.length >= CAVE_MOUTH_BUDGET) return caves;
    }
  }
  return caves;
}
