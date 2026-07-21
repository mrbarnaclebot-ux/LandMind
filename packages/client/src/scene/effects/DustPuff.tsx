/**
 * DustPuff — small grey dust motes rising and settling around a TRAPPED agent
 * (System 3 cave-in). Reuses the DeployBurst particle approach (a single
 * THREE.Points, deterministic per-agent velocities, no Math.random in render)
 * but LOOPS instead of self-terminating: motes drift up, fade, and recycle so
 * the agent reads as buried/struggling for as long as it stays trapped.
 *
 * Anti-slop: MATTE grey, toneMapped normal (NOT false) so it NEVER blooms — the
 * amber core is the only bloomer (ART-DIRECTION rule 2). No additive blending.
 * Quality-gated by the caller (disabled at low tier).
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hash01 } from '../../lib/juice';

const PUFF_COUNT = 8;
const CYCLE = 1.4; // seconds per mote rise/fade cycle
const RISE_SPEED = 0.35; // world units / s
const DUST_COLOR = new THREE.Color('#6A6A72'); // cool matte grey (never black)

interface DustPuffProps {
  /** World-space origin (agent feet). */
  position: [number, number, number];
  /** Stable id used to deterministically seed mote motion. */
  seedId: string;
}

export function DustPuff({ position, seedId }: DustPuffProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  // Per-mote deterministic params: angle, radius, per-mote phase offset so the
  // 8 motes don't puff in lockstep.
  const params = useMemo(() => {
    const p = new Float32Array(PUFF_COUNT * 3);
    for (let i = 0; i < PUFF_COUNT; i++) {
      p[i * 3 + 0] = hash01(seedId, i) * Math.PI * 2; // angle
      p[i * 3 + 1] = 0.1 + hash01(seedId, i + 50) * 0.28; // radius
      p[i * 3 + 2] = hash01(seedId, i + 100); // phase offset 0..1
    }
    return p;
  }, [seedId]);

  const positions = useMemo(() => new Float32Array(PUFF_COUNT * 3), []);

  useFrame(({ clock }) => {
    const geom = pointsRef.current?.geometry;
    if (!geom) return;
    const time = clock.elapsedTime;
    const attr = geom.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;

    let meanOpacity = 0;
    for (let i = 0; i < PUFF_COUNT; i++) {
      const angle = params[i * 3 + 0];
      const radius = params[i * 3 + 1];
      const phase = params[i * 3 + 2];
      // Local time within this mote's cycle (0..1).
      const t = ((time / CYCLE + phase) % 1 + 1) % 1;
      // Spiral outward slightly as it rises.
      const rNow = radius * (0.6 + t * 0.6);
      arr[i * 3 + 0] = Math.cos(angle) * rNow;
      arr[i * 3 + 1] = 0.05 + t * RISE_SPEED * CYCLE;
      arr[i * 3 + 2] = Math.sin(angle) * rNow;
      // Triangle-ish fade: rise in over first 30%, fade out after.
      meanOpacity += t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
    }
    attr.needsUpdate = true;
    if (matRef.current) {
      matRef.current.opacity = 0.32 * (meanOpacity / PUFF_COUNT);
    }
  });

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} count={PUFF_COUNT} />
        </bufferGeometry>
        {/* Matte grey, toneMapped normal → never blooms. NormalBlending. */}
        <pointsMaterial
          ref={matRef}
          color={DUST_COLOR}
          size={0.12}
          sizeAttenuation
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
