---
type: summary
phase: "06"
plan: "06"
subsystem: client-ui
tags: [earnings, dashboard, claim, zustand, react, pixel-theme]

dependency-graph:
  requires:
    - "06-05" # Claim API endpoints
    - "04-01" # Wallet adapter integration
  provides:
    - earnings-dashboard-ui
    - claim-button-component
    - earnings-state-management
  affects:
    - "06-07" # UI integration (if any)
    - "07-xx" # Final polish phase

tech-stack:
  added: []
  patterns:
    - zustand-store-for-earnings
    - socket-event-subscription
    - wallet-signed-transactions
    - slide-panel-ui-pattern

key-files:
  created:
    - packages/client/src/stores/earningsStore.ts
    - packages/client/src/hooks/useEarnings.ts
    - packages/client/src/hooks/useClaimEarnings.ts
    - packages/client/src/components/earnings/EarningsDashboard.tsx
    - packages/client/src/components/earnings/ClaimButton.tsx
    - packages/client/src/components/earnings/ClaimConfirmDialog.tsx
    - packages/client/src/components/earnings/index.ts
  modified: []

decisions:
  - id: earnings-store-bigint-strings
    choice: Store BigInt values as strings in Zustand
    rationale: Consistent with agentStore pattern, JSON serialization compatibility

metrics:
  duration: 4 min
  completed: 2026-01-21
---

# Phase 06 Plan 06: Earnings Dashboard UI Summary

Zustand store + React hooks + Pixel-themed UI components for earnings display and claim flow with wallet signature

## What Was Built

### Earnings Store (earningsStore.ts)
- Zustand store for earnings state management
- Stores claimable, totalClaimed, weightedScore, sharePercent, rank, percentile
- BigInt amounts stored as strings for JSON compatibility
- Helper methods: getClaimableSOL(), getTotalClaimedSOL(), getMinClaimSOL()

### useEarnings Hook
- Fetches earnings from GET /api/earnings
- Fetches leaderboard from GET /api/leaderboard in parallel
- Subscribes to socket events: earnings:update, claim:success, claim:error
- Returns computed SOL values and reload function

### useClaimEarnings Hook
- Multi-step claim flow with status tracking
- ClaimStatus: idle -> building -> signing -> sending -> confirming -> success/error
- POST /api/earnings/claim to get unsigned transaction
- Wallet signature via signTransaction
- Send raw transaction to chain
- POST /api/earnings/confirm after on-chain confirmation
- Graceful error handling for user rejection

### EarningsDashboard Component
- Slide-in panel from right (mirrors AgentDashboard from left)
- Hero section showing claimable SOL with live indicator
- Stats grid: Total Claimed, Mining Score, Pool Share, Rank
- ClaimButton integration with confirmation dialog
- Success state shows explorer link
- Error state with retry option
- Footer shows minimum claim amount

### ClaimButton Component
- Pixel-themed button with status text
- Loading states with animated pickaxe
- Gold styling when claimable, disabled when below minimum
- Shows minimum claim notice when can't claim

### ClaimConfirmDialog Component
- Modal confirmation before claim
- Shows amount to receive
- Transaction fee notice
- Cancel/Claim Now buttons
- Escape key closes (when not processing)

## Key Implementation Details

### State Flow
```
User opens dashboard
  -> useEarnings fetches /api/earnings + /api/leaderboard
  -> earningsStore updated
  -> Socket subscribes to user room

User clicks Claim
  -> ClaimConfirmDialog opens
  -> User confirms
  -> useClaimEarnings.claim() starts
  -> status: building -> signing -> sending -> confirming -> success
  -> Socket receives claim:success -> triggers reload
```

### Pixel Theme Consistency
- Matches AgentDashboard, WalletDrawer patterns
- Press Start 2P font throughout
- Gold (#FFAA00) for SOL amounts
- Inventory-style panels and buttons
- 3D box-shadow effects

### Minimum Claim Enforcement
- Button disabled when claimable < 0.025 SOL
- Shows "MIN: 0.025 SOL" notice
- Server also enforces (400 response)

## Verification

- [x] npm run build succeeds in packages/client
- [x] EarningsDashboard component created
- [x] Claim button shows/hides based on balance
- [x] Pixel theme matches existing UI

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Dashboard is ready for integration into main app. To use:

```tsx
import { EarningsDashboard } from './components/earnings';

// In App.tsx
const [earningsOpen, setEarningsOpen] = useState(false);

<button onClick={() => setEarningsOpen(true)}>EARNINGS</button>
<EarningsDashboard isOpen={earningsOpen} onClose={() => setEarningsOpen(false)} />
```

Note: Dashboard requires wallet authentication to display. Will return null if not authenticated.
