/**
 * HexWorld component - Renders hex grid using thin instances
 *
 * Uses Babylon.js thin instances for efficient GPU rendering of thousands
 * of hexes. Each hex is positioned based on axial coordinates and colored
 * by its biome type.
 *
 * Thin instances share a single mesh template, sending transformation matrices
 * and colors to the GPU for per-instance rendering. This is significantly
 * more efficient than creating individual meshes.
 */

import { useEffect, useRef, useMemo } from 'react';
import { useScene } from 'react-babylonjs';
import { Mesh, Matrix, StandardMaterial, Color3 } from '@babylonjs/core';
import { createBeveledHexMesh } from '../hex/hexMesh';
import { hexToPixel, ELEVATION_STEP } from '../hex/hexMath';
import { generateHexData, type TerrainSeed } from '../terrain/terrainGenerator';
import { getBiomeColor, type Biome } from '../terrain/biomes';

export interface HexWorldProps {
  /** Grid radius in hex units (default: 30, ~2700 hexes) */
  gridRadius?: number;
  /** Optional seeds for deterministic terrain generation */
  seed?: TerrainSeed;
}

/**
 * HexWorld component - renders the hex grid with thin instances
 *
 * Creates a template hex mesh, then uses thin instances to render
 * thousands of hexes efficiently. Each hex is positioned at its
 * world coordinates with elevation and colored by biome.
 */
export function HexWorld({ gridRadius = 30, seed }: HexWorldProps) {
  const scene = useScene();
  const meshRef = useRef<Mesh | null>(null);
  const templateRef = useRef<Mesh | null>(null);

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
    if (templateRef.current) {
      templateRef.current.dispose();
      templateRef.current = null;
    }

    // Create template mesh (not rendered directly)
    const templateMesh = createBeveledHexMesh(scene, {
      size: 1.0,
      height: 0.3,
      bevelSize: 0.08,
    });
    templateMesh.isVisible = false;
    templateRef.current = templateMesh;

    // Create instance mesh (the one that will render)
    const instanceMesh = templateMesh.clone('hexInstances');
    instanceMesh.isVisible = true;
    meshRef.current = instanceMesh;

    // Create material with vertex colors
    // Note: StandardMaterial with useVertexColors may not work directly with thin instances
    // Using a single base color as fallback - biome colors will be baked into per-instance colors
    const material = new StandardMaterial('hexWorldMaterial', scene);
    material.diffuseColor = new Color3(1, 1, 1); // White base, colors come from instances
    material.specularColor = new Color3(0.2, 0.2, 0.2);

    // For thin instances, we need to use a custom shader or bake colors differently
    // StandardMaterial.useVertexColors doesn't work with thin instances by default
    // Instead, we'll create multiple meshes grouped by biome for now
    // TODO: Implement custom shader for per-instance colors in future plan

    // Group hexes by biome for color-based batching
    const hexesByBiome = new Map<string, typeof hexes>();
    hexes.forEach((hex) => {
      const biomeHexes = hexesByBiome.get(hex.biome) || [];
      biomeHexes.push(hex);
      hexesByBiome.set(hex.biome, biomeHexes);
    });

    // Create a separate instanced mesh for each biome
    const instanceMeshes: Mesh[] = [];

    hexesByBiome.forEach((biomeHexes, biome) => {
      // Create mesh for this biome
      const biomeMesh = templateMesh.clone(`hexInstances_${biome}`);
      biomeMesh.isVisible = true;

      // Create material with biome color
      const biomeMaterial = new StandardMaterial(`hexMat_${biome}`, scene);
      const biomeColor = getBiomeColor(biome as Biome);
      biomeMaterial.diffuseColor = new Color3(biomeColor.r, biomeColor.g, biomeColor.b);
      biomeMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
      biomeMesh.material = biomeMaterial;

      // Allocate matrix buffer for this biome's hexes
      const matrixBuffer = new Float32Array(16 * biomeHexes.length);

      // Fill buffer with transformation matrices
      biomeHexes.forEach((hex, i) => {
        const { x, z } = hexToPixel(hex.q, hex.r);
        const y = hex.elevation * ELEVATION_STEP;
        Matrix.Translation(x, y, z).copyToArray(matrixBuffer, i * 16);
      });

      // Apply thin instance buffer
      biomeMesh.thinInstanceSetBuffer('matrix', matrixBuffer, 16, true);
      biomeMesh.thinInstanceRefreshBoundingInfo(true);

      instanceMeshes.push(biomeMesh);
    });

    // Dispose the original instance mesh (we're using biome-grouped meshes instead)
    instanceMesh.dispose();
    meshRef.current = null;

    // Store meshes for cleanup
    const allMeshes = instanceMeshes;

    return () => {
      allMeshes.forEach((m) => m.dispose());
      templateMesh.dispose();
    };
  }, [scene, hexes]);

  // Component renders nothing - meshes are created imperatively
  return null;
}
