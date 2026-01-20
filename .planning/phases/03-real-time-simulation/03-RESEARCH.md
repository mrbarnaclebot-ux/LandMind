# Phase 3: Real-Time Simulation - Research

**Researched:** 2026-01-20
**Domain:** WebSocket communication, Redis caching, game tick loops, hex grid algorithms
**Confidence:** HIGH

## Summary

This phase implements a mining simulation tick loop that runs on the server, broadcasts updates via WebSocket to connected clients, and uses Redis as a hot cache for active agent state. The research confirms that Socket.io with the Redis adapter is the standard approach for scalable WebSocket communication, ioredis provides robust Redis interaction including hash operations and pub/sub, and recursive setTimeout is preferred over setInterval for consistent game tick timing.

The key technical challenges are: (1) BigInt serialization when moving data between Prisma, Redis, and JSON, (2) hex grid neighbor/distance calculations using axial coordinates, and (3) graceful state persistence to PostgreSQL with write-behind caching.

**Primary recommendation:** Use Socket.io v4 with @socket.io/redis-adapter for WebSocket, ioredis hashes for agent state caching with string-serialized BigInts, recursive setTimeout for the tick loop, and implement standard axial coordinate hex math for relocation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socket.io | ^4.x | WebSocket server | First-class TypeScript, rooms, Redis adapter support |
| @socket.io/redis-adapter | ^8.x | Multi-instance broadcast | Official adapter, uses Redis pub/sub |
| ioredis | ^5.4.0 | Redis client (already installed) | TypeScript native, pub/sub, pipelining |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | ^22.x | Node.js types (already installed) | TypeScript development |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| socket.io | ws | Lower level, no rooms/adapters, more manual work |
| setInterval | setTimeout recursion | setTimeout provides consistent intervals regardless of tick processing time |
| Redis strings | Redis hashes | Hashes allow partial field updates, better for agent state |

**Installation:**
```bash
npm install socket.io @socket.io/redis-adapter
npm install -D @types/ws  # Only if using raw ws
```

## Architecture Patterns

### Recommended Project Structure
```
packages/server/src/
├── index.ts                 # Express + Socket.io setup
├── lib/
│   ├── redis.ts             # Redis clients (exists)
│   ├── socket.ts            # Socket.io server setup
│   └── prisma.ts            # Prisma client
├── simulation/
│   ├── tickLoop.ts          # Main tick loop controller
│   ├── mining.ts            # Mining calculation logic
│   ├── relocation.ts        # Agent relocation logic
│   └── hexMath.ts           # Hex grid algorithms
├── cache/
│   ├── agentCache.ts        # Redis agent state operations
│   └── persistence.ts       # Write-behind to PostgreSQL
├── events/
│   └── types.ts             # Socket.io event type definitions
└── routes/
    └── dev.ts               # Dev-only endpoints
```

### Pattern 1: Socket.io with Express 5 and HTTP Server
**What:** Attach Socket.io to an HTTP server created from Express app
**When to use:** Always with Express - cannot use app.listen() directly
**Example:**
```typescript
// Source: https://socket.io/docs/v4/server-initialization/
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// IMPORTANT: Use httpServer.listen(), NOT app.listen()
httpServer.listen(3001);
```

### Pattern 2: TypeScript Event Types for Socket.io
**What:** Define interfaces for type-safe event handling
**When to use:** All Socket.io servers in TypeScript
**Example:**
```typescript
// Source: https://socket.io/docs/v4/typescript/
interface ServerToClientEvents {
  'mining:update': (data: { agents: AgentUpdate[] }) => void;
  'hex:depleted': (data: { hexId: number; q: number; r: number }) => void;
  'agent:relocating': (data: { agentId: string; fromHex: number; toHex: number; arrivalTick: number }) => void;
  'agent:arrived': (data: { agentId: string; hexId: number }) => void;
}

interface ClientToServerEvents {
  'subscribe': (walletPubkey: string) => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  walletPubkey: string;
}

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer);
```

### Pattern 3: Redis Adapter for Multi-Instance Scaling
**What:** Use Redis pub/sub to broadcast events across server instances
**When to use:** Any production deployment (even single instance for future-proofing)
**Example:**
```typescript
// Source: https://socket.io/docs/v4/redis-adapter/
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

const pubClient = new Redis(redisUrl);
const subClient = pubClient.duplicate();

const io = new Server(httpServer, {
  adapter: createAdapter(pubClient, subClient)
});
```

### Pattern 4: User-Specific Room Broadcasting
**What:** Join users to rooms based on identifier, broadcast to room
**When to use:** Sending updates only to relevant users
**Example:**
```typescript
// Source: https://socket.io/docs/v4/rooms/
io.on('connection', (socket) => {
  socket.on('subscribe', (walletPubkey: string) => {
    socket.data.walletPubkey = walletPubkey;
    socket.join(`user:${walletPubkey}`);
  });
});

// Broadcast to specific user
io.to(`user:${walletPubkey}`).emit('mining:update', { agents: [...] });

// Broadcast to all (hex depletion)
io.emit('hex:depleted', { hexId, q, r });
```

### Pattern 5: Recursive setTimeout for Tick Loop
**What:** Schedule next tick after current tick completes
**When to use:** Game loops where consistent interval matters more than precise timing
**Example:**
```typescript
// Source: https://javascript.info/settimeout-setinterval
const TICK_INTERVAL = 5000; // 5 seconds
let tickLoopId: NodeJS.Timeout | null = null;
let currentTick = 0;

async function tick() {
  const startTime = Date.now();
  currentTick++;

  try {
    await processMiningTick(currentTick);
  } catch (error) {
    console.error('Tick error:', error);
  }

  // Schedule next tick, accounting for processing time
  const elapsed = Date.now() - startTime;
  const delay = Math.max(0, TICK_INTERVAL - elapsed);
  tickLoopId = setTimeout(tick, delay);
}

function startTickLoop() {
  tick(); // Start immediately
}

function stopTickLoop() {
  if (tickLoopId) {
    clearTimeout(tickLoopId);
    tickLoopId = null;
  }
}
```

### Pattern 6: Redis Hash for Agent State
**What:** Store agent state as Redis hash with string-serialized BigInts
**When to use:** Caching agent state for fast tick loop access
**Example:**
```typescript
// Source: https://redis.io/docs/latest/develop/clients/ioredis/
import { redis } from './lib/redis';

interface CachedAgent {
  agentId: string;
  ownerId: string;
  hexId: number;
  gold: string;      // BigInt as string
  silver: string;
  copper: string;
  iron: string;
  status: 'MINING' | 'RELOCATING';
  lastTick: number;
  targetHexId?: number;
  arrivalTick?: number;
}

async function cacheAgent(agent: CachedAgent): Promise<void> {
  await redis.hset(`agent:${agent.agentId}`, {
    agentId: agent.agentId,
    ownerId: agent.ownerId,
    hexId: String(agent.hexId),
    gold: agent.gold,
    silver: agent.silver,
    copper: agent.copper,
    iron: agent.iron,
    status: agent.status,
    lastTick: String(agent.lastTick),
    ...(agent.targetHexId && { targetHexId: String(agent.targetHexId) }),
    ...(agent.arrivalTick && { arrivalTick: String(agent.arrivalTick) })
  });
}

async function getAgent(agentId: string): Promise<CachedAgent | null> {
  const data = await redis.hgetall(`agent:${agentId}`);
  if (!data || !data.agentId) return null;
  return {
    ...data,
    hexId: parseInt(data.hexId),
    lastTick: parseInt(data.lastTick),
    targetHexId: data.targetHexId ? parseInt(data.targetHexId) : undefined,
    arrivalTick: data.arrivalTick ? parseInt(data.arrivalTick) : undefined
  } as CachedAgent;
}
```

### Pattern 7: Hex Grid Axial Coordinates
**What:** Calculate neighbors and distance using axial (q,r) coordinates
**When to use:** Finding nearest hex for relocation, hex depletion checks
**Example:**
```typescript
// Source: https://www.redblobgames.com/grids/hexagons/
interface Hex {
  q: number;
  r: number;
}

// Direction vectors for 6 neighbors
const AXIAL_DIRECTIONS: Hex[] = [
  { q: 1, r: 0 },   { q: 1, r: -1 },  { q: 0, r: -1 },
  { q: -1, r: 0 },  { q: -1, r: 1 },  { q: 0, r: 1 }
];

function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

function hexNeighbors(hex: Hex): Hex[] {
  return AXIAL_DIRECTIONS.map(dir => hexAdd(hex, dir));
}

function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  // Derived from cube distance: (|dq| + |dq + dr| + |dr|) / 2
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

// Find all hexes within range N of center
function hexesInRange(center: Hex, n: number): Hex[] {
  const results: Hex[] = [];
  for (let q = -n; q <= n; q++) {
    for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) {
      results.push(hexAdd(center, { q, r }));
    }
  }
  return results;
}
```

### Anti-Patterns to Avoid
- **Using app.listen() with Socket.io:** Always create HTTP server with createServer(app)
- **setInterval for game loops:** Processing time varies; use recursive setTimeout
- **Storing BigInt directly in Redis:** Redis strings don't support BigInt; serialize to string
- **Single Redis client for pub/sub:** Subscriber mode blocks; use separate clients
- **Broadcasting all updates to all users:** Use rooms to send user-specific data only

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket rooms/broadcast | Custom room tracking | Socket.io rooms | Handles edge cases, disconnect cleanup |
| Multi-server WebSocket sync | Custom pub/sub logic | @socket.io/redis-adapter | Battle-tested, handles reconnection |
| Hex distance/neighbors | Custom math from scratch | Axial coordinate formulas | Well-documented, proven correct |
| BigInt JSON serialization | Ignore the problem | String conversion + reviver | Runtime errors otherwise |

**Key insight:** Socket.io's room abstraction and the Redis adapter eliminate significant complexity around connection management and multi-instance scaling.

## Common Pitfalls

### Pitfall 1: BigInt Serialization Errors
**What goes wrong:** `TypeError: Do not know how to serialize a BigInt` when using JSON.stringify
**Why it happens:** JavaScript's JSON.stringify doesn't handle BigInt natively; Prisma returns BigInt for BigInt columns
**How to avoid:** Always convert BigInt to string before JSON/Redis, convert back when reading
**Warning signs:** Crashes when sending WebSocket events or caching to Redis

```typescript
// BAD
const data = { gold: 1000n };
JSON.stringify(data); // TypeError!

// GOOD
const data = { gold: String(1000n) };
JSON.stringify(data); // Works

// When reading back:
const gold = BigInt(data.gold);
```

### Pitfall 2: Socket.io with Express app.listen()
**What goes wrong:** Socket.io connection fails or behaves unexpectedly
**Why it happens:** app.listen() creates its own HTTP server; Socket.io needs the same server reference
**How to avoid:** Always use createServer(app) and httpServer.listen()
**Warning signs:** WebSocket connections not reaching handlers

### Pitfall 3: Tick Loop Drift with setInterval
**What goes wrong:** Ticks gradually desync from expected timing
**Why it happens:** setInterval schedules from start of callback, not end; long ticks cause buildup
**How to avoid:** Use recursive setTimeout with delay adjusted for processing time
**Warning signs:** Clients receiving bursts of updates, timing inconsistencies

### Pitfall 4: Redis Pub/Sub on Data Client
**What goes wrong:** Commands blocked, data operations fail
**Why it happens:** Redis connection in subscriber mode can't execute regular commands
**How to avoid:** Use dedicated pub/sub clients (already done in redis.ts)
**Warning signs:** Commands hanging, connection errors after subscribing

### Pitfall 5: No Graceful Shutdown
**What goes wrong:** Data loss on server restart, connections not cleaned up
**Why it happens:** Node.js doesn't automatically flush pending operations
**How to avoid:** Listen for SIGINT/SIGTERM, flush to PostgreSQL, close connections
**Warning signs:** Missing data after deployments, zombie connections

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  stopTickLoop();
  await flushToPostgres();
  await redis.quit();
  io.close();
  process.exit(0);
});
```

### Pitfall 6: Race Conditions in Tick Processing
**What goes wrong:** Inconsistent state, double-mining, incorrect resource counts
**Why it happens:** Multiple async operations on same data without coordination
**How to avoid:** Process agents sequentially within a tick, use atomic Redis operations where possible
**Warning signs:** Negative resource counts, duplicate events

## Code Examples

Verified patterns from official sources:

### Complete Socket.io Server Setup
```typescript
// Source: https://socket.io/docs/v4/typescript/
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

// Event types
interface ServerToClientEvents {
  'mining:update': (data: MiningUpdate) => void;
  'hex:depleted': (data: HexDepleted) => void;
  'agent:relocating': (data: AgentRelocating) => void;
  'agent:arrived': (data: AgentArrived) => void;
}

interface ClientToServerEvents {
  'subscribe': (walletPubkey: string, callback: (ok: boolean) => void) => void;
}

interface SocketData {
  walletPubkey: string;
}

// Setup
const app = express();
const httpServer = createServer(app);

const pubClient = new Redis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || '*' },
  adapter: createAdapter(pubClient, subClient)
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe', (walletPubkey, callback) => {
    socket.data.walletPubkey = walletPubkey;
    socket.join(`user:${walletPubkey}`);
    callback(true);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

httpServer.listen(3001);
export { io };
```

### Redis Pipeline for Batch Updates
```typescript
// Source: https://www.npmjs.com/package/ioredis
import { redis } from './lib/redis';

async function updateAgentsBatch(agents: CachedAgent[]): Promise<void> {
  const pipeline = redis.pipeline();

  for (const agent of agents) {
    pipeline.hset(`agent:${agent.agentId}`, {
      gold: agent.gold,
      silver: agent.silver,
      copper: agent.copper,
      iron: agent.iron,
      lastTick: String(agent.lastTick)
    });
  }

  await pipeline.exec();
}
```

### Write-Behind Persistence
```typescript
// Source: Pattern from https://redis.io/learn/howtos/solutions/caching-architecture/write-behind
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const FLUSH_INTERVAL = 30000; // 30 seconds

async function flushToPostgres(): Promise<void> {
  // Get all cached agent keys
  const keys = await redis.keys('agent:*');

  for (const key of keys) {
    const data = await redis.hgetall(key);
    if (!data.agentId) continue;

    await prisma.miningState.update({
      where: { agentId: data.agentId },
      data: {
        gold: BigInt(data.gold),
        silver: BigInt(data.silver),
        copper: BigInt(data.copper),
        iron: BigInt(data.iron),
        lastUpdate: new Date()
      }
    });

    // Update agent status if changed
    await prisma.agent.update({
      where: { id: data.agentId },
      data: {
        status: data.status as 'MINING' | 'RELOCATING' | 'IDLE',
        hexId: parseInt(data.hexId)
      }
    });
  }
}

// Schedule periodic flush
setInterval(flushToPostgres, FLUSH_INTERVAL);
```

### Find Nearest Non-Depleted Hex
```typescript
// Source: Adapted from https://www.redblobgames.com/grids/hexagons/
import { prisma } from './lib/prisma';

interface HexCoord {
  id: number;
  q: number;
  r: number;
}

async function findNearestHexWithResources(
  currentHex: HexCoord,
  excludeHexIds: number[] = []
): Promise<HexCoord | null> {
  // Query hexes with resources, ordered by distance
  const hexes = await prisma.hex.findMany({
    where: {
      resourceAmount: { gt: 0 },
      id: { notIn: excludeHexIds }
    },
    select: { id: true, q: true, r: true }
  });

  if (hexes.length === 0) return null;

  // Sort by distance, then by (q, r) for determinism
  hexes.sort((a, b) => {
    const distA = hexDistance(currentHex, a);
    const distB = hexDistance(currentHex, b);
    if (distA !== distB) return distA - distB;
    if (a.q !== b.q) return a.q - b.q;
    return a.r - b.r;
  });

  return hexes[0];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Socket.io v2/v3 | Socket.io v4 | 2021 | Native TypeScript, better adapter API |
| node-redis | ioredis (still valid) | N/A | ioredis stable, node-redis recommended for new |
| Manual room sync | @socket.io/redis-adapter | v4 | Simplified multi-instance setup |
| setInterval game loops | setTimeout recursion | Best practice | Consistent timing, no drift |

**Deprecated/outdated:**
- socket.io-redis package: Use @socket.io/redis-adapter instead
- Redis Streams adapter: Use sharded pub/sub adapter for new projects on Redis 7+

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal batch size for PostgreSQL flush**
   - What we know: 30-second intervals decided in CONTEXT.md
   - What's unclear: Should we batch by count (e.g., max 100 agents per transaction)?
   - Recommendation: Start with single transaction, add batching if performance issues arise

2. **Hex cache strategy**
   - What we know: Agent state is cached; hex depletion updates both Redis and DB
   - What's unclear: Should hex resource amounts also be cached in Redis?
   - Recommendation: Query hex from DB during tick (infrequent enough), update DB directly on depletion

3. **Recovery of missed ticks**
   - What we know: lastUpdate timestamp exists in MiningState
   - What's unclear: How many missed ticks to process on restart?
   - Recommendation: Calculate but cap at 10 ticks (50 seconds) to prevent long startup

## Sources

### Primary (HIGH confidence)
- [Socket.io TypeScript Documentation](https://socket.io/docs/v4/typescript/) - Event typing, server setup
- [Socket.io Redis Adapter](https://socket.io/docs/v4/redis-adapter/) - Multi-instance scaling
- [Socket.io Rooms](https://socket.io/docs/v4/rooms/) - Room-based broadcasting
- [Red Blob Games Hexagonal Grids](https://www.redblobgames.com/grids/hexagons/) - Axial coordinates, distance, neighbors
- [ioredis Guide](https://redis.io/docs/latest/develop/clients/ioredis/) - Hash operations, pipeline
- [MDN BigInt Serialization](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/BigInt_not_serializable) - JSON workarounds

### Secondary (MEDIUM confidence)
- [Redis Write-Behind Pattern](https://redis.io/learn/howtos/solutions/caching-architecture/write-behind) - Cache persistence strategy
- [Node.js Timers](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick) - setInterval vs setTimeout
- [Prisma BigInt Discussion](https://github.com/prisma/prisma/discussions/9793) - Serialization workarounds

### Tertiary (LOW confidence)
- [Game Tick Loop Accuracy](https://timetocode.tumblr.com/post/71512510386/an-accurate-nodejs-game-loop-inbetween-settimeout) - Hybrid setTimeout/setImmediate approach (may be overkill for 5s ticks)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Socket.io and ioredis are well-documented, official adapters exist
- Architecture: HIGH - Patterns from official Socket.io docs and established game dev practices
- Pitfalls: HIGH - Well-known issues with BigInt, pub/sub, and timer drift documented in official sources
- Hex math: HIGH - Red Blob Games is the canonical reference, formulas are mathematically proven

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (Socket.io v4 stable, patterns unlikely to change)
