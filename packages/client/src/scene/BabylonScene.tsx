import { Engine, Scene, SceneEventArgs } from 'react-babylonjs';
import { Vector3, Color3 } from '@babylonjs/core';
import { useEffect, useRef, useCallback } from 'react';
import {
  setupIsometricCamera,
  attachZoomHandler,
  updateCameraAspectRatio,
} from '../camera/isometricCamera';
import { HexWorld } from './HexWorld';

// Static constants for scene configuration - defined once at module level
// This prevents React re-renders from creating new object references
const SCENE_CLEAR_COLOR = new Color3(0.45, 0.65, 0.85).toColor4();
const SCENE_AMBIENT_COLOR = new Color3(0.4, 0.4, 0.5);
const HEMISPHERE_DIRECTION = Vector3.Up();
const HEMISPHERE_DIFFUSE = new Color3(0.8, 0.85, 0.95);
const HEMISPHERE_GROUND = new Color3(0.3, 0.35, 0.25);
const SUN_DIRECTION = new Vector3(-1, -2, -1);
const SUN_DIFFUSE = new Color3(1.0, 0.95, 0.85);

export function BabylonSceneComponent() {
  const cleanupRef = useRef<(() => void) | null>(null);

  const onSceneMount = useCallback(({ scene, canvas }: SceneEventArgs) => {
    // Setup isometric camera with orthographic projection
    const camera = setupIsometricCamera(scene, canvas);

    // Attach custom zoom handler for orthographic mode
    const cleanupZoom = attachZoomHandler(scene, camera, canvas);

    // Handle window resize to maintain aspect ratio
    const handleResize = () => {
      updateCameraAspectRatio(camera, canvas);
    };
    window.addEventListener('resize', handleResize);

    // Store cleanup function
    cleanupRef.current = () => {
      cleanupZoom();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return (
    <Engine antialias adaptToDeviceRatio canvasId="babylon-canvas">
      <Scene
        clearColor={SCENE_CLEAR_COLOR}
        ambientColor={SCENE_AMBIENT_COLOR}
        onSceneMount={onSceneMount}
      >
        {/* Ambient fill light - soft blue sky tones */}
        <hemisphericLight
          name="ambient"
          intensity={0.5}
          direction={HEMISPHERE_DIRECTION}
          diffuse={HEMISPHERE_DIFFUSE}
          groundColor={HEMISPHERE_GROUND}
        />
        {/* Main sun light - bright warm directional */}
        <directionalLight
          name="sun"
          intensity={1.5}
          direction={SUN_DIRECTION}
          diffuse={SUN_DIFFUSE}
        />
        <HexWorld gridRadius={30} />
      </Scene>
    </Engine>
  );
}
