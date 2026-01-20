/**
 * ThreeScene - Main 3D scene component using react-three-fiber
 *
 * Sets up the Three.js Canvas with:
 * - OrbitControls for smooth camera navigation
 * - Proper lighting (ambient + directional)
 * - Sky background for visual polish
 * - HexWorld for terrain rendering
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { HexWorld } from './HexWorld';

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
 * Camera controls with isometric-friendly settings
 */
function CameraControls() {
  return (
    <OrbitControls
      // Start at nice isometric-ish angle
      minPolarAngle={Math.PI / 6} // Don't look straight down
      maxPolarAngle={Math.PI / 2.2} // Don't look horizontal
      // Zoom limits
      minDistance={10}
      maxDistance={100}
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

/**
 * Main Three.js scene component
 *
 * Provides Canvas with proper defaults and scene setup for the hex world.
 */
export function ThreeScene() {
  return (
    <Canvas
      camera={{
        position: [30, 40, 30],
        fov: 50,
        near: 0.1,
        far: 1000,
      }}
      style={{
        width: '100%',
        height: '100%',
        background: '#1a2533',
        display: 'block',
      }}
      gl={{ antialias: true }}
    >
      {/* Sky backdrop */}
      <Sky
        distance={450000}
        sunPosition={[50, 80, 30]}
        inclination={0.6}
        azimuth={0.25}
        rayleigh={0.5}
      />

      {/* Scene lighting */}
      <Lighting />

      {/* Camera controls */}
      <CameraControls />

      {/* The hex world terrain */}
      <HexWorld gridRadius={20} />
    </Canvas>
  );
}
