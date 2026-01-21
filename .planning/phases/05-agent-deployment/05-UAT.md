---
status: diagnosed
phase: 05-agent-deployment
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md, 05-06-SUMMARY.md
started: 2026-01-21T06:30:00Z
updated: 2026-01-21T07:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Deploy Agent Button Visible
expected: When wallet is connected, a "Deploy Agent" button appears in the header alongside the Connect button. Hovering shows a tooltip with the deployment cost (0.1 SOL) and current agent count/limit.
result: pass

### 2. Deploy Agent Flow
expected: Clicking "Deploy Agent" triggers wallet signature request. After signing, status messages show deployment progress (requesting, signing, sending, confirming). On success, a toast confirms deployment.
result: pass

### 3. Agent Appears on Hex Grid
expected: After successful deployment, a colored box (agent) appears on a hex in the 3D world. User's agents are green colored.
result: issue
reported: "I can deploy an agent and I can see the agent in my list but not on the grid. NEW agents appear but OLD agents don't render."
severity: major

### 4. Agent Mining Animation
expected: Deployed agents on hexes have a subtle bobbing and rotation animation while mining.
result: skipped
reason: Cannot test - old agents not visible on grid

### 5. My Agents Button Opens Dashboard
expected: A "My Agents" button in the UI opens a side panel sliding from the left showing your deployed agents.
result: pass

### 6. Agent Dashboard Shows Stats
expected: The Agent Dashboard displays summary statistics (total agents, total resources mined) and lists each deployed agent with its status and hex location.
result: pass

### 7. Agent Card Shows Details
expected: Each agent card shows the agent status (mining/idle), current hex coordinates (q, r), and resources collected.
result: issue
reported: "pass but does not show hex coordinates"
severity: minor

### 8. Hex Tooltip on Hover
expected: Hovering over a hex in the 3D world shows a tooltip with the hex coordinates.
result: issue
reported: "pass but the gui is small unless I zoom in"
severity: cosmetic

### 9. Real-Time Mining Updates
expected: Agent resource totals update in real-time as the server mining tick runs. Dashboard stats reflect accumulated resources.
result: issue
reported: "since I cant see the agent on the grid I cant see real time mining, when I deploy a new agent I can see it on the grid but the old ones dont render and dont have locate button also the total mined status are barely visible due to the color of the text being black in a grey background"
severity: major

### 10. Agent Limit Enforcement
expected: At 20 agents, the Deploy button is disabled. Between 10-20 agents, a warning is shown but deployment is still allowed.
result: pass

## Summary

total: 10
passed: 5
issues: 4
pending: 0
skipped: 1

## Gaps

- truth: "After successful deployment, a colored box (agent) appears on a hex in the 3D world"
  status: failed
  reason: "User reported: NEW agents appear but OLD agents don't render on grid"
  severity: major
  test: 3
  root_cause: "Race condition in AgentLayer.tsx - useMemo depends on getHexInfo function but not on hexStore.isInitialized. When agents load before hex store initializes, elevation is calculated as 0 for all. New agents work because store is initialized by the time they're added."
  artifacts:
    - path: "packages/client/src/scene/AgentLayer.tsx"
      issue: "useMemo line 154 depends on [agents, getHexInfo] but doesn't react to hexStore initialization"
    - path: "packages/client/src/stores/hexStore.ts"
      issue: "isInitialized flag not exposed for dependency tracking"
  missing:
    - "Add isInitialized from hexStore as useMemo dependency in AgentLayer"
    - "Or use a state flag to re-render when hex store is ready"

- truth: "Each agent card shows hex coordinates (q, r)"
  status: failed
  reason: "User reported: pass but does not show hex coordinates"
  severity: minor
  test: 7
  root_cause: "AgentCard line 30 checks hasLocation = agent.hex && agent.hex.q !== undefined. Some old agents may have hexId=null in database, so hex relation is undefined. Additionally, some agents loaded may have stale data without hex info."
  artifacts:
    - path: "packages/client/src/components/agents/AgentCard.tsx"
      issue: "Condition at line 30 hides location when hex is undefined"
  missing:
    - "Ensure all agents have hex placement in database"
    - "Consider showing 'Unassigned' instead of hiding location section"

- truth: "Hex tooltip readable at default zoom"
  status: failed
  reason: "User reported: gui is small unless I zoom in"
  severity: cosmetic
  test: 8
  root_cause: "HexTooltip uses distanceFactor={12} in Drei Html component (line 71), which scales tooltip with camera distance. At default zoom level, tooltip becomes too small to read."
  artifacts:
    - path: "packages/client/src/scene/HexTooltip.tsx"
      issue: "distanceFactor={12} at line 71 causes distance-based scaling"
  missing:
    - "Increase distanceFactor to reduce scaling effect (e.g., 20-30)"
    - "Or use transform='none' to prevent scaling entirely"
    - "Or increase base font sizes"

- truth: "Agent resource totals update in real-time, stats visible, locate button works"
  status: failed
  reason: "User reported: old agents dont render, no locate button, total mined stats barely visible (black text on grey)"
  severity: major
  test: 9
  root_cause: "Three separate issues: (1) Grid rendering - same as Test 3 root cause. (2) Locate button - only shows when hasLocation=true, same as Test 7. (3) Text contrast - AgentDashboard lines 167-171 resource values don't have explicit color, inherit browser default (black) on grey background (#2D2D31)"
  artifacts:
    - path: "packages/client/src/components/agents/AgentDashboard.tsx"
      issue: "Lines 168-171: Resource values (Au/Ag/Cu/Fe numbers) have no color set, default to black"
  missing:
    - "Add explicit color: '#FFFFFF' or color: '#E0E0E0' to resource value spans"
    - "Or set parent div color to light color for inheritance"
