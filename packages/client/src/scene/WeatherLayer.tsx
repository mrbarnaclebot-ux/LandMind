/**
 * WeatherLayer — 3D rendering of System 2 weather fronts.
 *
 * Mounted as a sibling inside the Canvas tree (ThreeScene is NOT restructured).
 * For each live front it renders:
 *
 *  1. A translucent, MATTE instanced hex-tile overlay over every covered hex —
 *     thin hex prisms floated just above the terrain (same geometry technique as
 *     HeatMapOverlay). Additive-free, subtle. Tint per front type (weather.ts).
 *  2. A TELEGRAPH: a faint stepped line of hex tiles marching from the current
 *     center toward the projected center ~3 minutes out, so players read where
 *     the front is heading. Lower opacity than the body.
 *  3. Optional cheap falling-streak particles (THREE.Points) for rain/snow/ember,
 *     quality-gated (disabled when `qualityLow`).
 *
 * Fronts DRIFT smoothly: the covered-hex set is recomputed only when the integer
 * coverage changes, but the whole per-front group is translated each frame by the
 * fractional delta between the recompute anchor and the live extrapolated center,
 * so motion is continuous without rebuilding instance buffers every frame. Each
 * front fades in on spawn and out before expiry (weather.ts `frontFade`).
 *
 * Anti-slop: everything here is matte — no bloom, no additive blending. Only the
 * agent amber core glows (ART-DIRECTION rule 2). Disabled entirely at low quality.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../stores/worldStore';
import { useHexStore } from '../stores/hexStore';
import { hexToPixel, ELEVATION_STEP, HEX_TILE_HEIGHT } from '../hex/hexMath';
import { createHexGeometry } from '../hex/hexMesh';
import type { WeatherFront } from '../lib/socketTypes';
import {
  FRONT_STYLES,
  FRONT_FADE_MS,
  TELEGRAPH_STEPS,
  frontCenterAt,
  frontFutureCenterAt,
  frontFade,
  axialDistance,
} from './weather';

// Overlay floats slightly higher than the heat map so both can coexist.
const OVERLAY_HEIGHT_OFFSET = 0.22;
const TELEGRAPH_HEIGHT_OFFSET = 0.26;

interface WeatherLayerProps {
  /** Disable all weather visuals (low quality tier). */
  qualityLow?: boolean;
  /** Enable the cheap particle streaks (medium+ only). */
  particlesEnabled?: boolean;
}

export function WeatherLayer({ qualityLow = false, particlesEnabled = true }: WeatherLayerProps) {
  const fronts = useWorldStore((s) => s.fronts);

  if (qualityLow || fronts.length === 0) return null;

  return (
    <group>
      {fronts.map((front) => (
        <FrontMesh key={front.id} front={front} particlesEnabled={particlesEnabled} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// One front: body overlay + telegraph + particles
// ---------------------------------------------------------------------------

/** Shared thin hex overlay geometry (built once). */
const overlayGeometry = createHexGeometry({ size: 0.85, height: 0.05, skirtDepth: 0 });

function FrontMesh({
  front,
  particlesEnabled,
}: {
  front: WeatherFront;
  particlesEnabled: boolean;
}) {
  const hexes = useHexStore((s) => s.hexes);
  const style = FRONT_STYLES[front.type];

  // Elevation lookup so overlays hug terrain height. Built once per hex set.
  const elevationOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of hexes.values()) map.set(`${h.q},${h.r}`, h.elevation);
    return map;
  }, [hexes]);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const bodyMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const pathRef = useRef<THREE.InstancedMesh>(null);
  const pathMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const pointsMatRef = useRef<THREE.PointsMaterial>(null);

  // The integer center used to last rebuild the covered-hex buffers.
  const anchorRef = useRef<{ q: number; r: number } | null>(null);
  const tmpMatrix = useMemo(() => new THREE.Matrix4(), []);

  // Max instances we might light up: hexes within (radius+1) of the center. We
  // cap the mesh capacity generously and only draw `count`.
  const capacity = useMemo(() => {
    const r = Math.ceil(front.radius) + 1;
    return Math.max(1, 3 * r * (r + 1) + 1); // hexes in a radius-r disc
  }, [front.radius]);

  // Particle cloud (cheap streaks over the front area).
  const particleGeom = useMemo(() => {
    if (!particlesEnabled || !style.particles) return null;
    const n = 90;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const spread = (front.radius + 0.5) * 1.5; // world units
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2 * spread;
      pos[i * 3 + 1] = Math.random() * 6 + 1; // height above terrain
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * spread;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geom;
  }, [particlesEnabled, style.particles, front.radius]);

  useFrame((_, delta) => {
    const now = Date.now();
    const fade = frontFade(front, now);

    // Fade opacity.
    if (bodyMatRef.current) bodyMatRef.current.opacity = style.opacity * fade;
    if (pathMatRef.current) pathMatRef.current.opacity = style.pathOpacity * fade;
    if (pointsMatRef.current) pointsMatRef.current.opacity = 0.5 * fade;

    if (fade <= 0) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }
    if (groupRef.current) groupRef.current.visible = true;

    const center = frontCenterAt(front, now);
    const centerRound = { q: Math.round(center.q), r: Math.round(center.r) };

    // Rebuild the covered-hex instance buffers only when the integer center
    // moves (cheap); between rebuilds we glide the whole group by the fractional
    // delta so drift is perfectly smooth.
    if (
      !anchorRef.current ||
      anchorRef.current.q !== centerRound.q ||
      anchorRef.current.r !== centerRound.r
    ) {
      anchorRef.current = centerRound;
      rebuildBody(centerRound);
      rebuildTelegraph(now, centerRound);
    }

    // Smooth sub-hex glide of the whole front group: the covered-hex instance
    // matrices are baked at the anchor (integer) center; gliding the group by the
    // fractional delta to the live center keeps drift continuous without rebuild.
    if (groupRef.current) {
      const anchorPix = hexToPixel(anchorRef.current.q, anchorRef.current.r);
      const livePix = hexToPixel(center.q, center.r);
      groupRef.current.position.x = livePix.x - anchorPix.x;
      groupRef.current.position.z = livePix.z - anchorPix.z;
    }

    // Drift + fall the particles (cheap: recycle when they sink below ground).
    // The Points sit at the anchor center in local space; the group glide above
    // carries them along with the rest of the front, so no extra position set.
    const pts = pointsRef.current;
    if (pts && particleGeom) {
      const anchorPix = hexToPixel(anchorRef.current.q, anchorRef.current.r);
      pts.position.set(anchorPix.x, 0, anchorPix.z);
      const attr = particleGeom.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const fallSpeed = front.type === 'snow' ? 1.2 : front.type === 'ember' ? 0.6 : 3.2;
      const drift = front.type === 'ember' ? 0.4 : 0;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= (front.type === 'ember' ? -1 : 1) * fallSpeed * delta; // ember drifts up
        arr[i] += drift * delta;
        if (arr[i + 1] < 0.5 || arr[i + 1] > 8) {
          arr[i + 1] = front.type === 'ember' ? 0.5 : 7;
        }
      }
      attr.needsUpdate = true;
    }
  });

  /** Light up every stored hex within the front radius of `centerRound`. */
  function rebuildBody(centerRound: { q: number; r: number }) {
    const mesh = bodyRef.current;
    if (!mesh) return;
    let count = 0;
    for (const h of hexes.values()) {
      if (count >= capacity) break;
      if (axialDistance(centerRound, h) > front.radius) continue;
      const { x, z } = hexToPixel(h.q, h.r);
      const y = h.elevation * ELEVATION_STEP + HEX_TILE_HEIGHT + OVERLAY_HEIGHT_OFFSET;
      // Absolute world coords baked in; the parent group glide adds the smooth
      // sub-hex drift on top.
      tmpMatrix.makeTranslation(x, y, z);
      mesh.setMatrixAt(count, tmpMatrix);
      count++;
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Stepped telegraph tiles from the current center toward the 3-min projected
   * center. Each step lands on the nearest stored hex so it hugs terrain height.
   */
  function rebuildTelegraph(now: number, centerRound: { q: number; r: number }) {
    const mesh = pathRef.current;
    if (!mesh) return;
    const future = frontFutureCenterAt(front, now);
    let count = 0;
    const seen = new Set<string>();
    for (let s = 1; s <= TELEGRAPH_STEPS; s++) {
      const t = s / TELEGRAPH_STEPS;
      const q = Math.round(centerRound.q + (future.q - centerRound.q) * t);
      const r = Math.round(centerRound.r + (future.r - centerRound.r) * t);
      const key = `${q},${r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const elev = elevationOf.get(key) ?? 0;
      const { x, z } = hexToPixel(q, r);
      const y = elev * ELEVATION_STEP + HEX_TILE_HEIGHT + TELEGRAPH_HEIGHT_OFFSET;
      tmpMatrix.makeTranslation(x, y, z);
      mesh.setMatrixAt(count, tmpMatrix);
      count++;
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  const color = useMemo(() => new THREE.Color(style.color), [style.color]);

  return (
    <group ref={groupRef}>
      {/* Body overlay */}
      <instancedMesh ref={bodyRef} args={[overlayGeometry, undefined, capacity]} frustumCulled={false}>
        <meshBasicMaterial
          ref={bodyMatRef}
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Telegraph path (stepped, fainter) */}
      <instancedMesh
        ref={pathRef}
        args={[overlayGeometry, undefined, TELEGRAPH_STEPS]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          ref={pathMatRef}
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Cheap falling-streak particles (quality-gated) */}
      {particleGeom && (
        <points ref={pointsRef} geometry={particleGeom} frustumCulled={false}>
          <pointsMaterial
            ref={pointsMatRef}
            color={color}
            size={front.type === 'snow' ? 0.14 : 0.09}
            transparent
            opacity={0}
            depthWrite={false}
            sizeAttenuation
            toneMapped={false}
          />
        </points>
      )}
    </group>
  );
}

export { FRONT_FADE_MS };
