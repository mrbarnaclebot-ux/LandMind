# Phase 2: 3D World Core - Research

**Researched:** 2026-01-20
**Domain:** Babylon.js hex grid rendering, hex math, isometric camera, stylized shaders
**Confidence:** HIGH

## Summary

This phase involves rendering a 3D hexagonal world with Babylon.js that users can navigate via pan/zoom/rotate controls. The research covered five key areas: Babylon.js thin instances for performance, hex grid mathematics (flat-top axial coordinates), isometric camera configuration, stylized pixel shader aesthetics, and procedural terrain/biome generation.

The project already has `@babylonjs/core@^8.0.0` and `react-babylonjs@^3.2.0` installed with a basic ArcRotateCamera scene. The existing architecture provides a solid foundation. For 1-5k hexes, thin instances are the correct approach - they provide optimal performance by eliminating per-instance JavaScript object overhead while storing transformation matrices in GPU buffers.

**Primary recommendation:** Use thin instances with a single beveled hex mesh template, flat-top axial coordinates for hex math, ArcRotateCamera in orthographic mode for isometric view, and a simple cell shading material with optional pixelation post-process.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @babylonjs/core | ^8.0.0 | 3D rendering engine | Already installed, full WebGL2 support, GPU picking |
| react-babylonjs | ^3.2.0 | Declarative scene composition | Already installed, React 19 compatible |
| simplex-noise | ^4.0.3 | Terrain/biome noise generation | Dependency-free, ~20ns per 2D sample, seeded via alea |
| alea | ^1.0.1 | Seedable PRNG for noise | Required for deterministic terrain generation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @babylonjs/materials | ^8.0.0 | CellMaterial for stylized look | If using built-in cell shading |
| @babylonjs/inspector | ^8.0.0 | Debug tooling | Development only (already installed) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| simplex-noise | open-simplex-noise | OpenSimplex has different visual character, simplex-noise is faster |
| Thin instances | Regular instances | Regular instances allow individual visibility control but higher overhead |
| CellMaterial | Custom ShaderMaterial | Custom gives more control but more work; CellMaterial is good enough |

**Installation:**
```bash
npm install simplex-noise@^4.0.3 alea@^1.0.1 --workspace=@landmind/client
```

## Architecture Patterns

### Recommended Project Structure
```
packages/client/src/
├── scene/
│   ├── BabylonScene.tsx      # Root scene component (exists)
│   └── HexWorld.tsx          # Hex grid rendering component
├── hex/
│   ├── hexMath.ts            # Coordinate conversions, neighbors, distance
│   ├── hexMesh.ts            # Beveled hex mesh generation
│   └── hexGrid.ts            # Grid generation, thin instance management
├── terrain/
│   ├── terrainGenerator.ts   # Noise-based elevation/biome generation
│   └── biomes.ts             # Biome definitions and color palettes
├── camera/
│   └── isometricCamera.ts    # ArcRotateCamera orthographic setup
└── shaders/
    └── pixelPost.ts          # Optional pixelation post-process
```

### Pattern 1: Thin Instance Buffer Management
**What:** Pre-allocate transformation matrices in Float32Array, update via thinInstanceSetBuffer
**When to use:** Rendering 1-5k identical hex meshes with different positions/elevations
**Example:**
```typescript
// Source: https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances
const instanceCount = hexGrid.length;
const matrixBuffer = new Float32Array(16 * instanceCount);
const colorBuffer = new Float32Array(4 * instanceCount);

hexGrid.forEach((hex, i) => {
  const matrix = Matrix.Translation(hex.worldX, hex.elevation, hex.worldZ);
  matrix.copyToArray(matrixBuffer, i * 16);

  const biomeColor = getBiomeColor(hex.biome);
  colorBuffer.set([biomeColor.r, biomeColor.g, biomeColor.b, 1], i * 4);
});

hexMesh.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true); // static
hexMesh.thinInstanceSetBuffer("color", colorBuffer, 4, true);
```

### Pattern 2: Axial Coordinate System for Hex Math
**What:** Use (q, r) axial coordinates internally, convert to world (x, z) for rendering
**When to use:** All hex grid operations - neighbors, distance, pathfinding
**Example:**
```typescript
// Source: https://www.redblobgames.com/grids/hexagons/
const HEX_SIZE = 1.0; // outer radius

// Flat-top hex: pixel to hex
function pixelToHex(x: number, z: number): { q: number; r: number } {
  const q = (2/3 * x) / HEX_SIZE;
  const r = ((-1/3 * x) + (Math.sqrt(3)/3 * z)) / HEX_SIZE;
  return hexRound(q, r);
}

// Flat-top hex: hex to pixel (world position)
function hexToPixel(q: number, r: number): { x: number; z: number } {
  const x = HEX_SIZE * (3/2 * q);
  const z = HEX_SIZE * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
  return { x, z };
}

// Axial neighbor directions (flat-top)
const AXIAL_DIRECTIONS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
];

function hexDistance(a: Hex, b: Hex): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}
```

### Pattern 3: Orthographic ArcRotateCamera for Isometric View
**What:** Use ArcRotateCamera in orthographic mode with manual ortho bounds
**When to use:** Isometric strategy game view with rotation support
**Example:**
```typescript
// Source: https://forum.babylonjs.com/t/using-orthographic-camera-mode-with-arcrotatecamera/12319
import { ArcRotateCamera, Camera, Vector3 } from '@babylonjs/core';

function createIsometricCamera(scene: Scene, canvas: HTMLCanvasElement): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    "isoCam",
    Math.PI / 4,           // alpha: 45 degrees rotation
    Math.PI / 3,           // beta: ~60 degrees for isometric
    50,                    // radius (affects initial bounds calculation)
    Vector3.Zero(),
    scene
  );

  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;

  // Set orthographic bounds (zoom level)
  const orthoSize = 15;
  const aspectRatio = canvas.width / canvas.height;
  camera.orthoLeft = -orthoSize * aspectRatio;
  camera.orthoRight = orthoSize * aspectRatio;
  camera.orthoTop = orthoSize;
  camera.orthoBottom = -orthoSize;

  // Configure controls
  camera.panningSensibility = 100;     // Lower = faster panning
  camera.wheelPrecision = 0;           // Disable default zoom
  camera.lowerRadiusLimit = 1;
  camera.upperRadiusLimit = 200;

  camera.attachControl(canvas, true);
  return camera;
}

// Custom zoom via ortho bounds adjustment
function zoom(camera: ArcRotateCamera, delta: number, aspectRatio: number) {
  const currentSize = camera.orthoTop;
  const newSize = Math.max(5, Math.min(50, currentSize + delta));
  camera.orthoLeft = -newSize * aspectRatio;
  camera.orthoRight = newSize * aspectRatio;
  camera.orthoTop = newSize;
  camera.orthoBottom = -newSize;
}
```

### Pattern 4: Procedural Terrain with Noise
**What:** Use layered simplex noise for elevation, separate noise for moisture/biomes
**When to use:** Generating varied terrain with distinct regions
**Example:**
```typescript
// Source: https://www.redblobgames.com/maps/terrain-from-noise/
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';

const elevationNoise = createNoise2D(alea('elevation-seed-123'));
const moistureNoise = createNoise2D(alea('moisture-seed-456'));

function generateElevation(q: number, r: number): number {
  const { x, z } = hexToPixel(q, r);
  const scale = 0.02;

  // Fractional Brownian motion (octaves)
  let e = 1.0 * elevationNoise(1 * x * scale, 1 * z * scale)
        + 0.5 * elevationNoise(2 * x * scale, 2 * z * scale)
        + 0.25 * elevationNoise(4 * x * scale, 4 * z * scale);
  e = e / (1 + 0.5 + 0.25);

  // Normalize to 0-1 range, then quantize to 3 tiers
  e = (e + 1) / 2;
  return quantizeElevation(e); // Returns 0, 1, or 2
}

function quantizeElevation(e: number): number {
  if (e < 0.4) return 0; // Low
  if (e < 0.7) return 1; // Mid
  return 2;              // High
}

function getBiome(q: number, r: number, elevation: number): Biome {
  const { x, z } = hexToPixel(q, r);
  const moisture = (moistureNoise(x * 0.01, z * 0.01) + 1) / 2;

  if (elevation === 0) {
    return moisture > 0.6 ? 'marsh' : 'grassland';
  } else if (elevation === 1) {
    return moisture > 0.5 ? 'forest' : 'plains';
  } else {
    return moisture > 0.4 ? 'alpine' : 'rocky';
  }
}
```

### Anti-Patterns to Avoid
- **Per-frame thin instance updates:** Never call thinInstanceSetMatrixAt in render loop for static terrain
- **Individual mesh per hex:** Creates thousands of draw calls, use thin instances
- **Offset coordinates:** Use axial/cube coordinates for algorithms, offset is harder to work with
- **Perspective camera for isometric:** Objects won't maintain consistent size; use orthographic mode
- **Hand-rolling hex math:** Use established formulas from Red Blob Games

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hex coordinate math | Custom coordinate system | Axial coordinates (Red Blob Games) | Edge cases in neighbor/distance calculations |
| Noise generation | Custom random terrain | simplex-noise + alea | Performance, seedability, proper distribution |
| Cell shading | Custom shader from scratch | CellMaterial or adapt from CYOS | Lighting math is tricky, existing solutions work |
| Hex picking | Manual raycast math | thinInstanceEnablePicking + GPUPicker | GPU picking is orders of magnitude faster for thousands of hexes |
| Camera controls | Custom pan/zoom/rotate | ArcRotateCamera with ortho mode | Built-in input handling, inertia, limits |

**Key insight:** Babylon.js 8.0 has mature thin instance and GPU picking support. The hex grid is a data problem (coordinates, terrain), not a rendering problem. Let the engine handle rendering, focus on hex logic.

## Common Pitfalls

### Pitfall 1: Thin Instance Bounding Box Issues
**What goes wrong:** All thin instances share one bounding box, causing incorrect culling or picking
**Why it happens:** Babylon calculates bounds from the source mesh, not instance positions
**How to avoid:** Call `thinInstanceRefreshBoundingInfo(true)` after setting up all instances
**Warning signs:** Hexes disappear when panning camera, picking returns wrong hex

### Pitfall 2: Orthographic Camera Zoom Doesn't Work
**What goes wrong:** Mouse wheel zooming has no effect in orthographic mode
**Why it happens:** ArcRotateCamera's radius property doesn't affect orthographic projection
**How to avoid:** Implement custom zoom by adjusting orthoLeft/Right/Top/Bottom properties
**Warning signs:** wheelPrecision setting does nothing, camera.radius changes don't zoom

### Pitfall 3: Thin Instance Picking Unreliable
**What goes wrong:** Hover detection misses instances or reports wrong thinInstanceIndex
**Why it happens:** pointerOverDisableMeshTesting defaults to false for performance
**How to avoid:** Set `mesh.pointerOverDisableMeshTesting = true` when accurate hover is needed
**Warning signs:** Hover highlight doesn't update until mouse stops moving

### Pitfall 4: Noise Seeds Produce Identical Patterns
**What goes wrong:** Elevation and moisture terrain look identical
**Why it happens:** Using same seed for both noise generators
**How to avoid:** Use different seeds for elevation vs moisture noise functions
**Warning signs:** Biome distribution perfectly correlates with elevation

### Pitfall 5: Hex Grid Coordinate Confusion
**What goes wrong:** Neighbors calculations return wrong hexes, pathfinding breaks
**Why it happens:** Mixing flat-top and pointy-top formulas, or offset vs axial coordinates
**How to avoid:** Stick to flat-top axial coordinates throughout, never mix systems
**Warning signs:** Visual grid doesn't match coordinate expectations, neighbor at (1,0) is visually wrong

### Pitfall 6: Custom Mesh Normals Incorrect
**What goes wrong:** Lighting looks wrong, beveled edges don't catch light correctly
**Why it happens:** Forgetting to call ComputeNormals or wrong vertex winding order
**How to avoid:** Always compute normals after defining positions/indices, verify winding is CCW
**Warning signs:** Faces appear dark, lighting seems inverted

## Code Examples

Verified patterns from official sources:

### Creating a Beveled Hex Mesh (Procedural)
```typescript
// Custom mesh for flat-top hexagon with beveled edges
import { Mesh, VertexData, Vector3 } from '@babylonjs/core';

function createBeveledHexMesh(scene: Scene, size: number, height: number, bevelSize: number): Mesh {
  const mesh = new Mesh("hexTemplate", scene);

  // Flat-top hex: 6 corners at angles 0, 60, 120, 180, 240, 300
  const corners: Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    corners.push(new Vector3(
      size * Math.cos(angle),
      0,
      size * Math.sin(angle)
    ));
  }

  // Inner corners for bevel (scaled down)
  const innerCorners = corners.map(c => c.scale((size - bevelSize) / size));

  // Build vertices: top face center, top inner ring, top outer ring (bevel), side faces
  const positions: number[] = [];
  const indices: number[] = [];

  // Top center vertex (0)
  positions.push(0, height, 0);

  // Top inner ring (vertices 1-6)
  innerCorners.forEach(c => positions.push(c.x, height, c.z));

  // Top outer ring - lowered for bevel (vertices 7-12)
  const bevelHeight = height - bevelSize * 0.5;
  corners.forEach(c => positions.push(c.x, bevelHeight, c.z));

  // Bottom outer ring (vertices 13-18)
  corners.forEach(c => positions.push(c.x, 0, c.z));

  // Top face triangles (center to inner ring)
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(0, 1 + i, 1 + next);
  }

  // Bevel face triangles (inner ring to outer ring)
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(1 + i, 7 + i, 7 + next);
    indices.push(1 + i, 7 + next, 1 + next);
  }

  // Side faces (outer top ring to bottom ring)
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(7 + i, 13 + i, 13 + next);
    indices.push(7 + i, 13 + next, 7 + next);
  }

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  vertexData.normals = normals;

  vertexData.applyToMesh(mesh);
  return mesh;
}
```

### Setting Up Thin Instances with react-babylonjs
```typescript
// Source: https://github.com/brianzinn/react-babylonjs
import { useScene, useBeforeRender } from 'react-babylonjs';
import { useEffect, useRef } from 'react';
import { Mesh, Matrix, Color4 } from '@babylonjs/core';

interface HexGridProps {
  hexes: HexData[];
}

function HexGrid({ hexes }: HexGridProps) {
  const scene = useScene();
  const meshRef = useRef<Mesh>(null);

  useEffect(() => {
    if (!meshRef.current || hexes.length === 0) return;

    const mesh = meshRef.current;
    const matrixBuffer = new Float32Array(16 * hexes.length);
    const colorBuffer = new Float32Array(4 * hexes.length);

    hexes.forEach((hex, i) => {
      const { x, z } = hexToPixel(hex.q, hex.r);
      const y = hex.elevation * ELEVATION_STEP;
      Matrix.Translation(x, y, z).copyToArray(matrixBuffer, i * 16);

      const color = getBiomeColor(hex.biome);
      colorBuffer.set([color.r, color.g, color.b, 1], i * 4);
    });

    mesh.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true);
    mesh.thinInstanceRegisterAttribute("color", 4);
    mesh.thinInstanceSetBuffer("color", colorBuffer, 4, true);
    mesh.thinInstanceRefreshBoundingInfo(true);

    // Enable picking
    mesh.isPickable = true;
    mesh.thinInstanceEnablePicking = true;
    mesh.pointerOverDisableMeshTesting = true;
  }, [hexes]);

  return (
    <mesh name="hexGrid" ref={meshRef}>
      {/* Hex geometry created via createBeveledHexMesh */}
    </mesh>
  );
}
```

### GPU Picker for Hex Hover
```typescript
// Source: https://doc.babylonjs.com/features/featuresDeepDive/mesh/interactions/picking_collisions
import { GPUPicker, Scene } from '@babylonjs/core';

class HexPicker {
  private picker: GPUPicker;
  private hexMesh: Mesh;

  constructor(scene: Scene, hexMesh: Mesh) {
    this.picker = new GPUPicker();
    this.picker.setPickingList([hexMesh]);
    this.hexMesh = hexMesh;
  }

  async getHoveredHexIndex(pointerX: number, pointerY: number, scene: Scene): Promise<number | null> {
    const pickResult = await this.picker.pickAsync(pointerX, pointerY, scene);
    if (pickResult && pickResult.hit && pickResult.pickedMesh === this.hexMesh) {
      return pickResult.thinInstanceIndex;
    }
    return null;
  }
}
```

### Cell Shading Material Setup
```typescript
// Source: https://doc.babylonjs.com/toolsAndResources/assetLibraries/materialsLibrary/cellShadingMat
// Note: Requires @babylonjs/materials package
import { CellMaterial } from '@babylonjs/materials';
import { Color3 } from '@babylonjs/core';

function createCellMaterial(scene: Scene, name: string): CellMaterial {
  const mat = new CellMaterial(name, scene);
  mat.computeHighLevel = true; // 5 lighting gradations
  mat.diffuseColor = new Color3(0.5, 0.7, 0.3); // Will be overridden by instance color
  return mat;
}
```

### Simple Pixelation Post-Process
```typescript
// Source: https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/usePostProcesses
import { PostProcess, Effect, Camera } from '@babylonjs/core';

Effect.ShadersStore["pixelateFragmentShader"] = `
  precision highp float;
  varying vec2 vUV;
  uniform sampler2D textureSampler;
  uniform vec2 screenSize;
  uniform float pixelSize;

  void main(void) {
    vec2 pixelatedUV = floor(vUV * screenSize / pixelSize) * pixelSize / screenSize;
    gl_FragColor = texture2D(textureSampler, pixelatedUV);
  }
`;

function createPixelationPostProcess(camera: Camera, pixelSize: number = 4): PostProcess {
  const postProcess = new PostProcess(
    "pixelate",
    "pixelate",
    ["screenSize", "pixelSize"],
    null,
    1.0,
    camera
  );

  postProcess.onApply = (effect) => {
    effect.setFloat2("screenSize", postProcess.width, postProcess.height);
    effect.setFloat("pixelSize", pixelSize);
  };

  return postProcess;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Individual meshes | Thin instances | Babylon 4.1+ | 10-100x draw call reduction |
| CPU picking | GPU Picker | Babylon 8.0 | Orders of magnitude faster for large scenes |
| Manual instance transforms | thinInstanceSetBuffer | Babylon 4.1+ | Batch updates instead of per-instance |
| FreeCamera + manual controls | ArcRotateCamera ortho mode | Always available | Built-in pan/zoom/rotate |

**Deprecated/outdated:**
- `InstancedMesh.createInstance()` for large counts: Use thin instances instead
- Manual raycasting for picking: Use GPUPicker for thin instances
- babylon.js v5 patterns: Some examples online are outdated, verify against v8 docs

## Open Questions

Things that couldn't be fully resolved:

1. **Per-instance vertex colors with thin instances**
   - What we know: Thin instances support custom attributes like "color"
   - What's unclear: Whether CellMaterial properly reads instance color attribute or needs custom shader
   - Recommendation: Test with CellMaterial first; if colors don't work, create custom ShaderMaterial

2. **Exact shadow configuration for stylized look**
   - What we know: DirectionalLight + ShadowGenerator supports hard shadows
   - What's unclear: Optimal shadow map size and bias for 1-5k hex terrain
   - Recommendation: Start with 1024 shadow map, hard shadows (no filtering), tune bias

3. **react-babylonjs thin instance declarative API**
   - What we know: react-babylonjs supports declarative meshes and hooks
   - What's unclear: Whether there's a declarative way to set up thin instances or requires imperative code via refs
   - Recommendation: Use useEffect with mesh ref for thin instance setup (imperative is fine here)

## Sources

### Primary (HIGH confidence)
- [Babylon.js Thin Instances Documentation](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances) - Thin instance API, buffers, picking
- [Babylon.js Mesh Picking Documentation](https://doc.babylonjs.com/features/featuresDeepDive/mesh/interactions/picking_collisions) - GPU picker, thinInstanceIndex
- [Red Blob Games Hexagonal Grids](https://www.redblobgames.com/grids/hexagons/) - Authoritative hex math reference
- [Red Blob Games Terrain from Noise](https://www.redblobgames.com/maps/terrain-from-noise/) - Noise-based terrain generation
- [Babylon.js Shadows Documentation](https://doc.babylonjs.com/features/featuresDeepDive/lights/shadows) - Shadow generator configuration
- [Babylon.js Custom Mesh Documentation](https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/custom/custom) - Procedural mesh creation
- [Babylon.js PostProcess Documentation](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/usePostProcesses) - Custom shader post-processing
- [Babylon.js CellMaterial Documentation](https://doc.babylonjs.com/toolsAndResources/assetLibraries/materialsLibrary/cellShadingMat) - Cell shading material

### Secondary (MEDIUM confidence)
- [react-babylonjs GitHub](https://github.com/brianzinn/react-babylonjs) - Hooks API, declarative patterns
- [simplex-noise npm](https://www.npmjs.com/package/simplex-noise) - Noise library usage
- [Babylon.js Forum - Orthographic Camera](https://forum.babylonjs.com/t/using-orthographic-camera-mode-with-arcrotatecamera/12319) - Ortho mode setup
- [Babylon.js Forum - Thin Instance Picking](https://forum.babylonjs.com/t/thin-instances-and-picking/14813) - Picking gotchas

### Tertiary (LOW confidence)
- Various WebSearch results on stylized shaders and post-processing - needs validation with actual implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation verified
- Hex math: HIGH - Red Blob Games is the authoritative source
- Thin instances: HIGH - Official Babylon.js documentation
- Camera setup: MEDIUM - Forum-verified but needs implementation testing
- Pixel shader/stylization: MEDIUM - Concepts verified, exact implementation needs testing
- Biome generation: MEDIUM - Algorithm verified, tuning parameters TBD

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (Babylon.js 8.x stable, patterns unlikely to change)
