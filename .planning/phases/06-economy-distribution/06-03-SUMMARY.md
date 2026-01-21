---
phase: 6
plan: 3
subsystem: economy
tags: [earnings, leaderboard, redis, weighted-scoring]

dependency-graph:
  requires: [06-01, 06-02]
  provides: [weighted-scoring, leaderboard-ranking, earnings-calculation]
  affects: [06-04, 06-05]

tech-stack:
  added: []
  patterns: [redis-zset, bigint-precision, batch-operations]

key-files:
  created:
    - packages/server/src/services/earningsService.ts
    - packages/server/src/services/leaderboardService.ts
  modified:
    - packages/server/src/cache/persistence.ts
    - packages/server/src/simulation/tickLoop.ts

decisions:
  - key: resource-weights-scaled
    choice: "Weights scaled by 1000 to avoid floats (Gold 4000n, Silver 2000n, Copper 1500n, Iron 1000n)"
    rationale: BigInt precision without floating point errors
  - key: user-pool-50-percent
    choice: "50% of fee pool distributed to users"
    rationale: Matches PROJECT.md specification for sustainable economics
  - key: redis-zset-leaderboard
    choice: "Redis ZSET for O(log N) rank operations"
    rationale: Efficient leaderboard queries without table scans

metrics:
  duration: 7 min
  completed: 2026-01-21
---

# Phase 6 Plan 3: Earnings & Leaderboard Services Summary

Weighted resource scoring with Redis ZSET leaderboard for O(log N) ranking operations.

## What Was Built

### earningsService.ts
- **calculateWeightedScore()**: Weighted sum using multipliers (Gold 4x, Silver 2x, Copper 1.5x, Iron 1x)
- **calculateUserShare()**: User's proportional share of 50% fee pool
- **getEarningsForUser()**: Full earnings data including claimable amount
- **updateUserEarningsSnapshot()**: Update snapshot record for user

### leaderboardService.ts
- **updateUserScore()**: ZADD to insert/update score
- **getTopUsers()**: ZREVRANGE to get top N users with scores
- **getUserRank()**: ZREVRANK + ZSCORE + ZCARD for rank info
- **getUserPercentile()**: Calculate percentile from rank/total
- **removeUser()**: ZREM to remove from leaderboard
- **updateScoresBatch()**: Pipeline for efficient bulk updates

### Integration
- persistence.ts now groups agents by owner during flush
- EarningsSnapshot updated in PostgreSQL transaction
- Leaderboard scores batch-updated in Redis after flush

## Resource Weight Multipliers

| Resource | Weight | Scaled (x1000) |
|----------|--------|----------------|
| Gold     | 4x     | 4000n          |
| Silver   | 2x     | 2000n          |
| Copper   | 1.5x   | 1500n          |
| Iron     | 1x     | 1000n          |

**Example**: 100 Gold + 200 Silver + 300 Copper + 400 Iron = 1650 weighted score

## Verification Results

- npm run build succeeds
- Weighted score calculation verified: 100*4 + 200*2 + 300*1.5 + 400*1 = 1650
- User share calculation verified: (100/1000) * (10M * 0.5) = 500,000
- Redis ZSET operations tested (add, rank, percentile, remove)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed agent:arrived event type mismatch**
- **Found during:** Build verification
- **Issue:** arrivals array missing hexQ/hexR fields required by typed socket event
- **Fix:** Added hexQ and hexR to arrivals type and processRelocatingAgent signature
- **Files modified:** packages/server/src/simulation/tickLoop.ts
- **Commit:** 864b7c7

## Commits

| Hash    | Type | Description                                |
|---------|------|--------------------------------------------|
| f6356db | feat | Add earnings and leaderboard services      |
| 2e863e4 | feat | Integrate leaderboard updates into flush   |
| 864b7c7 | fix  | Fix agent:arrived event type mismatch      |

## Next Phase Readiness

- Earnings calculation ready for claim API
- Leaderboard ready for display endpoints
- Weighted scores automatically maintained during mining flush
