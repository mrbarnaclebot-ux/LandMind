/**
 * DeployBurst - 12 amber spark particles that arc outward + up then fall under gravity.
 *
 * Part of the deploy "juice" (see ART-DIRECTION.md "Agents & motion"):
 *   "12 amber spark particles (small emissive quads/points, toneMapped false,
 *    ~600ms lifetime, arc outward+up then fall)".
 *
 * Implementation notes:
 *  - Uses a single THREE.Points object (1 draw call for all 12 sparks) with a
 *    PointsMaterial. sizeAttenuation gives perspective-correct shrink with distance.
 *  - Emissive amber via `color` + `toneMapped={false}` so the sparks cross the world
 *    Bloom threshold (0.9) briefly, matching the amber core. Nothing else on agents blooms.
 *  - Velocities are deterministic from the agent id hash (no Math.random in render).
 *  - Self-reports completion via onDone so the parent can unmount it.
 */
import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hash01 } from '../../lib/juice';

const SPARK_COUNT = 12;
const LIFETIME = 0.6; // seconds (~600ms)
const GRAVITY = 9.0; // downward accel (world units / s²)
const SPARK_COLOR = new THREE.Color('#F0A63C');

interface DeployBurstProps {
  /** World-space origin (agent feet). */
  position: [number, number, number];
  /** Stable id used to deterministically seed spark velocities. */
  seedId: string;
  /** Called once the burst has fully faded so the parent can remove it. */
  onDone: () => void;
}

export function DeployBurst({ position, seedId, onDone }: DeployBurstProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const ageRef = useRef(0);
  const doneRef = useRef(false);
  // Local phase used to force a re-render only on completion (parent unmounts us).
  const [, setDone] = useState(false);

  // Deterministic initial velocities: arc outward (radial) + up.
  const velocities = useMemo(() => {
    const v = new Float32Array(SPARK_COUNT * 3);
    for (let i = 0; i < SPARK_COUNT; i++) {
      // Even angular spread + small deterministic jitter per spark.
      const jitter = (hash01(seedId, i) - 0.5) * 0.5;
      const angle = (i / SPARK_COUNT) * Math.PI * 2 + jitter;
      const speed = 1.6 + hash01(seedId, i + 100) * 1.4; // outward speed
      const up = 2.4 + hash01(seedId, i + 200) * 1.6; // upward pop
      v[i * 3 + 0] = Math.cos(angle) * speed;
      v[i * 3 + 1] = up;
      v[i * 3 + 2] = Math.sin(angle) * speed;
    }
    return v;
  }, [seedId]);

  // Positions buffer starts at origin (relative to the group at `position`).
  const positions = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);

  useFrame((_, delta) => {
    if (doneRef.current) return;
    ageRef.current += delta;
    const t = ageRef.current;

    if (t >= LIFETIME) {
      doneRef.current = true;
      setDone(true);
      onDone();
      return;
    }

    const geom = pointsRef.current?.geometry;
    if (geom) {
      const attr = geom.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < SPARK_COUNT; i++) {
        const vx = velocities[i * 3 + 0];
        const vy = velocities[i * 3 + 1];
        const vz = velocities[i * 3 + 2];
        // Integrated ballistic motion: p = v*t - 0.5*g*t² (on y).
        arr[i * 3 + 0] = vx * t;
        arr[i * 3 + 1] = vy * t - 0.5 * GRAVITY * t * t;
        arr[i * 3 + 2] = vz * t;
      }
      attr.needsUpdate = true;
    }

    // Fade + shrink over life.
    const life = 1 - t / LIFETIME;
    if (matRef.current) {
      matRef.current.opacity = life;
      matRef.current.size = 0.12 * (0.4 + 0.6 * life);
    }
  });

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={SPARK_COUNT}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={matRef}
          color={SPARK_COLOR}
          size={0.12}
          sizeAttenuation
          transparent
          opacity={1}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
