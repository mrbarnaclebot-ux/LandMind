import { Engine, Scene } from 'react-babylonjs';
import { Vector3, Color3 } from '@babylonjs/core';

export function BabylonScene() {
  return (
    <Engine antialias adaptToDeviceRatio canvasId="babylon-canvas">
      <Scene clearColor={new Color3(0.1, 0.1, 0.15).toColor4()}>
        <arcRotateCamera
          name="camera"
          alpha={Math.PI / 2}
          beta={Math.PI / 4}
          radius={10}
          target={Vector3.Zero()}
          minZ={0.1}
          wheelPrecision={50}
        />
        <hemisphericLight
          name="light"
          intensity={0.7}
          direction={Vector3.Up()}
        />
        {/* Ground plane for visual reference */}
        <ground
          name="ground"
          width={20}
          height={20}
          subdivisions={2}
        >
          <standardMaterial name="groundMat" specularColor={Color3.Black()}>
            <texture
              assignTo="diffuseTexture"
              url="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            />
          </standardMaterial>
        </ground>
      </Scene>
    </Engine>
  );
}
