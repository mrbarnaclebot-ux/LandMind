/**
 * AgentLayer - Renders all agents using InstancedMesh for performance
 * Minecraft-style blocky robots with mining animation
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAgentStore } from '../stores/agentStore';
import { hexToPixel, ELEVATION_STEP } from '../hex/hexMath';

// Agent visual config
const AGENT_SIZE = 0.25; // Small relative to hex
const AGENT_HEIGHT = 0.35;
const BOB_AMPLITUDE = 0.04;
const BOB_SPEED = 2;
const ROTATION_SPEED = 1;
const ROTATION_AMPLITUDE = 0.1;

// Colors
const USER_AGENT_COLOR = new THREE.Color('#4CAF50'); // Bright green for user's agents
const OTHER_AGENT_COLOR = new THREE.Color('#9E9E9E'); // Gray for others

interface AgentMeshData {
  id: string;
  position: [number, number, number];
  isOwned: boolean;
  status: 'MINING' | 'RELOCATING' | 'IDLE';
}

export function AgentLayer() {
  const { agents } = useAgentStore();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Convert agents to mesh data with positions
  const agentMeshData: AgentMeshData[] = useMemo(() => {
    return agents
      .filter((agent) => agent.hex) // Only agents with positions
      .map((agent) => {
        const { x, z } = hexToPixel(agent.hex!.q, agent.hex!.r);
        // Position slightly above hex surface
        const y = 0.5 * ELEVATION_STEP + AGENT_HEIGHT / 2;
        return {
          id: agent.id,
          position: [x, y, z] as [number, number, number],
          isOwned: true, // All user's agents for now
          status: agent.status,
        };
      });
  }, [agents]);

  // Create blocky robot geometry
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(AGENT_SIZE, AGENT_HEIGHT, AGENT_SIZE);
    // Flatten for pixel look
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Update instance matrices when agents change
  useEffect(() => {
    if (!meshRef.current) return;

    agentMeshData.forEach((agent, i) => {
      tempMatrix.makeTranslation(...agent.position);
      meshRef.current!.setMatrixAt(i, tempMatrix);

      // Set color based on ownership
      tempColor.copy(agent.isOwned ? USER_AGENT_COLOR : OTHER_AGENT_COLOR);
      meshRef.current!.setColorAt(i, tempColor);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [agentMeshData, tempMatrix, tempColor]);

  // Animate mining agents
  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    agentMeshData.forEach((agent, i) => {
      if (agent.status !== 'MINING') return;

      // Get base position
      const [baseX, baseY, baseZ] = agent.position;

      // Bobbing animation
      const bobOffset = Math.sin(clock.elapsedTime * BOB_SPEED + i * 0.7) * BOB_AMPLITUDE;

      // Slight rotation
      const rotation = Math.sin(clock.elapsedTime * ROTATION_SPEED + i * 0.5) * ROTATION_AMPLITUDE;

      tempMatrix.makeRotationY(rotation);
      tempMatrix.setPosition(baseX, baseY + bobOffset, baseZ);
      meshRef.current!.setMatrixAt(i, tempMatrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (agentMeshData.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, Math.max(agentMeshData.length, 1)]}
      frustumCulled={true}
    >
      <meshLambertMaterial
        vertexColors
        flatShading={true}
        emissiveIntensity={0.2}
      />
    </instancedMesh>
  );
}
