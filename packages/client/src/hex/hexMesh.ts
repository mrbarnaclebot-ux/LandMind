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
 * - Skirt faces: extend sides down to y=0 to prevent gaps between elevations
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
  /** Skirt depth below y=0 to close gaps between elevations (default: 2.0) */
  skirtDepth?: number;
}

const DEFAULT_OPTIONS: Required<BeveledHexOptions> = {
  size: 1.0,
  height: 0.3,
  bevelSize: 0.02, // Very subtle bevel - hexes should look like solid terrain, not rings
  skirtDepth: 0.6, // Just enough to cover one elevation step (0.5) plus small margin
};

/**
 * Create a beveled hexagon mesh for use as thin instance template
 *
 * Uses duplicated vertices for proper smooth normals on the bevel face,
 * while keeping flat shading on the top and side faces. This creates a
 * pleasing rounded-edge appearance on the hex tiles.
 *
 * @param scene - Babylon.js scene
 * @param options - Mesh generation options
 * @returns Mesh ready for thin instancing
 */
export function createBeveledHexMesh(
  scene: Scene,
  options: BeveledHexOptions = {}
): Mesh {
  const { size, height, bevelSize, skirtDepth } = { ...DEFAULT_OPTIONS, ...options };

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

  // Minimal bevel drop - just enough for subtle edge highlight, not a visible groove
  const bevelHeight = height - bevelSize * 0.3;

  // Build vertex positions and normals together for smooth shading
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  let vertexIndex = 0;

  // Helper to add a vertex
  const addVertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    positions.push(x, y, z);
    // Normalize the normal
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    normals.push(nx / len, ny / len, nz / len);
    return vertexIndex++;
  };

  // === TOP FACE (flat normal pointing up) ===
  // Center vertex
  const topCenter = addVertex(0, height, 0, 0, 1, 0);

  // Inner ring vertices for top face (with up normal)
  const topInnerRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    topInnerRing.push(addVertex(innerCorners[i][0], height, innerCorners[i][1], 0, 1, 0));
  }

  // Top face triangles
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(topCenter, topInnerRing[next], topInnerRing[i]);
  }

  // === BEVEL FACE (smooth normals for rounded edge) ===
  // Create separate vertices for bevel with angled normals
  // The bevel normal points diagonally up and outward

  // Inner edge of bevel (same position as top inner ring, but different normal)
  const bevelInnerRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    // Normal points at an angle between up and outward
    const nx = outerCorners[i][0] / size;
    const nz = outerCorners[i][1] / size;
    // Smooth normal: blend between straight up and outward
    bevelInnerRing.push(addVertex(
      innerCorners[i][0], height, innerCorners[i][1],
      nx * 0.5, 0.866, nz * 0.5 // ~60 degrees up
    ));
  }

  // Outer edge of bevel (at lowered position)
  const bevelOuterRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    // Normal on outer edge points more outward
    const nx = outerCorners[i][0] / size;
    const nz = outerCorners[i][1] / size;
    bevelOuterRing.push(addVertex(
      outerCorners[i][0], bevelHeight, outerCorners[i][1],
      nx * 0.866, 0.5, nz * 0.866 // ~30 degrees up
    ));
  }

  // Bevel face quads
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    // Triangle 1
    indices.push(bevelInnerRing[i], bevelOuterRing[i], bevelOuterRing[next]);
    // Triangle 2
    indices.push(bevelInnerRing[i], bevelOuterRing[next], bevelInnerRing[next]);
  }

  // === SIDE FACES (flat normals pointing outward) ===
  // Create vertices for each side face with face-specific normals
  // Sides extend down to -skirtDepth to prevent gaps between hexes at different elevations
  const sideBottom = -skirtDepth;

  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;

    // Calculate face normal (perpendicular to edge, pointing outward)
    const edgeX = outerCorners[next][0] - outerCorners[i][0];
    const edgeZ = outerCorners[next][1] - outerCorners[i][1];
    // Cross product with up vector gives outward normal
    const faceNx = -edgeZ;
    const faceNz = edgeX;
    const len = Math.sqrt(faceNx * faceNx + faceNz * faceNz);
    const nx = faceNx / len;
    const nz = faceNz / len;

    // Four corners of this side face quad (extends down to -skirtDepth)
    const v0 = addVertex(outerCorners[i][0], bevelHeight, outerCorners[i][1], nx, 0, nz);
    const v1 = addVertex(outerCorners[next][0], bevelHeight, outerCorners[next][1], nx, 0, nz);
    const v2 = addVertex(outerCorners[next][0], sideBottom, outerCorners[next][1], nx, 0, nz);
    const v3 = addVertex(outerCorners[i][0], sideBottom, outerCorners[i][1], nx, 0, nz);

    // Two triangles for the quad
    indices.push(v0, v3, v2);
    indices.push(v0, v2, v1);
  }

  // === BOTTOM FACE (flat normal pointing down) ===
  // Bottom is at -skirtDepth to close off the mesh
  const bottomCenter = addVertex(0, sideBottom, 0, 0, -1, 0);
  const bottomRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    bottomRing.push(addVertex(outerCorners[i][0], sideBottom, outerCorners[i][1], 0, -1, 0));
  }

  // Bottom face triangles (reverse winding for correct facing)
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(bottomCenter, bottomRing[i], bottomRing[next]);
  }

  // Create vertex data and apply to mesh
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.indices = indices;

  vertexData.applyToMesh(mesh);

  // Mesh is created but not positioned - caller handles thin instances
  mesh.isPickable = false; // Template mesh, not directly pickable

  return mesh;
}
