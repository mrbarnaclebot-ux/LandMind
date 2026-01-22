/**
 * ThreeScene - Main 3D scene component using react-three-fiber
 *
 * Sets up the Three.js Canvas with:
 * - OrbitControls for smooth camera navigation
 * - Proper lighting (ambient + directional)
 * - Sky background for visual polish
 * - ChunkedHexWorld for scalable terrain rendering (LOD + chunking)
 * - AgentLayer for agent visualization
 * - HexTooltip for hover information
 * - Camera panning support via store
 * - PerformanceAdapter for adaptive quality
 */

import { useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { ChunkedHexWorld } from '../rendering/ChunkedHexWorld';
import { PerformanceAdapter } from '../rendering/PerformanceAdapter';
import { AgentLayer } from './AgentLayer';
import { HeatMapOverlay } from './HeatMapOverlay';
import { HexTooltip, useHexHover } from './HexTooltip';
import { Clouds } from './Clouds';
import { useUserAgents } from '../hooks/useUserAgents';
import { useCameraStore } from '../stores/cameraStore';

interface ThreeSceneProps {
  /** Whether the heat map overlay is visible */
  heatMapVisible?: boolean;
}

/**
 * Scene lighting component - bright and contrasty for Minecraft-style look
 * Higher contrast lighting makes the beveled edges pop and colors vibrant
 */
function Lighting() {
  return (
    <>
      {/* Ambient light - higher for better color visibility */}
      <ambientLight intensity={0.6} color="#ffffff" />

      {/* Main directional "sun" light - bright white for color accuracy */}
      <directionalLight
        position={[50, 100, 30]}
        intensity={1.8}
        color="#ffffff"
        castShadow={false}
      />

      {/* Secondary fill light - subtle warm fill from opposite side */}
      <directionalLight
        position={[-30, 50, -20]}
        intensity={0.4}
        color="#fff0d0"
      />
    </>
  );
}

/**
 * Camera controls with isometric-friendly settings and pan-to support
 */
function CameraControls() {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const { targetPosition, clearTarget } = useCameraStore();

  // Smoothly pan camera to target position
  useFrame(() => {
    if (!controlsRef.current || !targetPosition) return;

    const controls = controlsRef.current;
    const target = controls.target as THREE.Vector3;

    // Lerp target position
    const lerpFactor = 0.08;
    target.x += (targetPosition.x - target.x) * lerpFactor;
    target.y += (targetPosition.y - target.y) * lerpFactor;
    target.z += (targetPosition.z - target.z) * lerpFactor;

    // Also move camera to maintain relative position
    const currentOffset = new THREE.Vector3().subVectors(camera.position, target);
    const desiredOffset = currentOffset.clone().normalize().multiplyScalar(25); // Fixed distance

    camera.position.x += (targetPosition.x + desiredOffset.x - camera.position.x) * lerpFactor;
    camera.position.y += (targetPosition.y + desiredOffset.y + 15 - camera.position.y) * lerpFactor;
    camera.position.z += (targetPosition.z + desiredOffset.z - camera.position.z) * lerpFactor;

    controls.update();

    // Check if close enough to clear target
    const distance = Math.sqrt(
      Math.pow(target.x - targetPosition.x, 2) +
      Math.pow(target.z - targetPosition.z, 2)
    );
    if (distance < 0.5) {
      clearTarget();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      // Start at nice isometric-ish angle
      minPolarAngle={Math.PI / 6} // Don't look straight down
      maxPolarAngle={Math.PI / 2.2} // Don't look horizontal
      // Zoom limits - extended for large worlds
      minDistance={10}
      maxDistance={500}
      // Smooth damping
      enableDamping={true}
      dampingFactor={0.1}
      // Pan settings
      enablePan={true}
      panSpeed={1.5}
      screenSpacePanning={true}
      // Mouse buttons: left=rotate, right=pan, middle=zoom
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}

// Grid radius from env var (default 500 for ~1M hexes, use 20 for dev)
const GRID_RADIUS = parseInt(import.meta.env.VITE_HEX_GRID_RADIUS || '20', 10);
// Approximate size of grid in world units (hex spacing is ~1.732)
const GRID_SIZE = GRID_RADIUS * 2 * 1.732 + 5;

/**
 * Invisible ground plane for capturing pointer events across the entire hex grid
 */
function PointerCaptureGround({
  onPointerMove,
  onPointerLeave,
}: {
  onPointerMove: (e: any) => void;
  onPointerLeave: () => void;
}) {
  return (
    <mesh
      position={[0, 0.01, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/**
 * Inner scene content - uses R3F hooks for agents and hover
 */
function SceneContent({ heatMapVisible = false }: { heatMapVisible?: boolean }) {
  // Initialize agent loading and subscription
  useUserAgents();

  // Hex hover state for tooltip
  const { hoveredHex, handlePointerMove, handlePointerLeave } = useHexHover();

  return (
    <>
      {/* Sky backdrop */}
      <Sky
        distance={450000}
        sunPosition={[50, 80, 30]}
        inclination={0.6}
        azimuth={0.25}
        rayleigh={0.5}
      />

      {/* Minecraft-style blocky clouds */}
      <Clouds count={18} height={55} spread={90} speed={0.8} />

      {/* Scene lighting */}
      <Lighting />

      {/* Camera controls */}
      <CameraControls />

      {/* Invisible ground for pointer events */}
      <PointerCaptureGround
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      />

      {/* Hex world terrain - chunked for scalability */}
      <ChunkedHexWorld gridRadius={GRID_RADIUS} />

      {/* Heat map overlay for resource visualization */}
      <HeatMapOverlay visible={heatMapVisible} />

      {/* Agents rendered on hexes */}
      <AgentLayer />

      {/* Tooltip shown on hex hover */}
      <HexTooltip visible={hoveredHex !== null} hexInfo={hoveredHex} />
    </>
  );
}

/**
 * Main Three.js scene component
 *
 * Provides Canvas with proper defaults and scene setup for the hex world.
 * Wraps content with PerformanceAdapter for adaptive quality.
 */
export function ThreeScene({ heatMapVisible = false }: ThreeSceneProps) {
  // Get DPR from performance settings (updated by PerformanceAdapter)
  const dpr = typeof window !== 'undefined'
    ? Math.min(window.devicePixelRatio, 2)
    : 1;

  return (
    <Canvas
      camera={{
        position: [30, 40, 30],
        fov: 50,
        near: 0.1,
        far: 2000, // Increased for larger world
      }}
      style={{
        width: '100%',
        height: '100%',
        background: '#1a2533',
        display: 'block',
      }}
      gl={{ antialias: true }}
      dpr={dpr}
    >
      <PerformanceAdapter>
        <SceneContent heatMapVisible={heatMapVisible} />
      </PerformanceAdapter>
    </Canvas>
  );
}
