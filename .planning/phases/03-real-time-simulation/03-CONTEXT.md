---
phase: 03-real-time-simulation
status: discussed
started: 2026-01-20T13:00:00Z
updated: 2026-01-20T13:15:00Z
---

# Phase 3: Real-Time Simulation - Context

## Phase Goal

Mining simulation runs continuously and broadcasts updates to connected clients

## Requirements

- BACKEND-01: Mining simulation runs off-chain with periodic state sync
- BACKEND-02: Real-time updates delivered via WebSocket
- AGENT-03: User's agent mines virtual resources (gold, silver, copper, iron)
- AGENT-04: User's agent automatically relocates to new hex when current hex depletes (free)

## Success Criteria

1. Mining tick loop runs on server and updates agent resource totals
2. Clients receive real-time mining updates via WebSocket
3. Redis caches hot game state for fast access
4. Agents automatically relocate when their hex depletes (simulated)
5. Mining state persists across server restarts

## Existing Infrastructure

From Phase 1:
- PostgreSQL database with schema: User, Agent, Hex, MiningState tables
- Redis clients configured (regular + pub/sub)
- Express server with health endpoint
- Prisma ORM configured

Key schema details:
- Agent has status: IDLE | MINING | RELOCATING
- MiningState tracks gold, silver, copper, iron per agent
- Hex has resourceType and resourceAmount (BigInt, default 1M)

## Decisions Made

### 1. Tick Rate & Mining Math

**Tick Rate:** 5 seconds
- Balance between responsiveness and WebSocket traffic
- ~12 updates per minute per client

**Mining Formula:** Hex-based rate
- Rich hexes yield more resources (10-50 per tick range)
- Adds strategic element to relocation decisions
- Formula: `baseRate * hexRichness` where richness varies by hex

### 2. WebSocket Events Structure

**Primary Events:** Batch per user
- One message per tick containing all user's agents
- Structure: `{ type: 'mining:update', agents: [{ id, hexId, resources: {gold,silver,copper,iron}, status }] }`

**Hex Depletion:** Separate events
- Broadcast when hex depletes: `{ type: 'hex:depleted', hexId, q, r }`
- Enables UI to show depletion visually

**Relocation:** Separate events
- When agent starts moving: `{ type: 'agent:relocating', agentId, fromHex, toHex, arrivalTick }`
- When agent arrives: `{ type: 'agent:arrived', agentId, hexId }`

### 3. Redis Cache Strategy

**Strategy:** Hot agents only
- Cache only agents with status MINING or RELOCATING
- Postgres remains source of truth
- On tick: read from Redis, write to Redis, periodic flush to Postgres

**Cache Shape:** Full agent state
```
Key: agent:{agentId}
Value: {
  agentId: string,
  ownerId: string,
  hexId: number,
  resources: { gold: bigint, silver: bigint, copper: bigint, iron: bigint },
  status: 'MINING' | 'RELOCATING',
  lastTick: number,
  // If relocating:
  targetHexId?: number,
  arrivalTick?: number
}
```

**Flush Interval:** Every 30 seconds to Postgres

### 4. Hex Depletion & Relocation

**Depletion Threshold:** resourceAmount = 0
- Hex is depleted when no resources remain
- Simple, clear threshold

**Next Hex Selection:** Nearest with resources
- Find closest non-depleted hex using hex distance
- Ties broken by lowest (q, r) for determinism
- If no hexes available, agent goes IDLE (shouldn't happen with 1M hexes)

**Travel Time:** Distance-based
- 1 tick per hex distance traveled
- Agent status = RELOCATING during travel
- No mining during relocation
- Minimum 1 tick even for adjacent hex (gives UI time to animate)

### 5. State Recovery

**Strategy:** Postgres source of truth
- On server startup: load all MINING/RELOCATING agents from Postgres to Redis
- Resume tick loop from last known state
- `lastUpdate` timestamp in MiningState helps calculate missed ticks

### 6. Test Data (Dev Mode)

**Approach:** Seed database + dev endpoint
- Seed script creates test users and agents
- Dev-only endpoint: `POST /dev/agents` to create test agent
- Disabled in production via environment variable

## Implementation Notes

### Tick Loop Architecture

```
Server Start
    |
    v
Load hot agents from Postgres -> Redis
    |
    v
Start tick interval (every 5s)
    |
    v
Each Tick:
  1. Get all MINING agents from Redis
  2. For each agent:
     - Calculate resources mined (hex-based rate)
     - Deduct from hex, add to agent
     - Check if hex depleted -> trigger relocation
  3. Process RELOCATING agents:
     - Check if arrived (currentTick >= arrivalTick)
     - If arrived: status = MINING, broadcast arrival
  4. Update Redis with new state
  5. Broadcast updates via WebSocket (batched per user)
  6. Every 6th tick (30s): flush to Postgres
```

### WebSocket Rooms

- Each connected user joins room `user:{walletPubkey}`
- Hex depletion events broadcast to all connected clients
- Agent updates sent only to owner's room

---
*Created: 2026-01-20*
*Discussed: 2026-01-20*
