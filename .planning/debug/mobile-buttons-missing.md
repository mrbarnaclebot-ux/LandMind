---
status: diagnosed
trigger: "Mobile layout missing deploy agent and heat map buttons"
created: 2026-01-22T00:00:00Z
updated: 2026-01-22T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: Deploy agent and heat map buttons are only rendered in desktop layout, not in MobileLayout
test: Compare desktop layout component with MobileLayout component
expecting: Find buttons in desktop but absent from mobile
next_action: Read MobileLayout.tsx and find desktop equivalent

## Symptoms

expected: Deploy agent button and heat map toggle should be accessible in mobile view
actual: Mobile layout shows bottom nav (AGENTS, EARNINGS, SETTINGS) but deploy agent and heat map buttons are missing
errors: None - just missing UI elements
reproduction: View app at <768px width
started: Unknown - may have always been this way

## Eliminated

## Evidence

- timestamp: 2026-01-22T00:01:00Z
  checked: App.tsx desktop vs mobile rendering
  found: Desktop header contains DeployButton and HEAT MAP button (lines 101-123). Mobile branch (line 229-238) renders only MobileLayout which does NOT include these buttons.
  implication: Buttons are desktop-only, never passed to or included in MobileLayout

- timestamp: 2026-01-22T00:02:00Z
  checked: MobileLayout.tsx component structure
  found: MobileLayout has MobileHeader (logo + ConnectButton only), bottom nav (AGENTS, EARNINGS, SETTINGS), and BottomSheet panels. No DeployButton import or usage. No heat map toggle anywhere.
  implication: MobileLayout was designed without these action buttons

- timestamp: 2026-01-22T00:03:00Z
  checked: How heatMapVisible is passed in App.tsx
  found: Desktop ThreeScene gets heatMapVisible prop (line 252). Mobile ThreeScene inside MobileLayout has NO heatMapVisible prop passed (line 233) - it uses default false.
  implication: Heat map toggle wouldn't work on mobile even if button existed because state isn't wired

- timestamp: 2026-01-22T00:04:00Z
  checked: DeployButton component requirements
  found: DeployButton is self-contained (handles its own state), only needs wallet connection. Can be reused in mobile.
  implication: DeployButton can be added to MobileLayout without major changes

## Resolution

root_cause: MobileLayout component was implemented without DeployButton or heat map toggle. These buttons exist only in the desktop Header component (App.tsx lines 90-124). The mobile path (App.tsx line 229) renders MobileLayout which has no equivalent action buttons - it only has navigation tabs (AGENTS, EARNINGS, SETTINGS).
fix:
verification:
files_changed: []
