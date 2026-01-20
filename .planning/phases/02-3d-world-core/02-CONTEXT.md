# Phase 2: 3D World Core - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Render a 3D hexagonal world that users can navigate. Users can see the hex grid, pan/zoom/rotate the camera, and see terrain with variable height. This phase delivers the visual foundation — no game logic, no interactions beyond camera movement and hover feedback.

</domain>

<decisions>
## Implementation Decisions

### Hex Visual Style
- Flat-top hex orientation
- Beveled/3D edges creating natural separation between hexes
- Subtle highlight effect on hover (hex brightens slightly)
- Medium world size: 1,000-5,000 hexes

### Terrain System
- 3 distinct elevation tiers (low/mid/high)
- Clear steps/plateaus between tiers — like Civilization terrain
- Biome zones: regions of different terrain types (grassland, rocky, etc.)

### Color Palette
- Stylized/saturated colors (think Zelda: Link's Awakening vibrancy)
- Greens for vegetation, stone grays/browns for rocky terrain
- Colors vary by biome zone, not just elevation

### Camera
- Isometric default view
- Rotatable — user can rotate to see from different angles
- Pan and zoom supported

### Lighting & Shaders
- Pixel shader aesthetic
- Bright daylight mood
- Vibrant colors
- Sharp shadows

### Claude's Discretion
- Specific hex dimensions and spacing
- Exact color values within the "stylized/saturated" palette
- World boundary treatment (fade, edge, water, etc.)
- Camera zoom limits and movement speed
- Thin instance implementation details for performance

</decisions>

<specifics>
## Specific Ideas

- "Isometric view like old strategy games"
- "Distinct elevation tiers like Civilization terrain"
- "Pixel shader with vibrant colors and sharp shadows"
- Zelda: Link's Awakening referenced for color saturation level

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-3d-world-core*
*Context gathered: 2026-01-20*
