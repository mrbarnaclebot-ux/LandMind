/**
 * Clouds - Minecraft-style blocky clouds
 *
 * Features:
 * - Blocky voxel-style cloud shapes using box geometries
 * - White/light gray with subtle transparency
 * - Slow horizontal drift animation
 * - Multiple cloud layers at different heights
 * - InstancedMesh for performance
 */

import { useRef, useMemo } from 'react';
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

/** Single cloud block dimensions */
const BLOCK_SIZE = { x: 4, y: 1.5, z: 3 };

/** Cloud material - white with transparency */
const cloudMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide,
});

/**
 * Generate a Minecraft-style cloud cluster shape
 * Each cluster is made of overlapping blocks
 */
function generateCloudCluster(
  baseX: number,
  baseY: number,
  baseZ: number,
  seed: number
): THREE.Matrix4[] {
  const matrices: THREE.Matrix4[] = [];
  const random = seedRandom(seed);

  // Number of blocks in this cluster (3-8)
  const blockCount = Math.floor(random() * 6) + 3;

  for (let i = 0; i < blockCount; i++) {
    const matrix = new THREE.Matrix4();

    // Offset from cluster center
    const offsetX = (random() - 0.5) * BLOCK_SIZE.x * 2;
    const offsetY = (random() - 0.5) * BLOCK_SIZE.y * 0.5;
    const offsetZ = (random() - 0.5) * BLOCK_SIZE.z * 1.5;

    // Slight scale variation
    const scaleX = 0.8 + random() * 0.6;
    const scaleY = 0.7 + random() * 0.4;
    const scaleZ = 0.8 + random() * 0.5;

    matrix.compose(
      new THREE.Vector3(baseX + offsetX, baseY + offsetY, baseZ + offsetZ),
      new THREE.Quaternion(),
      new THREE.Vector3(
        BLOCK_SIZE.x * scaleX,
        BLOCK_SIZE.y * scaleY,
        BLOCK_SIZE.z * scaleZ
      )
    );

    matrices.push(matrix);
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
  height = 60,
  spread = 80,
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

  // Set initial matrices on mount
  useMemo(() => {
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
