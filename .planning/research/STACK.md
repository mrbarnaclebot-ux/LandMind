# Technology Stack: LandMind

**Project:** LandMind - Web3 Mining Game on Solana
**Researched:** 2026-01-19
**Overall Confidence:** HIGH (verified via official docs, npm, GitHub releases)

---

## Executive Summary

LandMind requires a modern Web3 gaming stack optimized for:
- High-performance 3D rendering (1M hex grid)
- Real-time game state updates
- Solana blockchain integration (agent deployment, fee distribution)
- PumpFun token trading fee integration

**Recommended approach:** Vite + React 19 for frontend (faster dev, no SSR needed for game), Babylon.js 8.x for 3D, @solana/kit 3.x for blockchain, Socket.io for real-time, PostgreSQL + Prisma + Redis for backend.

---

## Recommended Stack

### Frontend Framework

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **Vite** | ^6.0.0 | Build tool, dev server | HIGH |
| **React** | ^19.2.0 | UI framework | HIGH |
| **TypeScript** | ^5.7.0 | Type safety | HIGH |

**Why Vite over Next.js:**
- Games are client-side SPAs - no SSR/SEO benefits needed
- 10x faster HMR than Next.js (390ms vs 4.5s startup)
- Simpler mental model - no server components complexity
- Framework-agnostic tooling plays well with game engines

**Why NOT Next.js:**
- SSR adds complexity without benefit for games
- Server components not useful for real-time 3D rendering
- Heavier bundle, slower iteration cycle
- Overkill for SPA architecture

Sources:
- [Strapi: Vite vs Next.js 2025](https://strapi.io/blog/vite-vs-nextjs-2025-developer-framework-comparison)
- [React 19.2 Stable](https://react.dev/versions)

---

### 3D Rendering

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **@babylonjs/core** | ^8.45.0 | 3D engine (ES6 modules) | HIGH |
| **@babylonjs/loaders** | ^8.45.0 | Asset loading | HIGH |
| **@babylonjs/gui** | ^8.45.0 | 2D UI overlays | HIGH |

**Why Babylon.js:**
- Battle-tested WebGL/WebGPU engine with excellent TypeScript support
- Tree-shakable ES6 modules reduce bundle size
- Built-in instancing for rendering 1M+ meshes efficiently
- Active development (8.45.3 released 3 days ago as of research)
- Excellent documentation and community

**Why NOT Three.js:**
- Babylon.js has better built-in optimization (SceneOptimizer, freezeActiveMeshes)
- Better TypeScript integration out of the box
- More game-focused features (physics, GUI, inputs)

**Performance Critical Settings:**
```typescript
// For 1M hex grid - use these optimizations
engine.enableOfflineSupport = false;
scene.freezeActiveMeshes(); // 70-100% perf improvement
scene.blockMaterialDirtyMechanism = true;
// Use thin instances for hex grid (not regular instances)
```

**Avoid:**
- MeshWriter library (causes 40k vertices in v7+, use GUI textures instead)
- Loading entire grid at once (use LOD + culling)

Sources:
- [Babylon.js npm @babylonjs/core](https://www.npmjs.com/package/@babylonjs/core)
- [Babylon.js Scene Optimization](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene)
- [Large Scene Optimization Guide](https://joepavitt.medium.com/optimizing-a-large-scale-babylon-js-scene-9466bb715e15)

---

### Solana Blockchain

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **@solana/kit** | ^3.0.3 | Modern Solana SDK (replaces web3.js) | HIGH |
| **@solana/wallet-adapter-react** | ^0.15.x | Wallet connection | HIGH |
| **@solana/wallet-adapter-phantom** | ^0.9.x | Phantom wallet | HIGH |
| **Anchor** | 0.32.1 | Smart contract framework | HIGH |

**Why @solana/kit over @solana/web3.js:**
- Official replacement, actively maintained by Anza (Solana Labs spin-off)
- Modular, tree-shakable architecture
- Better TypeScript types
- Modern ESM-first design

**Why Anchor:**
- De facto standard for Solana program development
- Auto-generates TypeScript client from IDL
- Built-in security checks and account validation
- LazyAccount memory optimization (2025 update)
- Still the "gold standard" per Solana ecosystem consensus

**Installation:**
```bash
# Anchor (via avm - Anchor Version Manager)
cargo install --git https://github.com/coral-xyz/avm
avm install 0.32.1
avm use 0.32.1

# Frontend packages
npm install @solana/kit @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-phantom
```

Sources:
- [Anchor GitHub Releases](https://github.com/solana-foundation/anchor/releases)
- [@solana/kit npm](https://www.npmjs.com/package/@solana/kit)
- [Solana Wallet Adapter](https://solana.com/developers/cookbook/wallets/connect-wallet-react)
- [Solana Developer Toolbox 2025](https://medium.com/@smilewithkhushi/inside-solanas-developer-toolbox-a-2025-deep-dive-7f7e6c4df389)

---

### PumpFun Integration

| Technology | Purpose | Confidence |
|------------|---------|------------|
| **QuickNode Metis API** | PumpFun swap/quote endpoints | MEDIUM |
| **Bitquery GraphQL** | On-chain PumpFun data | MEDIUM |
| **Token-2022 (SPL)** | Transfer fee extension | HIGH |

**Critical Note:** PumpFun has NO official API. All integration options are third-party.

**Recommended Approach:**
1. Use Token-2022 `TransferFeeExtension` for automatic fee collection
2. Use QuickNode Metis for swap operations (if needed)
3. Track PumpFun token events via Bitquery or Helius webhooks

**Token Fee Distribution Pattern:**
```typescript
// Token-2022 transfer fee configuration
const transferFeeConfig = {
  feeBasisPoints: 100, // 1% fee
  maxFee: BigInt(1000000), // Max fee in token base units
  transferFeeConfigAuthority: adminKeypair.publicKey,
  withdrawWithheldAuthority: treasuryKeypair.publicKey,
};
```

**QuickNode Pricing:** Free tier: 10M credits, 15 RPS. Growth: $39/mo.

Sources:
- [QuickNode Pump.fun API Guide](https://www.quicknode.com/guides/solana-development/tooling/web3-2/pump-fun-api)
- [Bitquery PumpFun API](https://docs.bitquery.io/docs/blockchain/Solana/Pumpfun/Pump-Fun-API/)
- [Token-2022 Transfer Fees](https://solana.com/docs/tokens/extensions/transfer-fees)

---

### Real-Time Communication

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **Socket.io** | ^4.8.x | WebSocket with fallbacks | HIGH |
| **Yellowstone gRPC** | Latest | Solana event streaming | HIGH |

**Why Socket.io for game state:**
- Automatic reconnection and fallbacks
- Room/namespace support for game sessions
- Mature, battle-tested (not experimental)
- Event-driven model fits game architecture

**Why NOT raw WebSocket:**
- No automatic reconnection logic
- No fallback for flaky connections
- More boilerplate for room management

**Why Yellowstone gRPC for blockchain events:**
- Sub-50ms latency for on-chain events
- Direct validator memory access
- Fine-grained subscription filters
- Better than native Solana WebSocket (limited to base64, coarse filters)

**Architecture:**
```
Game State Updates:    Client <-> Socket.io <-> Game Server <-> Redis Pub/Sub
Blockchain Events:     Solana <-> Yellowstone gRPC <-> Backend <-> Socket.io <-> Client
```

Sources:
- [Yellowstone Geyser gRPC Guide](https://chainstack.com/how-to-use-the-solana-geyser-plugin-to-stream-data-with-yellowstone-grpc/)
- [Socket.io vs WebSocket 2025](https://www.mergesociety.com/code-report/websocets-explained)
- [Solana Data Streaming Comparison](https://blog.quicknode.com/access-real-time-solana-data-3-tools-compared/)

---

### Backend & Database

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **Node.js** | ^22.x LTS | Runtime | HIGH |
| **Express** or **Fastify** | ^5.x / ^5.x | HTTP server | HIGH |
| **PostgreSQL** | ^16.x | Primary database | HIGH |
| **Prisma** | ^6.x | ORM with TypedSQL | HIGH |
| **Redis** | ^7.x | Cache, pub/sub, leaderboards | HIGH |
| **Upstash Redis** | Managed | Serverless Redis option | MEDIUM |

**Why PostgreSQL:**
- ACID transactions for game economy
- Excellent for structured data (players, agents, resources)
- Prisma 6 has Rust-free engine (faster cold starts)

**Why Redis:**
- Real-time leaderboards (Sorted Sets, O(log N))
- Session/cache for hot data
- Pub/Sub for real-time game events
- Rate limiting

**Prisma Best Practices:**
```typescript
// Singleton pattern to prevent connection exhaustion
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

Sources:
- [Prisma Deep Dive 2025](https://dev.to/mihir_bhadak/prisma-deep-dive-handbook-2025-from-zero-to-expert-1761)
- [Game Database Architecture 2025](https://generalistprogrammer.com/tutorials/game-database-architecture-complete-backend-guide-2025)
- [Caching Prisma with Redis](https://upstash.com/blog/caching-prisma-redis)

---

### State Management

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **Zustand** | ^5.x | Client state | HIGH |
| **TanStack Query** | ^5.x | Server state/caching | HIGH |

**Why Zustand over Redux:**
- Minimal boilerplate, no Provider wrapper needed
- Per-component subscriptions (optimal for game UI)
- Simpler mental model for game state
- Flux architecture without ceremony

**Why NOT Redux Toolkit:**
- Overkill for single-developer/small team
- More boilerplate
- Zustand handles game state patterns equally well

**Pattern:**
```typescript
// Zustand store for game state
const useGameStore = create<GameState>((set, get) => ({
  agents: [],
  selectedHex: null,
  resources: {},

  setSelectedHex: (hex) => set({ selectedHex: hex }),
  updateAgent: (id, data) => set((state) => ({
    agents: state.agents.map(a => a.id === id ? { ...a, ...data } : a)
  })),
}));
```

Sources:
- [Zustand vs Redux 2025](https://medium.com/@msmt0452/zustand-vs-redux-toolkit-the-complete-guide-to-state-management-in-react-4dce420741b4)
- [React State Management 2025](https://www.zignuts.com/blog/react-state-management-2025)

---

### Testing

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **Vitest** | ^3.x | Unit/integration tests | HIGH |
| **@testing-library/react** | ^16.x | Component testing | HIGH |
| **Playwright** | ^1.50.x | E2E testing | HIGH |

**Why Vitest over Jest:**
- 10-20x faster in watch mode
- Native TypeScript support (no ts-jest config)
- Vite-native (same config)
- 30% lower memory usage

**Why NOT Jest:**
- Requires ts-jest configuration
- Slower test execution
- Higher memory consumption
- Jest is better for React Native (not applicable here)

Sources:
- [Vitest vs Jest 2025](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9)
- [Vitest Comparisons](https://vitest.dev/guide/comparisons)

---

### RPC Infrastructure

| Provider | Use Case | Pricing | Confidence |
|----------|----------|---------|------------|
| **Helius** | Primary RPC, webhooks, enhanced APIs | $49/mo Developer | HIGH |
| **QuickNode** | Backup RPC, PumpFun API | $39/mo Growth | HIGH |
| **Triton One** | High-frequency trading (if needed) | Premium | MEDIUM |

**Why Helius as Primary:**
- Solana-only focus, optimized infrastructure
- Staked validator nodes (priority during congestion)
- Enhanced APIs for NFTs, SPL tokens
- Webhooks for on-chain events
- 10-80ms latency

**Why QuickNode as Secondary:**
- PumpFun Metis API integration
- Multi-region fallback
- Good free tier for development

Sources:
- [Solana RPC Providers 2026](https://chainstack.com/best-solana-rpc-providers-in-2026/)
- [RPC Comparison](https://blog.carbium.io/solana-rpcs-compared-2025-carbium-vs-helius-vs-quicknode/)

---

### UI Components

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **Tailwind CSS** | ^4.x | Styling | HIGH |
| **shadcn/ui** | Latest | Component library | HIGH |
| **Radix UI** | ^1.x | Accessible primitives | HIGH |

**Why This Stack:**
- shadcn/ui gives you ownership of components (not a dependency)
- Tailwind 4 has significant performance improvements
- Radix provides accessible, unstyled primitives
- Works seamlessly with React 19

Sources:
- [shadcn/ui + React 19](https://ui.shadcn.com/docs/react-19)

---

## Complete Installation

### Frontend
```bash
# Create Vite project
npm create vite@latest landmind-client -- --template react-ts
cd landmind-client

# Core dependencies
npm install react@^19.2.0 react-dom@^19.2.0

# 3D Engine
npm install @babylonjs/core @babylonjs/loaders @babylonjs/gui

# Solana
npm install @solana/kit @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-phantom

# State
npm install zustand @tanstack/react-query

# Real-time
npm install socket.io-client

# UI
npm install tailwindcss@^4 @radix-ui/react-dialog @radix-ui/react-dropdown-menu

# Dev dependencies
npm install -D typescript @types/react @types/react-dom vitest @testing-library/react playwright
```

### Backend
```bash
mkdir landmind-server && cd landmind-server
npm init -y

# Runtime
npm install express socket.io cors helmet

# Database
npm install prisma @prisma/client redis ioredis

# Solana
npm install @solana/kit @coral-xyz/anchor

# Utils
npm install zod dotenv

# Dev
npm install -D typescript @types/node @types/express vitest tsx
```

### Smart Contracts
```bash
# Install Anchor via avm
cargo install --git https://github.com/coral-xyz/avm --locked
avm install 0.32.1
avm use 0.32.1

# Initialize Anchor project
anchor init landmind-contracts
cd landmind-contracts
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Frontend Framework | Vite + React | Next.js | SSR overkill for SPA game |
| 3D Engine | Babylon.js | Three.js | Less game-focused, weaker TS |
| Solana SDK | @solana/kit | @solana/web3.js | Legacy, being deprecated |
| State | Zustand | Redux Toolkit | Unnecessary complexity |
| Testing | Vitest | Jest | Slower, needs ts-jest |
| ORM | Prisma | TypeORM | Prisma has better DX, TypedSQL |
| Real-time | Socket.io | tRPC WebSocket | Socket.io better for game patterns |

---

## Version Verification Sources

| Package | Verified Source | Date Checked |
|---------|-----------------|--------------|
| @babylonjs/core 8.45.3 | npm registry | 2026-01-19 |
| @solana/kit 3.0.3 | npm registry | 2026-01-19 |
| Anchor 0.32.1 | GitHub releases | 2026-01-19 |
| React 19.2.x | react.dev/versions | 2026-01-19 |
| Next.js 16.x | nextjs.org/blog | 2026-01-19 |
| Vite 6.x | Strapi comparison | 2026-01-19 |

---

## Risk Assessment

| Technology | Risk Level | Mitigation |
|------------|------------|------------|
| PumpFun Integration | MEDIUM | No official API - use third-party, have fallback |
| 1M Hex Rendering | LOW | Babylon.js thin instances + LOD proven at scale |
| Solana Congestion | MEDIUM | Use Helius staked nodes + priority fees |
| Token-2022 | LOW | Official Solana standard, well-documented |

---

## Summary

**Core Stack:**
- Frontend: Vite 6 + React 19 + TypeScript 5.7
- 3D: Babylon.js 8.45
- Blockchain: @solana/kit 3.0 + Anchor 0.32
- Real-time: Socket.io + Yellowstone gRPC
- Backend: Node 22 + Express/Fastify + Prisma 6 + PostgreSQL 16 + Redis 7
- State: Zustand 5 + TanStack Query 5
- Testing: Vitest 3 + Playwright

**This stack is:**
- Modern (2025/2026 current)
- Battle-tested (not experimental)
- Well-documented
- Optimized for game development
- Solana ecosystem aligned
