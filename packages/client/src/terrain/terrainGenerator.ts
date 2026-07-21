/**
 * Procedural terrain generation using noise functions
 *
 * Generates HexData arrays with:
 *  - biome assignment (UNCHANGED contract: deterministic per (q,r), drives
 *    tooltip + resource map)
 *  - a separate VISUAL elevation tier (0-4) for complex terraforming (water /
 *    shore / midland / highland / peak) derived from a fixed-seed multi-octave
 *    noise keyed only by (q,r).
 *
 * The visual elevation is layered on top of biomes; it does NOT change which
 * biome a hex is. Same input (q,r) => same world across sessions/clients.
 */

import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import alea from 'alea';
import { getBiome, type Biome } from './biomes';
import { hexToPixel, hexDistance } from '../hex/hexMath';

/**
 * Visual elevation tiers for terraforming.
 * These indices are stored in HexData.elevation and used for column height:
 *   y = tier * ELEVATION_STEP (+ jitter).
 */
export const TIER_WATER = 0;
export const TIER_SHORE = 1;
export const TIER_MIDLAND = 2;
export const TIER_HIGHLAND = 3;
export const TIER_PEAK = 4;

/** Number of distinct visual tiers */
export const ELEVATION_TIER_COUNT = 5;

/** Waterline tier — tiles at or below this render as water. */
export const WATERLINE_TIER = TIER_WATER;

/**
 * Data for a single hex tile
 */
export interface HexData {
  q: number; // Axial coordinate q
  r: number; // Axial coordinate r
  /** Visual elevation tier 0..4 (water..peak). Drives column height + agent Y. */
  elevation: number;
  /** Continuous normalized height 0..1 (for ramp value + jitter). */
  height: number;
  /** Small deterministic per-hex vertical jitter within the tier (world units). */
  jitter: number;
  biome: Biome; // Biome type (unchanged contract)
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

/**
 * Biome-band thresholds (UNCHANGED — preserve biome contract).
 */
const BIOME_BAND_THRESHOLDS = {
  low: 0.4, // Below this = band 0
  mid: 0.7, // Below this = band 1, above = band 2
};

/**
 * Visual elevation tier thresholds on the normalized terraform height (0..1).
 * Tuned so ~18% of the world is water, with a gentle spread up to peaks.
 */
const TIER_THRESHOLDS = {
  water: 0.32, // < 0.32  -> water
  shore: 0.44, // < 0.44  -> shore/lowland
  midland: 0.62, // < 0.62 -> midland
  highland: 0.82, // < 0.82 -> highland ; else peak
};

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

/**
 * Visual terraform height via 4-octave fBm keyed only by world (x,z) of (q,r).
 * Returns a normalized 0..1 continuous height.
 */
function generateTerraformHeight(x: number, z: number, noise: NoiseFunction2D): number {
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
  const raw = sum / norm; // -1..1
  let h = (raw + 1) / 2; // 0..1
  // Gentle contrast curve so midland dominates and peaks stay rare.
  h = Math.pow(h, 1.15);
  return Math.max(0, Math.min(1, h));
}

/**
 * Quantize a continuous 0..1 height into a visual tier 0..4.
 */
function heightToTier(h: number): number {
  if (h < TIER_THRESHOLDS.water) return TIER_WATER;
  if (h < TIER_THRESHOLDS.shore) return TIER_SHORE;
  if (h < TIER_THRESHOLDS.midland) return TIER_MIDLAND;
  if (h < TIER_THRESHOLDS.highland) return TIER_HIGHLAND;
  return TIER_PEAK;
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
  const s: Required<TerrainSeed> = {
    elevation: seed.elevation ?? DEFAULT_SEED.elevation,
    moisture: seed.moisture ?? DEFAULT_SEED.moisture,
    terraform: seed.terraform ?? DEFAULT_SEED.terraform,
  };

  const biomeBandNoise = createNoise2D(alea(s.elevation));
  const moistureNoise = createNoise2D(alea(s.moisture));
  const terraformNoise = createNoise2D(alea(s.terraform));

  const hexes: HexData[] = [];
  const center = { q: 0, r: 0 };

  for (let q = -gridRadius; q <= gridRadius; q++) {
    for (let r = -gridRadius; r <= gridRadius; r++) {
      if (hexDistance({ q, r }, center) > gridRadius) continue;

      const { x, z } = hexToPixel(q, r);

      // --- Biome (unchanged contract) ---
      const biomeBand = generateBiomeBand(x, z, biomeBandNoise);
      const moisture = generateMoisture(x, z, moistureNoise);
      const biome = getBiome(biomeBand, moisture);

      // --- Visual terraforming (new) ---
      const height = generateTerraformHeight(x, z, terraformNoise);
      const elevation = heightToTier(height);
      // Per-hex jitter within tier: ±40% of a step, deterministic by (q,r).
      const jitter = (hashQR(q, r) - 0.5) * 0.8; // -0.4..0.4 (in step units)

      hexes.push({ q, r, elevation, height, jitter, biome });
    }
  }

  return hexes;
}
