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
import { hexToPixel } from '../hex/hexMath';

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
 * Cluster marker appearance
 */
const CLUSTER_COLOR = '#FFD700'; // Golden
const CLUSTER_EMISSIVE = '#FFA500';
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;

/**
 * Calculate cluster marker scale based on agent count
 */
function getClusterScale(count: number): number {
  // Scale logarithmically: 1 -> 0.5, 5 -> 1.0, 20+ -> 2.0
  const scale = MIN_SCALE + (Math.log10(count + 1) / Math.log10(21)) * (MAX_SCALE - MIN_SCALE);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

interface ClusterMarkerProps {
  cluster: AgentClusterData;
}

/**
 * ClusterMarker - renders a single cluster as golden sphere with count
 */
export function ClusterMarker({ cluster }: ClusterMarkerProps) {
  const scale = getClusterScale(cluster.count);

  return (
    <group position={[cluster.centerX, 1.5, cluster.centerZ]}>
      {/* Golden sphere */}
      <mesh scale={[scale, scale, scale]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color={CLUSTER_COLOR}
          emissive={CLUSTER_EMISSIVE}
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>

      {/* Count label */}
      <Text
        position={[0, scale * 0.6 + 0.3, 0]}
        fontSize={0.4}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        x{cluster.count}
      </Text>

      {/* Glow effect */}
      <pointLight
        color={CLUSTER_COLOR}
        intensity={0.5 * scale}
        distance={3}
      />
    </group>
  );
}
