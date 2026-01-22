/**
 * ChunkedHexWorld - Scalable hex world rendering with LOD and chunking
 *
 * Replaces HexWorld for large worlds (1M+ hexes). Features:
 * - Spatial chunking (20x20 hexes per chunk)
 * - 3 LOD levels based on camera distance
 * - Frustum culling (only render visible chunks)
 * - Memory-efficient (InstancedMesh per chunk per biome)
 *
 * Uses ChunkManager for spatial partitioning and LODHexGeometry for
 * distance-based geometry selection.
 */

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { generateHexData, type TerrainSeed } from '../terrain/terrainGenerator';
import { getBiomeColor, type Biome } from '../terrain/biomes';
import { ELEVATION_STEP } from '../hex/hexMath';
import { useHexStore } from '../stores/hexStore';
import { ChunkManager, type Chunk, type ChunkHex } from './ChunkManager';
import { createLODGeometries, type LODLevel } from './LODHexGeometry';
import { usePerformanceSettings } from './PerformanceAdapter';

/** Default grid radius for ~1M hexes */
const DEFAULT_GRID_RADIUS = parseInt(import.meta.env.VITE_HEX_GRID_RADIUS || '500', 10);

export interface ChunkedHexWorldProps {
  /** Grid radius in hex units (default: 500 for ~1M hexes) */
  gridRadius?: number;
  /** Optional seeds for deterministic terrain generation */
  seed?: TerrainSeed;
}

/**
 * BiomeChunk - renders all hexes of one biome type within a chunk
 * Uses InstancedMesh with LOD-appropriate geometry
 */
interface BiomeChunkProps {
  chunk: Chunk;
  biome: Biome;
  hexes: ChunkHex[];
  geometry: THREE.BufferGeometry;
  lodLevel: LODLevel;
}

function BiomeChunk({ biome, hexes, geometry, lodLevel }: BiomeChunkProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const biomeColor = getBiomeColor(biome);
  const color = useMemo(
    () => new THREE.Color(biomeColor.r, biomeColor.g, biomeColor.b),
    [biomeColor]
  );

  // Memoize instance matrices - recompute only when hexes change
  const matrices = useMemo(() => {
    const count = hexes.length;
    const result = new Float32Array(count * 16);
    const tempMatrix = new THREE.Matrix4();

    hexes.forEach((hex, i) => {
      const y = hex.elevation * ELEVATION_STEP;
      tempMatrix.makeTranslation(hex.worldX, y, hex.worldZ);
      tempMatrix.toArray(result, i * 16);
    });

    return result;
  }, [hexes]);

  // Apply matrices when ref is available or LOD changes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const tempMatrix = new THREE.Matrix4();
    for (let i = 0; i < hexes.length; i++) {
      tempMatrix.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, tempMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices, hexes.length, lodLevel]);

  if (hexes.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, hexes.length]}
      frustumCulled={false} // Chunk-level culling handles this
    >
      <meshLambertMaterial
        color={color}
        flatShading={true}
        emissive={color}
        emissiveIntensity={0.1}
      />
    </instancedMesh>
  );
}

/**
 * VisibleChunk - renders a single chunk with all its biomes
 */
interface VisibleChunkProps {
  chunk: Chunk;
  lodGeometries: [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry];
}

function VisibleChunk({ chunk, lodGeometries }: VisibleChunkProps) {
  const geometry = lodGeometries[chunk.lodLevel];

  return (
    <group key={chunk.key}>
      {Array.from(chunk.hexesByBiome.entries()).map(([biome, hexes]) => (
        <BiomeChunk
          key={`${chunk.key}-${biome}`}
          chunk={chunk}
          biome={biome}
          hexes={hexes}
          geometry={geometry}
          lodLevel={chunk.lodLevel}
        />
      ))}
    </group>
  );
}

/**
 * ChunkedHexWorld - main component for scalable hex world rendering
 *
 * Generates hex data, partitions into chunks, and renders only visible
 * chunks with appropriate LOD based on camera distance.
 */
export function ChunkedHexWorld({
  gridRadius = DEFAULT_GRID_RADIUS,
  seed,
}: ChunkedHexWorldProps) {
  const { setHexData } = useHexStore();
  const { camera } = useThree();
  const performanceSettings = usePerformanceSettings();

  // Create LOD geometries (memoized)
  const lodGeometries = useMemo(() => {
    return createLODGeometries(0.95, 0.35, 0.3);
  }, []);

  // Create chunk manager (memoized)
  const chunkManager = useMemo(() => new ChunkManager(), []);

  // Generate hex data - only regenerate on seed/radius change
  const hexes = useMemo(() => {
    console.log(`[ChunkedHexWorld] Generating hex data for radius ${gridRadius}`);
    const start = performance.now();
    const data = generateHexData(gridRadius, seed);
    console.log(`[ChunkedHexWorld] Generated ${data.length} hexes in ${(performance.now() - start).toFixed(0)}ms`);
    return data;
  }, [gridRadius, seed]);

  // Populate hex store with generated data
  useEffect(() => {
    if (hexes.length > 0) {
      setHexData(hexes);
    }
  }, [hexes, setHexData]);

  // Initialize chunks when hex data changes
  useEffect(() => {
    console.log('[ChunkedHexWorld] Generating chunks...');
    const start = performance.now();
    chunkManager.generateChunks(hexes, gridRadius);
    console.log(
      `[ChunkedHexWorld] Created ${chunkManager.getChunkCount()} chunks in ${(performance.now() - start).toFixed(0)}ms`
    );
  }, [hexes, gridRadius, chunkManager]);

  // Track visible chunks
  const visibleChunksRef = useRef<Chunk[]>([]);

  // Update visibility and LOD each frame
  const updateVisibility = useCallback(() => {
    // Get visible chunks based on frustum and max distance
    const visible = chunkManager.getVisibleChunks(
      camera,
      performanceSettings.maxRenderDistance
    );

    // Update LOD levels based on camera position
    chunkManager.updateLODLevels(camera.position, performanceSettings.lodDistances);

    visibleChunksRef.current = visible;
  }, [camera, chunkManager, performanceSettings]);

  // Run visibility update every few frames (not every frame for performance)
  const frameCountRef = useRef(0);
  useFrame(() => {
    frameCountRef.current++;
    // Update every 3 frames (~20 Hz at 60 FPS)
    if (frameCountRef.current % 3 === 0) {
      updateVisibility();
    }
  });

  // Initial visibility update
  useEffect(() => {
    updateVisibility();
  }, [updateVisibility]);

  // Force re-render when chunks change
  const [, forceUpdate] = useState<number>(0);
  useFrame(() => {
    // Re-render when visible chunks might have changed
    if (frameCountRef.current % 3 === 0) {
      forceUpdate((n: number) => n + 1);
    }
  });

  return (
    <group name="chunkedHexWorld">
      {visibleChunksRef.current.map((chunk) => (
        <VisibleChunk
          key={chunk.key}
          chunk={chunk}
          lodGeometries={lodGeometries}
        />
      ))}
    </group>
  );
}
