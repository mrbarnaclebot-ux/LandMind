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
 * VIBRANT Minecraft-style color palette for each biome
 * Values are in 0-1 range for Three.js
 *
 * Colors are BOLD and SATURATED like Minecraft:
 * - Grass is bright lime green (#7CFC00)
 * - Water is bright blue (#0099FF)
 * - Sand is bright yellow (#FFEB3B)
 * - No muddy colors - everything POPS
 */
export const BIOME_COLORS: Record<Biome, BiomeColor> = {
  // Minecraft grass: #7CFC00 = rgb(124, 252, 0) = (0.486, 0.988, 0.0)
  grassland: { r: 0.486, g: 0.988, b: 0.0 },

  // Bright cyan/teal water: #00CED1 = rgb(0, 206, 209)
  marsh: { r: 0.0, g: 0.808, b: 0.82 },

  // Minecraft sand/wheat: #F4D03F = rgb(244, 208, 63)
  plains: { r: 0.957, g: 0.816, b: 0.247 },

  // Rich forest green: #228B22 = rgb(34, 139, 34)
  forest: { r: 0.133, g: 0.545, b: 0.133 },

  // Warm terracotta/stone: #CD853F = rgb(205, 133, 63)
  rocky: { r: 0.804, g: 0.522, b: 0.247 },

  // Pure snow white: #FFFFFF with slight blue tint
  alpine: { r: 0.95, g: 0.97, b: 1.0 },
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
