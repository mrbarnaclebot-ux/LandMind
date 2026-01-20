/**
 * Procedural terrain generation using noise functions
 *
 * Generates HexData arrays with elevation tiers and biome assignments
 * for the hex world. Uses simplex noise for natural-looking terrain
 * variation and fractional Brownian motion for multi-scale detail.
 */

import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import alea from 'alea';
import { getBiome, type Biome } from './biomes';

/**
 * Hex size constant (outer radius)
 * TODO: Import from ../hex/hexMath when Plan 02-01 is executed
 */
const HEX_SIZE = 1.0;

/**
 * Convert axial hex coordinates to world position (flat-top orientation)
 * TODO: Import from ../hex/hexMath when Plan 02-01 is executed
 */
function hexToPixel(q: number, r: number): { x: number; z: number } {
  const x = HEX_SIZE * (3 / 2) * q;
  const z = HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, z };
}

/**
 * Calculate hex distance from origin (for grid generation bounds)
 */
function hexDistance(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2;
}

/**
 * Data for a single hex tile
 */
export interface HexData {
  q: number;         // Axial coordinate q
  r: number;         // Axial coordinate r
  elevation: number; // Elevation tier: 0 (low), 1 (mid), or 2 (high)
  biome: Biome;      // Biome type based on elevation and moisture
}

/**
 * Seeds for deterministic terrain generation
 */
export interface TerrainSeed {
  elevation: string;
  moisture: string;
}

/**
 * Default seeds for consistent default terrain
 */
const DEFAULT_SEED: TerrainSeed = {
  elevation: 'elevation-default',
  moisture: 'moisture-default',
};

/**
 * Noise configuration
 */
const ELEVATION_SCALE = 0.02; // Large features
const MOISTURE_SCALE = 0.015; // Slightly larger regions

/**
 * Elevation thresholds for quantizing continuous noise to tiers
 */
const ELEVATION_THRESHOLDS = {
  low: 0.4,   // Below this = tier 0
  mid: 0.7,   // Below this = tier 1, above = tier 2
};

/**
 * Generate elevation using fractional Brownian motion (3 octaves)
 */
function generateElevation(
  x: number,
  z: number,
  noise: NoiseFunction2D
): number {
  // fBm with 3 octaves for varied terrain
  const e1 = 1.0 * noise(1 * x * ELEVATION_SCALE, 1 * z * ELEVATION_SCALE);
  const e2 = 0.5 * noise(2 * x * ELEVATION_SCALE, 2 * z * ELEVATION_SCALE);
  const e3 = 0.25 * noise(4 * x * ELEVATION_SCALE, 4 * z * ELEVATION_SCALE);

  // Normalize to 0-1 range
  const raw = (e1 + e2 + e3) / (1 + 0.5 + 0.25);
  const normalized = (raw + 1) / 2;

  // Quantize to elevation tiers
  if (normalized < ELEVATION_THRESHOLDS.low) return 0;
  if (normalized < ELEVATION_THRESHOLDS.mid) return 1;
  return 2;
}

/**
 * Generate moisture value (single octave, different scale)
 */
function generateMoisture(
  x: number,
  z: number,
  noise: NoiseFunction2D
): number {
  const raw = noise(x * MOISTURE_SCALE, z * MOISTURE_SCALE);
  // Normalize to 0-1 range
  return (raw + 1) / 2;
}

/**
 * Generate hex data for a circular grid of specified radius
 *
 * @param gridRadius - Radius of the hex grid (in hex units)
 * @param seed - Optional seeds for deterministic generation
 * @returns Array of HexData for all hexes in the grid
 *
 * @example
 * // Generate a small grid with default seed
 * const hexes = generateHexData(5);
 * console.log(hexes.length); // ~91 hexes
 *
 * // Generate with custom seed for different terrain
 * const hexes2 = generateHexData(30, { elevation: 'my-seed', moisture: 'other-seed' });
 */
export function generateHexData(
  gridRadius: number,
  seed: TerrainSeed = DEFAULT_SEED
): HexData[] {
  // Create seeded noise functions
  const elevationNoise = createNoise2D(alea(seed.elevation));
  const moistureNoise = createNoise2D(alea(seed.moisture));

  const hexes: HexData[] = [];

  // Generate hexes in a grid, filtering to circular shape
  for (let q = -gridRadius; q <= gridRadius; q++) {
    for (let r = -gridRadius; r <= gridRadius; r++) {
      // Only include hexes within the radius
      if (hexDistance(q, r) > gridRadius) continue;

      // Get world position for noise sampling
      const { x, z } = hexToPixel(q, r);

      // Generate terrain values
      const elevation = generateElevation(x, z, elevationNoise);
      const moisture = generateMoisture(x, z, moistureNoise);
      const biome = getBiome(elevation, moisture);

      hexes.push({ q, r, elevation, biome });
    }
  }

  return hexes;
}

// Verification test (can be removed in production)
// const testHexes = generateHexData(5);
// console.log('Generated', testHexes.length, 'hexes');
// console.log('Sample:', testHexes[0]);
// Expected: ~91 hexes for radius 5 with varied elevations
