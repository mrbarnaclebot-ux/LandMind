---
status: diagnosed
phase: 05-agent-deployment
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md, 05-06-SUMMARY.md, 05-07-SUMMARY.md
started: 2026-01-21T09:41:00Z
updated: 2026-01-21T09:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Deploy Agent Button Visible
expected: When wallet is connected, a "Deploy Agent" button appears in the UI with deployment cost (0.1 SOL).
result: pass

### 2. Deploy Agent Flow
expected: Clicking "Deploy Agent" triggers wallet signature. Status messages show progress. On success, toast confirms deployment.
result: pass

### 3. Agent Appears on Hex Grid (FIX VERIFIED)
expected: After deployment, agent (colored box) appears on a hex. OLD agents also render at correct elevation (not stuck at y=0).
result: issue
reported: "agents are still below the hex y axis"
severity: major

### 4. Agent Mining Animation
expected: Agents on hexes have subtle bobbing and rotation animation while mining.
result: pass

### 5. My Agents Dashboard Opens
expected: "My Agents" button opens side panel sliding from left showing deployed agents.
result: pass

### 6. Agent Dashboard Stats Visible (FIX VERIFIED)
expected: Dashboard shows total agents, total resources mined. Resource values (Au/Ag/Cu/Fe numbers) are clearly visible with light text on dark background.
result: pass

### 7. Agent Card Shows Location (FIX VERIFIED)
expected: Each agent card shows hex coordinates "HEX (q, r)" OR "UNASSIGNED" if not placed. No blank location section.
result: pass

### 8. Hex Tooltip Readable (FIX VERIFIED)
expected: Hovering over hex shows tooltip with coordinates and biome. Tooltip is readable at default zoom level without zooming in.
result: pass

### 9. Locate Button Works
expected: Clicking "Locate" on an agent card moves camera to that agent's hex position.
result: pass
note: unassigned agents need to be reassigned

### 10. Real-Time Mining Updates
expected: Agent resource totals update in real-time as server mining tick runs. Dashboard stats reflect accumulated resources.
result: issue
reported: "total mined shows values but there is no indication of real time mining / depletion of resources"
severity: minor

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Agents render at correct elevation on hex grid"
  status: failed
  reason: "User reported: agents are still below the hex y axis"
  severity: major
  test: 3
  root_cause: "AgentLayer.tsx line 170 uses HEX_TILE_HEIGHT / 2 (0.175) but hex geometry places top face at y=height (0.35), not y=height/2. Agents render 0.175 units below actual surface."
  artifacts:
    - path: "packages/client/src/scene/AgentLayer.tsx"
      issue: "Line 170: hexTopSurface = elevation * ELEVATION_STEP + HEX_TILE_HEIGHT / 2 should be + HEX_TILE_HEIGHT"
    - path: "packages/client/src/hex/hexMesh.ts"
      issue: "Reference: line 84 shows top face center at y=height, not centered"
  missing:
    - "Change HEX_TILE_HEIGHT / 2 to HEX_TILE_HEIGHT in AgentLayer.tsx line 170"
  debug_session: "packages/client/.planning/debug/agents-below-hex-y-axis.md"

- truth: "Real-time mining updates visible to user"
  status: failed
  reason: "User reported: total mined shows values but there is no indication of real time mining / depletion of resources"
  severity: minor
  test: 10
  root_cause: "Three issues: (1) Server AgentUpdate missing hexQ/hexR fields, (2) Dashboard numbers update without animation, (3) No visual indicator like particles when mining."
  artifacts:
    - path: "packages/server/src/simulation/tickLoop.ts"
      issue: "Lines 164-169: AgentUpdate missing hexQ and hexR fields required by type"
    - path: "packages/client/src/components/agents/AgentCard.tsx"
      issue: "Resource numbers display statically with no change animation"
    - path: "packages/client/src/components/agents/AgentDashboard.tsx"
      issue: "Total mined section has no visual feedback for updates"
  missing:
    - "Add hexQ/hexR to AgentUpdate in tickLoop.ts"
    - "Add CSS transition/pulse effect when resource numbers change"
    - "Optional: Add floating +N numbers or particle effects for mining visual"
  debug_session: "packages/client/.planning/debug/no-realtime-mining-updates.md"
