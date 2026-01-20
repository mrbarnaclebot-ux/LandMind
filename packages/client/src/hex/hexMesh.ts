/**
 * Flat-Top Hex Geometry Generator (Three.js) - Solid Prism
 *
 * Creates a simple flat-top hexagonal prism geometry (Minecraft-style solid tiles).
 * NO bevel - just clean flat faces with sharp edges. 3D depth comes from lighting
 * on the side faces, not from geometry complexity.
 *
 * Geometry structure:
 * - Top face: flat hexagon at y=height (all vertices at same height)
 * - Side faces: 6 vertical quads from y=height down to y=-skirtDepth
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
  /** Skirt depth below y=0 to close gaps between elevations (default: 0.3) */
  skirtDepth?: number;
}

const DEFAULT_OPTIONS: Required<HexGeometryOptions> = {
  size: 0.95, // Slightly smaller than 1.0 to create visible gaps between hexes
  height: 0.35, // Thick tile, not tall column
  skirtDepth: 0.3, // Covers elevation differences
};

/**
 * Create a flat-top hexagonal prism geometry (solid tile, no bevel)
 *
 * Minecraft-style: flat top face, vertical sides. 3D feel comes from
 * lighting hitting sides at different angles, not from beveled geometry.
 *
 * @param options - Geometry generation options
 * @returns BufferGeometry ready for instancing
 */
export function createHexGeometry(
  options: HexGeometryOptions = {}
): THREE.BufferGeometry {
  const { size, height, skirtDepth } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

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

  const sideBottom = -skirtDepth;

  // === TOP FACE (flat normal pointing up) ===
  // All vertices at y=height - completely flat top
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
  // Vertical sides from y=height down to y=sideBottom
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;

    // Calculate face normal (perpendicular to edge, pointing outward)
    // Edge goes from corner[i] to corner[next] (CCW around hex when viewed from above)
    // Outward normal is 90 degrees clockwise from edge direction (right-hand rule)
    const edgeX = corners[next][0] - corners[i][0];
    const edgeZ = corners[next][1] - corners[i][1];
    // Rotate edge direction 90 degrees clockwise in XZ plane for outward normal
    const faceNx = edgeZ;
    const faceNz = -edgeX;
    const len = Math.sqrt(faceNx * faceNx + faceNz * faceNz);
    const nx = faceNx / len;
    const nz = faceNz / len;

    // Four corners of this side face quad (top at height, bottom at sideBottom)
    // v0 = top-left (corner[i] at height)
    // v1 = top-right (corner[next] at height)
    // v2 = bottom-right (corner[next] at sideBottom)
    // v3 = bottom-left (corner[i] at sideBottom)
    const v0 = addVertex(corners[i][0], height, corners[i][1], nx, 0, nz);
    const v1 = addVertex(corners[next][0], height, corners[next][1], nx, 0, nz);
    const v2 = addVertex(corners[next][0], sideBottom, corners[next][1], nx, 0, nz);
    const v3 = addVertex(corners[i][0], sideBottom, corners[i][1], nx, 0, nz);

    // Two triangles for the quad (CCW winding when viewed from outside)
    // Looking from outside: need CCW order, which is v0 -> v3 -> v2 and v0 -> v2 -> v1
    // But simpler: v0 -> v2 -> v1 for top triangle, v0 -> v3 -> v2 for bottom triangle
    indices.push(v0, v2, v1);
    indices.push(v0, v3, v2);
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
