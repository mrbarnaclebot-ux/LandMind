/**
 * AgentLayer - Renders all agents as dark-matte voxel bodies with a single amber core.
 *
 * Golden-Hour Dusk art direction (see .planning/design/ART-DIRECTION.md → "Agents & motion"):
 *  - Dark matte body (deep indigo-charcoal) with subtle per-instance tint jitter; matte limbs.
 *  - ONE amber core cube (emissive #F0A63C, toneMapped=false) is the only thing that blooms.
 *    The world composer adds Bloom threshold 0.9; the core crosses it, nothing else does.
 *  - States: IDLE steady core; MINING core pulses 0.8→1.5 @ 1.2 Hz + amber ground ring pulse;
 *    RELOCATING slight forward lean + faster bob.
 *  - Idle motion: bob 0.3 Hz + sway 0.18 Hz with per-instance phase offsets (id hash) to kill
 *    the mechanical synchronized look.
 *  - Deploy juice: squash-land (scaleY 0.88→1.0 easeOutBack ~220ms) + 12 amber spark particles
 *    + a brief hit-pause + Perlin trauma camera shake.
 *
 * Perf: no per-agent pointLights (removed). Distant agents cluster (AgentCluster). Per-instance
 * variation is deterministic (hash of agent id) — no Math.random in render.
 */
import { useRef, useMemo, useEffect, useState, useSyncExternalStore } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAgentStore } from '../stores/agentStore';
import { useHexStore } from '../stores/hexStore';
import { hexToPixel, ELEVATION_STEP, HEX_TILE_HEIGHT } from '../hex/hexMath';
import { useAgentClusters, ClusterMarker } from '../rendering/AgentCluster';
import { usePerformanceSettings } from '../rendering/PerformanceAdapter';
import {
  hash01,
  easeOutBack,
  clamp01,
  addTrauma,
  decayTrauma,
  getShake,
  getTrauma,
  subscribeTrauma,
  noise1D,
} from '../lib/juice';
import { DeployBurst } from './effects/DeployBurst';

// Agent visual config
const BODY_WIDTH = 0.4;
const BODY_HEIGHT = 0.5;
const BODY_DEPTH = 0.25;
const HEAD_SIZE = 0.35;
const CORE_SIZE = 0.16;
const TOTAL_HEIGHT = BODY_HEIGHT + HEAD_SIZE * 0.8;

// Idle motion (spec: bob 0.3 Hz, sway 0.18 Hz)
const BOB_HZ = 0.3;
const SWAY_HZ = 0.18;
const BOB_AMPLITUDE = 0.05;
const SWAY_AMPLITUDE = 0.12; // radians of gentle rotation sway

// Mining core pulse (spec: 0.8 → 1.5 @ 1.2 Hz)
const MINING_HZ = 1.2;
const CORE_MIN = 0.8;
const CORE_MAX = 1.5;

// Deploy juice (spec)
const SQUASH_DURATION = 0.22; // 220ms easeOutBack
const SQUASH_START_Y = 0.88; // scaleY 0.88 → 1.0
const HIT_PAUSE = 0.04; // ~40ms freeze of local animation
const DEPLOY_TRAUMA = 0.25; // trauma impulse
const TRAUMA_DECAY_SECONDS = 0.18; // full-trauma decay time (100-250ms band)

// Colors
const BODY_BASE = new THREE.Color('#232838'); // deep indigo-charcoal
const LIMB_BASE = new THREE.Color('#1B1F2C'); // slightly darker matte limbs
const CORE_AMBER = new THREE.Color('#F0A63C'); // the ONLY bloomer
const RING_AMBER = new THREE.Color('#F0A63C'); // ground ring (no bloom)

interface AgentData {
  id: string;
  position: [number, number, number];
  status: 'MINING' | 'RELOCATING' | 'IDLE';
}

/**
 * Per-instance deterministic body tint: nudge the deep indigo-charcoal base by a small
 * amount derived from the id hash so a crowd doesn't read as a flat clone army.
 */
function tintedBody(id: string): THREE.Color {
  const c = BODY_BASE.clone();
  const h = (hash01(id, 7) - 0.5) * 0.08; // ±0.04 lightness-ish jitter
  const warm = (hash01(id, 11) - 0.5) * 0.03;
  c.r = clamp01(c.r + h + warm);
  c.g = clamp01(c.g + h);
  c.b = clamp01(c.b + h - warm);
  return c;
}

/**
 * Single voxel-robot agent: dark matte shell + one amber core.
 */
function VoxelAgent({
  id,
  position,
  status,
  isNewlyDeployed,
  particlesEnabled,
}: {
  id: string;
  position: [number, number, number];
  status: string;
  isNewlyDeployed: boolean;
  particlesEnabled: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Deploy animation timeline (seconds since deploy started). null = not animating.
  const deployAgeRef = useRef<number | null>(null);
  // Spark burst state — needs to be React state so mounting the <DeployBurst> re-renders.
  const [burst, setBurst] = useState<{ active: boolean; key: number }>({ active: false, key: 0 });

  // Per-instance phase offsets (deterministic) — kill synchronized motion.
  const bobPhase = useMemo(() => hash01(id, 1) * Math.PI * 2, [id]);
  const swayPhase = useMemo(() => hash01(id, 2) * Math.PI * 2, [id]);
  const speedJitter = useMemo(() => 0.9 + hash01(id, 3) * 0.2, [id]); // ±10% speed variance
  const bodyColor = useMemo(() => tintedBody(id), [id]);

  // Kick off the deploy timeline when this agent first appears as newly deployed.
  useEffect(() => {
    if (isNewlyDeployed) {
      deployAgeRef.current = 0;
      if (particlesEnabled) {
        setBurst((b) => ({ active: true, key: b.key + 1 }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewlyDeployed]);

  useFrame(({ clock }, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const time = clock.elapsedTime;

    // ---- Deploy timeline (squash-land + hit-pause) ------------------------
    let inHitPause = false;
    let squashY = 1;
    if (deployAgeRef.current !== null) {
      deployAgeRef.current += delta;
      const da = deployAgeRef.current;

      if (da < HIT_PAUSE) {
        // Brief freeze of local animation for a "hit" feel.
        inHitPause = true;
        squashY = SQUASH_START_Y;
      } else {
        const t = clamp01((da - HIT_PAUSE) / SQUASH_DURATION);
        const e = easeOutBack(t);
        squashY = SQUASH_START_Y + (1 - SQUASH_START_Y) * e;
        if (t >= 1) {
          deployAgeRef.current = null; // done
          squashY = 1;
        }
      }
    }

    // ---- Idle / state motion ---------------------------------------------
    // During the hit-pause we freeze the bob/sway to sell the impact.
    if (!inHitPause) {
      let bobAmp = BOB_AMPLITUDE;
      let bobHz = BOB_HZ;
      let lean = 0;

      if (status === 'RELOCATING') {
        // Faster bob + slight forward lean.
        bobHz = BOB_HZ * 2.4;
        bobAmp = BOB_AMPLITUDE * 1.3;
        lean = 0.18; // forward pitch (radians)
      } else if (status === 'MINING') {
        bobHz = BOB_HZ * 1.2;
      }

      const bob = Math.sin(time * bobHz * speedJitter * Math.PI * 2 + bobPhase) * bobAmp;
      const sway = Math.sin(time * SWAY_HZ * speedJitter * Math.PI * 2 + swayPhase) * SWAY_AMPLITUDE;

      g.position.y = position[1] + bob;
      g.rotation.y = sway;
      g.rotation.x = lean;
    }

    // Apply squash (never during idle it stays 1).
    g.scale.y = squashY;

    // ---- Amber core state emissive ---------------------------------------
    if (coreMatRef.current) {
      let intensity: number;
      if (status === 'MINING') {
        // Pulse 0.8 → 1.5 @ 1.2 Hz.
        const p = 0.5 + 0.5 * Math.sin(time * MINING_HZ * Math.PI * 2 + bobPhase);
        intensity = CORE_MIN + (CORE_MAX - CORE_MIN) * p;
      } else if (status === 'RELOCATING') {
        intensity = 1.1;
      } else {
        intensity = CORE_MIN; // IDLE steady 0.8
      }
      coreMatRef.current.emissiveIntensity = intensity;
    }

    // ---- Mining ground ring pulse (amber, fading opacity, no bloom) -------
    if (ringRef.current && ringMatRef.current) {
      if (status === 'MINING') {
        ringRef.current.visible = true;
        // 0→1 sawtooth expanding ring at the mining cadence.
        const phase = (time * MINING_HZ + hash01(id, 5)) % 1;
        const s = 0.5 + phase * 1.1; // expand outward
        ringRef.current.scale.set(s, s, s);
        ringMatRef.current.opacity = 0.5 * (1 - phase); // fade as it expands
      } else {
        ringRef.current.visible = false;
      }
    }
  });

  return (
    <>
      <group ref={groupRef} position={position}>
        {/* Body - dark matte, per-instance tint */}
        <mesh position={[0, BODY_HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH]} />
          <meshStandardMaterial color={bodyColor} roughness={0.95} metalness={0.0} />
        </mesh>

        {/* Head - matte */}
        <mesh position={[0, BODY_HEIGHT + HEAD_SIZE * 0.3, 0]} castShadow>
          <boxGeometry args={[HEAD_SIZE, HEAD_SIZE, HEAD_SIZE]} />
          <meshStandardMaterial color={bodyColor} roughness={0.9} metalness={0.0} />
        </mesh>

        {/* Amber CORE cube - the ONLY bloomer. Sits in the chest. */}
        <mesh position={[0, BODY_HEIGHT * 0.55, BODY_DEPTH / 2]}>
          <boxGeometry args={[CORE_SIZE, CORE_SIZE, CORE_SIZE * 0.6]} />
          <meshStandardMaterial
            ref={coreMatRef}
            color="#3A2A12"
            emissive={CORE_AMBER}
            emissiveIntensity={1.5}
            toneMapped={false}
            roughness={0.4}
            metalness={0.0}
          />
        </mesh>

        {/* Matte limbs (only when mining — the "arms working") */}
        {status === 'MINING' && (
          <>
            <mesh position={[BODY_WIDTH / 2 + 0.08, BODY_HEIGHT * 0.6, 0]} rotation={[0, 0, -0.3]} castShadow>
              <boxGeometry args={[0.1, 0.3, 0.1]} />
              <meshStandardMaterial color={LIMB_BASE} roughness={0.95} metalness={0.0} />
            </mesh>
            <mesh position={[-BODY_WIDTH / 2 - 0.08, BODY_HEIGHT * 0.6, 0]} rotation={[0, 0, 0.3]} castShadow>
              <boxGeometry args={[0.1, 0.3, 0.1]} />
              <meshStandardMaterial color={LIMB_BASE} roughness={0.95} metalness={0.0} />
            </mesh>
          </>
        )}

        {/* Mining ground ring - amber, no bloom (toneMapped default). Flat on the hex. */}
        <mesh ref={ringRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.28, 0.36, 24]} />
          <meshBasicMaterial
            ref={ringMatRef}
            color={RING_AMBER}
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Deploy spark burst (own draw call; unmounts itself when finished). */}
      {burst.active && particlesEnabled && (
        <DeployBurst
          key={`burst-${id}-${burst.key}`}
          position={[position[0], position[1] + 0.05, position[2]]}
          seedId={id}
          onDone={() => setBurst((b) => ({ ...b, active: false }))}
        />
      )}
    </>
  );
}

/**
 * CameraShake - applies trauma-based (Perlin-ish) shake to the r3f camera every frame,
 * then restores. Lives inside AgentLayer's tree so it can access `useThree().camera`
 * WITHOUT editing ThreeScene. Trauma is fed via the juice store (addTrauma on deploy).
 * Disabled at low quality.
 */
function CameraShake({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  // Max shake displacement in world units (~4px-equivalent at typical framing).
  const MAX_OFFSET = 0.25;
  const seedRef = useRef({ x: Math.PI * 3.7, z: Math.PI * 1.3 });
  // Offset we applied last frame; reverted at the top of this frame to avoid drift when
  // camera controls run between frames (we never mutate controls, only the camera pose).
  const appliedRef = useRef<{ x: number; y: number; z: number } | null>(null);

  useFrame((_, delta) => {
    // Revert last frame's offset first so shake is a transient pose delta, not cumulative.
    const prev = appliedRef.current;
    if (prev) {
      camera.position.x -= prev.x;
      camera.position.y -= prev.y;
      camera.position.z -= prev.z;
      appliedRef.current = null;
    }

    const trauma = getTrauma();
    if (trauma <= 0) return;
    if (!enabled) {
      // Still decay so a queued impulse doesn't linger if quality dropped mid-burst.
      decayTrauma(delta, TRAUMA_DECAY_SECONDS);
      return;
    }

    const shake = getShake(); // trauma²
    const t = performance.now() * 0.06; // fast sampling → jittery-but-smooth
    const s = seedRef.current;
    const ox = noise1D(t, 1) * shake * MAX_OFFSET;
    const oy = noise1D(t + s.x, 2) * shake * MAX_OFFSET;
    const oz = noise1D(t + s.z, 3) * shake * MAX_OFFSET * 0.5;

    camera.position.x += ox;
    camera.position.y += oy;
    camera.position.z += oz;
    camera.updateMatrixWorld();
    appliedRef.current = { x: ox, y: oy, z: oz };

    decayTrauma(delta, TRAUMA_DECAY_SECONDS);
  });

  return null;
}

// Distance threshold for clustering (agents beyond this are clustered)
const CLUSTER_THRESHOLD = 100;

export function AgentLayer() {
  const { agents } = useAgentStore();
  const { getHexInfo, isInitialized } = useHexStore();
  const { camera } = useThree();
  const perf = usePerformanceSettings();

  // Quality gating: at 'low', disable particles and shake (spec task 7).
  const particlesEnabled = perf.qualityLevel !== 'low';
  const shakeEnabled = perf.qualityLevel !== 'low';

  // Subscribe to trauma store so shake enable-state is reactive (cheap no-op selector).
  useSyncExternalStore(subscribeTrauma, getTrauma, getTrauma);

  // Track which agent ids we've already seen so we can flag NEW deploys for juice.
  const seenIdsRef = useRef<Set<string>>(new Set());
  const newlyDeployedRef = useRef<Set<string>>(new Set());
  const firstRunRef = useRef(true);

  // Determine newly-deployed agents (appeared since last render).
  const newIds = useMemo(() => {
    const currentIds = new Set(agents.map((a) => a.id));
    const fresh = new Set<string>();
    for (const a of agents) {
      if (!seenIdsRef.current.has(a.id)) {
        // On the very first mount, treat all existing agents as "already present"
        // (don't fire deploy juice for the initial load).
        if (!firstRunRef.current) fresh.add(a.id);
      }
    }
    seenIdsRef.current = currentIds;
    firstRunRef.current = false;
    newlyDeployedRef.current = fresh;
    return fresh;
  }, [agents]);

  // Fire trauma once per newly-deployed agent (respecting quality).
  useEffect(() => {
    if (newIds.size === 0) return;
    if (shakeEnabled) addTrauma(DEPLOY_TRAUMA);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newIds]);

  // Use agent clustering based on camera distance
  const { individualAgents, clusters } = useAgentClusters(agents, camera.position, CLUSTER_THRESHOLD);

  // Convert individual agents to render data with positions
  const agentData: AgentData[] = useMemo(() => {
    return individualAgents
      .filter((agent) => agent.hex)
      .map((agent) => {
        const { x, z } = hexToPixel(agent.hex!.q, agent.hex!.r);
        const hexInfo = getHexInfo(agent.hex!.q, agent.hex!.r);
        const elevation = hexInfo?.elevation ?? 0;
        const hexTopSurface = elevation * ELEVATION_STEP + HEX_TILE_HEIGHT;
        const y = hexTopSurface + 0.02;
        return {
          id: agent.id,
          position: [x, y, z] as [number, number, number],
          status: agent.status,
        };
      });
  }, [individualAgents, getHexInfo, isInitialized]);

  if (agentData.length === 0 && clusters.length === 0) {
    return <CameraShake enabled={shakeEnabled} />;
  }

  return (
    <group name="agentLayer">
      {/* Non-invasive camera shake (reads trauma store; never edits ThreeScene). */}
      <CameraShake enabled={shakeEnabled} />

      {/* Individual agents rendered with full detail and animation */}
      {agentData.map((agent) => (
        <VoxelAgent
          key={agent.id}
          id={agent.id}
          position={agent.position}
          status={agent.status}
          isNewlyDeployed={newlyDeployedRef.current.has(agent.id)}
          particlesEnabled={particlesEnabled}
        />
      ))}

      {/* Clustered agents rendered as dark pile + shared amber core */}
      {clusters.map((cluster) => (
        <ClusterMarker key={cluster.key} cluster={cluster} />
      ))}
    </group>
  );
}

// Re-export for convenience / potential external consumers.
export { TOTAL_HEIGHT };
