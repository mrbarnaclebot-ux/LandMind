---
created: 2026-01-21T07:16
title: Add clouds to 3D environment
area: ui
files:
  - packages/client/src/scene/ThreeScene.tsx
  - packages/client/src/scene/Clouds.tsx (new)
---

## Problem

The 3D environment has a Sky backdrop but no clouds. Adding Minecraft-style blocky/pixel clouds would:

1. Enhance the visual atmosphere
2. Better match the established Minecraft pixel theme
3. Add depth and movement to the scene
4. Make the world feel more alive

Current theme: Minecraft-inspired with Press Start 2P font, vibrant biome colors, beveled hex tiles, chunky UI elements.

## Solution

Create a Clouds component with:
- Blocky/voxel-style cloud shapes (box geometries or simple planes)
- White/light gray color with slight transparency
- Slow horizontal drift animation
- Multiple cloud layers at different heights
- Match the flat-shaded aesthetic of hex terrain
- Consider InstancedMesh for performance if many clouds

Reference: Minecraft's simple rectangular cloud blocks that slowly move across the sky.
