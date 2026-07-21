/**
 * Biome definitions and color palettes for terrain generation
 *
 * ART DIRECTION: "Golden-Hour Dusk" (LOCKED 2026-07-21)
 * See .planning/design/ART-DIRECTION.md
 *
 * Every biome color comes from its 3-value ramp (shadow / mid / light):
 * cool-shadow, warm-lit. No saturated-AND-dark colors, no neon.
 * Colors are converted from hex to 0-1 linear-ish sRGB values for Three.js.
 */

export type Biome = 'grassland' | 'marsh' | 'plains' | 'forest' | 'rocky' | 'alpine';

export interface BiomeColor {
  r: number;
  g: number;
  b: number;
}

/** One biome ramp: shadow (cool), mid, light (warm-lit) */
export interface BiomeRamp {
  shadow: BiomeColor;
  mid: BiomeColor;
  light: BiomeColor;
}

/** Parse a #RRGGBB hex string to a 0-1 RGB triple (sRGB component values). */
function hex(h: string): BiomeColor {
  const n = parseInt(h.replace('#', ''), 16);
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}

/**
 * Dusk biome ramps (shadow / mid / light) straight from ART-DIRECTION.md.
 * These are the ONLY source of biome color. Per-instance value is picked
 * by elevation tier (higher tier = lighter / more sun-caught) plus a small
 * hashed brightness jitter.
 */
export const BIOME_RAMPS: Record<Biome, BiomeRamp> = {
  grassland: { shadow: hex('#3C5A2E'), mid: hex('#6B8C3E'), light: hex('#9DB85A') },
  marsh: { shadow: hex('#2C5E62'), mid: hex('#47898A'), light: hex('#74B0AC') },
  plains: { shadow: hex('#8A6A2E'), mid: hex('#C89A44'), light: hex('#F0CC72') }, // golden hero
  forest: { shadow: hex('#26402C'), mid: hex('#3E6440'), light: hex('#5E8858') },
  rocky: { shadow: hex('#7A3E2A'), mid: hex('#B4613A'), light: hex('#E0966A') }, // terracotta hero
  alpine: { shadow: hex('#8E9AB0'), mid: hex('#C4CBD6'), light: hex('#F2E4D4') }, // pink-gold snow
};

/**
 * Backwards-compatible single-color map (uses the mid value of each ramp).
 * Retained so any legacy consumer that still calls getBiomeColor keeps working.
 */
export const BIOME_COLORS: Record<Biome, BiomeColor> = {
  grassland: BIOME_RAMPS.grassland.mid,
  marsh: BIOME_RAMPS.marsh.mid,
  plains: BIOME_RAMPS.plains.mid,
  forest: BIOME_RAMPS.forest.mid,
  rocky: BIOME_RAMPS.rocky.mid,
  alpine: BIOME_RAMPS.alpine.mid,
};

/**
 * Get the full dusk ramp for a biome.
 */
export function getBiomeRamp(biome: Biome): BiomeRamp {
  return BIOME_RAMPS[biome];
}

/**
 * Get the (mid) color for a biome. Legacy helper.
 */
export function getBiomeColor(biome: Biome): BiomeColor {
  return BIOME_COLORS[biome];
}

/**
 * Pick a biome ramp color by a normalized 0-1 elevation factor.
 * 0 = shadow (low/valley), 0.5 = mid, 1 = light (peak/sun-caught).
 * Linearly interpolates between the ramp's three stops.
 */
export function sampleBiomeRamp(biome: Biome, t: number): BiomeColor {
  const ramp = BIOME_RAMPS[biome];
  const c = Math.max(0, Math.min(1, t));
  if (c <= 0.5) {
    const k = c / 0.5;
    return {
      r: ramp.shadow.r + (ramp.mid.r - ramp.shadow.r) * k,
      g: ramp.shadow.g + (ramp.mid.g - ramp.shadow.g) * k,
      b: ramp.shadow.b + (ramp.mid.b - ramp.shadow.b) * k,
    };
  }
  const k = (c - 0.5) / 0.5;
  return {
    r: ramp.mid.r + (ramp.light.r - ramp.mid.r) * k,
    g: ramp.mid.g + (ramp.light.g - ramp.mid.g) * k,
    b: ramp.mid.b + (ramp.light.b - ramp.mid.b) * k,
  };
}

/**
 * Determine biome based on a 3-tier biome-elevation band and moisture level.
 *
 * NOTE: This is the ORIGINAL biome-assignment contract and its outputs for a
 * given (biomeTier, moisture) MUST NOT change — the tooltip + server-parity
 * resource map depend on it. Visual terraforming elevation is a separate,
 * additional concept (see terrainGenerator.ts).
 *
 * @param elevation - Biome elevation band (0 low, 1 mid, 2 high)
 * @param moisture - Moisture level (0-1)
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
