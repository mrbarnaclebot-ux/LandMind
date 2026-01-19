# Phase 1: Foundation - Research

**Researched:** 2026-01-19
**Domain:** Infrastructure setup (PostgreSQL, Redis, Express, Babylon.js, Anchor)
**Confidence:** HIGH

## Summary

Phase 1 establishes the independently testable infrastructure for LandMind. This research covers five distinct setup domains:

1. **PostgreSQL with Prisma ORM** - Schema design for users, agents, hexes, and mining state
2. **Redis via Docker** - Hot state caching and pub/sub infrastructure
3. **Express server** - TypeScript backend with health check endpoint
4. **Babylon.js with Vite** - 3D rendering foundation in React frontend
5. **Anchor project** - Solana program scaffold for future blockchain work

All technologies are well-documented with established patterns. The recommended approach uses Docker Compose for local database infrastructure, which allows consistent development environments and easy teardown/reset.

**Primary recommendation:** Use Docker Compose for PostgreSQL and Redis, Prisma for database access, and the official Babylon.js Vite template as starting points. These are battle-tested patterns requiring minimal customization.

## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 16.x | Persistent game state | ACID transactions, excellent Prisma support |
| Prisma | ^6.x | ORM with TypeScript | Schema-first, auto-generated types, migrations |
| Redis | 7.x | Hot state cache, pub/sub | Sub-millisecond latency, sorted sets for leaderboards |
| ioredis | ^5.x | Node.js Redis client | Full TypeScript support, pub/sub, auto-reconnect |
| Express | ^5.x | HTTP server | Simple, well-documented, ecosystem support |
| @babylonjs/core | ^8.x | 3D engine | WebGL/WebGPU, thin instances for hex grid |
| Anchor | 0.32.1 | Solana framework | De facto standard, IDL generation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Docker Compose | 2.0+ | Local infrastructure | Development environment |
| react-babylonjs | @latest | React + Babylon.js integration | Declarative 3D scenes in React |
| tsx | ^4.x | TypeScript execution | Running scripts without build step |
| dotenv | ^16.x | Environment variables | Loading .env files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma | TypeORM | TypeORM has decorator-based models; Prisma has better DX |
| ioredis | redis (npm) | redis package lacks some features; ioredis is more complete |
| Docker | Local install | Docker provides reproducible environments |

**Installation:**
```bash
# Backend
npm install express prisma @prisma/client ioredis dotenv cors helmet
npm install -D typescript @types/node @types/express tsx

# Frontend
npm install @babylonjs/core @babylonjs/inspector react-babylonjs

# Anchor (via avm)
cargo install --git https://github.com/coral-xyz/avm --locked
avm install 0.32.1 && avm use 0.32.1
```

## Architecture Patterns

### Recommended Project Structure
```
landmind/
├── docker-compose.yml       # PostgreSQL + Redis
├── .env                     # Environment variables
├── packages/
│   ├── server/              # Express backend
│   │   ├── src/
│   │   │   ├── index.ts     # Entry point
│   │   │   ├── routes/
│   │   │   │   └── health.ts
│   │   │   └── lib/
│   │   │       ├── prisma.ts
│   │   │       └── redis.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── client/              # Vite + React + Babylon.js
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   └── scene/
│   │   │       └── BabylonScene.tsx
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   └── contracts/           # Anchor project
│       ├── programs/
│       │   └── landmind/
│       │       └── src/lib.rs
│       ├── tests/
│       ├── Anchor.toml
│       └── Cargo.toml
└── package.json             # Root workspace
```

### Pattern 1: Prisma Singleton for Connection Management
**What:** Single Prisma client instance to prevent connection exhaustion
**When to use:** Always in Node.js applications
**Example:**
```typescript
// Source: Prisma best practices documentation
// packages/server/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### Pattern 2: Separate Redis Clients for Pub/Sub
**What:** Dedicated Redis client instances for subscriber mode
**When to use:** When using pub/sub alongside regular commands
**Example:**
```typescript
// Source: ioredis documentation
// packages/server/src/lib/redis.ts
import Redis from 'ioredis';

// Regular client for get/set operations
export const redis = new Redis(process.env.REDIS_URL);

// Dedicated client for pub/sub (enters subscriber mode)
export const redisSub = new Redis(process.env.REDIS_URL);
export const redisPub = new Redis(process.env.REDIS_URL);
```

### Pattern 3: Express Health Check with Dependency Verification
**What:** Health endpoint that verifies database and cache connectivity
**When to use:** For container orchestration and monitoring
**Example:**
```typescript
// Source: Express health checks documentation
// packages/server/src/routes/health.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    services: {
      database: 'unknown',
      cache: 'unknown',
    },
  };

  try {
    // Check PostgreSQL
    await prisma.$queryRaw`SELECT 1`;
    healthcheck.services.database = 'healthy';

    // Check Redis
    const pong = await redis.ping();
    healthcheck.services.cache = pong === 'PONG' ? 'healthy' : 'unhealthy';

    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.message = 'ERROR';
    res.status(503).json(healthcheck);
  }
});

export default router;
```

### Pattern 4: Babylon.js Empty Scene with React
**What:** Minimal Babylon.js scene setup using react-babylonjs
**When to use:** Foundation for 3D rendering
**Example:**
```tsx
// Source: react-babylonjs documentation + Babylon.js Vite guide
// packages/client/src/scene/BabylonScene.tsx
import { Engine, Scene } from 'react-babylonjs';
import { Vector3 } from '@babylonjs/core';

export function BabylonScene() {
  return (
    <Engine antialias adaptToDeviceRatio canvasId="babylon-canvas">
      <Scene>
        <arcRotateCamera
          name="camera"
          alpha={Math.PI / 2}
          beta={Math.PI / 4}
          radius={10}
          target={Vector3.Zero()}
        />
        <hemisphericLight
          name="light"
          intensity={0.7}
          direction={Vector3.Up()}
        />
      </Scene>
    </Engine>
  );
}
```

### Anti-Patterns to Avoid
- **Multiple Prisma clients:** Creates connection pool exhaustion; use singleton
- **Single Redis client for pub/sub:** Subscriber mode blocks regular commands
- **Health checks without timeouts:** Can hang indefinitely if service is down
- **Importing entire Babylon.js:** Use tree-shakable @babylonjs/core imports

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database migrations | Manual SQL scripts | Prisma migrate | Tracks history, generates types, reversible |
| Connection pooling | Custom pool logic | Prisma/ioredis built-in | Already optimized, handles edge cases |
| TypeScript Redis types | Manual interfaces | ioredis (100% TypeScript) | Built-in declarations, auto-complete |
| Docker networking | Manual port mapping | Docker Compose networks | Service discovery by name |
| Babylon.js canvas setup | Raw WebGL context | Engine component | Handles resize, context loss, device pixel ratio |

**Key insight:** Phase 1 is pure infrastructure setup. Every component has official templates and guides. Custom solutions add maintenance burden without benefit.

## Common Pitfalls

### Pitfall 1: Prisma Connection Exhaustion
**What goes wrong:** Creating new PrismaClient on every request
**Why it happens:** Not understanding connection pooling
**How to avoid:** Use singleton pattern (see Pattern 1)
**Warning signs:** "Too many connections" errors, slow queries

### Pitfall 2: Redis Subscriber Mode Blocking
**What goes wrong:** Using same client for subscribe and regular commands
**Why it happens:** Subscribe puts client in special mode
**How to avoid:** Create dedicated pub/sub clients (see Pattern 2)
**Warning signs:** Commands hang after subscribing

### Pitfall 3: Docker Volume Permissions (macOS)
**What goes wrong:** PostgreSQL fails to start with permission errors
**Why it happens:** Volume mount permissions mismatch
**How to avoid:** Use named volumes instead of bind mounts for data
**Warning signs:** "FATAL: data directory has wrong ownership" errors

### Pitfall 4: Babylon.js Import Size
**What goes wrong:** Bundle includes entire engine (2MB+)
**Why it happens:** Importing from "babylonjs" instead of "@babylonjs/core"
**How to avoid:** Always use @babylonjs/* packages for tree-shaking
**Warning signs:** Large bundle size, slow initial load

### Pitfall 5: Anchor Version Mismatch
**What goes wrong:** Build fails with cryptic errors
**Why it happens:** Anchor CLI version differs from project version
**How to avoid:** Use avm (Anchor Version Manager), check Anchor.toml
**Warning signs:** "account constraint violated", IDL mismatch

## Code Examples

Verified patterns from official sources:

### PostgreSQL Schema (Prisma)
```prisma
// Source: Adapted from Prisma data modeling docs
// packages/server/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  walletPubkey String @unique @map("wallet_pubkey")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  agents    Agent[]

  @@map("users")
}

model Agent {
  id           String   @id @default(uuid())
  owner        User     @relation(fields: [ownerId], references: [id])
  ownerId      String   @map("owner_id")
  hexId        Int?     @map("hex_id")
  hex          Hex?     @relation(fields: [hexId], references: [id])
  status       AgentStatus @default(IDLE)
  deployedAt   DateTime @default(now()) @map("deployed_at")
  miningState  MiningState?

  @@map("agents")
}

model Hex {
  id             Int      @id @default(autoincrement())
  q              Int      // Axial coordinate
  r              Int      // Axial coordinate
  resourceType   ResourceType @map("resource_type")
  resourceAmount BigInt   @default(1000000) @map("resource_amount")
  currentAgent   Agent[]

  @@unique([q, r])
  @@index([q, r])
  @@map("hexes")
}

model MiningState {
  id         String   @id @default(uuid())
  agent      Agent    @relation(fields: [agentId], references: [id])
  agentId    String   @unique @map("agent_id")
  gold       BigInt   @default(0)
  silver     BigInt   @default(0)
  copper     BigInt   @default(0)
  iron       BigInt   @default(0)
  lastUpdate DateTime @default(now()) @map("last_update")

  @@map("mining_states")
}

enum AgentStatus {
  IDLE
  MINING
  RELOCATING
}

enum ResourceType {
  GOLD
  SILVER
  COPPER
  IRON
  EMPTY
}
```

### Docker Compose Configuration
```yaml
# Source: Adapted from sevic.dev PostgreSQL/Redis guide
# docker-compose.yml

version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: landmind
      POSTGRES_USER: landmind
      POSTGRES_PASSWORD: landmind_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U landmind"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### Express Server Entry Point
```typescript
// Source: Express health checks documentation
// packages/server/src/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import healthRouter from './routes/health';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/health', healthRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
```

### Anchor Program Scaffold
```rust
// Source: Anchor documentation
// packages/contracts/programs/landmind/src/lib.rs

use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111"); // Placeholder - update after deployment

#[program]
pub mod landmind {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("LandMind program initialized");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
```

### Environment Variables
```bash
# .env (development)

# PostgreSQL
DATABASE_URL="postgresql://landmind:landmind_dev@localhost:5432/landmind?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Server
PORT=3001
NODE_ENV=development
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma 5 | Prisma 6 | 2025 | Rust-free engine, faster cold starts |
| Babylon 7 | Babylon 8 | 2025 | WebGPU default, better thin instances |
| Anchor 0.29 | Anchor 0.32 | 2025 | LazyAccount memory optimization |
| redis npm | ioredis | Ongoing | Better TypeScript, more features |

**Deprecated/outdated:**
- `babylonjs` package: Use `@babylonjs/core` for tree-shaking
- `@solana/web3.js`: Being replaced by `@solana/kit` (but Anchor still uses internally)

## Open Questions

Things that couldn't be fully resolved:

1. **React 19 + react-babylonjs compatibility**
   - What we know: Works with @latest version
   - What's unclear: Long-term maintenance status of react-babylonjs
   - Recommendation: Use @latest, have fallback plan to raw Babylon.js if issues arise

2. **Monorepo vs separate repos**
   - What we know: Both approaches work
   - What's unclear: User preference
   - Recommendation: Monorepo with packages/ structure for easier development

## Sources

### Primary (HIGH confidence)
- [Prisma PostgreSQL Quickstart](https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/postgresql) - Schema setup, migrations
- [Babylon.js Vite Guide](https://doc.babylonjs.com/guidedLearning/usingVite) - Official Vite setup
- [ioredis GitHub](https://github.com/redis/ioredis) - Redis client, pub/sub patterns
- [Anchor Documentation](https://www.anchor-lang.com/docs) - Program initialization
- [Express Health Checks](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html) - Health endpoint patterns

### Secondary (MEDIUM confidence)
- [Docker Compose PostgreSQL + Redis](https://sevic.dev/notes/postgres-redis-docker-compose/) - Docker setup
- [react-babylonjs](https://github.com/brianzinn/react-babylonjs) - React integration
- [Solana Toolkit](https://solana.com/docs/toolkit/projects/anchor-init) - Anchor CLI

### Tertiary (LOW confidence)
- WebSearch results for version verification - requires validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs
- Architecture: HIGH - Patterns from official documentation
- Pitfalls: HIGH - Well-documented issues with solutions

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (stable infrastructure, 30-day validity)
