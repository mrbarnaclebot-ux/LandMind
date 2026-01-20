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
 * Material settings are tuned for maximum depth perception:
 * - No emissive (allows lighting to create shadows)
 * - Low ambient (side faces stay darker)
 * - Slight specular on tops (catches light)
 *
 * @param scene - The Babylon.js scene
 * @param name - Material name
 * @param diffuseColor - Base color for the material (biome color)
 * @returns StandardMaterial configured for solid 3D look
 */
export function createHexMaterial(
  scene: Scene,
  name: string,
  diffuseColor: Color3 = new Color3(0.4, 0.6, 0.3)
): StandardMaterial {
  const material = new StandardMaterial(name, scene);

  // Boost the diffuse color slightly for vibrancy
  material.diffuseColor = diffuseColor.scale(1.1);

  // Subtle specular for slight shininess that helps show surface angles
  // This creates slight highlights on top faces catching the sun
  material.specularColor = new Color3(0.15, 0.15, 0.15);
  material.specularPower = 32;

  // Very low ambient - this is KEY for depth perception
  // Low ambient means side faces (not hit by directional light) appear darker
  material.ambientColor = diffuseColor.scale(0.15);

  // NO emissive - emissive washes out lighting and makes everything look flat
  // Removing emissive lets the lighting create proper shadows on sides
  material.emissiveColor = Color3.Black();

  // Enable backface culling for performance
  material.backFaceCulling = true;

  // Freeze the material since we won't change it after creation
  // This improves performance by avoiding unnecessary state checks
  material.freeze();

  return material;
}
