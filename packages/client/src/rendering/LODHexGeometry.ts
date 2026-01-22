/**
 * LOD Hex Geometry - 3 detail levels for distance-based rendering
 *
 * Level 0 (HIGH): Full hex geometry with top, sides, and bottom (current quality)
 * Level 1 (MED): Simplified 6-sided prism (fewer vertices, no bottom)
 * Level 2 (LOW): Simple flat hexagon (top face only)
 *
 * Each lower LOD level has significantly fewer vertices for better GPU performance
 * at distance where detail isn't visible anyway.
 */

import * as THREE from 'three';

/** LOD level constants */
export const LOD_HIGH = 0;
export const LOD_MED = 1;
export const LOD_LOW = 2;

export type LODLevel = typeof LOD_HIGH | typeof LOD_MED | typeof LOD_LOW;

/**
 * Create all 3 LOD geometries for hex tiles
 *
 * @param size - Hex outer radius (default: 0.95)
 * @param height - Height of hex tile above y=0 (default: 0.35)
 * @param skirtDepth - Depth below y=0 for elevation gaps (default: 0.3)
 * @returns Tuple of [highGeo, medGeo, lowGeo]
 */
export function createLODGeometries(
  size = 0.95,
  height = 0.35,
  skirtDepth = 0.3
): [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry] {
  return [
    createHighDetailGeometry(size, height, skirtDepth),
    createMedDetailGeometry(size, height, skirtDepth),
    createLowDetailGeometry(size, height),
  ];
}

/**
 * Calculate hex corner positions for flat-top orientation
 * Corners at angles 0, 60, 120, 180, 240, 300 degrees
 */
function getHexCorners(size: number): [number, number][] {
  const corners: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    corners.push([size * Math.cos(angle), size * Math.sin(angle)]);
  }
  return corners;
}

/**
 * LOD 0 (HIGH): Full hex prism with top, sides, and bottom faces
 * Vertices: 7 (top) + 24 (sides) + 7 (bottom) = 38
 * Triangles: 6 (top) + 12 (sides) + 6 (bottom) = 24
 */
function createHighDetailGeometry(
  size: number,
  height: number,
  skirtDepth: number
): THREE.BufferGeometry {
  const corners = getHexCorners(size);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertexIndex = 0;

  const addVertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    return vertexIndex++;
  };

  const sideBottom = -skirtDepth;

  // TOP FACE
  const topCenter = addVertex(0, height, 0, 0, 1, 0);
  const topRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    topRing.push(addVertex(corners[i][0], height, corners[i][1], 0, 1, 0));
  }
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(topCenter, topRing[next], topRing[i]);
  }

  // SIDE FACES
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    const edgeX = corners[next][0] - corners[i][0];
    const edgeZ = corners[next][1] - corners[i][1];
    const faceNx = edgeZ;
    const faceNz = -edgeX;
    const len = Math.sqrt(faceNx * faceNx + faceNz * faceNz);
    const nx = faceNx / len;
    const nz = faceNz / len;

    const v0 = addVertex(corners[i][0], height, corners[i][1], nx, 0, nz);
    const v1 = addVertex(corners[next][0], height, corners[next][1], nx, 0, nz);
    const v2 = addVertex(corners[next][0], sideBottom, corners[next][1], nx, 0, nz);
    const v3 = addVertex(corners[i][0], sideBottom, corners[i][1], nx, 0, nz);

    indices.push(v0, v1, v2);
    indices.push(v0, v2, v3);
  }

  // BOTTOM FACE
  const bottomCenter = addVertex(0, sideBottom, 0, 0, -1, 0);
  const bottomRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    bottomRing.push(addVertex(corners[i][0], sideBottom, corners[i][1], 0, -1, 0));
  }
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(bottomCenter, bottomRing[i], bottomRing[next]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * LOD 1 (MED): Simplified prism - top face + sides, no bottom
 * Vertices: 7 (top) + 24 (sides) = 31
 * Triangles: 6 (top) + 12 (sides) = 18
 */
function createMedDetailGeometry(
  size: number,
  height: number,
  skirtDepth: number
): THREE.BufferGeometry {
  const corners = getHexCorners(size);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertexIndex = 0;

  const addVertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    return vertexIndex++;
  };

  const sideBottom = -skirtDepth;

  // TOP FACE
  const topCenter = addVertex(0, height, 0, 0, 1, 0);
  const topRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    topRing.push(addVertex(corners[i][0], height, corners[i][1], 0, 1, 0));
  }
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(topCenter, topRing[next], topRing[i]);
  }

  // SIDE FACES (simplified - shared normals could be optimized further)
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    const edgeX = corners[next][0] - corners[i][0];
    const edgeZ = corners[next][1] - corners[i][1];
    const faceNx = edgeZ;
    const faceNz = -edgeX;
    const len = Math.sqrt(faceNx * faceNx + faceNz * faceNz);
    const nx = faceNx / len;
    const nz = faceNz / len;

    const v0 = addVertex(corners[i][0], height, corners[i][1], nx, 0, nz);
    const v1 = addVertex(corners[next][0], height, corners[next][1], nx, 0, nz);
    const v2 = addVertex(corners[next][0], sideBottom, corners[next][1], nx, 0, nz);
    const v3 = addVertex(corners[i][0], sideBottom, corners[i][1], nx, 0, nz);

    indices.push(v0, v1, v2);
    indices.push(v0, v2, v3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * LOD 2 (LOW): Flat hexagon - top face only
 * Vertices: 7
 * Triangles: 6
 * Best for distant hexes where 3D detail isn't visible
 */
function createLowDetailGeometry(size: number, height: number): THREE.BufferGeometry {
  const corners = getHexCorners(size);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertexIndex = 0;

  const addVertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    return vertexIndex++;
  };

  // TOP FACE ONLY
  const topCenter = addVertex(0, height, 0, 0, 1, 0);
  const topRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    topRing.push(addVertex(corners[i][0], height, corners[i][1], 0, 1, 0));
  }
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(topCenter, topRing[next], topRing[i]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
