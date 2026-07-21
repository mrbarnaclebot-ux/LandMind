/**
 * LOD Hex Geometry - 3 detail levels for distance-based rendering
 *
 * Level 0 (HIGH): Full hex prism with top, sides, and bottom, baked vertex AO.
 * Level 1 (MED): Simplified prism (top + sides), baked vertex AO.
 * Level 2 (LOW): Flat tier-colored hexagon (top face only) — far LOD flatten.
 *
 * ART DIRECTION: vertex-color AO is baked here (multiply-only, no black):
 *   - top face verts    warm  (1.0, 0.98, 0.94)
 *   - side top ring     mid   ~0.80 grey
 *   - skirt / crevices  cool  (0.55, 0.60, 0.74)
 * The per-instance biome ramp color multiplies against these via instanceColor,
 * so we get warm sun-caught tops and cool crevices without any black shadow.
 */

import * as THREE from 'three';

/** LOD level constants */
export const LOD_HIGH = 0;
export const LOD_MED = 1;
export const LOD_LOW = 2;

export type LODLevel = typeof LOD_HIGH | typeof LOD_MED | typeof LOD_LOW;

/** Baked AO vertex colors (multiply-only, cool crevices, warm tops). */
const AO_TOP: [number, number, number] = [1.0, 0.98, 0.94];
const AO_EDGE: [number, number, number] = [0.8, 0.8, 0.82];
const AO_SKIRT: [number, number, number] = [0.55, 0.6, 0.74];

/**
 * Create all 3 LOD geometries for hex tiles.
 *
 * IMPORTANT (seamless tiling): `size` is the hex OUTER radius (centre→corner)
 * and MUST equal the grid pitch parameter HEX_SIZE (1.0) — any shrink factor
 * (e.g. the old 0.95) leaves a visible gap between neighbouring columns because
 * flat-top hexes only share an edge when radius == HEX_SIZE.
 *
 * `skirtDepth` is how far the side skirt extends BELOW each column's own base
 * (local y=0 sits at the column's elevation*STEP). To guarantee that stepped
 * elevation differences never reveal a see-through slit, the caller passes a
 * skirt deep enough to reach global bedrock (below the lowest tier) from the
 * TALLEST column — see ChunkedHexWorld's BEDROCK_SKIRT_DEPTH.
 */
export function createLODGeometries(
  size = 1.0,
  height = 0.35,
  skirtDepth = 2.4
): [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry] {
  return [
    createHighDetailGeometry(size, height, skirtDepth),
    createMedDetailGeometry(size, height, skirtDepth),
    createLowDetailGeometry(size, height),
  ];
}

/**
 * Calculate hex corner positions for flat-top orientation.
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
 * LOD 0 (HIGH): Full hex prism with baked vertex AO.
 */
function createHighDetailGeometry(
  size: number,
  height: number,
  skirtDepth: number
): THREE.BufferGeometry {
  const corners = getHexCorners(size);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vertexIndex = 0;

  const addVertex = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    c: [number, number, number]
  ) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    colors.push(c[0], c[1], c[2]);
    return vertexIndex++;
  };

  const sideBottom = -skirtDepth;

  // TOP FACE — warm
  const topCenter = addVertex(0, height, 0, 0, 1, 0, AO_TOP);
  const topRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    topRing.push(addVertex(corners[i][0], height, corners[i][1], 0, 1, 0, AO_TOP));
  }
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(topCenter, topRing[next], topRing[i]);
  }

  // SIDE FACES — top edge mid, skirt cool
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    const edgeX = corners[next][0] - corners[i][0];
    const edgeZ = corners[next][1] - corners[i][1];
    const faceNx = edgeZ;
    const faceNz = -edgeX;
    const len = Math.sqrt(faceNx * faceNx + faceNz * faceNz);
    const nx = faceNx / len;
    const nz = faceNz / len;

    const v0 = addVertex(corners[i][0], height, corners[i][1], nx, 0, nz, AO_EDGE);
    const v1 = addVertex(corners[next][0], height, corners[next][1], nx, 0, nz, AO_EDGE);
    const v2 = addVertex(corners[next][0], sideBottom, corners[next][1], nx, 0, nz, AO_SKIRT);
    const v3 = addVertex(corners[i][0], sideBottom, corners[i][1], nx, 0, nz, AO_SKIRT);

    indices.push(v0, v1, v2);
    indices.push(v0, v2, v3);
  }

  // BOTTOM FACE — cool
  const bottomCenter = addVertex(0, sideBottom, 0, 0, -1, 0, AO_SKIRT);
  const bottomRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    bottomRing.push(addVertex(corners[i][0], sideBottom, corners[i][1], 0, -1, 0, AO_SKIRT));
  }
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(bottomCenter, bottomRing[i], bottomRing[next]);
  }

  return buildGeometry(positions, normals, colors, indices);
}

/**
 * LOD 1 (MED): top face + sides, no bottom, baked vertex AO.
 */
function createMedDetailGeometry(
  size: number,
  height: number,
  skirtDepth: number
): THREE.BufferGeometry {
  const corners = getHexCorners(size);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vertexIndex = 0;

  const addVertex = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    c: [number, number, number]
  ) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    colors.push(c[0], c[1], c[2]);
    return vertexIndex++;
  };

  const sideBottom = -skirtDepth;

  const topCenter = addVertex(0, height, 0, 0, 1, 0, AO_TOP);
  const topRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    topRing.push(addVertex(corners[i][0], height, corners[i][1], 0, 1, 0, AO_TOP));
  }
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(topCenter, topRing[next], topRing[i]);
  }

  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    const edgeX = corners[next][0] - corners[i][0];
    const edgeZ = corners[next][1] - corners[i][1];
    const faceNx = edgeZ;
    const faceNz = -edgeX;
    const len = Math.sqrt(faceNx * faceNx + faceNz * faceNz);
    const nx = faceNx / len;
    const nz = faceNz / len;

    const v0 = addVertex(corners[i][0], height, corners[i][1], nx, 0, nz, AO_EDGE);
    const v1 = addVertex(corners[next][0], height, corners[next][1], nx, 0, nz, AO_EDGE);
    const v2 = addVertex(corners[next][0], sideBottom, corners[next][1], nx, 0, nz, AO_SKIRT);
    const v3 = addVertex(corners[i][0], sideBottom, corners[i][1], nx, 0, nz, AO_SKIRT);

    indices.push(v0, v1, v2);
    indices.push(v0, v2, v3);
  }

  return buildGeometry(positions, normals, colors, indices);
}

/**
 * LOD 2 (LOW): flat tier-colored hexagon (top only), warm vertex AO.
 */
function createLowDetailGeometry(size: number, height: number): THREE.BufferGeometry {
  const corners = getHexCorners(size);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vertexIndex = 0;

  const addVertex = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    c: [number, number, number]
  ) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    colors.push(c[0], c[1], c[2]);
    return vertexIndex++;
  };

  const topCenter = addVertex(0, height, 0, 0, 1, 0, AO_TOP);
  const topRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    topRing.push(addVertex(corners[i][0], height, corners[i][1], 0, 1, 0, AO_TOP));
  }
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(topCenter, topRing[next], topRing[i]);
  }

  return buildGeometry(positions, normals, colors, indices);
}

function buildGeometry(
  positions: number[],
  normals: number[],
  colors: number[],
  indices: number[]
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
