import { Engine, Scene, useScene } from 'react-babylonjs';
import { Vector3, Color3, StandardMaterial } from '@babylonjs/core';
import { useEffect, useRef } from 'react';
import { createBeveledHexMesh } from '../hex/hexMesh';

/**
 * Test component to verify beveled hex mesh renders correctly
 * Temporary - will be replaced by HexWorld component
 */
function TestHex() {
  const scene = useScene();
  const createdRef = useRef(false);

  useEffect(() => {
    if (!scene || createdRef.current) return;
    createdRef.current = true;

    // Create beveled hex mesh
    const hex = createBeveledHexMesh(scene, {
      size: 1.0,
      height: 0.3,
      bevelSize: 0.08,
    });

    // Make it visible for testing
    hex.isPickable = true;

    // Add a simple material to see the bevel
    const material = new StandardMaterial('hexMat', scene);
    material.diffuseColor = new Color3(0.4, 0.7, 0.3); // Green grass color
    material.specularColor = new Color3(0.2, 0.2, 0.2);
    hex.material = material;

    return () => {
      hex.dispose();
      material.dispose();
    };
  }, [scene]);

  return null;
}

export function BabylonScene() {
  return (
    <Engine antialias adaptToDeviceRatio canvasId="babylon-canvas">
      <Scene clearColor={new Color3(0.1, 0.1, 0.15).toColor4()}>
        <arcRotateCamera
          name="camera"
          alpha={Math.PI / 2}
          beta={Math.PI / 4}
          radius={5}
          target={Vector3.Zero()}
          minZ={0.1}
          wheelPrecision={50}
        />
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
        <TestHex />
      </Scene>
    </Engine>
  );
}
