/**
 * AgentLayer - Renders all agents as Minecraft-style voxel robots
 * Features body + head blocks with mining animation and glow effects
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAgentStore } from '../stores/agentStore';
import { useHexStore } from '../stores/hexStore';
import { hexToPixel, ELEVATION_STEP } from '../hex/hexMath';

// Agent visual config - more visible sizes
const BODY_WIDTH = 0.4;
const BODY_HEIGHT = 0.5;
const BODY_DEPTH = 0.25;
const HEAD_SIZE = 0.35;
const TOTAL_HEIGHT = BODY_HEIGHT + HEAD_SIZE * 0.8; // Head sits slightly into body

// Animation config
const BOB_AMPLITUDE = 0.08;
const BOB_SPEED = 3;
const ROTATION_SPEED = 1.5;
const ROTATION_AMPLITUDE = 0.15;

// Colors - bright and glowing
const AGENT_BODY_COLOR = new THREE.Color('#2E7D32'); // Dark green body
const AGENT_HEAD_COLOR = new THREE.Color('#4CAF50'); // Lighter green head
const AGENT_EMISSIVE = new THREE.Color('#00FF41'); // Bright green glow

interface AgentData {
  id: string;
  position: [number, number, number];
  status: 'MINING' | 'RELOCATING' | 'IDLE';
}

/**
 * Single voxel robot agent component
 */
function VoxelAgent({ position, status, index }: {
  position: [number, number, number];
  status: string;
  index: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Animate the agent
  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const time = clock.elapsedTime;
    const offset = index * 0.7; // Phase offset per agent

    if (status === 'MINING') {
      // Bobbing animation
      const bobOffset = Math.sin(time * BOB_SPEED + offset) * BOB_AMPLITUDE;
      groupRef.current.position.y = position[1] + bobOffset;

      // Rotation wiggle
      const rotation = Math.sin(time * ROTATION_SPEED + offset) * ROTATION_AMPLITUDE;
      groupRef.current.rotation.y = rotation;
    } else if (status === 'RELOCATING') {
      // Faster movement animation
      const bobOffset = Math.sin(time * BOB_SPEED * 2 + offset) * BOB_AMPLITUDE * 0.5;
      groupRef.current.position.y = position[1] + bobOffset;
      groupRef.current.rotation.y = time * 2; // Spin while relocating
    }
  });

  const emissiveIntensity = status === 'MINING' ? 0.4 : status === 'RELOCATING' ? 0.6 : 0.2;

  return (
    <group ref={groupRef} position={position}>
      {/* Body - wider and taller box */}
      <mesh position={[0, BODY_HEIGHT / 2, 0]}>
        <boxGeometry args={[BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH]} />
        <meshStandardMaterial
          color={AGENT_BODY_COLOR}
          emissive={AGENT_EMISSIVE}
          emissiveIntensity={emissiveIntensity}
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      {/* Head - smaller cube on top */}
      <mesh position={[0, BODY_HEIGHT + HEAD_SIZE * 0.3, 0]}>
        <boxGeometry args={[HEAD_SIZE, HEAD_SIZE, HEAD_SIZE]} />
        <meshStandardMaterial
          color={AGENT_HEAD_COLOR}
          emissive={AGENT_EMISSIVE}
          emissiveIntensity={emissiveIntensity + 0.1}
          roughness={0.6}
          metalness={0.3}
        />
      </mesh>

      {/* Eyes - small dark spots */}
      <mesh position={[0.08, BODY_HEIGHT + HEAD_SIZE * 0.35, HEAD_SIZE / 2 + 0.01]}>
        <boxGeometry args={[0.06, 0.06, 0.02]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh position={[-0.08, BODY_HEIGHT + HEAD_SIZE * 0.35, HEAD_SIZE / 2 + 0.01]}>
        <boxGeometry args={[0.06, 0.06, 0.02]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Arms - small boxes on sides (only when mining) */}
      {status === 'MINING' && (
        <>
          <mesh position={[BODY_WIDTH / 2 + 0.08, BODY_HEIGHT * 0.6, 0]} rotation={[0, 0, -0.3]}>
            <boxGeometry args={[0.1, 0.3, 0.1]} />
            <meshStandardMaterial
              color={AGENT_BODY_COLOR}
              emissive={AGENT_EMISSIVE}
              emissiveIntensity={emissiveIntensity}
              roughness={0.8}
            />
          </mesh>
          <mesh position={[-BODY_WIDTH / 2 - 0.08, BODY_HEIGHT * 0.6, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.1, 0.3, 0.1]} />
            <meshStandardMaterial
              color={AGENT_BODY_COLOR}
              emissive={AGENT_EMISSIVE}
              emissiveIntensity={emissiveIntensity}
              roughness={0.8}
            />
          </mesh>
        </>
      )}

      {/* Mining indicator - floating pickaxe particles when mining */}
      {status === 'MINING' && (
        <pointLight
          position={[0, TOTAL_HEIGHT + 0.3, 0]}
          color="#00FF41"
          intensity={0.5}
          distance={2}
        />
      )}
    </group>
  );
}

// Hex tile geometry constants (match HexWorld)
const HEX_TILE_HEIGHT = 0.35;

export function AgentLayer() {
  const { agents } = useAgentStore();
  const { getHexInfo, isInitialized } = useHexStore();

  console.log('[AgentLayer] Rendering with agents:', agents.length, agents);

  // Convert agents to render data with positions
  const agentData: AgentData[] = useMemo(() => {
    console.log('[AgentLayer] Processing agents, total:', agents.length);
    const filtered = agents.filter((agent) => agent.hex);
    console.log('[AgentLayer] Agents with hex:', filtered.length);
    return filtered // Only agents with positions
      .map((agent) => {
        const { x, z } = hexToPixel(agent.hex!.q, agent.hex!.r);

        // Get hex elevation from store
        const hexInfo = getHexInfo(agent.hex!.q, agent.hex!.r);
        const elevation = hexInfo?.elevation ?? 0;

        // Position on top of hex tile surface
        // Hex geometry places top face at y=height (0.35), not y=height/2
        // Agent should stand on top with feet at surface
        const hexTopSurface = elevation * ELEVATION_STEP + HEX_TILE_HEIGHT;
        const y = hexTopSurface + 0.02; // Small offset above surface

        return {
          id: agent.id,
          position: [x, y, z] as [number, number, number],
          status: agent.status,
        };
      });
  }, [agents, getHexInfo, isInitialized]);

  if (agentData.length === 0) {
    return null;
  }

  return (
    <group name="agentLayer">
      {agentData.map((agent, index) => (
        <VoxelAgent
          key={agent.id}
          position={agent.position}
          status={agent.status}
          index={index}
        />
      ))}
    </group>
  );
}
