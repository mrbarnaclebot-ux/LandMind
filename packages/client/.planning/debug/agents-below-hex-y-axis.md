---
status: diagnosed
trigger: "Diagnose why agents render below the hex y axis"
created: 2026-01-21T12:00:00Z
updated: 2026-01-21T12:01:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - Hex Y positioning mismatch between HexWorld and AgentLayer
test: Compared hex geometry creation with agent Y calculation
expecting: Found the root cause
next_action: Return diagnosis

## Symptoms

expected: Agents should render on top of hex tiles at the correct Y elevation
actual: Agents render below the hex surface/y-axis
errors: None reported
reproduction: Deploy agents and observe their 3D position
started: After previous fix attempt (isInitialized dependency added)

## Eliminated

## Evidence

- timestamp: 2026-01-21T12:00:30Z
  checked: HexWorld.tsx BiomeMesh positioning (line 57-60)
  found: Hex Y position = elevation * ELEVATION_STEP (not centered, bottom edge at Y=0)
  implication: Hex top surface = elevation * ELEVATION_STEP + height (where height=0.35)

- timestamp: 2026-01-21T12:00:45Z
  checked: hexMesh.ts geometry creation (line 84-88)
  found: Top face vertices at y=height (0.35), bottom at y=-skirtDepth (-0.3)
  implication: Geometry is NOT centered at Y=0. Top is at +0.35, bottom at -0.3

- timestamp: 2026-01-21T12:01:00Z
  checked: AgentLayer.tsx Y calculation (line 167-171)
  found: hexTopSurface = elevation * ELEVATION_STEP + HEX_TILE_HEIGHT / 2
  implication: Agent assumes hex geometry is CENTERED at Y (adds height/2=0.175), but geometry actually has top at +height (0.35)

## Resolution

root_cause: AgentLayer calculates hex top surface as `elevation * ELEVATION_STEP + HEX_TILE_HEIGHT / 2` (0.175 offset), but hex geometry has its top face at y=height (0.35 offset from origin), not centered. The agent Y position is 0.175 units too low.
fix: Change AgentLayer line 170 from `+ HEX_TILE_HEIGHT / 2` to `+ HEX_TILE_HEIGHT` (full height, not half)
verification:
files_changed: []
