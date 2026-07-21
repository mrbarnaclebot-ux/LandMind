/**
 * PropGeometry - low-poly procedural scatter props for the dusk world.
 *
 * All props are built once as shared BufferGeometries and rendered via
 * InstancedMesh per chunk. Deterministic placement comes from a (q,r) hash so
 * the same hex always grows the same tree/rock/tuft.
 *
 * Prop kinds:
 *  - pine: 2-3 stacked cones + trunk (forest hexes)
 *  - boulder: irregular dodecahedron (rocky / highland hexes)
 *  - tuft: small grass / wheat sprig cluster (plains / grassland hexes)
 */

import * as THREE from 'three';

export type PropKind = 'pine' | 'boulder' | 'tuft';

/** Merge a list of geometries (already positioned) into one. */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let offset = 0;

  for (const g of geos) {
    g.computeVertexNormals();
    const pos = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    const col = g.getAttribute('color');
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      if (col) colors.push(col.getX(i), col.getY(i), col.getZ(i));
      else colors.push(1, 1, 1);
    }
    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + offset);
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(i + offset);
    }
    offset += pos.count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}

function paint(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const count = geo.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

/** Pine tree: dark trunk + 3 stacked cones, dusk forest greens. */
function createPine(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const trunk = new THREE.CylinderGeometry(0.05, 0.07, 0.28, 5);
  trunk.translate(0, 0.14, 0);
  parts.push(paint(trunk, new THREE.Color('#4A3524')));

  const coneColorLow = new THREE.Color('#2F4A32');
  const coneColorHigh = new THREE.Color('#5E8858');
  const coneData = [
    { y: 0.34, r: 0.28, h: 0.34, c: coneColorLow },
    { y: 0.56, r: 0.22, h: 0.3, c: coneColorLow.clone().lerp(coneColorHigh, 0.5) },
    { y: 0.76, r: 0.15, h: 0.26, c: coneColorHigh },
  ];
  for (const cd of coneData) {
    const cone = new THREE.ConeGeometry(cd.r, cd.h, 6);
    cone.translate(0, cd.y, 0);
    parts.push(paint(cone, cd.c));
  }

  return mergeGeometries(parts);
}

/** Boulder: irregular low-poly dodecahedron, desaturated rock. */
function createBoulder(): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(0.22, 0);
  const pos = geo.getAttribute('position');
  // Deterministic irregular displacement.
  for (let i = 0; i < pos.count; i++) {
    const j = i + 1;
    const n = (Math.sin(j * 12.9898) * 43758.5453) % 1;
    const f = 0.82 + Math.abs(n) * 0.36;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * 0.8, pos.getZ(i) * f);
  }
  geo.translate(0, 0.12, 0);
  geo.computeVertexNormals();
  return paint(geo, new THREE.Color('#6E5142'));
}

/** Grass / wheat tuft: a few thin crossed blades. */
function createTuft(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const blade = new THREE.Color('#8A9A44');
  for (let b = 0; b < 4; b++) {
    const g = new THREE.ConeGeometry(0.03, 0.24, 3);
    const ang = (b / 4) * Math.PI * 2;
    g.rotateZ((b % 2 === 0 ? 0.18 : -0.18));
    g.translate(Math.cos(ang) * 0.06, 0.12, Math.sin(ang) * 0.06);
    parts.push(paint(g, blade));
  }
  return mergeGeometries(parts);
}

let cache: Record<PropKind, THREE.BufferGeometry> | null = null;

/** Get (and lazily build) the shared prop geometries. */
export function getPropGeometries(): Record<PropKind, THREE.BufferGeometry> {
  if (!cache) {
    cache = {
      pine: createPine(),
      boulder: createBoulder(),
      tuft: createTuft(),
    };
  }
  return cache;
}
