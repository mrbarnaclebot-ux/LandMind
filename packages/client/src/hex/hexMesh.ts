/**
 * Flat-Top Hex Geometry Generator (Three.js) with Beveled Edges
 *
 * Creates a procedural flat-top hexagonal prism geometry with beveled top edges
 * for a polished 3D tile appearance like Minecraft or Civ games.
 *
 * Geometry structure:
 * - Top face: flat hexagon (smaller, inset for bevel)
 * - Bevel ring: 6 angled faces connecting top to outer edge
 * - Side faces: 6 vertical quads
 * - Skirt: extends down to cover gaps between elevation levels
 * - Bottom face: flat hexagon (for closed mesh)
 *
 * Uses counter-clockwise winding for proper face normals (Three.js default).
 */

import * as THREE from 'three';

export interface HexGeometryOptions {
  /** Hex outer radius (default: 0.95) */
  size?: number;
  /** Height of the hex tile above y=0 (default: 0.35) */
  height?: number;
  /** Bevel size as fraction of size (default: 0.12) */
  bevelSize?: number;
  /** Bevel height (default: 0.08) */
  bevelHeight?: number;
  /** Skirt depth below y=0 to close gaps between elevations (default: 0.3) */
  skirtDepth?: number;
}

const DEFAULT_OPTIONS: Required<HexGeometryOptions> = {
  size: 0.95, // Slightly smaller than 1.0 to create visible gaps between hexes
  height: 0.35, // Thick tile, not tall column
  bevelSize: 0.12, // Bevel inset from edge
  bevelHeight: 0.08, // How much the bevel drops
  skirtDepth: 0.3, // Covers elevation differences
};

/**
 * Create a flat-top hexagonal prism geometry with beveled top edges
 *
 * The bevel creates that polished 3D tile look where the top edge
 * catches light nicely and creates visual depth.
 *
 * @param options - Geometry generation options
 * @returns BufferGeometry ready for instancing
 */
export function createHexGeometry(
  options: HexGeometryOptions = {}
): THREE.BufferGeometry {
  const { size, height, bevelSize, bevelHeight, skirtDepth } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  // Calculate corner positions for flat-top hex
  // Outer corners at angles 0, 60, 120, 180, 240, 300 degrees
  const outerCorners: [number, number][] = [];
  const innerCorners: [number, number][] = []; // Inset for bevel

  const innerSize = size - bevelSize;
  const bevelY = height - bevelHeight;

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    outerCorners.push([size * Math.cos(angle), size * Math.sin(angle)]);
    innerCorners.push([innerSize * Math.cos(angle), innerSize * Math.sin(angle)]);
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

  // === TOP FACE (flat normal pointing up, inset for bevel) ===
  const topCenter = addVertex(0, height, 0, 0, 1, 0);
  const topRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    topRing.push(
      addVertex(innerCorners[i][0], height, innerCorners[i][1], 0, 1, 0)
    );
  }

  // Top face triangles (CCW winding for Three.js)
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(topCenter, topRing[i], topRing[next]);
  }

  // === BEVEL FACES (angled normals) ===
  // Connects inner top edge to outer edge at bevelY height
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;

    // Calculate bevel face normal (points outward and slightly up)
    // Direction from inner to outer
    const dx = outerCorners[i][0] - innerCorners[i][0];
    const dz = outerCorners[i][1] - innerCorners[i][1];

    // Simplified: normal points outward + up at bevel angle
    const outLen = Math.sqrt(dx * dx + dz * dz);
    const bevelAngle = Math.atan2(bevelHeight, bevelSize);
    const cosAngle = Math.cos(bevelAngle);
    const sinAngle = Math.sin(bevelAngle);

    const nx = (dx / outLen) * cosAngle;
    const ny = sinAngle;
    const nz = (dz / outLen) * cosAngle;

    // Four corners of bevel quad
    // Top inner
    const v0 = addVertex(
      innerCorners[i][0],
      height,
      innerCorners[i][1],
      nx,
      ny,
      nz
    );
    const v1 = addVertex(
      innerCorners[next][0],
      height,
      innerCorners[next][1],
      nx,
      ny,
      nz
    );
    // Bottom outer
    const v2 = addVertex(
      outerCorners[next][0],
      bevelY,
      outerCorners[next][1],
      nx,
      ny,
      nz
    );
    const v3 = addVertex(
      outerCorners[i][0],
      bevelY,
      outerCorners[i][1],
      nx,
      ny,
      nz
    );

    // Two triangles for the quad (CCW winding)
    indices.push(v0, v1, v2);
    indices.push(v0, v2, v3);
  }

  // === SIDE FACES (flat normals pointing outward) ===
  // Sides extend from bevel bottom (bevelY) down to bottom (-skirtDepth)
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

    // Four corners of this side face quad
    const v0 = addVertex(outerCorners[i][0], bevelY, outerCorners[i][1], nx, 0, nz);
    const v1 = addVertex(
      outerCorners[next][0],
      bevelY,
      outerCorners[next][1],
      nx,
      0,
      nz
    );
    const v2 = addVertex(
      outerCorners[next][0],
      sideBottom,
      outerCorners[next][1],
      nx,
      0,
      nz
    );
    const v3 = addVertex(
      outerCorners[i][0],
      sideBottom,
      outerCorners[i][1],
      nx,
      0,
      nz
    );

    // Two triangles for the quad (CCW winding)
    indices.push(v0, v1, v2);
    indices.push(v0, v2, v3);
  }

  // === BOTTOM FACE (flat normal pointing down) ===
  const bottomCenter = addVertex(0, sideBottom, 0, 0, -1, 0);
  const bottomRing: number[] = [];
  for (let i = 0; i < 6; i++) {
    bottomRing.push(
      addVertex(outerCorners[i][0], sideBottom, outerCorners[i][1], 0, -1, 0)
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
