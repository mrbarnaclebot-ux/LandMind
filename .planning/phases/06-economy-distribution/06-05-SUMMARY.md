---
phase: 6
plan: 5
subsystem: api
tags: [routes, earnings, leaderboard, claim, socket-events, merkle-proof]
depends_on:
  requires: [06-03, 06-04]
  provides: [claim-api, leaderboard-api, earnings-api]
  affects: [07-ui]
tech-stack:
  added: []
  patterns: [optionalAuth-middleware, merkle-proof-transaction, socket-events-for-claims]
key-files:
  created:
    - packages/server/src/routes/earnings.ts
    - packages/server/src/routes/leaderboard.ts
  modified:
    - packages/server/src/middleware/authMiddleware.ts
    - packages/server/src/events/types.ts
    - packages/server/src/index.ts
decisions:
  - "optionalAuth middleware sets user context if token valid, otherwise null"
  - "MIN_CLAIM of 0.025 SOL to prevent dust claims"
  - "Claim transaction built server-side with Merkle proof"
  - "Socket events for real-time claim feedback"
metrics:
  duration: "2 min 43 sec"
  completed: "2026-01-21"
---

# Phase 6 Plan 5: Claim API Summary

Claim API routes for earnings queries, claim transaction building with Merkle proofs, and leaderboard with optional auth.

## What Was Built

### Earnings Routes (`/api/earnings`)

1. **GET /** - Returns user's earnings data (authenticated)
   - weightedScore, totalPoolScore, userShare
   - availableFeePool, claimableAmount, totalClaimed
   - canClaim flag and minClaimAmount

2. **POST /claim** - Builds claim transaction with Merkle proof (authenticated)
   - Validates minimum claim amount (0.025 SOL)
   - Generates Merkle tree from all user shares
   - Builds on-chain claim instruction with proof
   - Returns serialized transaction for client signing

3. **POST /confirm** - Records claim after on-chain confirmation (authenticated)
   - Verifies transaction on-chain
   - Updates EarningsSnapshot.totalClaimed
   - Creates Claim record
   - Emits claim:success socket event

### Leaderboard Route (`/api/leaderboard`)

1. **GET /** - Returns top 10 + user's rank if authenticated (public with optional auth)
   - Uses optionalAuth middleware
   - Returns topUsers array with wallet, score, rank
   - If authenticated: includes userRank and userPercentile
   - Highlights current user in top 10 with isCurrentUser flag

### Auth Middleware Enhancement

Added `optionalAuth` middleware:
- Sets req.walletAddress and req.userId if token is valid
- Passes through without error if no token or invalid token
- Enables public routes with optional user context

### Socket Events Added

```typescript
'earnings:update': (data: EarningsUpdateData) => void;
'leaderboard:update': (data: LeaderboardUpdateData) => void;
'claim:success': (data: ClaimSuccessData) => void;
'claim:error': (data: ClaimErrorData) => void;
```

## Technical Details

### Claim Transaction Building

```typescript
// Derive PDAs
[vaultStatePda] = findProgramAddressSync(['vault_state'], PROGRAM_ID)
[treasuryPda] = findProgramAddressSync(['treasury'], PROGRAM_ID)
[claimStatePda] = findProgramAddressSync(['claim_state', walletPubkey], PROGRAM_ID)

// Instruction accounts
keys: [claimer, vault_state, treasury, claim_state, system_program]

// Instruction data
discriminator (8 bytes) + amount (u64 LE) + proof (vec of [u8; 32])
```

### Merkle Proof Flow

1. Fetch all users' claimable amounts from EarningsSnapshot
2. Generate Merkle tree using keccak256 hashing
3. Extract proof for requesting user
4. Include proof in claim instruction data
5. On-chain contract verifies proof against stored root

## Verification

- [x] npm run build succeeds
- [x] Routes registered at /api/earnings and /api/leaderboard
- [x] Server binds (EADDRINUSE confirms code works, existing server running)
- [x] TypeScript types compile correctly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed non-existent status field from Claim model**
- **Found during:** Task verification (build)
- **Issue:** Plan referenced Claim.status but schema has no status field
- **Fix:** Removed status from create/response, used claimedAt instead
- **Commit:** a1af945

## Files Changed

| File | Change |
|------|--------|
| packages/server/src/routes/earnings.ts | Created - earnings/claim routes |
| packages/server/src/routes/leaderboard.ts | Created - leaderboard route |
| packages/server/src/middleware/authMiddleware.ts | Added optionalAuth |
| packages/server/src/events/types.ts | Added 4 socket event types |
| packages/server/src/index.ts | Registered new routes |

## Next Phase Readiness

Phase 6 economy layer API is complete:
- Earnings calculation service (06-03)
- Leaderboard service (06-03)
- Merkle proof service (06-04)
- Fee monitoring (06-04)
- API routes for all above (06-05)

Ready for:
- UI components to consume these APIs
- Integration testing with frontend
- End-to-end claim flow testing
