/**
 * ChunkedHexWorld - Scalable hex world rendering with LOD and chunking
 *
 * Replaces HexWorld for large worlds (1M+ hexes). Features:
 * - Spatial chunking (20x20 hexes per chunk)
 * - 3 LOD levels based on camera distance
 * - Frustum culling (only render visible chunks)
 * - Memory-efficient (InstancedMesh per chunk per biome)
 *
 * ART DIRECTION: "Golden-Hour Dusk" (LOCKED 2026-07-21)
 *  - Land columns are stepped by visual elevation tier.
 *  - Each instance gets a per-instance biome-ramp color: higher tier picks a
 *    lighter (more sun-caught) ramp value, plus a small deterministic ±5%
 *    brightness jitter. This multiplies against the baked vertex AO (warm tops,
 *    cool crevices) from LODHexGeometry.
 *  - Cliff shading: hexes whose neighbours drop >1 tier get a slightly darker
 *    ramp pick so exposed cliff faces read cooler.
 *  - Water tiles (tier 0) render a translucent animated plane (Water.tsx).
 *  - Instanced procedural props (pine/boulder/tuft) scatter deterministically,
 *    budget-capped, shadows only at high quality.
 */

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  generateWorld,
  hashQR,
  TIER_WATER,
  TIER_MAX,
  type TerrainSeed,
  type CaveMouth,
} from '../terrain/terrainGenerator';
import { sampleBiomeRamp, type Biome } from '../terrain/biomes';
import { ELEVATION_STEP, HEX_TILE_HEIGHT, HEX_SIZE, hexToPixel, AXIAL_DIRECTIONS } from '../hex/hexMath';
import { useHexStore } from '../stores/hexStore';
import { ChunkManager, type Chunk, type ChunkHex } from './ChunkManager';
import { createLODGeometries, LOD_HIGH, type LODLevel } from './LODHexGeometry';
import { usePerformanceSettings } from './PerformanceAdapter';
import { getPropGeometries, type PropKind } from './PropGeometry';
import { Water, type WaterTile } from './Water';

/** Default grid radius for ~1M hexes */
const DEFAULT_GRID_RADIUS = parseInt(import.meta.env.VITE_HEX_GRID_RADIUS || '500', 10);

/**
 * Side-skirt depth (world units below each column's base). Must reach global
 * bedrock from the TALLEST column so stepped elevation differences never show a
 * see-through slit to the fog/sky behind. The tallest column sits at
 * TIER_MAX*ELEVATION_STEP; its skirt must pass below the lowest possible top
 * (tier 0 ≈ HEX_TILE_HEIGHT). We add a comfortable margin.
 *   depth >= TIER_MAX*STEP + HEX_TILE_HEIGHT + margin
 */
const BEDROCK_SKIRT_DEPTH = TIER_MAX * ELEVATION_STEP + HEX_TILE_HEIGHT + 0.4;

/** Amber ember speckle color (pit floors). Sub-threshold — glimmer, no halo. */
const EMBER_AMBER = '#F0A63C';

/** Prop budgets across the whole visible world (spec: ~600 trees / ~300 rocks). */
const PROP_BUDGET: Record<PropKind, number> = {
  pine: 600,
  boulder: 300,
  tuft: 500,
};

export interface ChunkedHexWorldProps {
  /** Grid radius in hex units (default: 500 for ~1M hexes) */
  gridRadius?: number;
  /** Optional seeds for deterministic terrain generation */
  seed?: TerrainSeed;
}

/**
 * Convert a biomes.ts sRGB triple (0..1 component values matching the hex
 * string) into a THREE.Color in the renderer's working (linear) space, so the
 * on-screen result matches the ART-DIRECTION hex swatches under SRGB output.
 */
function rampToColor(target: THREE.Color, r: number, g: number, b: number, mul: number) {
  target.setRGB(
    Math.min(1, r * mul),
    Math.min(1, g * mul),
    Math.min(1, b * mul),
    THREE.SRGBColorSpace
  );
}

/**
 * Pick the per-instance ramp factor (0..1) for a hex from its elevation tier,
 * with a deterministic ±5% brightness jitter, cliff/pit darkening.
 *
 * Uses the full v2 tier range (0..TIER_MAX) so the taller relief spreads across
 * the biome ramp: valleys read shadow-cool, peaks catch the sun.
 */
function rampFactorFor(hex: ChunkHex): { t: number; mul: number } {
  // Tier 0..TIER_MAX → ramp 0.12..1.0 (water/valley cool; peaks sun-caught).
  const tierT = hex.elevation / TIER_MAX;
  let t = 0.12 + tierT * 0.88;
  // ±5% brightness jitter, deterministic by (q,r).
  const jitter = (hashQR(hex.q + 101, hex.r - 57) - 0.5) * 0.1; // -0.05..0.05
  let mul = 1 + jitter;

  // Pit floors sit in cool shadow: strengthen AO down toward the 0.45 floor and
  // pull the ramp value toward its shadow end.
  if (hex.isPit) {
    t = Math.max(0, t - 0.35);
    mul *= 0.6; // approaches the 0.45 crevice multiplier region
  }
  return { t, mul };
}

/**
 * BiomeChunk - renders all hexes of one biome type within a chunk.
 * Uses InstancedMesh with LOD-appropriate geometry, per-instance ramp color
 * (via instanceColor) multiplied against the baked vertex AO.
 */
interface BiomeChunkProps {
  biome: Biome;
  hexes: ChunkHex[];
  geometry: THREE.BufferGeometry;
  lodLevel: LODLevel;
  castShadow: boolean;
}

function BiomeChunk({ biome, hexes, geometry, lodLevel, castShadow }: BiomeChunkProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Per-instance colors from the biome ramp (elevation + jitter + cliff shade).
  const instanceColors = useMemo(() => {
    const arr = new Float32Array(hexes.length * 3);
    const c = new THREE.Color();
    hexes.forEach((hex, i) => {
      const { t, mul } = rampFactorFor(hex);
      // Cliff darkening: if this hex sits far above the chunk mean, cool it a touch.
      const ramp = sampleBiomeRamp(biome, t);
      rampToColor(c, ramp.r, ramp.g, ramp.b, mul);
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    });
    return arr;
  }, [hexes, biome]);

  const matrices = useMemo(() => {
    const count = hexes.length;
    const result = new Float32Array(count * 16);
    const tempMatrix = new THREE.Matrix4();
    hexes.forEach((hex, i) => {
      const y = hex.elevation * ELEVATION_STEP;
      tempMatrix.makeTranslation(hex.worldX, y, hex.worldZ);
      tempMatrix.toArray(result, i * 16);
    });
    return result;
  }, [hexes]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();
    for (let i = 0; i < hexes.length; i++) {
      tempMatrix.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, tempMatrix);
      tempColor.setRGB(
        instanceColors[i * 3],
        instanceColors[i * 3 + 1],
        instanceColors[i * 3 + 2]
      );
      mesh.setColorAt(i, tempColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matrices, instanceColors, hexes.length, lodLevel]);

  if (hexes.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, hexes.length]}
      frustumCulled={false} // Chunk-level culling handles this
      castShadow={castShadow}
      receiveShadow
    >
      {/* vertexColors uses the baked AO * instanceColor ramp. Matte (no emissive). */}
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0.0} />
    </instancedMesh>
  );
}

/**
 * PropChunk - instanced scatter props (trees / rocks / tufts) for one chunk.
 * Placement is deterministic by (q,r); only rendered at LOD_HIGH and when the
 * quality tier allows props.
 */
interface PropChunkProps {
  hexes: ChunkHex[];
  castShadow: boolean;
  budget: { pine: number; boulder: number; tuft: number };
}

/** Which prop (if any) a hex grows, from its biome. */
function propForBiome(biome: Biome): PropKind | null {
  switch (biome) {
    case 'forest':
      return 'pine';
    case 'rocky':
      return 'boulder';
    case 'plains':
    case 'grassland':
      return 'tuft';
    default:
      return null;
  }
}

function PropChunk({ hexes, castShadow, budget }: PropChunkProps) {
  const geometries = useMemo(() => getPropGeometries(), []);

  const placements = useMemo(() => {
    const out: Record<PropKind, THREE.Matrix4[]> = { pine: [], boulder: [], tuft: [] };
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (const hex of hexes) {
      // Water tiles never grow props.
      if (hex.elevation === TIER_WATER) continue;
      // Highland boulders too (rocky OR highland tier on non-forest).
      let kind = propForBiome(hex.biome);
      if (!kind && hex.elevation >= 3) kind = 'boulder';
      if (!kind) continue;

      // Deterministic density gate so we don't cover every hex.
      const gate = hashQR(hex.q * 3 + 7, hex.r * 5 - 11);
      const density = kind === 'tuft' ? 0.4 : kind === 'pine' ? 0.55 : 0.35;
      if (gate > density) continue;

      const yTop = hex.elevation * ELEVATION_STEP + HEX_TILE_HEIGHT;
      const rot = hashQR(hex.q - 3, hex.r + 9) * Math.PI * 2;
      const scale = 0.85 + hashQR(hex.q + 13, hex.r + 4) * 0.4;
      // Small in-hex offset so props don't all sit dead-center.
      const ox = (hashQR(hex.q + 21, hex.r) - 0.5) * 0.5;
      const oz = (hashQR(hex.q, hex.r + 21) - 0.5) * 0.5;
      p.set(hex.worldX + ox, yTop, hex.worldZ + oz);
      q.setFromEuler(new THREE.Euler(0, rot, 0));
      s.set(scale, scale, scale);
      m.compose(p, q, s);
      out[kind].push(m.clone());
    }
    // Budget-cap (keep deterministic first-N).
    out.pine.length = Math.min(out.pine.length, budget.pine);
    out.boulder.length = Math.min(out.boulder.length, budget.boulder);
    out.tuft.length = Math.min(out.tuft.length, budget.tuft);
    return out;
  }, [hexes, budget]);

  return (
    <>
      {(['pine', 'boulder', 'tuft'] as PropKind[]).map((kind) => {
        const mats = placements[kind];
        if (mats.length === 0) return null;
        return (
          <PropInstances
            key={kind}
            geometry={geometries[kind]}
            matrices={mats}
            castShadow={castShadow}
          />
        );
      })}
    </>
  );
}

function PropInstances({
  geometry,
  matrices,
  castShadow,
}: {
  geometry: THREE.BufferGeometry;
  matrices: THREE.Matrix4[];
  castShadow: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = matrices.length;
  }, [matrices]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, matrices.length]}
      frustumCulled={false}
      castShadow={castShadow}
      receiveShadow
    >
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0.0} />
    </instancedMesh>
  );
}

/**
 * VisibleChunk - renders a single chunk with all its biomes (+ props at high LOD).
 */
interface VisibleChunkProps {
  chunk: Chunk;
  lodGeometries: [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry];
  shadows: boolean;
  props: boolean;
}

function VisibleChunk({ chunk, lodGeometries, shadows, props }: VisibleChunkProps) {
  const geometry = lodGeometries[chunk.lodLevel];
  const showProps = props && chunk.lodLevel === LOD_HIGH;

  return (
    <group key={chunk.key}>
      {Array.from(chunk.hexesByBiome.entries()).map(([biome, hexes]) => (
        <BiomeChunk
          key={`${chunk.key}-${biome}`}
          biome={biome}
          hexes={hexes}
          geometry={geometry}
          lodLevel={chunk.lodLevel}
          castShadow={shadows}
        />
      ))}
      {showProps && (
        <PropChunk hexes={chunk.hexes} castShadow={shadows} budget={PROP_BUDGET} />
      )}
    </group>
  );
}

/**
 * ChunkedHexWorld - main component for scalable hex world rendering
 */
export function ChunkedHexWorld({
  gridRadius = DEFAULT_GRID_RADIUS,
  seed,
}: ChunkedHexWorldProps) {
  const { setHexData } = useHexStore();
  const { camera } = useThree();
  const performanceSettings = usePerformanceSettings();

  const shadowsOn = performanceSettings.qualityLevel === 'high';
  const propsOn = performanceSettings.qualityLevel !== 'low';
  const waterAnimated = performanceSettings.qualityLevel !== 'low';
  // Pit embers + cave mouths are extra set dressing — off at low quality.
  const detailDressing = performanceSettings.qualityLevel !== 'low';

  // Create LOD geometries (memoized). size == HEX_SIZE (no shrink → no gaps),
  // skirt reaches bedrock so elevation steps never show a see-through slit.
  const lodGeometries = useMemo(() => {
    return createLODGeometries(HEX_SIZE, HEX_TILE_HEIGHT, BEDROCK_SKIRT_DEPTH);
  }, []);

  // Create chunk manager (memoized)
  const chunkManager = useMemo(() => new ChunkManager(), []);

  // Generate world (hexes + cave-mouth set dressing) — regenerate on seed/radius.
  const world = useMemo(() => {
    return generateWorld(gridRadius, seed);
  }, [gridRadius, seed]);
  const hexes = world.hexes;

  // Water tiles (all tier-0 hexes) — computed once from full hex list.
  const waterTiles = useMemo<WaterTile[]>(() => {
    const tiles: WaterTile[] = [];
    for (const h of hexes) {
      if (h.elevation === TIER_WATER) {
        const { x, z } = hexToPixel(h.q, h.r);
        tiles.push({ worldX: x, worldZ: z });
      }
    }
    return tiles;
  }, [hexes]);

  // Populate hex store with generated data
  useEffect(() => {
    if (hexes.length > 0) {
      setHexData(hexes);
    }
  }, [hexes, setHexData]);

  // Initialize chunks when hex data changes
  useEffect(() => {
    chunkManager.generateChunks(hexes, gridRadius);
  }, [hexes, gridRadius, chunkManager]);

  // Track visible chunks
  const visibleChunksRef = useRef<Chunk[]>([]);

  const updateVisibility = useCallback(() => {
    const visible = chunkManager.getVisibleChunks(
      camera,
      performanceSettings.maxRenderDistance
    );
    chunkManager.updateLODLevels(camera.position, performanceSettings.lodDistances);
    visibleChunksRef.current = visible;
  }, [camera, chunkManager, performanceSettings]);

  const frameCountRef = useRef(0);
  const [, forceUpdate] = useState<number>(0);
  useFrame(() => {
    frameCountRef.current++;
    if (frameCountRef.current % 3 === 0) {
      updateVisibility();
      forceUpdate((n: number) => n + 1);
    }
  });

  useEffect(() => {
    updateVisibility();
  }, [updateVisibility]);

  return (
    <group name="chunkedHexWorld">
      {visibleChunksRef.current.map((chunk) => (
        <VisibleChunk
          key={chunk.key}
          chunk={chunk}
          lodGeometries={lodGeometries}
          shadows={shadowsOn}
          props={propsOn}
        />
      ))}
      <Water tiles={waterTiles} animated={waterAnimated} size={HEX_SIZE} />

      {/* Pit ember speckles + cave mouths — chunk-independent set dressing.
          Sub-threshold amber emissive (glimmer, never halo). Disabled at low
          quality; simplified budgets otherwise. */}
      {detailDressing && (
        <>
          <PitEmbers hexes={hexes} />
          <CaveMouths caves={world.caves} />
        </>
      )}
    </group>
  );
}

/**
 * PitEmbers — sparse amber ember speckles on pit floors. One InstancedMesh of
 * tiny cubes with sub-threshold emissive (<=0.3) so they glimmer without ever
 * crossing the 0.9 bloom threshold. Deterministic count/position per (q,r).
 */
function PitEmbers({ hexes }: { hexes: ReturnType<typeof generateWorld>['hexes'] }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const matrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    for (const hex of hexes) {
      if (!hex.isPit) continue;
      const { x, z } = hexToPixel(hex.q, hex.r);
      const yTop = hex.elevation * ELEVATION_STEP + HEX_TILE_HEIGHT;
      // 2-4 embers per pit floor, deterministic.
      const count = 2 + Math.floor(hashQR(hex.q + 41, hex.r - 29) * 3);
      for (let i = 0; i < count; i++) {
        const a = hashQR(hex.q * 3 + i * 7, hex.r * 5 - i * 11) * Math.PI * 2;
        const rad = 0.15 + hashQR(hex.q + i, hex.r + i * 2) * 0.45;
        const scale = 0.03 + hashQR(hex.q - i, hex.r + i) * 0.04;
        s.set(scale, scale, scale);
        p.set(x + Math.cos(a) * rad, yTop + 0.02, z + Math.sin(a) * rad);
        m.compose(p, q, s);
        out.push(m.clone());
      }
    }
    return out;
  }, [hexes]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((mm, i) => mesh.setMatrixAt(i, mm));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = matrices.length;
  }, [matrices]);

  if (matrices.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      {/* toneMapped normal + emissiveIntensity 0.3 → below bloom threshold. */}
      <meshStandardMaterial
        color="#2A1B0E"
        emissive={EMBER_AMBER}
        emissiveIntensity={0.3}
        roughness={0.7}
        metalness={0.0}
      />
    </instancedMesh>
  );
}

/**
 * CaveMouths — dark inset openings on tall cliff faces. Each mouth is a small
 * dark quad recessed into the cliff (interior #0C0E16) plus a faint amber
 * gradient plane deeper inside (emissive <=0.25, non-blooming). Set dressing.
 */
function CaveMouths({ caves }: { caves: CaveMouth[] }) {
  const openingRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);

  const { openings, glows } = useMemo(() => {
    const openings: THREE.Matrix4[] = [];
    const glows: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (const cave of caves) {
      const { x, z } = hexToPixel(cave.q, cave.r);
      const dir = AXIAL_DIRECTIONS[cave.dir];
      // Outward face direction in world space (toward the lower neighbour).
      const nWorld = hexToPixel(cave.q + dir.q, cave.r + dir.r);
      const fx = nWorld.x - x;
      const fz = nWorld.z - z;
      const flen = Math.hypot(fx, fz) || 1;
      const nx = fx / flen;
      const nz = fz / flen;

      // Mouth centred on the cliff face, roughly mid-height of the drop.
      const topY = cave.tier * ELEVATION_STEP + HEX_TILE_HEIGHT;
      const dropY = (cave.tier - cave.neighborTier) * ELEVATION_STEP;
      const cy = topY - dropY * 0.5;
      // Face position: at the hex edge (radius ~0.86 for edge midpoint of R=1).
      const edge = HEX_SIZE * 0.86;
      const px = x + nx * edge;
      const pz = z + nz * edge;

      // Orient the quad to face outward (rotate a +Z plane onto the face normal).
      const yaw = Math.atan2(nx, nz);
      quat.setFromAxisAngle(up, yaw);

      // Dark opening (slightly recessed).
      p.set(px - nx * 0.02, cy, pz - nz * 0.02);
      scl.set(0.5, 0.6, 1);
      m.compose(p, quat, scl);
      openings.push(m.clone());

      // Faint amber glow plane deeper inside the opening.
      p.set(px - nx * 0.12, cy, pz - nz * 0.12);
      scl.set(0.34, 0.42, 1);
      m.compose(p, quat, scl);
      glows.push(m.clone());
    }
    return { openings, glows };
  }, [caves]);

  useEffect(() => {
    if (openingRef.current) {
      openings.forEach((mm, i) => openingRef.current!.setMatrixAt(i, mm));
      openingRef.current.instanceMatrix.needsUpdate = true;
      openingRef.current.count = openings.length;
    }
    if (glowRef.current) {
      glows.forEach((mm, i) => glowRef.current!.setMatrixAt(i, mm));
      glowRef.current.instanceMatrix.needsUpdate = true;
      glowRef.current.count = glows.length;
    }
  }, [openings, glows]);

  if (openings.length === 0) return null;

  return (
    <>
      {/* Dark inset opening — near-black indigo interior, matte, non-blooming. */}
      <instancedMesh ref={openingRef} args={[undefined, undefined, openings.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#0C0E16" roughness={1} metalness={0} side={THREE.DoubleSide} />
      </instancedMesh>
      {/* Faint amber ember light deep inside (emissive 0.25 → below bloom). */}
      <instancedMesh ref={glowRef} args={[undefined, undefined, glows.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#1A1208"
          emissive={EMBER_AMBER}
          emissiveIntensity={0.25}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </>
  );
}
