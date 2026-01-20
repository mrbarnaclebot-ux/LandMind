import { Engine, Scene, SceneEventArgs } from 'react-babylonjs';
import { Vector3, Color3 } from '@babylonjs/core';
import { useEffect, useRef, useCallback } from 'react';
import {
  setupIsometricCamera,
  attachZoomHandler,
  updateCameraAspectRatio,
} from '../camera/isometricCamera';
import { HexWorld } from './HexWorld';

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
        clearColor={new Color3(0.15, 0.18, 0.25).toColor4()}
        onSceneMount={onSceneMount}
      >
        {/* Ambient fill light - cool blue tones for sky reflection */}
        <hemisphericLight
          name="ambient"
          intensity={0.3}
          direction={Vector3.Up()}
          diffuse={new Color3(0.7, 0.75, 0.9)}
          groundColor={new Color3(0.2, 0.2, 0.25)}
        />
        {/* Main sun light - warm directional from upper right */}
        <directionalLight
          name="sun"
          intensity={1.2}
          direction={new Vector3(-1, -2, -1)}
          diffuse={new Color3(1.0, 0.98, 0.9)}
        />
        <HexWorld gridRadius={30} />
      </Scene>
    </Engine>
  );
}
