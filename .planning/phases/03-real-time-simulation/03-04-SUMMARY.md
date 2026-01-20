---
phase: 03-real-time-simulation
plan: 04
subsystem: testing
tags: [dev-routes, seeding, integration-testing, e2e-verification]

# Dependency graph
requires:
  - phase: 03-01
    provides: "Socket.io server, event types, getIO()"
  - phase: 03-02
    provides: "Agent cache, mining logic, relocation logic"
  - phase: 03-03
    provides: "Tick loop, persistence, graceful shutdown"
provides:
  - "Development-only test endpoints"
  - "Database seeding script"
  - "End-to-end simulation verification"
affects: [04-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Environment-guarded dev routes"
    - "Upsert for idempotent seeding"
    - "Deterministic resource distribution"

key-files:
  created:
    - "packages/server/src/routes/dev.ts"
    - "packages/server/prisma/seed.ts"
  modified:
    - "packages/server/src/index.ts"
    - "packages/server/package.json"

key-decisions:
  - "Dev routes disabled in production via NODE_ENV check"
  - "Radius-10 hexagonal grid pattern for seeding"
  - "Deterministic resource type assignment based on (q*7 + r*13) mod 4"
  - "1M resources per hex for extended testing"

patterns-established:
  - "Dev endpoint pattern with production guard"
  - "Seed script with explicit .env loading for workspace compatibility"

# Metrics
duration: ~8min
completed: 2026-01-20
---

# Phase 3 Plan 4: Integration Testing Summary

**Dev endpoints for testing, database seeding, and verified end-to-end simulation pipeline**

## Performance

- **Duration:** ~8 min (across checkpoint)
- **Started:** 2026-01-20
- **Completed:** 2026-01-20
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files created:** 2
- **Files modified:** 2

## Accomplishments

- Development-only routes for testing the mining simulation
- Database seed script with test user, hexes, and agent
- Complete end-to-end verification of simulation pipeline
- User approved full integration test suite

## Task Commits

Each task was committed atomically:

1. **Task 1: Create dev-only routes for testing** - `8e9b1aa` (feat)
2. **Task 2: Create database seed script** - `260983d` (feat)
3. **Task 3: Integration Testing Checkpoint** - Approved by user (human-verify)

Additional fix during execution:
- `888b6fb` (fix) - Load .env in seed script for workspace compatibility

## Files Created/Modified

**Created:**
- `packages/server/src/routes/dev.ts` - Development endpoints for testing
- `packages/server/prisma/seed.ts` - Database seeding script

**Modified:**
- `packages/server/src/index.ts` - Mounted dev router
- `packages/server/package.json` - Added db:seed script and prisma seed config

## Key Code Patterns

### Production Guard on Dev Routes
```typescript
devRouter.use((req: Request, res: Response, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});
```

### Hexagonal Grid Seeding
```typescript
for (let q = -radius; q <= radius; q++) {
  const r1 = Math.max(-radius, -q - radius);
  const r2 = Math.min(radius, -q + radius);
  for (let r = r1; r <= r2; r++) {
    // Deterministic resource distribution
    const typeIndex = Math.abs((q * 7 + r * 13) % 4);
    // ...
  }
}
```

### Workspace-Compatible .env Loading
```typescript
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../.env') });
```

## Dev Endpoints Available

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dev/status` | GET | Simulation status (tick, agents, hexes, users) |
| `/dev/users` | POST | Create test user with wallet pubkey |
| `/dev/hexes/seed` | POST | Seed hexes in hexagonal grid |
| `/dev/agents` | POST | Create agent and add to cache |
| `/dev/agents` | GET | Get all cached agents |
| `/dev/agents/:wallet` | GET | Get agents for specific user |
| `/dev/reset` | DELETE | Clear all test data |

## Decisions Made

- **Production guard:** Dev routes return 404 in production (security)
- **Explicit .env path:** Seed script loads from project root to work in workspace
- **1M resources per hex:** Allows extended testing without depletion
- **Deterministic distribution:** Resource types consistent across seed runs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Seed script failed to connect to database**
- **Found during:** Task 2 verification
- **Issue:** Seed script running via tsx from prisma/ dir couldn't find .env
- **Fix:** Added explicit dotenv.config with resolved path to project root
- **Files modified:** packages/server/prisma/seed.ts
- **Commit:** 888b6fb

**Total deviations:** 1 auto-fixed (blocking issue)
**Impact on plan:** Script works correctly in workspace environment

## Verification Results

**Setup verified:**
- [x] Docker running with PostgreSQL and Redis
- [x] Seed script completes: `npm run --workspace=@landmind/server db:seed`
- [x] Server starts: `npm run --workspace=@landmind/server dev`

**Integration tests verified (user approval):**
- [x] Tick loop running (5-second interval)
- [x] Dev endpoints functional
- [x] Agent creation via API
- [x] WebSocket events received by subscribed clients
- [x] Mining updates show increasing resources
- [x] State persists across server restart
- [x] Graceful shutdown works

## User Setup Required

For testing:
```bash
# Seed the database
npm run --workspace=@landmind/server db:seed

# Start the server
npm run --workspace=@landmind/server dev

# Test endpoints
curl http://localhost:3001/dev/status
curl -X POST http://localhost:3001/dev/agents \
  -H "Content-Type: application/json" \
  -d '{"walletPubkey": "test-wallet-pubkey-123"}'
```

## Phase 3 Complete

This plan completes Phase 3 (Real-Time Simulation). The full simulation pipeline is now operational:

1. **Socket.io server** with Redis adapter for scaling
2. **Agent caching** in Redis for fast tick processing
3. **Mining tick loop** (5-second interval) with resource accumulation
4. **Relocation logic** for depleted hexes
5. **PostgreSQL persistence** (30-second write-behind)
6. **WebSocket broadcast** to user-specific rooms
7. **Graceful shutdown** preserving state
8. **Dev endpoints** for testing
9. **Seed script** for development data

**Ready for:** Phase 4 (Deployment) or Phase 5 (Solana Contracts)

---
*Phase: 03-real-time-simulation*
*Completed: 2026-01-20*
