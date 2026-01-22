/**
 * ChunkManager - Spatial partitioning for scalable hex world rendering
 *
 * Partitions hex data into chunks for efficient:
 * - Frustum culling (only render visible chunks)
 * - LOD selection (detail based on camera distance)
 * - Memory management (dispose chunks out of view)
 *
 * Chunk coordinates are derived from axial hex coordinates:
 * chunkX = floor(q / CHUNK_SIZE)
 * chunkZ = floor(r / CHUNK_SIZE)
 */

import * as THREE from 'three';
import type { HexData } from '../terrain/terrainGenerator';
import type { Biome } from '../terrain/biomes';
import { hexToPixel } from '../hex/hexMath';
import { LOD_HIGH, LOD_MED, LOD_LOW, type LODLevel } from './LODHexGeometry';

/** Number of hexes per chunk dimension (20x20 = 400 hexes max per chunk) */
export const CHUNK_SIZE = 20;

/** Distance thresholds for LOD levels (in world units) */
export const LOD_DISTANCES = {
  high: 50,   // Within 50 units: LOD 0 (high detail)
  med: 100,   // 50-100 units: LOD 1 (medium detail)
  low: 200,   // 100-200 units: LOD 2 (low detail)
  // Beyond 200 units: still LOD 2, until maxDistance
};

/**
 * Hex data with world position for chunk assignment
 */
export interface ChunkHex extends HexData {
  worldX: number;
  worldZ: number;
}

/**
 * Represents a spatial chunk of hexes
 */
export interface Chunk {
  /** Chunk X coordinate (derived from q / CHUNK_SIZE) */
  chunkX: number;
  /** Chunk Z coordinate (derived from r / CHUNK_SIZE) */
  chunkZ: number;
  /** Unique key for this chunk */
  key: string;
  /** Hexes in this chunk, grouped by biome */
  hexesByBiome: Map<Biome, ChunkHex[]>;
  /** All hexes in this chunk */
  hexes: ChunkHex[];
  /** Current LOD level */
  lodLevel: LODLevel;
  /** Center position in world coordinates */
  centerX: number;
  centerZ: number;
  /** Whether this chunk is currently visible */
  visible: boolean;
  /** Bounding sphere for frustum culling */
  boundingSphere: THREE.Sphere;
}

/**
 * Creates a unique key for a chunk based on coordinates
 */
function chunkKey(chunkX: number, chunkZ: number): string {
  return `${chunkX},${chunkZ}`;
}

/**
 * Get chunk coordinates from axial hex coordinates
 */
function getChunkCoords(q: number, r: number): { chunkX: number; chunkZ: number } {
  return {
    chunkX: Math.floor(q / CHUNK_SIZE),
    chunkZ: Math.floor(r / CHUNK_SIZE),
  };
}

/**
 * ChunkManager - manages spatial partitioning and LOD for hex world
 */
export class ChunkManager {
  private chunks: Map<string, Chunk> = new Map();
  private frustum = new THREE.Frustum();
  private projScreenMatrix = new THREE.Matrix4();

  /**
   * Generate chunks from hex data
   * Partitions all hexes into spatial chunks based on axial coordinates
   *
   * @param hexData - Array of hex data from terrain generator
   * @param _gridRadius - Grid radius (for bounds calculation)
   */
  generateChunks(hexData: HexData[], _gridRadius: number): void {
    this.chunks.clear();

    // Group hexes into chunks
    for (const hex of hexData) {
      const { chunkX, chunkZ } = getChunkCoords(hex.q, hex.r);
      const key = chunkKey(chunkX, chunkZ);

      // Get or create chunk
      let chunk = this.chunks.get(key);
      if (!chunk) {
        chunk = {
          chunkX,
          chunkZ,
          key,
          hexesByBiome: new Map(),
          hexes: [],
          lodLevel: LOD_HIGH,
          centerX: 0,
          centerZ: 0,
          visible: false,
          boundingSphere: new THREE.Sphere(),
        };
        this.chunks.set(key, chunk);
      }

      // Add hex to chunk with world position
      const { x: worldX, z: worldZ } = hexToPixel(hex.q, hex.r);
      const chunkHex: ChunkHex = { ...hex, worldX, worldZ };
      chunk.hexes.push(chunkHex);

      // Group by biome
      if (!chunk.hexesByBiome.has(hex.biome)) {
        chunk.hexesByBiome.set(hex.biome, []);
      }
      chunk.hexesByBiome.get(hex.biome)!.push(chunkHex);
    }

    // Calculate chunk centers and bounding spheres
    for (const chunk of Array.from(this.chunks.values())) {
      this.calculateChunkBounds(chunk);
    }
  }

  /**
   * Calculate center position and bounding sphere for a chunk
   */
  private calculateChunkBounds(chunk: Chunk): void {
    if (chunk.hexes.length === 0) return;

    // Calculate center
    let sumX = 0;
    let sumZ = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const hex of chunk.hexes) {
      sumX += hex.worldX;
      sumZ += hex.worldZ;
      minX = Math.min(minX, hex.worldX);
      maxX = Math.max(maxX, hex.worldX);
      minZ = Math.min(minZ, hex.worldZ);
      maxZ = Math.max(maxZ, hex.worldZ);
    }

    chunk.centerX = sumX / chunk.hexes.length;
    chunk.centerZ = sumZ / chunk.hexes.length;

    // Bounding sphere: radius from center to farthest corner
    const radiusX = (maxX - minX) / 2 + 1; // +1 for hex size
    const radiusZ = (maxZ - minZ) / 2 + 1;
    const radius = Math.sqrt(radiusX * radiusX + radiusZ * radiusZ);

    chunk.boundingSphere.center.set(chunk.centerX, 0, chunk.centerZ);
    chunk.boundingSphere.radius = radius;
  }

  /**
   * Get visible chunks based on camera frustum
   *
   * @param camera - The camera to use for frustum calculation
   * @param maxDistance - Maximum distance to render chunks
   * @returns Array of visible chunks
   */
  getVisibleChunks(camera: THREE.Camera, maxDistance: number): Chunk[] {
    // Update frustum from camera
    this.projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    const cameraPos = camera.position;
    const visible: Chunk[] = [];

    for (const chunk of Array.from(this.chunks.values())) {
      // Distance check first (cheaper than frustum test)
      const dx = chunk.centerX - cameraPos.x;
      const dz = chunk.centerZ - cameraPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > maxDistance + chunk.boundingSphere.radius) {
        chunk.visible = false;
        continue;
      }

      // Frustum check - expand sphere slightly for smooth transitions
      const expandedSphere = chunk.boundingSphere.clone();
      expandedSphere.radius *= 1.2; // 20% margin

      if (this.frustum.intersectsSphere(expandedSphere)) {
        chunk.visible = true;
        visible.push(chunk);
      } else {
        chunk.visible = false;
      }
    }

    return visible;
  }

  /**
   * Update LOD levels for all chunks based on camera position
   *
   * @param cameraPosition - Current camera position
   * @param lodDistances - Optional custom LOD distance thresholds
   */
  updateLODLevels(
    cameraPosition: THREE.Vector3,
    lodDistances: typeof LOD_DISTANCES = LOD_DISTANCES
  ): void {
    for (const chunk of Array.from(this.chunks.values())) {
      const dx = chunk.centerX - cameraPosition.x;
      const dz = chunk.centerZ - cameraPosition.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      let newLOD: LODLevel;
      if (distance < lodDistances.high) {
        newLOD = LOD_HIGH;
      } else if (distance < lodDistances.med) {
        newLOD = LOD_MED;
      } else {
        newLOD = LOD_LOW;
      }

      chunk.lodLevel = newLOD;
    }
  }

  /**
   * Get all chunks (for debugging/metrics)
   */
  getAllChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Get chunk count
   */
  getChunkCount(): number {
    return this.chunks.size;
  }

  /**
   * Get a specific chunk by key
   */
  getChunk(key: string): Chunk | undefined {
    return this.chunks.get(key);
  }

  /**
   * Clear all chunks
   */
  clear(): void {
    this.chunks.clear();
  }
}
