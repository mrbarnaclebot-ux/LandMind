/**
 * Flat-Top Hex Geometry Generator (Three.js)
 *
 * Creates a procedural flat-top hexagonal prism geometry for use with InstancedMesh.
 * Flat-top orientation: corners at angles 0, 60, 120, 180, 240, 300 degrees.
 *
 * Geometry structure:
 * - Top face: flat hexagon (6 triangles from center)
 * - Side faces: 6 vertical quads (12 triangles)
 * - Skirt: extends down to cover gaps between elevation levels
 * - Bottom face: flat hexagon (for closed mesh)
 *
 * Uses counter-clockwise winding for proper face normals (Three.js default).
 * Clean flat-top tiles like Civilization hex games.
 */

import * as THREE from 'three';

export interface HexGeometryOptions {
  /** Hex outer radius (default: 0.95) */
  size?: number;
  /** Height of the hex tile above y=0 (default: 0.8) */
  height?: number;
  /** Skirt depth below y=0 to close gaps between elevations (default: 0.8) */
  skirtDepth?: number;
}

const DEFAULT_OPTIONS: Required<HexGeometryOptions> = {
  size: 0.95, // Slightly smaller than 1.0 to create visible gaps between hexes
  height: 0.8, // Chunky height for solid 3D block appearance
  skirtDepth: 0.8, // Covers one elevation step (0.5) plus margin
};

/**
 * Create a flat-top hexagonal prism geometry for use with InstancedMesh
 *
 * Simple geometry: flat hexagon on top, vertical sides, skirt below.
 * Clean game-like appearance similar to Civilization hex tiles.
 *
 * @param options - Geometry generation options
 * @returns BufferGeometry ready for instancing
 */
export function createHexGeometry(
  options: HexGeometryOptions = {}
): THREE.BufferGeometry {
  const { size, height, skirtDepth } = { ...DEFAULT_OPTIONS, ...options };

  // Calculate corner positions for flat-top hex
  // Corners at angles 0, 60, 120, 180, 240, 300 degrees
  const corners: [number, number][] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    corners.push([size * Math.cos(angle), size * Math.sin(angle)]);
  }

  // Build vertex positions and normals
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  let vertexIndex = 0;

  // Helper to add a vertex
  const addVertex = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number
  ) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    return vertexIndex++;
  };

  // === TOP FACE (flat normal pointing up) ===
  const topCenter = addVertex(0, height, 0, 0, 1, 0);
  const topRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    topRing.push(addVertex(corners[i][0], height, corners[i][1], 0, 1, 0));
  }

  // Top face triangles (CCW winding for Three.js)
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(topCenter, topRing[i], topRing[next]);
  }

  // === SIDE FACES (flat normals pointing outward) ===
  // Sides extend from top (height) down to bottom (-skirtDepth)
  const sideBottom = -skirtDepth;

  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;

    // Calculate face normal (perpendicular to edge, pointing outward)
    const edgeX = corners[next][0] - corners[i][0];
    const edgeZ = corners[next][1] - corners[i][1];
    // Cross product with up vector gives outward normal
    const faceNx = -edgeZ;
    const faceNz = edgeX;
    const len = Math.sqrt(faceNx * faceNx + faceNz * faceNz);
    const nx = faceNx / len;
    const nz = faceNz / len;

    // Four corners of this side face quad
    const v0 = addVertex(corners[i][0], height, corners[i][1], nx, 0, nz);
    const v1 = addVertex(corners[next][0], height, corners[next][1], nx, 0, nz);
    const v2 = addVertex(
      corners[next][0],
      sideBottom,
      corners[next][1],
      nx,
      0,
      nz
    );
    const v3 = addVertex(corners[i][0], sideBottom, corners[i][1], nx, 0, nz);

    // Two triangles for the quad (CCW winding)
    indices.push(v0, v1, v2);
    indices.push(v0, v2, v3);
  }

  // === BOTTOM FACE (flat normal pointing down) ===
  const bottomCenter = addVertex(0, sideBottom, 0, 0, -1, 0);
  const bottomRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    bottomRing.push(
      addVertex(corners[i][0], sideBottom, corners[i][1], 0, -1, 0)
    );
  }

  // Bottom face triangles (reverse winding for correct facing)
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(bottomCenter, bottomRing[next], bottomRing[i]);
  }

  // Create BufferGeometry and apply attributes
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);

  // Compute bounding sphere for frustum culling
  geometry.computeBoundingSphere();

  return geometry;
}
