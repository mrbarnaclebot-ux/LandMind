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
import { Mesh, Matrix, Color3, ShaderMaterial } from '@babylonjs/core';
import { createBeveledHexMesh } from '../hex/hexMesh';
import { hexToPixel, ELEVATION_STEP } from '../hex/hexMath';
import { generateHexData, type TerrainSeed } from '../terrain/terrainGenerator';
import { getBiomeColor, type Biome } from '../terrain/biomes';
import { createHexMaterial } from '../shaders/hexMaterial';

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
    const materials: ShaderMaterial[] = [];

    hexesByBiome.forEach((biomeHexes, biome) => {
      // Create a NEW mesh for each biome using fresh geometry
      const biomeMesh = createBeveledHexMesh(scene, {
        size: 1.0,
        height: 0.3,
        bevelSize: 0.08,
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

      // Apply thin instance buffer
      biomeMesh.thinInstanceSetBuffer('matrix', matrixBuffer, 16, true);
      biomeMesh.thinInstanceRefreshBoundingInfo(true);

      instanceMeshes.push(biomeMesh);
    });

    // Store first mesh for ref tracking
    meshRef.current = instanceMeshes[0] || null;

    return () => {
      instanceMeshes.forEach((m) => m.dispose());
      materials.forEach((m) => m.dispose());
      templateMesh.dispose();
    };
  }, [scene, hexes]);

  // Component renders nothing - meshes are created imperatively
  return null;
}
