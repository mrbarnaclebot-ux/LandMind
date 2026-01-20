/**
 * Hex Material - Stylized material for hex rendering
 *
 * Creates a StandardMaterial with stylized settings for hex rendering.
 * Uses per-biome meshes with different colors for biome differentiation.
 *
 * StandardMaterial is used because it has full thin instance support,
 * unlike custom ShaderMaterial which requires manual instance matrix handling.
 */

import { StandardMaterial, Scene, Color3 } from '@babylonjs/core';

/**
 * Creates a stylized hex material using StandardMaterial
 *
 * Uses StandardMaterial for reliable thin instance support.
 * Each biome gets its own material with its color.
 *
 * @param scene - The Babylon.js scene
 * @param name - Material name
 * @param diffuseColor - Base color for the material (biome color)
 * @returns StandardMaterial configured for stylized look
 */
export function createHexMaterial(
  scene: Scene,
  name: string,
  diffuseColor: Color3 = new Color3(0.4, 0.6, 0.3)
): StandardMaterial {
  const material = new StandardMaterial(name, scene);

  // Set the biome color as diffuse
  material.diffuseColor = diffuseColor;

  // Minimal specular for a more matte, stylized look
  material.specularColor = new Color3(0.1, 0.1, 0.1);
  material.specularPower = 8;

  // Slight emissive to prevent pure black shadows (stylized look)
  material.emissiveColor = diffuseColor.scale(0.05);

  // Enable backface culling for performance
  material.backFaceCulling = true;

  return material;
}
