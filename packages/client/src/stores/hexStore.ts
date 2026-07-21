/**
 * Hex store for caching terrain data
 * Used by tooltips to display hex information
 */
import { create } from 'zustand';
import type { HexData } from '../terrain/terrainGenerator';
import type { Biome } from '../terrain/biomes';

// Resource types based on biome
export type ResourceType = 'GOLD' | 'SILVER' | 'COPPER' | 'IRON' | 'NONE';

// Map biomes to resource types
const BIOME_RESOURCES: Record<Biome, ResourceType> = {
  grassland: 'COPPER',
  marsh: 'SILVER',
  plains: 'GOLD',
  forest: 'IRON',
  rocky: 'IRON',
  alpine: 'SILVER',
};

// Resource abundance by biome (simulated amount)
const BIOME_ABUNDANCE: Record<Biome, number> = {
  grassland: 5000,
  marsh: 8000,
  plains: 10000,
  forest: 6000,
  rocky: 7000,
  alpine: 9000,
};

interface HexInfo {
  q: number;
  r: number;
  elevation: number;
  biome: Biome;
  resourceType: ResourceType;
  resourceAmount: number;
}

interface HexStore {
  /** Map of hex key to hex info */
  hexes: Map<string, HexInfo>;

  /** Initialize the store with hex data */
  setHexData: (data: HexData[]) => void;

  /** Get info for a specific hex */
  getHexInfo: (q: number, r: number) => HexInfo | null;

  /**
   * Authoritative existence check for a hex. True only for hexes that are part
   * of the generated radius-N world (i.e. present in the `hexes` map). Used to
   * reject hover/pick events that land beyond the world edge.
   */
  hasHex: (q: number, r: number) => boolean;

  /** Check if store is initialized */
  isInitialized: boolean;
}

/** Create a unique key for a hex position */
function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export const useHexStore = create<HexStore>((set, get) => ({
  hexes: new Map(),
  isInitialized: false,

  setHexData: (data: HexData[]) => {
    // Don't re-initialize if already done
    if (get().isInitialized) return;

    const hexes = new Map<string, HexInfo>();

    data.forEach((hex) => {
      const resourceType = BIOME_RESOURCES[hex.biome];
      const baseAmount = BIOME_ABUNDANCE[hex.biome];
      // Add some variation to resource amount (using hex coords as seed for consistency)
      const seed = (hex.q * 31 + hex.r * 17) % 2000;
      const resourceAmount = Math.max(0, baseAmount + seed - 1000);

      hexes.set(hexKey(hex.q, hex.r), {
        q: hex.q,
        r: hex.r,
        elevation: hex.elevation,
        biome: hex.biome,
        resourceType,
        resourceAmount,
      });
    });

    set({ hexes, isInitialized: true });
    console.log(`HexStore initialized with ${hexes.size} hexes`);
  },

  getHexInfo: (q: number, r: number) => {
    return get().hexes.get(hexKey(q, r)) || null;
  },

  hasHex: (q: number, r: number) => {
    return get().hexes.has(hexKey(q, r));
  },
}));
