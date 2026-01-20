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
        clearColor={new Color3(0.1, 0.1, 0.15).toColor4()}
        onSceneMount={onSceneMount}
      >
        <hemisphericLight
          name="light"
          intensity={0.7}
          direction={Vector3.Up()}
        />
        <directionalLight
          name="dirLight"
          intensity={0.5}
          direction={new Vector3(-1, -2, -1)}
        />
        <HexWorld gridRadius={30} />
      </Scene>
    </Engine>
  );
}
