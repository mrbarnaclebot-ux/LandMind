/**
 * Biome definitions and color palettes for terrain generation
 *
 * Color palette inspired by Zelda: Link's Awakening - saturated, stylized colors
 * Colors are in 0-1 range for Babylon.js compatibility
 */

export type Biome = 'grassland' | 'marsh' | 'plains' | 'forest' | 'rocky' | 'alpine';

export interface BiomeColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Saturated, stylized color palette for each biome
 * Values are in 0-1 range for Babylon.js
 *
 * Colors are intentionally vibrant/saturated for a Zelda-like stylized look
 * These work well with the cell-shaded material lighting bands
 */
export const BIOME_COLORS: Record<Biome, BiomeColor> = {
  grassland: { r: 0.35, g: 0.85, b: 0.25 }, // Vibrant lime green
  marsh: { r: 0.2, g: 0.65, b: 0.55 },      // Teal blue-green
  plains: { r: 0.85, g: 0.78, b: 0.35 },    // Golden yellow
  forest: { r: 0.15, g: 0.6, b: 0.2 },      // Rich forest green
  rocky: { r: 0.6, g: 0.5, b: 0.35 },       // Warm sandstone
  alpine: { r: 0.7, g: 0.75, b: 0.85 },     // Snow-capped blue-white
};

/**
 * Get the color for a biome
 */
export function getBiomeColor(biome: Biome): BiomeColor {
  return BIOME_COLORS[biome];
}

/**
 * Determine biome based on elevation tier and moisture level
 *
 * Elevation tiers: 0 (low), 1 (mid), 2 (high)
 * Moisture: 0-1 normalized value
 *
 * @param elevation - Elevation tier (0, 1, or 2)
 * @param moisture - Moisture level (0-1)
 * @returns The appropriate biome for the given conditions
 */
export function getBiome(elevation: number, moisture: number): Biome {
  if (elevation === 0) {
    return moisture >= 0.6 ? 'marsh' : 'grassland';
  } else if (elevation === 1) {
    return moisture >= 0.5 ? 'forest' : 'plains';
  } else {
    // elevation === 2
    return moisture >= 0.4 ? 'alpine' : 'rocky';
  }
}
