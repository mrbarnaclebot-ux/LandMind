/**
 * VeinLayer — 3D rendering of System 3 rich-vein strikes.
 *
 * Mounted as a sibling inside the Canvas tree (ThreeScene is NOT restructured —
 * one additive line, like WeatherLayer). For each live vein it renders, on the
 * struck hex:
 *
 *  1. A pulsing amber hex RING floated just above the terrain — a flat hex-edge
 *     ring whose opacity + scale breathe at a slow cadence (a land-rush beacon).
 *  2. Rising sparkle MOTES — a cheap THREE.Points column of amber flecks drifting
 *     upward out of the hex, quality-gated.
 *
 * Anti-slop (ART-DIRECTION rule 2): the amber core of an agent is the ONLY thing
 * that blooms. Everything here is MATTE / SUB-BLOOM — `toneMapped` stays NORMAL
 * (so the ring/motes never cross the 0.9 bloom threshold) and there is NO
 * additive blending. A rich vein glimmers; it does not halo. Disabled at low
 * quality.
 *
 * Veins fade in on spawn and out over the last few seconds before expiry so they
 * don't pop. Removal is driven by the store (vein:expired), but we also self-hide
 * once past expiresAt as a safety net.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../stores/worldStore';
import { useHexStore } from '../stores/hexStore';
import { hexToPixel, ELEVATION_STEP, HEX_TILE_HEIGHT } from '../hex/hexMath';
import type { Vein } from '../lib/socketTypes';

/** Ring floats a touch above the terrain surface. */
const RING_HEIGHT_OFFSET = 0.06;
/** Fade window (ms) at spawn and before expiry. */
const VEIN_FADE_MS = 2500;
/** Amber, matte — sits inside the LOCKED accent family. */
const VEIN_AMBER = '#F0A63C';

interface VeinLayerProps {
  /** Disable all vein visuals (low quality tier). */
  qualityLow?: boolean;
  /** Enable the rising sparkle motes (medium+ only). */
  particlesEnabled?: boolean;
}

export function VeinLayer({ qualityLow = false, particlesEnabled = true }: VeinLayerProps) {
  const veins = useWorldStore((s) => s.veins);

  if (qualityLow || veins.length === 0) return null;

  return (
    <group>
      {veins.map((vein) => (
        <VeinMesh key={vein.hexId} vein={vein} particlesEnabled={particlesEnabled} />
      ))}
    </group>
  );
}

/** Fade factor (0..1) for a vein: eases in after spawn-ish and out before expiry.
 *  We don't get a spawn time in the store, so fade-in keys off first mount; the
 *  fade-out keys off expiresAt. */
function veinFadeOut(vein: Vein, nowMs: number): number {
  if (nowMs >= vein.expiresAt) return 0;
  return Math.min(1, (vein.expiresAt - nowMs) / VEIN_FADE_MS);
}

function VeinMesh({ vein, particlesEnabled }: { vein: Vein; particlesEnabled: boolean }) {
  const elevationOf = useHexStore((s) => s.getHexInfo);

  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const pointsMatRef = useRef<THREE.PointsMaterial>(null);
  // Local mount time so the ring fades IN smoothly.
  const mountedAtRef = useRef<number>(Date.now());

  // Base world position (hugs terrain height).
  const base = useMemo(() => {
    const { x, z } = hexToPixel(vein.q, vein.r);
    const info = elevationOf(vein.q, vein.r);
    const elev = info?.elevation ?? 0;
    const y = elev * ELEVATION_STEP + HEX_TILE_HEIGHT + RING_HEIGHT_OFFSET;
    return { x, y, z };
  }, [vein.q, vein.r, elevationOf]);

  // Sparkle motes: a small column of amber flecks that rise + recycle.
  const N = 26;
  const particleGeom = useMemo(() => {
    if (!particlesEnabled) return null;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + (i * 2.399); // golden-angle spread
      const rad = 0.15 + ((i * 37) % 100) / 100 * 0.55;
      pos[i * 3] = Math.cos(a) * rad;
      pos[i * 3 + 1] = ((i * 53) % 100) / 100 * 2.4; // staggered heights
      pos[i * 3 + 2] = Math.sin(a) * rad;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geom;
  }, [particlesEnabled]);

  useFrame((_, delta) => {
    const now = Date.now();
    const fadeOut = veinFadeOut(vein, now);
    const fadeIn = Math.min(1, (now - mountedAtRef.current) / VEIN_FADE_MS);
    const fade = Math.max(0, Math.min(fadeIn, fadeOut));

    // Pulsing ring: slow breathing scale + opacity (a beacon, hard-ish cadence).
    const t = now / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 1.1); // ~0.55 Hz
    if (ringRef.current) {
      const s = 0.9 + pulse * 0.18;
      ringRef.current.scale.set(s, s, s);
      ringRef.current.visible = fade > 0;
    }
    if (ringMatRef.current) {
      ringMatRef.current.opacity = (0.35 + pulse * 0.4) * fade;
    }

    // Rising sparkle motes: drift up, recycle at the top.
    const pts = pointsRef.current;
    if (pts && particleGeom) {
      const attr = particleGeom.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += 0.6 * delta;
        if (arr[i + 1] > 2.4) arr[i + 1] = 0.05;
      }
      attr.needsUpdate = true;
    }
    if (pointsMatRef.current) {
      pointsMatRef.current.opacity = (0.35 + pulse * 0.25) * fade;
    }
  });

  return (
    <group position={[base.x, base.y, base.z]}>
      {/* Pulsing amber hex ring — flat on the hex, matte (no bloom). */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        {/* 6-segment ring reads as a hex outline. */}
        <ringGeometry args={[0.78, 0.94, 6]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={VEIN_AMBER}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rising sparkle motes (quality-gated). Matte amber, non-blooming. */}
      {particleGeom && (
        <points ref={pointsRef} geometry={particleGeom} frustumCulled={false}>
          <pointsMaterial
            ref={pointsMatRef}
            color={VEIN_AMBER}
            size={0.08}
            transparent
            opacity={0}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}
    </group>
  );
}

export { VEIN_FADE_MS };
