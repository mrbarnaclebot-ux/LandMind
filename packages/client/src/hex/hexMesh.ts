/**
 * Beveled Hex Mesh Generator
 *
 * Creates a procedural beveled hexagon mesh for use as a thin instance template.
 * Flat-top orientation: corners at angles 0, 60, 120, 180, 240, 300 degrees.
 *
 * Mesh structure:
 * - Top face: center to inner ring (6 triangles)
 * - Bevel face: inner ring to outer ring (12 triangles / 6 quads)
 * - Side faces: outer top ring to bottom ring (12 triangles / 6 quads)
 *
 * Uses counter-clockwise winding for proper face normals.
 */

import { Mesh, VertexData, Scene } from '@babylonjs/core';

export interface BeveledHexOptions {
  /** Hex outer radius (default: 1.0) */
  size?: number;
  /** Total height of the hex (default: 0.3) */
  height?: number;
  /** Size of the bevel edge (default: 0.08) */
  bevelSize?: number;
}

const DEFAULT_OPTIONS: Required<BeveledHexOptions> = {
  size: 1.0,
  height: 0.3,
  bevelSize: 0.08,
};

/**
 * Create a beveled hexagon mesh for use as thin instance template
 *
 * Vertex layout:
 * - Index 0: Top center (0, height, 0)
 * - Indices 1-6: Top inner ring (at full height)
 * - Indices 7-12: Top outer ring (lowered for bevel)
 * - Indices 13-18: Bottom outer ring (at y=0)
 *
 * @param scene - Babylon.js scene
 * @param options - Mesh generation options
 * @returns Mesh ready for thin instancing
 */
export function createBeveledHexMesh(
  scene: Scene,
  options: BeveledHexOptions = {}
): Mesh {
  const { size, height, bevelSize } = { ...DEFAULT_OPTIONS, ...options };

  const mesh = new Mesh('hexTemplate', scene);

  // Calculate corner positions for flat-top hex
  // Corners at angles 0, 60, 120, 180, 240, 300 degrees
  const outerCorners: [number, number][] = [];
  const innerCorners: [number, number][] = [];
  const innerScale = (size - bevelSize) / size;

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    outerCorners.push([size * cos, size * sin]);
    innerCorners.push([size * innerScale * cos, size * innerScale * sin]);
  }

  // Build vertex positions
  const positions: number[] = [];

  // Vertex 0: Top center
  positions.push(0, height, 0);

  // Vertices 1-6: Top inner ring (at full height)
  for (let i = 0; i < 6; i++) {
    positions.push(innerCorners[i][0], height, innerCorners[i][1]);
  }

  // Vertices 7-12: Top outer ring (lowered for bevel)
  const bevelHeight = height - bevelSize * 0.5;
  for (let i = 0; i < 6; i++) {
    positions.push(outerCorners[i][0], bevelHeight, outerCorners[i][1]);
  }

  // Vertices 13-18: Bottom outer ring (at y=0)
  for (let i = 0; i < 6; i++) {
    positions.push(outerCorners[i][0], 0, outerCorners[i][1]);
  }

  // Vertex 19: Bottom center (for bottom face)
  positions.push(0, 0, 0);

  // Build indices (triangles, counter-clockwise winding)
  const indices: number[] = [];

  // Top face: 6 triangles from center (0) to inner ring (1-6)
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    // CCW winding when viewed from above: center -> next -> current
    indices.push(0, 1 + next, 1 + i);
  }

  // Bevel face: 6 quads (12 triangles) from inner ring to outer ring
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    // Inner ring vertices: 1-6
    // Outer ring vertices: 7-12
    // Quad: inner[i], inner[next], outer[next], outer[i]
    // Triangle 1 (CCW): inner[i] -> outer[i] -> outer[next]
    indices.push(1 + i, 7 + i, 7 + next);
    // Triangle 2 (CCW): inner[i] -> outer[next] -> inner[next]
    indices.push(1 + i, 7 + next, 1 + next);
  }

  // Side faces: 6 quads (12 triangles) from outer top ring to bottom ring
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    // Top outer ring vertices: 7-12
    // Bottom outer ring vertices: 13-18
    // Quad: top[i], top[next], bottom[next], bottom[i]
    // Triangle 1 (CCW): top[i] -> bottom[i] -> bottom[next]
    indices.push(7 + i, 13 + i, 13 + next);
    // Triangle 2 (CCW): top[i] -> bottom[next] -> top[next]
    indices.push(7 + i, 13 + next, 7 + next);
  }

  // Bottom face: 6 triangles from center (19) to bottom ring (13-18)
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    // CCW winding when viewed from below (opposite of top)
    indices.push(19, 13 + i, 13 + next);
  }

  // Create vertex data and compute normals
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;

  // Compute normals for proper lighting
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  vertexData.normals = normals;

  // Apply to mesh
  vertexData.applyToMesh(mesh);

  // Mesh is created but not positioned - caller handles thin instances
  mesh.isPickable = false; // Template mesh, not directly pickable

  return mesh;
}
