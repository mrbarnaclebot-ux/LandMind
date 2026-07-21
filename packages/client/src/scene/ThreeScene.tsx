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
 * - Mobile touch controls and optimizations
 */

import { useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  ToneMapping,
  HueSaturation,
  Vignette,
  SMAA,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { ChunkedHexWorld } from '../rendering/ChunkedHexWorld';
import { PerformanceAdapter } from '../rendering/PerformanceAdapter';
import { AgentLayer } from './AgentLayer';
import { HeatMapOverlay } from './HeatMapOverlay';
import { HexTooltip, useHexHover } from './HexTooltip';
import { Clouds } from './Clouds';
import { useUserAgents } from '../hooks/useUserAgents';
import { useCameraStore } from '../stores/cameraStore';
import { useMobile } from '../hooks/useMobile';

interface ThreeSceneProps {
  /** Whether the heat map overlay is visible */
  heatMapVisible?: boolean;
}

/**
 * Quality level type - synced with MobileLayout QualitySettings
 */
type QualityLevel = 'low' | 'medium' | 'high';

/**
 * Get quality settings based on level
 */
function getQualitySettings(level: QualityLevel, isMobile: boolean) {
  const baseDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

  switch (level) {
    case 'low':
      return {
        dpr: Math.min(baseDpr, 1),
        cloudsEnabled: false,
        effectsEnabled: false,
        shadows: false,
      };
    case 'medium':
      return {
        dpr: Math.min(baseDpr, isMobile ? 1.5 : 2),
        cloudsEnabled: true,
        effectsEnabled: !isMobile,
        shadows: false,
      };
    case 'high':
      return {
        dpr: Math.min(baseDpr, 2),
        cloudsEnabled: true,
        effectsEnabled: true,
        shadows: true,
      };
    default:
      return {
        dpr: Math.min(baseDpr, isMobile ? 1.5 : 2),
        cloudsEnabled: true,
        effectsEnabled: !isMobile,
        shadows: false,
      };
  }
}

/**
 * Scene lighting — "Golden-Hour Dusk" (ART-DIRECTION.md).
 *  - low warm sun #FFB86B intensity 2.4 at ~22° elevation (long cool shadows)
 *  - cool ambient #4A5A78 0.45 (no black shadows)
 *  - PCFSoft shadows, frustum ±80, mapSize 2048, bias -0.0005, normalBias 0.02
 */
function Lighting({ shadows }: { shadows: boolean }) {
  const sunRef = useRef<THREE.DirectionalLight>(null);

  // ~22° elevation warm sun. Distance chosen so the ortho frustum ±80 covers the
  // near world while keeping long shadows.
  const sunDist = 120;
  const elevRad = (22 * Math.PI) / 180;
  const sunPos: [number, number, number] = [
    Math.cos(elevRad) * sunDist * 0.8,
    Math.sin(elevRad) * sunDist,
    Math.cos(elevRad) * sunDist * 0.6,
  ];

  useEffect(() => {
    const sun = sunRef.current;
    if (!sun) return;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.camera.updateProjectionMatrix();
  }, []);

  return (
    <>
      {/* Cool ambient fill so crevices stay indigo, never black. */}
      <ambientLight intensity={0.45} color="#4A5A78" />

      {/* Low warm sun. */}
      <directionalLight
        ref={sunRef}
        position={sunPos}
        intensity={2.4}
        color="#FFB86B"
        castShadow={shadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
    </>
  );
}

/**
 * DuskEnvironment — sets NeutralToneMapping + exposure, SRGB output, PCFSoft
 * shadow map, and the warm horizon fog. Fog color MUST equal the sky horizon
 * band (#E8A26B), linear 50 → 320.
 */
function DuskEnvironment({ shadows }: { shadows: boolean }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    // three r182 supports NeutralToneMapping.
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = 0.95;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = shadows;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;

    scene.fog = new THREE.Fog('#E8A26B', 50, 320);
    scene.background = new THREE.Color('#E8A26B');

    return () => {
      scene.fog = null;
    };
  }, [gl, scene, shadows]);

  return null;
}

/**
 * Camera controls with isometric-friendly settings, pan-to support, and mobile touch
 */
function CameraControls({ isMobile }: { isMobile: boolean }) {
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
      // Explicitly enable all controls
      enabled={true}
      enableRotate={true}
      enableZoom={true}
      enablePan={true}
      // Start at nice isometric-ish angle
      minPolarAngle={Math.PI / 6} // Don't look straight down
      maxPolarAngle={isMobile ? Math.PI / 2.1 : Math.PI / 2.2} // Slightly higher on mobile
      // Zoom limits - extended for large worlds
      minDistance={10}
      maxDistance={500}
      // Smooth damping
      enableDamping={true}
      dampingFactor={0.1}
      // Pan/rotate speeds
      panSpeed={1.5}
      rotateSpeed={0.8}
      screenSpacePanning={true}
      // Mouse buttons: left=rotate, right=pan, middle=zoom
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      // Touch settings: single finger rotate, two fingers zoom/pan
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      // Make sure controls handle events properly
      makeDefault
    />
  );
}

// Grid radius from env var (default 500 for ~1M hexes, use 20 for dev)
const GRID_RADIUS = parseInt(import.meta.env.VITE_HEX_GRID_RADIUS || '20', 10);
// Approximate size of grid in world units (hex spacing is ~1.732)
const GRID_SIZE = GRID_RADIUS * 2 * 1.732 + 5;

/**
 * Invisible ground plane for capturing pointer events across the entire hex grid
 * Only captures hover events - pointer-events-type="listener" prevents blocking OrbitControls
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
function SceneContent({
  heatMapVisible = false,
  isMobile,
  cloudsEnabled,
  effectsEnabled,
  shadows,
}: {
  heatMapVisible?: boolean;
  isMobile: boolean;
  cloudsEnabled: boolean;
  effectsEnabled: boolean;
  shadows: boolean;
}) {
  // Initialize agent loading and subscription
  useUserAgents();

  // Hex hover state for tooltip
  const { hoveredHex, handlePointerMove, handlePointerLeave } = useHexHover();

  return (
    <>
      {/* Dusk tone mapping, fog, shadow map config */}
      <DuskEnvironment shadows={shadows} />

      {/* Dusk sky: low warm sun near the horizon, zenith deep indigo. */}
      <Sky
        distance={450000}
        sunPosition={[80, 18, 40]}
        inclination={0.49}
        azimuth={0.25}
        rayleigh={2.2}
        turbidity={9}
        mieCoefficient={0.006}
        mieDirectionalG={0.85}
      />

      {/* Dusk-tinted blocky clouds - disabled on low quality */}
      {cloudsEnabled && (
        <Clouds count={isMobile ? 10 : 20} height={40} spread={120} speed={0.6} />
      )}

      {/* Scene lighting */}
      <Lighting shadows={shadows} />

      {/* Camera controls with mobile touch support */}
      <CameraControls isMobile={isMobile} />

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

      {/* Post chain: Bloom → ToneMapping → HueSaturation → Vignette → SMAA.
          Tonemapping lives in the composer (gl tonemapping is bypassed by it). */}
      {effectsEnabled && (
        <EffectComposer enableNormalPass={false} multisampling={0}>
          <Bloom
            mipmapBlur
            intensity={0.5}
            luminanceThreshold={0.9}
            luminanceSmoothing={0.05}
          />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          <HueSaturation saturation={-0.06} />
          <Vignette offset={0.25} darkness={0.7} />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}

/**
 * Main Three.js scene component
 *
 * Provides Canvas with proper defaults and scene setup for the hex world.
 * Wraps content with PerformanceAdapter for adaptive quality.
 * Includes mobile optimizations and user-selectable quality settings.
 */
export function ThreeScene({ heatMapVisible = false }: ThreeSceneProps) {
  const { isMobile } = useMobile();

  // Quality state from localStorage or default
  const [quality, setQuality] = useState<QualityLevel>(() => {
    const stored = localStorage.getItem('qualityLevel');
    return (stored as QualityLevel) || 'medium';
  });

  // Listen for quality change events from settings panel
  useEffect(() => {
    const handleQualityChange = (e: CustomEvent<QualityLevel>) => {
      setQuality(e.detail);
    };

    window.addEventListener('qualityChange', handleQualityChange as EventListener);
    return () => window.removeEventListener('qualityChange', handleQualityChange as EventListener);
  }, []);

  // Get quality settings
  const settings = getQualitySettings(quality, isMobile);

  return (
    <Canvas
      // `flat` prevents R3F from forcing ACESFilmic tone mapping; DuskEnvironment
      // sets NeutralToneMapping + exposure explicitly.
      flat
      shadows={settings.shadows ? 'soft' : false}
      camera={{
        position: [30, 40, 30],
        fov: 50,
        near: 0.1,
        far: 2000, // Increased for larger world
      }}
      style={{
        width: '100%',
        height: '100%',
        background: '#E8A26B', // dusk horizon (matches fog)
        display: 'block',
        touchAction: isMobile ? 'none' : 'auto', // Prevent browser gestures on mobile
      }}
      gl={{
        antialias: false, // SMAA handles AA in the composer
        powerPreference: isMobile ? 'default' : 'high-performance',
      }}
      dpr={settings.dpr}
      className={isMobile ? 'mobile-canvas' : ''}
    >
      <PerformanceAdapter>
        <SceneContent
          heatMapVisible={heatMapVisible}
          isMobile={isMobile}
          cloudsEnabled={settings.cloudsEnabled}
          effectsEnabled={settings.effectsEnabled}
          shadows={settings.shadows}
        />
      </PerformanceAdapter>
    </Canvas>
  );
}
