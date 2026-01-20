---
phase: 03-real-time-simulation
plan: 03
subsystem: simulation
tags: [tick-loop, websocket, persistence, graceful-shutdown]

# Dependency graph
requires:
  - phase: 03-01
    provides: "Socket.io server, event types, getIO()"
  - phase: 03-02
    provides: "Agent cache, mining logic, relocation logic"
provides:
  - "Main tick loop (5-second interval)"
  - "Write-behind persistence to PostgreSQL (30-second flush)"
  - "Hot agent restoration on startup"
  - "Graceful shutdown with state preservation"
affects: [03-04, 04-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recursive setTimeout for drift-free timing"
    - "Write-behind caching with periodic flush"
    - "Batch Redis updates via pipeline"
    - "Signal handlers for graceful shutdown"

key-files:
  created:
    - "packages/server/src/cache/persistence.ts"
    - "packages/server/src/simulation/tickLoop.ts"
  modified:
    - "packages/server/src/index.ts"

key-decisions:
  - "5-second tick interval with recursive setTimeout (no drift)"
  - "30-second flush interval (every 6 ticks) for DB persistence"
  - "10-second force exit timeout on shutdown"
  - "Graceful handling of missing tables during development"

patterns-established:
  - "Tick overlap protection with isProcessing flag"
  - "Map-based user update grouping for efficient WebSocket broadcast"

# Metrics
duration: 3.5min
completed: 2026-01-20
---

# Phase 3 Plan 3: Mining Tick Loop with Persistence Summary

**5-second tick loop with mining/relocation processing, WebSocket broadcast, 30-second PostgreSQL flush, and graceful shutdown**

## Performance

- **Duration:** 3.5 min
- **Started:** 2026-01-20T07:38:02Z
- **Completed:** 2026-01-20T07:41:30Z
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- PostgreSQL persistence layer for write-behind caching
- Main tick loop with mining and relocation processing
- WebSocket event broadcasting to user-specific rooms
- Server integration with graceful shutdown handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create persistence module for PostgreSQL sync** - `15e2935` (feat)
2. **Task 2: Create main tick loop** - `7083d60` (feat)
3. **Task 3: Integrate tick loop into server with graceful shutdown** - `fb0cbb8` (feat)

## Files Created/Modified

**Created:**
- `packages/server/src/cache/persistence.ts` - Write-behind persistence (load/flush agents)
- `packages/server/src/simulation/tickLoop.ts` - Main tick loop controller

**Modified:**
- `packages/server/src/index.ts` - Added tick loop startup and shutdown handlers

## Key Code Patterns

### Tick Loop with Drift Prevention
```typescript
function scheduleNextTick(): void {
  tickLoopId = setTimeout(async () => {
    await processTick();
    scheduleNextTick();
  }, TICK_INTERVAL);
}
```

### Graceful Shutdown
```typescript
async function shutdown(signal: string): Promise<void> {
  stopTickLoop();
  await flushToPostgres();
  await redis.quit();
  io.close();
  httpServer.close();
}
```

### Mining Agent Processing
```typescript
// Calculate yield -> Deduct from hex -> Add to agent -> Queue updates
const yield_ = calculateMiningYield(hex.resourceType, hex.resourceAmount);
const { depleted } = await deductHexResources(hex.id, yield_.amount);
const newResources = addResourcesToAgent(currentResources, yield_);
```

## Decisions Made

- **5-second tick interval:** Balances real-time feel with server load
- **30-second flush interval:** 6 ticks between DB writes reduces I/O
- **Recursive setTimeout:** Prevents timing drift vs setInterval
- **isProcessing flag:** Prevents tick overlap during slow processing
- **10-second shutdown timeout:** Allows flush to complete, prevents hang

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added missing table error handling**
- **Found during:** Task 3 verification
- **Issue:** Server crashed on startup when database tables don't exist (development scenario)
- **Fix:** Added try/catch in loadHotAgentsFromPostgres with graceful warning
- **Files modified:** packages/server/src/cache/persistence.ts
- **Commit:** fb0cbb8 (Task 3 commit)

**Total deviations:** 1 auto-fixed (missing critical functionality)
**Impact on plan:** Improved development experience, no scope creep

## Verification Results

- [x] Server startup shows "Tick loop started (interval: 5000ms)"
- [x] Hot agent loading attempted (with graceful handling of missing tables)
- [x] Health endpoint returns healthy status
- [x] TypeScript builds without errors
- [x] All exports present: startTickLoop, stopTickLoop, getCurrentTick, isTickLoopRunning

## Server Startup Output
```
Server running on http://localhost:3001
Health check: http://localhost:3001/health
WebSocket: ws://localhost:3001
Starting tick loop...
Database tables not yet created, skipping agent load
Tick loop started (interval: 5000ms)
```

## Issues Encountered

None beyond the graceful table handling fix.

## User Setup Required

None - tick loop auto-starts with server.

## Next Phase Readiness

- Tick loop fully operational and ready for testing
- WebSocket events will broadcast when agents are cached
- Persistence will sync when agents exist in database
- Ready for: end-to-end testing with seeded agents (Plan 04)

---
*Phase: 03-real-time-simulation*
*Completed: 2026-01-20*
