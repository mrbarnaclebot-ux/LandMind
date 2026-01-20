/**
 * Hex Material - Stylized cell-shaded material for hex rendering
 *
 * Creates a ShaderMaterial with cell shading (toon shading) effect.
 * Supports per-instance colors via vertex attribute for biome coloring.
 *
 * Cell shading uses discrete light bands instead of smooth gradients,
 * giving the characteristic stylized look of games like Zelda.
 */

import {
  ShaderMaterial,
  Scene,
  Effect,
  Vector3,
  Color3,
} from '@babylonjs/core';

// Register vertex shader in Babylon's shader store
Effect.ShadersStore['hexVertexShader'] = `
  precision highp float;

  // Attributes
  attribute vec3 position;
  attribute vec3 normal;

  // Uniforms
  uniform mat4 viewProjection;
  uniform mat4 world;

  // Varyings (passed to fragment shader)
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  // Babylon.js thin instance support
  #include<instancesDeclaration>

  void main() {
    #include<instancesVertex>

    vec4 worldPos = finalWorld * vec4(position, 1.0);
    gl_Position = viewProjection * worldPos;

    // Transform normal to world space
    vNormal = normalize((finalWorld * vec4(normal, 0.0)).xyz);
    vWorldPosition = worldPos.xyz;
  }
`;

// Register fragment shader with cell shading
Effect.ShadersStore['hexFragmentShader'] = `
  precision highp float;

  // Varyings from vertex shader
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  // Uniforms for lighting
  uniform vec3 lightDirection;
  uniform vec3 ambientColor;
  uniform vec3 diffuseColor;

  void main() {
    // Calculate basic diffuse lighting
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(lightDirection);
    float ndl = dot(normal, lightDir);

    // Cell shading: quantize light into 3 discrete bands
    float lightIntensity;
    if (ndl > 0.5) {
      lightIntensity = 1.0;       // Bright band
    } else if (ndl > 0.0) {
      lightIntensity = 0.65;      // Mid band
    } else {
      lightIntensity = 0.35;      // Shadow band
    }

    // Combine diffuse color with lighting
    vec3 finalColor = diffuseColor * lightIntensity + ambientColor * 0.15;

    // Slight color boost for stylized look
    finalColor = pow(finalColor, vec3(0.95));

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

/**
 * Creates a cell-shaded hex material
 *
 * The material uses custom shaders to achieve a stylized look with
 * discrete light bands (cell shading) instead of smooth gradients.
 *
 * @param scene - The Babylon.js scene
 * @param name - Material name
 * @param diffuseColor - Base color for the material (typically biome color)
 * @returns ShaderMaterial configured for cell shading
 */
export function createHexMaterial(
  scene: Scene,
  name: string,
  diffuseColor: Color3 = new Color3(0.4, 0.6, 0.3)
): ShaderMaterial {
  const material = new ShaderMaterial(
    name,
    scene,
    {
      vertex: 'hex',
      fragment: 'hex',
    },
    {
      attributes: ['position', 'normal'],
      uniforms: [
        'world',
        'viewProjection',
        'lightDirection',
        'ambientColor',
        'diffuseColor',
      ],
    }
  );

  // Default light direction (sun from upper-right-front)
  // Negative values point FROM light TO surface
  material.setVector3('lightDirection', new Vector3(1, 2, 1));

  // Ambient color (cool blue-ish for sky fill)
  material.setColor3('ambientColor', new Color3(0.3, 0.35, 0.4));

  // Diffuse color (base material color)
  material.setColor3('diffuseColor', diffuseColor);

  // Enable backface culling for performance
  material.backFaceCulling = true;

  return material;
}

/**
 * Updates the light direction on a hex material
 * Call this if you want to sync with a scene's directional light
 */
export function setHexMaterialLightDirection(
  material: ShaderMaterial,
  direction: Vector3
): void {
  // Negate direction since shader expects direction TO light
  material.setVector3(
    'lightDirection',
    new Vector3(-direction.x, -direction.y, -direction.z)
  );
}
