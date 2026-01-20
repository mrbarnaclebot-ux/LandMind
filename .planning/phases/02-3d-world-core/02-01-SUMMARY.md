---
phase: 02-3d-world-core
plan: 01
subsystem: 3d-rendering
tags: [babylonjs, hex-grid, procedural-mesh, coordinate-math]

# Dependency graph
requires: []
provides:
  - Flat-top axial coordinate system for hex math
  - hexToPixel/pixelToHex coordinate conversions
  - Procedural beveled hex mesh generator
  - HEX_SIZE and ELEVATION_STEP constants
affects: [02-02, 02-03, 02-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [axial-hex-coordinates, procedural-mesh-generation]

key-files:
  created: [packages/client/src/hex/hexMath.ts, packages/client/src/hex/hexMesh.ts]
  modified: [packages/client/src/scene/BabylonScene.tsx]

key-decisions:
  - "Flat-top hex orientation with corners at 0, 60, 120, 180, 240, 300 degrees"
  - "HEX_SIZE=1.0 and ELEVATION_STEP=0.5 as foundational constants"
  - "20-vertex mesh structure: center + inner ring + outer ring + bottom ring"

patterns-established:
  - "Axial coordinate system (q,r) based on Red Blob Games reference"
  - "Procedural mesh with VertexData.ComputeNormals for proper lighting"

# Metrics
duration: 5min
completed: 2026-01-20
---

# Phase 02 Plan 01: Hex Math & Mesh Foundation Summary

**Flat-top axial coordinate system and procedural beveled hex mesh generator ready for thin instance rendering**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-01-20
- **Completed:** 2026-01-20
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- Complete axial coordinate system for flat-top hexes (hexToPixel, pixelToHex, hexDistance, hexNeighbors)
- Hex rounding algorithm for converting world positions to discrete hex coordinates
- Procedural beveled hex mesh with customizable size, height, and bevel
- 20-vertex geometry with proper triangle winding for correct normals
- TestHex component verifying mesh renders with proper lighting
- All modules compile successfully with TypeScript

## Task Commits

Each task was committed atomically:

1. **Task 1: Create hex math utilities** - `a7184f8` (feat)
   - hexMath.ts with coordinate conversions, distance, neighbors
2. **Task 2: Create beveled hex mesh generator** - `ea0df45` (feat)
   - hexMesh.ts with createBeveledHexMesh function
   - BabylonScene.tsx updated with TestHex component

## Files Created/Modified

- `packages/client/src/hex/hexMath.ts` - Axial coordinate system with all conversion utilities
- `packages/client/src/hex/hexMesh.ts` - Procedural beveled hex mesh generator
- `packages/client/src/scene/BabylonScene.tsx` - TestHex component for visual verification

## Key Exports

### hexMath.ts
- `HexCoord` - Type for axial coordinates (q, r)
- `hexToPixel(q, r)` - Convert hex to world position
- `pixelToHex(x, z)` - Convert world position to hex
- `hexDistance(a, b)` - Manhattan distance between hexes
- `hexNeighbors(q, r)` - Get 6 adjacent hex coordinates
- `hexRound(q, r)` - Round fractional coordinates to nearest hex
- `hexSpiral(q, r, radius)` - Generate spiral of hexes
- `HEX_SIZE` - Outer radius constant (1.0)
- `ELEVATION_STEP` - Height per tier (0.5)

### hexMesh.ts
- `createBeveledHexMesh(scene, options)` - Generate procedural hex mesh
- `BeveledHexOptions` - Configuration interface (size, height, bevelSize)

## Decisions Made

- **Flat-top orientation:** Hex corners at angles 0, 60, 120, 180, 240, 300 degrees for classic strategy game look
- **Axial coordinates:** Using (q, r) system from Red Blob Games reference for simpler algorithms
- **20-vertex mesh:** Center + 6 inner + 6 outer + 6 bottom + bottom center for proper bevel geometry
- **Counter-clockwise winding:** Standard for Babylon.js proper face normals

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- None

## User Setup Required

None - no external configuration needed.

## Next Phase Readiness

- hexMath.ts provides coordinate system for terrain generation (02-02)
- hexMesh.ts provides template mesh for thin instance grid (02-02, 02-03)
- TestHex demonstrates mesh renders correctly with lighting
- Ready for HexWorld component implementation

---
*Phase: 02-3d-world-core*
*Completed: 2026-01-20*
