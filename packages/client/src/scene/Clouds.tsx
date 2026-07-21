/**
 * Clouds - Minecraft-style blocky clouds
 *
 * Features:
 * - Blocky voxel-style cloud shapes using box geometries
 * - Flat bottom, uneven top like Minecraft clouds
 * - Soft white with subtle shading from lighting
 * - Slow horizontal drift animation
 * - InstancedMesh for performance
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CloudsProps {
  /** Number of cloud clusters to render */
  count?: number;
  /** Base height of clouds above terrain */
  height?: number;
  /** Horizontal spread radius of cloud field */
  spread?: number;
  /** Drift speed multiplier */
  speed?: number;
}

/** Single cloud block dimensions - Minecraft clouds are flat and wide */
const BLOCK_SIZE = { x: 6, y: 2, z: 6 };

/**
 * Cloud material — dusk-tinted, matte. Warm dusty rose so clouds sit in the
 * golden-hour horizon band; no emissive (only the agent amber core may bloom).
 */
const cloudMaterial = new THREE.MeshLambertMaterial({
  color: 0xe8c8a8, // warm dusk cloud
  transparent: true,
  opacity: 0.85,
});

/**
 * Generate a Minecraft-style cloud cluster shape
 * Flat bottom layer with blocks stacked on top for variation
 */
function generateCloudCluster(
  baseX: number,
  baseY: number,
  baseZ: number,
  seed: number
): THREE.Matrix4[] {
  const matrices: THREE.Matrix4[] = [];
  const random = seedRandom(seed);

  // Grid size for base layer (2x2 to 4x4)
  const gridX = Math.floor(random() * 3) + 2;
  const gridZ = Math.floor(random() * 3) + 2;

  // Create flat base layer - this gives the Minecraft look
  for (let gx = 0; gx < gridX; gx++) {
    for (let gz = 0; gz < gridZ; gz++) {
      const matrix = new THREE.Matrix4();
      const offsetX = (gx - gridX / 2) * BLOCK_SIZE.x;
      const offsetZ = (gz - gridZ / 2) * BLOCK_SIZE.z;

      matrix.compose(
        new THREE.Vector3(baseX + offsetX, baseY, baseZ + offsetZ),
        new THREE.Quaternion(),
        new THREE.Vector3(BLOCK_SIZE.x, BLOCK_SIZE.y, BLOCK_SIZE.z)
      );
      matrices.push(matrix);

      // Randomly add blocks on top (30% chance) for uneven top surface
      if (random() > 0.7) {
        const topMatrix = new THREE.Matrix4();
        topMatrix.compose(
          new THREE.Vector3(baseX + offsetX, baseY + BLOCK_SIZE.y, baseZ + offsetZ),
          new THREE.Quaternion(),
          new THREE.Vector3(BLOCK_SIZE.x, BLOCK_SIZE.y * 0.6, BLOCK_SIZE.z)
        );
        matrices.push(topMatrix);
      }
    }
  }

  return matrices;
}

/**
 * Simple seeded random number generator for deterministic cloud placement
 */
function seedRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Clouds component - renders Minecraft-style blocky clouds
 */
export function Clouds({
  count = 15,
  height = 45,
  spread = 100,
  speed = 1,
}: CloudsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const basePositionsRef = useRef<{ x: number; z: number; y: number }[]>([]);

  // Generate cloud instance matrices
  const { matrices, totalInstances } = useMemo(() => {
    const allMatrices: THREE.Matrix4[] = [];
    const basePositions: { x: number; z: number; y: number }[] = [];

    for (let i = 0; i < count; i++) {
      const seed = i * 12345;
      const random = seedRandom(seed);

      // Random position within spread area
      const baseX = (random() - 0.5) * spread * 2;
      const baseZ = (random() - 0.5) * spread * 2;
      const baseY = height + (random() - 0.5) * 10; // Slight height variation

      basePositions.push({ x: baseX, z: baseZ, y: baseY });

      // Generate cluster of blocks for this cloud
      const clusterMatrices = generateCloudCluster(baseX, baseY, baseZ, seed);
      allMatrices.push(...clusterMatrices);
    }

    basePositionsRef.current = basePositions;

    return {
      matrices: allMatrices,
      totalInstances: allMatrices.length,
    };
  }, [count, height, spread]);

  // Set initial matrices on mount - useEffect because ref isn't available during render
  useEffect(() => {
    if (meshRef.current) {
      matrices.forEach((matrix, i) => {
        meshRef.current!.setMatrixAt(i, matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [matrices]);

  // Animate cloud drift
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const driftSpeed = 0.8 * speed;
    const drift = delta * driftSpeed;
    const wrapBoundary = spread * 1.5;

    // Update each instance's position
    const tempMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let i = 0; i < totalInstances; i++) {
      meshRef.current.getMatrixAt(i, tempMatrix);
      tempMatrix.decompose(position, quaternion, scale);

      // Drift along X axis
      position.x += drift;

      // Wrap around when cloud goes too far
      if (position.x > wrapBoundary) {
        position.x = -wrapBoundary;
      }

      tempMatrix.compose(position, quaternion, scale);
      meshRef.current.setMatrixAt(i, tempMatrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, totalInstances]}
      material={cloudMaterial}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}
