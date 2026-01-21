/**
 * HeatMapOverlay - Visualizes resource values across hex grid
 * Uses InstancedMesh with per-instance colors for efficient GPU rendering
 *
 * Heat colors:
 * - Blue (cold) = IRON (0.2)
 * - Cyan = COPPER (0.4)
 * - Green = SILVER (0.6)
 * - Yellow = GOLD (0.8)
 * - Red (hot) = GOLD max (1.0)
 * - Transparent = EMPTY (0.0)
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHexStore, type ResourceType } from '../stores/hexStore';
import { hexToPixel, ELEVATION_STEP } from '../hex/hexMath';
import { createHexGeometry } from '../hex/hexMesh';

interface HeatMapOverlayProps {
  /** Whether the heat map is visible */
  visible: boolean;
  /** Animation duration in seconds */
  fadeDuration?: number;
}

/**
 * Resource type to heat value mapping
 */
const RESOURCE_HEAT: Record<ResourceType, number> = {
  GOLD: 1.0,
  SILVER: 0.6,
  COPPER: 0.4,
  IRON: 0.2,
  NONE: 0.0,
};

/**
 * Convert heat value (0-1) to color using a cold-to-hot gradient
 * Blue (0.0) -> Cyan (0.25) -> Green (0.5) -> Yellow (0.75) -> Red (1.0)
 */
function heatToColor(heat: number): THREE.Color {
  const color = new THREE.Color();

  if (heat <= 0) {
    // Transparent/empty - use very dark blue with low visibility
    color.setRGB(0.1, 0.1, 0.2);
  } else if (heat <= 0.25) {
    // Blue to Cyan
    const t = heat / 0.25;
    color.setRGB(0, t, 1);
  } else if (heat <= 0.5) {
    // Cyan to Green
    const t = (heat - 0.25) / 0.25;
    color.setRGB(0, 1, 1 - t);
  } else if (heat <= 0.75) {
    // Green to Yellow
    const t = (heat - 0.5) / 0.25;
    color.setRGB(t, 1, 0);
  } else {
    // Yellow to Red
    const t = (heat - 0.75) / 0.25;
    color.setRGB(1, 1 - t, 0);
  }

  return color;
}

// Hex tile height (must match HexWorld)
const HEX_TILE_HEIGHT = 0.35;
// Height offset above hex surface
const OVERLAY_HEIGHT_OFFSET = 0.15;

/**
 * HeatMapOverlay component
 * Renders colored hex overlays showing resource heat values
 */
export function HeatMapOverlay({ visible, fadeDuration = 0.3 }: HeatMapOverlayProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const currentOpacityRef = useRef(0);

  const { hexes, isInitialized } = useHexStore();

  // Convert hex store to array for processing
  const hexArray = useMemo(() => {
    if (!isInitialized) return [];
    return Array.from(hexes.values());
  }, [hexes, isInitialized]);

  // Create geometry for overlay hexes (thin, flat)
  const geometry = useMemo(() => {
    return createHexGeometry({
      size: 0.85, // Slightly smaller than terrain hex for visual separation
      height: 0.05, // Very thin overlay
      skirtDepth: 0.0, // No skirt needed
    });
  }, []);

  // Create instance matrices and colors
  const { matrices, colors, count } = useMemo(() => {
    if (hexArray.length === 0) {
      return { matrices: new Float32Array(0), colors: new Float32Array(0), count: 0 };
    }

    // Filter out hexes with no resources (NONE type)
    const resourceHexes = hexArray.filter((hex) => hex.resourceType !== 'NONE');
    const count = resourceHexes.length;

    const matrices = new Float32Array(count * 16);
    const colors = new Float32Array(count * 3);
    const tempMatrix = new THREE.Matrix4();

    resourceHexes.forEach((hex, i) => {
      // Position
      const { x, z } = hexToPixel(hex.q, hex.r);
      const y = hex.elevation * ELEVATION_STEP + HEX_TILE_HEIGHT + OVERLAY_HEIGHT_OFFSET;
      tempMatrix.makeTranslation(x, y, z);
      tempMatrix.toArray(matrices, i * 16);

      // Color based on resource heat
      const heat = RESOURCE_HEAT[hex.resourceType];
      const color = heatToColor(heat);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });

    return { matrices, colors, count };
  }, [hexArray]);

  // Apply matrices and colors when mesh is available
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Set matrix
      tempMatrix.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, tempMatrix);

      // Set color
      tempColor.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
      mesh.setColorAt(i, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [matrices, colors, count]);

  // Animate opacity for fade in/out
  useFrame((_, delta) => {
    if (!materialRef.current) return;

    const targetOpacity = visible ? 0.7 : 0;
    const speed = 1 / fadeDuration;

    if (currentOpacityRef.current !== targetOpacity) {
      if (visible) {
        currentOpacityRef.current = Math.min(currentOpacityRef.current + delta * speed, targetOpacity);
      } else {
        currentOpacityRef.current = Math.max(currentOpacityRef.current - delta * speed, 0);
      }
      materialRef.current.opacity = currentOpacityRef.current;
    }
  });

  // Don't render if no hexes or fully faded out
  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      frustumCulled={true}
      visible={visible || currentOpacityRef.current > 0}
    >
      <meshBasicMaterial
        ref={materialRef}
        transparent={true}
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors={true}
      />
    </instancedMesh>
  );
}
