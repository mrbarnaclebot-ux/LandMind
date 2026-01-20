/**
 * Hex Math Utilities for Server
 * Based on Red Blob Games: https://www.redblobgames.com/grids/hexagons/
 * Flat-top axial coordinate system (q, r)
 */

export interface HexCoord {
  q: number;
  r: number;
}

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
 * Calculate Manhattan distance between two hex coordinates
 * Uses cube coordinate distance formula
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = Math.abs(a.q - b.q);
  const dr = Math.abs(a.r - b.r);
  const ds = Math.abs((a.q + a.r) - (b.q + b.r));
  return (dq + dr + ds) / 2;
}

/**
 * Get the 6 neighboring hex coordinates
 */
export function hexNeighbors(hex: HexCoord): HexCoord[] {
  return AXIAL_DIRECTIONS.map((dir) => ({
    q: hex.q + dir.q,
    r: hex.r + dir.r,
  }));
}

/**
 * Add two hex coordinates
 */
export function hexAdd(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q + b.q, r: a.r + b.r };
}

/**
 * Create a string key for hex coordinates (for Maps/Sets)
 */
export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

/**
 * Parse hex key back to coordinates
 */
export function parseHexKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}
