---
phase: 06-economy-distribution
plan: 01
subsystem: database
tags: [prisma, postgresql, economy, claims, earnings]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: User model with wallet authentication
  - phase: 05-agent-deployment
    provides: Agent model with mining states
provides:
  - FeeDeposit model for tracking fee deposits from DEPLOYMENT and PUMPFUN sources
  - Claim model for tracking user claim history with transaction signatures
  - EarningsSnapshot model for weighted earnings scores per user
  - User relations to claims and earningsSnapshot
affects: [06-02 (earnings calculation), 06-03 (claim API), 06-04 (distribution UI)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BigInt for lamports storage
    - Unique constraints on transaction signatures
    - FeeSource enum for deposit categorization

key-files:
  created: []
  modified:
    - packages/server/prisma/schema.prisma

key-decisions:
  - "Used prisma db push instead of migrate dev due to schema drift"
  - "FeeSource enum with DEPLOYMENT and PUMPFUN values"
  - "EarningsSnapshot as one-per-user cumulative tracker (not periodic snapshots)"

patterns-established:
  - "Economy tables use BigInt for lamport amounts"
  - "Transaction signatures stored as unique strings for deduplication"

# Metrics
duration: 2min
completed: 2026-01-21
---

# Phase 06 Plan 01: Economy Database Schema Summary

**Prisma schema extended with FeeDeposit, Claim, and EarningsSnapshot models for tracking fee sources, user claims, and weighted mining contributions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-21T06:36:08Z
- **Completed:** 2026-01-21T06:38:34Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Added FeeDeposit model to track fee deposits with source type (DEPLOYMENT/PUMPFUN)
- Added Claim model to track user claims with transaction signatures
- Added EarningsSnapshot model to track cumulative weighted mining scores per user
- Added relations to User model (claims[], earningsSnapshot?)
- Database schema synced and Prisma Client regenerated

## Task Commits

Each task was committed atomically:

1. **Tasks 1-2: Add FeeDeposit, Claim, and EarningsSnapshot models** - `7e55e79` (feat)
   - Combined because schema validation requires all models present

**Note:** Task 3 (migration) used `prisma db push` due to schema drift - no migration files generated

## Files Created/Modified
- `packages/server/prisma/schema.prisma` - Added FeeSource enum, FeeDeposit, Claim, EarningsSnapshot models and User relations

## Decisions Made
- **Used `prisma db push` instead of migrations:** Database had schema drift (tables existed but weren't tracked by migrations). Using `db push` syncs schema directly without requiring a database reset.
- **EarningsSnapshot as cumulative tracker:** One snapshot per user that gets updated as mining progresses, not periodic point-in-time snapshots.
- **BigInt for all lamport amounts:** Consistent with existing mining state pattern.

## Deviations from Plan

### Schema Drift Handling

- **Found during:** Task 3 (migration)
- **Issue:** Database had existing tables created via `db push` without migration tracking
- **Fix:** Used `prisma db push` instead of `prisma migrate dev` to sync schema without reset
- **Impact:** No migration files created, but schema is correctly synced to database

---

**Total deviations:** 1 (process deviation for migration approach)
**Impact on plan:** Schema is correctly applied. Future migrations may require baseline reset.

## Issues Encountered
- Schema validation failed initially because EarningsSnapshot model was referenced in User before being defined - combined Tasks 1 and 2 into single commit

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Database schema ready for earnings calculation service (06-02)
- FeeDeposit, Claim, EarningsSnapshot types available in Prisma Client
- Ready to implement fee tracking, earnings calculation, and claim endpoints

---
*Phase: 06-economy-distribution*
*Completed: 2026-01-21*
