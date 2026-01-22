---
status: diagnosed
phase: 07-scale-launch
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md]
started: 2026-01-22T08:48:00Z
updated: 2026-01-22T09:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Hex world renders with chunking
expected: Open http://localhost:5173 in browser. The 3D hexagonal world should load and render smoothly. You should see colored hexes in a large grid pattern. Frame rate should feel smooth (60 FPS target).
result: pass

### 2. Camera navigation works
expected: Click and drag to rotate the camera around the hex world. Scroll wheel to zoom in/out. Middle mouse button or shift+drag to pan. All controls should feel responsive.
result: pass

### 3. LOD visible when zooming out
expected: Zoom out significantly from the hex world. Distant hexes should appear simpler (less detailed geometry). This is the LOD (Level of Detail) system working - hexes far from camera use simplified meshes.
result: pass

### 4. Mobile layout on narrow viewport
expected: Resize browser to narrow width (<768px) OR open DevTools and toggle device toolbar to phone size. UI should switch to mobile layout with bottom navigation bar showing AGENTS, EARNINGS, SETTINGS tabs.
result: issue
reported: "resizing works but I do not see the deploy agent button and heat map button"
severity: major

### 5. Mobile bottom sheets work
expected: In mobile view, tap AGENTS or EARNINGS in the bottom nav. A bottom sheet should slide up from the bottom with content. Can swipe down to dismiss.
result: issue
reported: "pass but the sizing of the sheet isnt fitting to mobile view"
severity: minor

### 6. Quality settings available
expected: In mobile view, tap SETTINGS. A bottom sheet should appear with graphics quality options (Low/Medium/High). Selecting a quality level should apply immediately.
result: pass

### 7. Wallet connects successfully
expected: Click the Connect Wallet button. Phantom or Solflare wallet extension should prompt for connection. After approving, wallet address should appear truncated in the UI and SOL balance should display.
result: pass

### 8. Admin dashboard accessible for admin wallet
expected: If your wallet is configured as admin (ADMIN_WALLET_1 in server .env), after connecting you should see an Admin button in the header. Clicking it opens the admin dashboard with tabs: Metrics, Users, Economy.
result: issue
reported: "this is the dev wallet 2qaYB64KpD1yNbmgVSytCBcSpF2hJUd2fmXpa7P5cF7f but I dont see the admin button"
severity: major

### 9. Admin metrics show real-time data
expected: In admin dashboard Metrics tab, you should see cards showing: Total Users, Total Agents, Total Mined (resources), Total Fees, API Latency. Values update every 2 seconds without page refresh.
result: skipped
reason: Blocked by test 8 (admin dashboard not accessible)

### 10. Admin user management works
expected: In admin dashboard Users tab, you should see a table of users with wallet addresses, roles, agent counts, and join dates. Search box filters the list. Pagination works if many users.
result: skipped
reason: Blocked by test 8 (admin dashboard not accessible)

### 11. Admin economy controls visible
expected: In admin dashboard Economy tab, you should see: Emergency Pause section with status indicator, Resource Weights editor (Gold, Silver, Copper, Iron), and Minimum Claim display.
result: skipped
reason: Blocked by test 8 (admin dashboard not accessible)

### 12. Emergency pause confirmation
expected: Click "Emergency Pause" button in Economy tab. A confirmation dialog should appear asking to confirm. Cancel should dismiss. Confirm should change status to PAUSED (red pulsing indicator).
result: skipped
reason: Blocked by test 8 (admin dashboard not accessible)

### 13. Transaction toast notifications appear
expected: Perform any blockchain transaction (deploy agent or claim earnings). Toast notifications should appear in corner showing transaction status: processing, success with Solscan link, or error details.
result: pass

## Summary

total: 13
passed: 6
issues: 3
pending: 0
skipped: 4

## Gaps

- truth: "Mobile layout shows deploy agent button and heat map button"
  status: failed
  reason: "User reported: resizing works but I do not see the deploy agent button and heat map button"
  severity: major
  test: 4
  root_cause: "MobileLayout component never includes DeployButton or heat map toggle - these only exist in desktop Header component"
  artifacts:
    - path: "packages/client/src/App.tsx"
      issue: "Mobile branch (lines 229-238) renders MobileLayout without action buttons; heatMapVisible not passed to mobile ThreeScene"
    - path: "packages/client/src/components/mobile/MobileLayout.tsx"
      issue: "No DeployButton import/component, no heat map toggle state or UI element"
  missing:
    - "DeployButton needs to be added to MobileLayout (in header, FAB, or nav area)"
    - "Heat map toggle needs to be added (nav item, settings panel, or FAB)"
    - "heatMapVisible state + toggle needs to be passed from App.tsx to MobileLayout to ThreeScene"
  debug_session: ".planning/debug/mobile-buttons-missing.md"

- truth: "Bottom sheet sizing fits mobile viewport"
  status: failed
  reason: "User reported: pass but the sizing of the sheet isnt fitting to mobile view"
  severity: minor
  test: 5
  root_cause: "snapPoints prop incorrectly configured - values [0.9, 0.5, 0.25] not in ascending order, missing 0 (closed) and 1 (fully open)"
  artifacts:
    - path: "packages/client/src/components/mobile/BottomSheet.tsx"
      issue: "snapPoints default value violates library requirements: must be ascending, first=0, last=1"
  missing:
    - "snapPoints should be in ascending order: [0, 0.25, 0.5, 0.9]"
    - "initialSnap should be updated to correct index after reordering"
    - "CSS may need height adjustments for safe-area-inset-bottom (nav bar)"
  debug_session: ".planning/debug/bottom-sheet-sizing.md"

- truth: "Admin button visible for configured admin wallet"
  status: failed
  reason: "User reported: this is the dev wallet 2qaYB64KpD1yNbmgVSytCBcSpF2hJUd2fmXpa7P5cF7f but I dont see the admin button"
  severity: major
  test: 8
  root_cause: "Configuration timing issue - server restart and user re-login required after adding ADMIN_WALLET_1 env var (not a code bug)"
  artifacts:
    - path: "packages/server/.env"
      issue: "None - ADMIN_WALLET_1 is correctly configured"
    - path: "packages/server/src/middleware/adminAuth.ts"
      issue: "ADMIN_WALLETS evaluated at module load time (design, not bug)"
  missing:
    - "Server restart (to reload env vars into ADMIN_WALLETS)"
    - "User logout + login (to trigger auto-promotion in /auth/verify)"
  debug_session: ".planning/debug/admin-button-not-visible.md"
