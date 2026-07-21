/**
 * AgentCluster - Clusters distant agents for performance
 *
 * When agents are beyond a distance threshold from camera:
 * - Groups agents within same spatial chunk
 * - Renders single cluster marker instead of individual agents
 * - Shows count badge on cluster marker
 *
 * Agents within threshold are passed through for individual rendering.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { CHUNK_SIZE } from './ChunkManager';
import { hexToPixel, HEX_TILE_HEIGHT } from '../hex/hexMath';

/** Agent data needed for clustering - compatible with lib/agents.ts Agent type */
export interface ClusterableAgent {
  id: string;
  hex?: { q: number; r: number } | null;
  status: 'MINING' | 'RELOCATING' | 'IDLE';
}

/** Cluster of agents at a position */
export interface AgentClusterData {
  key: string;
  agents: ClusterableAgent[];
  centerX: number;
  centerZ: number;
  count: number;
}

/** Result of clustering operation */
export interface ClusterResult {
  /** Agents close enough to render individually */
  individualAgents: ClusterableAgent[];
  /** Clusters of distant agents */
  clusters: AgentClusterData[];
}

/**
 * Get chunk key for an agent based on hex coordinates
 */
function getAgentChunkKey(q: number, r: number): string {
  const chunkX = Math.floor(q / CHUNK_SIZE);
  const chunkZ = Math.floor(r / CHUNK_SIZE);
  return `${chunkX},${chunkZ}`;
}

/**
 * Hook to cluster agents based on camera distance
 *
 * @param agents - All agents to potentially cluster
 * @param cameraPosition - Current camera position
 * @param threshold - Distance threshold for clustering (default 100)
 * @returns Object with individual agents and clusters
 */
export function useAgentClusters(
  agents: ClusterableAgent[],
  cameraPosition: THREE.Vector3,
  threshold = 100
): ClusterResult {
  return useMemo(() => {
    const individualAgents: ClusterableAgent[] = [];
    const distantAgents: ClusterableAgent[] = [];

    // First pass: separate by distance
    for (const agent of agents) {
      if (!agent.hex) continue;

      const { x, z } = hexToPixel(agent.hex.q, agent.hex.r);
      const dx = x - cameraPosition.x;
      const dz = z - cameraPosition.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < threshold) {
        individualAgents.push(agent);
      } else {
        distantAgents.push(agent);
      }
    }

    // Second pass: cluster distant agents by chunk
    const clusterMap = new Map<string, ClusterableAgent[]>();

    for (const agent of distantAgents) {
      if (!agent.hex) continue;

      const key = getAgentChunkKey(agent.hex.q, agent.hex.r);
      if (!clusterMap.has(key)) {
        clusterMap.set(key, []);
      }
      clusterMap.get(key)!.push(agent);
    }

    // Convert to cluster data with center positions
    const clusters: AgentClusterData[] = [];

    for (const [key, clusterAgents] of Array.from(clusterMap.entries())) {
      if (clusterAgents.length === 0) continue;

      // Calculate cluster center
      let sumX = 0;
      let sumZ = 0;
      for (const agent of clusterAgents) {
        if (!agent.hex) continue;
        const { x, z } = hexToPixel(agent.hex.q, agent.hex.r);
        sumX += x;
        sumZ += z;
      }

      clusters.push({
        key,
        agents: clusterAgents,
        centerX: sumX / clusterAgents.length,
        centerZ: sumZ / clusterAgents.length,
        count: clusterAgents.length,
      });
    }

    return { individualAgents, clusters };
  }, [agents, cameraPosition.x, cameraPosition.y, cameraPosition.z, threshold]);
}

/**
 * Cluster marker appearance — Golden-Hour Dusk: a small pile of dark matte agent bodies
 * with ONE shared amber core glow (the only bloomer). No gold metallic sphere, no pointLight.
 */
const BODY_DARK = '#232838'; // deep indigo-charcoal (matches AgentLayer body)
const CORE_AMBER = '#F0A63C'; // shared amber core — the only bloomer
const LABEL_AMBER = '#F0A63C'; // count label amber-on-dark
const LABEL_OUTLINE = '#14161F'; // near-black indigo (UI ground tone)
const MIN_SCALE = 0.6;
const MAX_SCALE = 1.8;

/**
 * Calculate cluster marker scale based on agent count
 */
function getClusterScale(count: number): number {
  // Scale logarithmically: 1 -> 0.6, 5 -> ~1.1, 20+ -> 1.8
  const scale = MIN_SCALE + (Math.log10(count + 1) / Math.log10(21)) * (MAX_SCALE - MIN_SCALE);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

interface ClusterMarkerProps {
  cluster: AgentClusterData;
}

/**
 * Deterministic stacked-pile offsets so the pile reads as a huddle rather than random noise.
 * Kept small and fixed (no Math.random) for stable frames.
 */
const PILE_OFFSETS: Array<[number, number, number, number]> = [
  // [x, y, z, scale]
  [0, 0, 0, 0.42],
  [0.28, 0, 0.12, 0.36],
  [-0.26, 0, 0.16, 0.34],
  [0.05, 0, -0.28, 0.32],
  [-0.14, 0.34, -0.02, 0.3],
];

/**
 * ClusterMarker - renders a cluster as a small pile of dark matte bodies sharing one amber core.
 */
export function ClusterMarker({ cluster }: ClusterMarkerProps) {
  const scale = getClusterScale(cluster.count);
  // How many bodies to show in the pile scales gently with count (max = pile slots).
  const bodyCount = Math.min(PILE_OFFSETS.length, Math.max(2, Math.ceil(Math.log2(cluster.count + 1))));

  return (
    <group position={[cluster.centerX, HEX_TILE_HEIGHT + 0.02, cluster.centerZ]} scale={[scale, scale, scale]}>
      {/* Pile of dark matte agent bodies */}
      {PILE_OFFSETS.slice(0, bodyCount).map((o, i) => (
        <mesh key={i} position={[o[0], o[3] * 0.5 + o[1], o[2]]} castShadow>
          <boxGeometry args={[o[3] * 0.8, o[3], o[3] * 0.55]} />
          <meshStandardMaterial color={BODY_DARK} roughness={0.95} metalness={0.0} />
        </mesh>
      ))}

      {/* Single shared amber core glow — the ONLY bloomer on the cluster. */}
      <mesh position={[0, 0.3, 0.16]}>
        <boxGeometry args={[0.16, 0.16, 0.12]} />
        <meshStandardMaterial
          color="#3A2A12"
          emissive={CORE_AMBER}
          emissiveIntensity={1.4}
          toneMapped={false}
          roughness={0.4}
          metalness={0.0}
        />
      </mesh>

      {/* Count label — amber on dark */}
      <Text
        position={[0, 1.05, 0]}
        fontSize={0.42}
        color={LABEL_AMBER}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.045}
        outlineColor={LABEL_OUTLINE}
      >
        x{cluster.count}
      </Text>
    </group>
  );
}
