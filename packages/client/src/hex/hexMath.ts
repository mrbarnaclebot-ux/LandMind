/**
 * Hex Math Utilities - Flat-top Axial Coordinate System
 *
 * Based on Red Blob Games hexagonal grid reference:
 * https://www.redblobgames.com/grids/hexagons/
 *
 * Flat-top orientation: hex corners at angles 0, 60, 120, 180, 240, 300 degrees
 *
 * Test cases (verify with npm run --workspace=@landmind/client build):
 * - hexToPixel(0, 0) => { x: 0, z: 0 }
 * - hexToPixel(1, 0) => { x: 1.5, z: ~0.866 }
 * - hexNeighbors(0, 0) => 6 coordinates
 */

/**
 * Hex coordinate in axial system (q, r)
 * - q: column axis (increases east)
 * - r: row axis (increases southeast)
 */
export interface HexCoord {
  q: number;
  r: number;
}

/**
 * World position (x, z plane)
 */
export interface WorldPosition {
  x: number;
  z: number;
}

/** Hex outer radius (distance from center to corner) */
export const HEX_SIZE = 1.0;

/**
 * Height per visual elevation tier (world units).
 * With 5 tiers (water..peak) this gives stepped columns from y=0 up to ~1.12.
 * NOTE: AgentLayer positions agents at `elevation * ELEVATION_STEP + 0.35`, so
 * changing this stays consistent for agents automatically.
 */
export const ELEVATION_STEP = 0.28;

/** Height of a hex tile's top face above its base (matches hexMesh height). */
export const HEX_TILE_HEIGHT = 0.35;

/**
 * Fixed world Y of the water surface. Water tiles (tier 0) render a translucent
 * animated plane at this level; land columns rise above it.
 */
export const WATER_LEVEL_Y = 0.18;

/** Square root of 3, used frequently in hex math */
const SQRT3 = Math.sqrt(3);

/**
 * Axial direction vectors for flat-top hex neighbors
 * Order: E, NE, NW, W, SW, SE (clockwise from east)
 */
export const AXIAL_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },   // East
  { q: 1, r: -1 },  // Northeast
  { q: 0, r: -1 },  // Northwest
  { q: -1, r: 0 },  // West
  { q: -1, r: 1 },  // Southwest
  { q: 0, r: 1 },   // Southeast
] as const;

/**
 * Convert axial hex coordinates to world position (flat-top orientation)
 *
 * Formula (flat-top):
 * x = HEX_SIZE * (3/2 * q)
 * z = HEX_SIZE * (sqrt(3)/2 * q + sqrt(3) * r)
 */
export function hexToPixel(q: number, r: number): WorldPosition {
  const x = HEX_SIZE * (1.5 * q);
  const z = HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r);
  return { x, z };
}

/**
 * Convert world position to fractional axial coordinates (flat-top orientation)
 *
 * Formula (inverse of hexToPixel):
 * q = (2/3 * x) / HEX_SIZE
 * r = ((-1/3 * x) + (sqrt(3)/3 * z)) / HEX_SIZE
 */
export function pixelToHex(x: number, z: number): HexCoord {
  const q = (2 / 3 * x) / HEX_SIZE;
  const r = ((-1 / 3 * x) + (SQRT3 / 3 * z)) / HEX_SIZE;
  return hexRound(q, r);
}

/**
 * Round fractional axial coordinates to nearest hex
 * Uses cube coordinate conversion for accurate rounding
 */
export function hexRound(q: number, r: number): HexCoord {
  // Convert to cube coordinates for rounding
  const s = -q - r;

  let roundedQ = Math.round(q);
  let roundedR = Math.round(r);
  const roundedS = Math.round(s);

  // Calculate rounding deltas
  const qDiff = Math.abs(roundedQ - q);
  const rDiff = Math.abs(roundedR - r);
  const sDiff = Math.abs(roundedS - s);

  // Reset the coordinate with the largest rounding error
  if (qDiff > rDiff && qDiff > sDiff) {
    roundedQ = -roundedR - roundedS;
  } else if (rDiff > sDiff) {
    roundedR = -roundedQ - roundedS;
  }
  // else: keep roundedQ and roundedR, s is recalculated

  return { q: roundedQ, r: roundedR };
}

/**
 * Calculate Manhattan distance between two hex coordinates
 * Uses cube coordinate distance formula
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  // In cube coordinates: |x1-x2| + |y1-y2| + |z1-z2| / 2
  // Where s = -q - r (the implicit third coordinate)
  const dq = Math.abs(a.q - b.q);
  const dr = Math.abs(a.r - b.r);
  const ds = Math.abs((a.q + a.r) - (b.q + b.r));
  return (dq + dr + ds) / 2;
}

/**
 * Get the 6 neighboring hex coordinates
 * Order: E, NE, NW, W, SW, SE (clockwise from east)
 */
export function hexNeighbors(q: number, r: number): HexCoord[] {
  return AXIAL_DIRECTIONS.map((dir) => ({
    q: q + dir.q,
    r: r + dir.r,
  }));
}

/**
 * Get a specific neighbor by direction index (0-5)
 * 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
 */
export function hexNeighbor(q: number, r: number, direction: number): HexCoord {
  const dir = AXIAL_DIRECTIONS[direction % 6];
  return { q: q + dir.q, r: r + dir.r };
}

/**
 * Generate hex coordinates in a spiral pattern from center
 * Useful for generating grid in expanding rings
 */
export function hexSpiral(centerQ: number, centerR: number, radius: number): HexCoord[] {
  const results: HexCoord[] = [{ q: centerQ, r: centerR }];

  if (radius === 0) return results;

  let hex = { q: centerQ, r: centerR };

  // Move to the starting position (direction 4 = SW)
  for (let i = 0; i < radius; i++) {
    hex = hexNeighbor(hex.q, hex.r, 4);
  }

  // Walk around in rings
  for (let ring = 1; ring <= radius; ring++) {
    // Start position for this ring
    hex = { q: centerQ - ring, r: centerR + ring };

    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < ring; step++) {
        results.push({ q: hex.q, r: hex.r });
        hex = hexNeighbor(hex.q, hex.r, side);
      }
    }
  }

  return results;
}

/**
 * Create a hex coordinate key for use in Maps/Sets
 */
export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

/**
 * Parse a hex key back to coordinates
 */
export function parseHexKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}
