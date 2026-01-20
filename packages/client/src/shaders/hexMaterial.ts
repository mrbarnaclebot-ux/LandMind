/**
 * Hex Material - Stylized material for hex rendering
 *
 * Creates a StandardMaterial with stylized settings for hex rendering.
 * Uses per-biome meshes with different colors for biome differentiation.
 *
 * StandardMaterial is used because it has full thin instance support,
 * unlike custom ShaderMaterial which requires manual instance matrix handling.
 *
 * The material is configured for a vibrant, cel-shaded look with:
 * - High diffuse saturation
 * - Minimal specular (matte finish)
 * - Ambient emissive to prevent dark shadows
 * - Freeze for performance optimization
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

  // Set the biome color as diffuse - boost slightly for vibrancy
  material.diffuseColor = diffuseColor;

  // No specular for flat, stylized cartoon look
  material.specularColor = Color3.Black();
  material.specularPower = 1;

  // Add ambient color for fill lighting (prevents pitch black shadows)
  material.ambientColor = diffuseColor.scale(0.3);

  // Slight emissive glow to make colors pop (stylized look)
  material.emissiveColor = diffuseColor.scale(0.15);

  // Enable backface culling for performance
  material.backFaceCulling = true;

  // Freeze the material since we won't change it after creation
  // This improves performance by avoiding unnecessary state checks
  material.freeze();

  return material;
}
