---
phase: 05-agent-deployment
plan: 03
subsystem: api
tags: [express, prisma, solana, cnft, bubblegum, metaplex]

# Dependency graph
requires:
  - phase: 05-01
    provides: Agent Factory contract with treasury PDA
  - phase: 05-02
    provides: Umi SDK setup for server minting
provides:
  - Agent deployment endpoints (GET /, POST /deploy, POST /confirm)
  - cNFT minting service using Metaplex Bubblegum
  - Agent NFT metadata endpoint for Metaplex URI
  - requireAuth middleware with userId extraction
affects: [05-04, 05-05, 06-claims]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server-side cNFT minting with Bubblegum mintV1
    - Two-phase deployment (deploy tx + confirm with mint)
    - Asset ID derivation via findLeafAssetIdPda

key-files:
  created:
    - packages/server/src/services/agentMinting.ts
    - packages/server/src/routes/agents.ts
  modified:
    - packages/server/prisma/schema.prisma
    - packages/server/src/index.ts
    - packages/server/src/middleware/authMiddleware.ts

key-decisions:
  - "Two-phase deploy: client signs SOL transfer, server confirms and mints cNFT"
  - "Asset ID derived from merkle tree + leaf index via findLeafAssetIdPda"
  - "Agent creation succeeds even if minting fails (mintPending flag)"
  - "requireAuth middleware extracts userId from JWT for protected routes"

patterns-established:
  - "Agent deployment flow: POST /deploy returns unsigned tx, client signs, POST /confirm creates agent"
  - "NFT metadata served at /api/agents/:id/metadata for Metaplex URI"
  - "Soft cap of 20 agents per user enforced at endpoint level"

# Metrics
duration: 4min
completed: 2026-01-21
---

# Phase 05 Plan 03: Agent Minting Summary

**Server-side agent deployment API with cNFT minting service using Metaplex Bubblegum and two-phase deployment flow**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-21T00:45:08Z
- **Completed:** 2026-01-21T00:49:30Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Updated Agent model with cNFT fields (mintAddress, deployTxSig, mintTxSig, agentIndex)
- Created agentMinting service with mintAgentNFT and getAgentMetadata functions
- Created agent routes with GET /, GET /:id/metadata, POST /deploy, POST /confirm endpoints
- Added requireAuth middleware with userId extraction from JWT
- Integrated agent router into Express server at /api/agents

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Prisma schema with cNFT fields** - `0fdbbaa` (feat)
2. **Task 2: Create agent minting service** - `a852059` (feat)
3. **Task 3: Create agent routes and integrate into server** - `0d41a70` (feat)

## Files Created/Modified

- `packages/server/prisma/schema.prisma` - Added mintAddress, deployTxSig, mintTxSig, agentIndex to Agent model
- `packages/server/src/services/agentMinting.ts` - cNFT minting service with Bubblegum
- `packages/server/src/routes/agents.ts` - Agent deployment and management routes
- `packages/server/src/middleware/authMiddleware.ts` - Added requireAuth middleware with userId
- `packages/server/src/index.ts` - Mounted agentRouter at /api/agents

## Decisions Made

- **Two-phase deployment flow:** Client signs SOL transfer to treasury, server confirms on-chain and mints cNFT. This separates payment from minting, allowing graceful handling if minting fails.
- **Asset ID derivation:** Using findLeafAssetIdPda with merkle tree and agentIndex-1 as leaf index. This may need adjustment for production if tree state diverges.
- **Graceful minting failure:** Agent record is created before minting attempt. If minting fails, mintPending flag is set and can be retried later.
- **requireAuth vs authMiddleware:** Created separate requireAuth middleware that enforces userId presence for protected routes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid assetId access on mint result**
- **Found during:** Task 3 verification (tsc --noEmit)
- **Issue:** `result.result.assetId` does not exist on RpcConfirmTransactionResult type
- **Fix:** Used findLeafAssetIdPda to derive asset ID from merkle tree and leaf index
- **Files modified:** packages/server/src/services/agentMinting.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 0d41a70 (Task 3 commit)

**2. [Rule 3 - Blocking] Added requireAuth middleware**
- **Found during:** Task 3 implementation
- **Issue:** Plan referenced requireAuth middleware that didn't exist in authMiddleware.ts
- **Fix:** Created requireAuth function that extracts userId from JWT payload
- **Files modified:** packages/server/src/middleware/authMiddleware.ts
- **Verification:** Routes compile and middleware is functional
- **Committed in:** a852059 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for TypeScript compilation and feature completeness. No scope creep.

## Issues Encountered

None - plan executed smoothly after fixing discovered issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Agent deployment endpoints ready for client integration
- POST /api/agents/deploy returns unsigned transaction for wallet signing
- POST /api/agents/confirm handles on-chain verification and cNFT minting
- MERKLE_TREE_ADDRESS environment variable required for minting to work
- Plan 05-04 (Client Deployment Flow) can integrate with these endpoints

---
*Phase: 05-agent-deployment*
*Completed: 2026-01-21*
