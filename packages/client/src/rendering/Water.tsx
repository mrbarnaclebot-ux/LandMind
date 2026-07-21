/**
 * Water - translucent animated water for tiles below the waterline.
 *
 * Renders one InstancedMesh of flat hex tops sitting at a fixed WATER_LEVEL_Y.
 * A small vertex wave + fresnel-ish rim gives gentle motion. Kept intentionally
 * dark/matte and low-luminance so it never blooms (bloom threshold 0.9).
 *
 * Animation is gated off at low quality (static plane) via the `animated` prop.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WATER_LEVEL_Y } from '../hex/hexMath';

export interface WaterTile {
  worldX: number;
  worldZ: number;
}

interface WaterProps {
  tiles: WaterTile[];
  /** Whether to animate the surface (disabled on low quality). */
  animated?: boolean;
  /** Hex top radius (match land tile size). */
  size?: number;
}

/** Flat hexagon geometry (top face only) for the water surface. */
function createWaterHex(size: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  positions.push(0, 0, 0);
  normals.push(0, 1, 0);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    positions.push(Math.cos(a) * size, 0, Math.sin(a) * size);
    normals.push(0, 1, 0);
  }
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(0, next + 1, i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

export function Water({ tiles, animated = true, size = 0.95 }: WaterProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => createWaterHex(size), [size]);

  // Dusk water shader: deep teal base, warm horizon reflection on rim,
  // gentle wave. toneMapped stays on so it can't out-shine the bloom threshold.
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAnimated: { value: animated ? 1 : 0 },
        uDeep: { value: new THREE.Color('#1E3E4A') },
        uShallow: { value: new THREE.Color('#3B6E70') },
        uRim: { value: new THREE.Color('#C77A4A') },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uAnimated;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
          vec4 world = instanceMatrix * vec4(position, 1.0);
          float wave = uAnimated * 0.035 * sin(world.x * 1.7 + uTime * 1.4)
                     * cos(world.z * 1.3 + uTime * 1.1);
          world.y += wave;
          vWorldPos = world.xyz;
          vNormal = normalize(vec3(-0.05 * cos(world.x * 1.7 + uTime * 1.4), 1.0,
                                    -0.05 * sin(world.z * 1.3 + uTime * 1.1)));
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uRim;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fres = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
          vec3 base = mix(uDeep, uShallow, clamp(vNormal.y, 0.0, 1.0));
          vec3 col = mix(base, uRim, fres * 0.6);
          gl_FragColor = vec4(col, 0.82);
        }
      `,
    });
    return mat;
  }, [animated]);

  useEffect(() => {
    material.uniforms.uAnimated.value = animated ? 1 : 0;
  }, [animated, material]);

  // Position instances.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    tiles.forEach((t, i) => {
      m.makeTranslation(t.worldX, WATER_LEVEL_Y, t.worldZ);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = tiles.length;
  }, [tiles]);

  useFrame((_, delta) => {
    if (animated) material.uniforms.uTime.value += delta;
  });

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  if (tiles.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, tiles.length]}
      frustumCulled={false}
    />
  );
}
