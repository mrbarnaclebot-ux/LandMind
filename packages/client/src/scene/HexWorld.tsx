/**
 * HexWorld component - Renders hex grid using Three.js InstancedMesh
 *
 * Uses Three.js InstancedMesh for efficient GPU rendering of thousands
 * of hexes. Each hex is positioned based on axial coordinates and colored
 * by its biome type.
 *
 * Performance optimizations:
 * - One InstancedMesh per biome (6 draw calls total)
 * - Shared geometry across all instances
 * - Static matrices (uploaded once to GPU)
 * - Frustum culling enabled
 */

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { createHexGeometry } from '../hex/hexMesh';
import { hexToPixel, ELEVATION_STEP } from '../hex/hexMath';
import { generateHexData, type TerrainSeed } from '../terrain/terrainGenerator';
import { getBiomeColor, type Biome } from '../terrain/biomes';

export interface HexWorldProps {
  /** Grid radius in hex units (default: 20, ~1261 hexes) */
  gridRadius?: number;
  /** Optional seeds for deterministic terrain generation */
  seed?: TerrainSeed;
}

/**
 * Biome mesh component - renders all hexes of one biome type
 */
interface BiomeMeshProps {
  biome: Biome;
  hexes: Array<{ q: number; r: number; elevation: number }>;
  geometry: THREE.BufferGeometry;
}

function BiomeMesh({ biome, hexes, geometry }: BiomeMeshProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const biomeColor = getBiomeColor(biome);
  const color = useMemo(
    () => new THREE.Color(biomeColor.r, biomeColor.g, biomeColor.b),
    [biomeColor]
  );

  // Create instance matrices for all hexes of this biome
  const matrices = useMemo(() => {
    const count = hexes.length;
    const result = new Float32Array(count * 16);
    const tempMatrix = new THREE.Matrix4();

    hexes.forEach((hex, i) => {
      const { x, z } = hexToPixel(hex.q, hex.r);
      const y = hex.elevation * ELEVATION_STEP;
      tempMatrix.makeTranslation(x, y, z);
      tempMatrix.toArray(result, i * 16);
    });

    return result;
  }, [hexes]);

  // Apply matrices when ref is available or matrices change
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const tempMatrix = new THREE.Matrix4();
    for (let i = 0; i < hexes.length; i++) {
      tempMatrix.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, tempMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices, hexes.length]);

  if (hexes.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, hexes.length]}
      frustumCulled={true}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.8}
        metalness={0.0}
        flatShading={false}
      />
    </instancedMesh>
  );
}

/**
 * HexWorld component - renders the hex grid with instanced meshes
 *
 * Creates one InstancedMesh per biome, each containing all hexes
 * of that biome type. This results in 6 draw calls total regardless
 * of how many hexes are rendered.
 */
export function HexWorld({ gridRadius = 20, seed }: HexWorldProps) {
  // Generate hex data - only regenerate on seed/radius change
  const hexes = useMemo(() => {
    return generateHexData(gridRadius, seed);
  }, [gridRadius, seed]);

  // Create shared geometry for all hexes
  const geometry = useMemo(() => {
    return createHexGeometry({
      size: 0.95,
      height: 0.8,
      skirtDepth: 0.8,
    });
  }, []);

  // Group hexes by biome for color-based batching
  const hexesByBiome = useMemo(() => {
    const grouped = new Map<
      Biome,
      Array<{ q: number; r: number; elevation: number }>
    >();

    hexes.forEach((hex) => {
      if (!grouped.has(hex.biome)) {
        grouped.set(hex.biome, []);
      }
      grouped.get(hex.biome)!.push({
        q: hex.q,
        r: hex.r,
        elevation: hex.elevation,
      });
    });

    return grouped;
  }, [hexes]);

  return (
    <group name="hexWorld">
      {Array.from(hexesByBiome.entries()).map(([biome, biomeHexes]) => (
        <BiomeMesh
          key={biome}
          biome={biome}
          hexes={biomeHexes}
          geometry={geometry}
        />
      ))}
    </group>
  );
}
