---
phase: 07-scale-launch
plan: 06
subsystem: admin
tags: [economy, admin, pause, weights, redis]

dependency_graph:
  requires:
    - 07-05  # Admin Dashboard infrastructure
  provides:
    - EconomyConfig model with weight/pause storage
    - Economy service with Redis caching
    - Admin economy endpoints (GET/PATCH/pause/unpause/deposit)
    - EconomyControls UI component
  affects:
    - claim flow (pause check)
    - earnings calculation (configurable weights)

tech_stack:
  added: []
  patterns:
    - Redis-cached config with 60s TTL
    - Emergency pause with admin tracking
    - Confirmation dialogs for destructive actions

files:
  key_files:
    created:
      - packages/server/src/services/economyService.ts
      - packages/client/src/admin/EconomyControls.tsx
    modified:
      - packages/server/prisma/schema.prisma
      - packages/server/src/routes/admin.ts
      - packages/server/src/routes/earnings.ts
      - packages/server/src/services/earningsService.ts
      - packages/client/src/admin/AdminDashboard.tsx
      - packages/client/src/admin/admin.css

decisions:
  - key: redis-cached-economy-config
    choice: 60-second TTL cache for economy config
    why: Balance between freshness and performance
  - key: pause-tracking
    choice: Store pausedAt and pausedBy in EconomyConfig
    why: Audit trail for emergency actions
  - key: confirmation-dialogs
    choice: Require confirm() before pause action
    why: Prevent accidental emergency pause

metrics:
  duration: 4 min
  completed: 2026-01-22
---

# Phase 7 Plan 6: Economy Controls Summary

**One-liner:** Admin economy controls with configurable weights, emergency pause, and Redis-cached config management.

## What Was Built

### 1. EconomyConfig Model (Task 1)
Added database model for economy configuration:
- `minClaimAmount` - Minimum claim threshold in lamports (default 0.025 SOL)
- `goldWeight`, `silverWeight`, `copperWeight`, `ironWeight` - Resource weight multipliers
- `isPaused`, `pausedAt`, `pausedBy` - Emergency pause state tracking
- Defaults match existing hardcoded values for seamless migration

### 2. Economy Service (Task 1)
Created `/packages/server/src/services/economyService.ts`:
- `getEconomyConfig()` - Retrieves config with 60-second Redis cache
- `updateEconomyConfig()` - Updates config and invalidates cache
- `isClaimsPaused()` - Helper for pause check
- `getResourceWeights()` - Returns weights as BigInt for calculations
- Automatic default config creation on first access

### 3. Claim Pause Integration (Task 1)
Updated earnings route to check pause state:
- Returns 503 "Claims are currently paused" when paused
- Check happens before any claim processing
- Allows platform to halt claims during incidents

### 4. Admin Economy Endpoints (Task 2)
Added to `/admin` router:
- `GET /admin/economy` - Returns full config
- `PATCH /admin/economy` - Update weights
- `POST /admin/economy/pause` - Emergency pause with admin tracking
- `POST /admin/economy/unpause` - Resume claims
- `POST /admin/economy/deposit` - Manual fee deposit for testing

### 5. EconomyControls UI (Task 3)
Created admin panel component with:
- Emergency pause/unpause section with confirmation dialog
- Visual status indicator (green ACTIVE / red pulsing PAUSED)
- Resource weights editor with 4 input fields
- Save button for weight changes
- Minimum claim display (read-only - set in contract)
- Last updated timestamp

## Technical Details

### Redis Caching Pattern
```typescript
const CONFIG_CACHE_KEY = 'economy:config';
const CACHE_TTL = 60; // 1 minute

// Get with cache
const cached = await redis.get(CONFIG_CACHE_KEY);
if (cached) return JSON.parse(cached, reviver);

// Fetch and cache
const config = await prisma.economyConfig.findUnique({...});
await redis.setex(CONFIG_CACHE_KEY, CACHE_TTL, JSON.stringify(config, replacer));
```

### Emergency Pause Flow
1. Admin clicks "Emergency Pause" in dashboard
2. Confirmation dialog requires explicit approval
3. API records `isPaused=true`, `pausedAt=now()`, `pausedBy=walletAddress`
4. Redis cache invalidated
5. All subsequent claim attempts return 503

### Configurable Weights
- Added `calculateWeightedScoreWithConfig()` for async weight lookup
- Original `calculateWeightedScore()` kept for sync operations
- Weights scale: 1000 = 1x multiplier

## Files Changed

| File | Change |
|------|--------|
| `schema.prisma` | Added EconomyConfig model |
| `economyService.ts` | New service for config management |
| `earningsService.ts` | Added configurable weight calculation |
| `earnings.ts` | Added pause check to claim endpoint |
| `admin.ts` | Added economy endpoints |
| `EconomyControls.tsx` | New UI component |
| `AdminDashboard.tsx` | Import and render EconomyControls |
| `admin.css` | Economy-specific styling |

## Verification Status

- [x] EconomyConfig model stores parameters
- [x] Economy service provides config with caching
- [x] /admin/economy GET returns config
- [x] /admin/economy PATCH updates weights
- [x] /admin/economy/pause pauses claims
- [x] /admin/economy/unpause resumes claims
- [x] EconomyControls UI shows current state
- [x] Pause button shows confirmation dialog
- [x] Pause state visually distinct (red pulsing)
- [x] Weights editable and saveable
- [x] Claim endpoint checks pause state

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 5c2f190 | feat(07-06): add EconomyConfig model and economy service |
| 687a0a5 | feat(07-06): add economy API endpoints to admin routes |
| c0aebcb | feat(07-06): add economy controls UI to admin dashboard |

## Next Phase Readiness

Phase 7 complete. All 6 plans executed successfully.

**Final state:**
- Admin dashboard with real-time metrics
- User management with role controls
- Economy controls with emergency pause
- Platform ready for launch

**Remaining items from todos:**
- Deploy smart contract to devnet (blocks vault init and live claiming)
- Add clouds to 3D environment (visual polish)
