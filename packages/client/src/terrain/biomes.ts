/**
 * Biome definitions and color palettes for terrain generation
 *
 * Color palette inspired by Zelda: Link's Awakening - saturated, stylized colors
 * Colors are in 0-1 range for Three.js compatibility
 */

export type Biome = 'grassland' | 'marsh' | 'plains' | 'forest' | 'rocky' | 'alpine';

export interface BiomeColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Bright, saturated color palette for each biome
 * Values are in 0-1 range for Three.js
 *
 * Colors are intentionally BRIGHT and vibrant for a Zelda-like stylized look.
 * Increased saturation and value for better visibility and cheerful aesthetic.
 */
export const BIOME_COLORS: Record<Biome, BiomeColor> = {
  grassland: { r: 0.45, g: 0.95, b: 0.35 }, // Bright lime green
  marsh: { r: 0.3, g: 0.8, b: 0.7 },        // Bright teal
  plains: { r: 0.95, g: 0.88, b: 0.45 },    // Bright golden yellow
  forest: { r: 0.25, g: 0.75, b: 0.35 },    // Bright forest green
  rocky: { r: 0.75, g: 0.65, b: 0.5 },      // Bright warm sandstone
  alpine: { r: 0.85, g: 0.9, b: 0.98 },     // Bright snow white
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
