/**
 * HexWorld component - Renders hex grid using thin instances
 *
 * Uses Babylon.js thin instances for efficient GPU rendering of thousands
 * of hexes. Each hex is positioned based on axial coordinates and colored
 * by its biome type.
 *
 * Thin instances share mesh geometry, sending transformation matrices
 * to the GPU for per-instance rendering. This is significantly
 * more efficient than creating individual meshes.
 *
 * Performance optimizations:
 * - One mesh per biome (6 draw calls total)
 * - Frozen world matrices (no per-frame recalculation)
 * - Frozen materials (no state change checks)
 * - Static instance buffers (uploaded once)
 */

import { useEffect, useRef, useMemo, memo } from 'react';
import { useScene } from 'react-babylonjs';
import { Mesh, Matrix, Color3, StandardMaterial } from '@babylonjs/core';
import { createBeveledHexMesh } from '../hex/hexMesh';
import { hexToPixel, ELEVATION_STEP } from '../hex/hexMath';
import { generateHexData, type TerrainSeed } from '../terrain/terrainGenerator';
import { getBiomeColor, type Biome } from '../terrain/biomes';
import { createHexMaterial } from '../shaders/hexMaterial';

export interface HexWorldProps {
  /** Grid radius in hex units (default: 15, ~721 hexes) */
  gridRadius?: number;
  /** Optional seeds for deterministic terrain generation */
  seed?: TerrainSeed;
}

/**
 * HexWorld component - renders the hex grid with thin instances
 *
 * Creates one mesh per biome, each with thin instances for all hexes
 * of that biome type. This results in 6 draw calls total regardless
 * of how many hexes are rendered.
 *
 * Wrapped with React.memo to prevent unnecessary re-renders when
 * parent components re-render (e.g., during camera movement).
 */
function HexWorldInner({ gridRadius = 15, seed }: HexWorldProps) {
  const scene = useScene();
  const meshRef = useRef<Mesh | null>(null);

  // Generate hex data - only regenerate on seed/radius change
  const hexes = useMemo(() => {
    return generateHexData(gridRadius, seed);
  }, [gridRadius, seed]);

  // Set up thin instances when scene is ready or hexes change
  useEffect(() => {
    if (!scene) return;

    // Clean up previous meshes
    if (meshRef.current) {
      meshRef.current.dispose();
      meshRef.current = null;
    }

    // Group hexes by biome for color-based batching
    const hexesByBiome = new Map<string, typeof hexes>();
    hexes.forEach((hex) => {
      if (!hexesByBiome.has(hex.biome)) {
        hexesByBiome.set(hex.biome, []);
      }
      hexesByBiome.get(hex.biome)!.push(hex);
    });

    // Create a separate instanced mesh for each biome
    const instanceMeshes: Mesh[] = [];
    const materials: StandardMaterial[] = [];

    hexesByBiome.forEach((biomeHexes, biome) => {
      // Create flat-top hex mesh for each biome
      // Size 0.95 creates visible gaps between hexes for edge definition
      // Height 0.8 creates chunky solid 3D blocks (like Minecraft or Zelda terrain)
      const biomeMesh = createBeveledHexMesh(scene, {
        size: 0.95,
        height: 0.8,
      });
      biomeMesh.name = `hexInstances_${biome}`;
      biomeMesh.isVisible = true;
      biomeMesh.isPickable = false;

      // Create cell-shaded material with biome color
      const biomeColor = getBiomeColor(biome as Biome);
      const biomeMaterial = createHexMaterial(
        scene,
        `hexMat_${biome}`,
        new Color3(biomeColor.r, biomeColor.g, biomeColor.b)
      );
      biomeMesh.material = biomeMaterial;
      materials.push(biomeMaterial);

      // Allocate matrix buffer for this biome's hexes
      const matrixBuffer = new Float32Array(16 * biomeHexes.length);

      // Fill buffer with transformation matrices
      biomeHexes.forEach((hex, i) => {
        const { x, z } = hexToPixel(hex.q, hex.r);
        const y = hex.elevation * ELEVATION_STEP;
        Matrix.Translation(x, y, z).copyToArray(matrixBuffer, i * 16);
      });

      // Apply thin instance buffer (static = true, won't change)
      biomeMesh.thinInstanceSetBuffer('matrix', matrixBuffer, 16, true);

      // Freeze the mesh's world matrix since it won't move
      biomeMesh.freezeWorldMatrix();

      // Compute bounding info once for culling
      biomeMesh.thinInstanceRefreshBoundingInfo(true);

      instanceMeshes.push(biomeMesh);
    });

    // Store first mesh for ref tracking
    meshRef.current = instanceMeshes[0] || null;

    return () => {
      instanceMeshes.forEach((m) => m.dispose());
      materials.forEach((m) => m.dispose());
    };
  }, [scene, hexes]);

  // Component renders nothing - meshes are created imperatively
  return null;
}

/**
 * Memoized HexWorld component to prevent re-renders during camera movement.
 * The hex grid is static, so we only need to render it once when scene/props change.
 */
export const HexWorld = memo(HexWorldInner);
