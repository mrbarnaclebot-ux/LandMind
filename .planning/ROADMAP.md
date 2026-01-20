# Roadmap: LandMind

## Overview

LandMind progresses from foundational infrastructure through progressive capability delivery: database and 3D rendering first, then real-time simulation, then wallet integration, then blockchain ownership, then economics, and finally scale and launch preparation. Each phase delivers a complete, verifiable capability that builds on previous work. The journey prioritizes proving the simulation concept before adding blockchain complexity, and establishing ownership before economics.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Database schema, server skeleton, Babylon.js setup, Anchor scaffold
- [x] **Phase 2: 3D World Core** - Hex grid rendering with thin instances, camera navigation (Three.js)
- [x] **Phase 3: Real-Time Simulation** - Mining tick loop, WebSocket broadcast, Redis hot state
- [~] **Phase 4: Wallet Integration** - Phantom connection, session management, balance display (gap fix in progress)
- [ ] **Phase 5: Agent Deployment** - cNFT minting, agent creation on-chain, ownership display
- [ ] **Phase 6: Economy & Distribution** - Fee vault, reward tracking, claims, PumpFun integration
- [ ] **Phase 7: Scale & Launch** - Performance optimization, admin dashboard, audit, mobile responsive

## Phase Details

### Phase 1: Foundation
**Goal**: Establish independently testable infrastructure that enables all subsequent work
**Depends on**: Nothing (first phase)
**Requirements**: BACKEND-03, BACKEND-04
**Success Criteria** (what must be TRUE):
  1. PostgreSQL database runs locally with schema for users, agents, hexes, and mining state
  2. Redis instance runs locally and accepts connections
  3. Express server starts and responds to health check endpoint
  4. Babylon.js renders an empty scene in the browser
  5. Anchor project compiles with placeholder program structure
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Docker Compose setup (PostgreSQL + Redis)
- [x] 01-02-PLAN.md — Prisma schema and Express server with health endpoint
- [x] 01-03-PLAN.md — Babylon.js + Vite frontend scaffold
- [x] 01-04-PLAN.md — Anchor project scaffold

### Phase 2: 3D World Core
**Goal**: Users can see and navigate a 3D hexagonal world in their browser
**Depends on**: Phase 1
**Requirements**: WORLD-01, WORLD-02
**Success Criteria** (what must be TRUE):
  1. User sees a 3D hexagonal grid rendered in the browser
  2. User can pan the camera across the hex world
  3. User can zoom in and out of the hex world
  4. User can rotate the camera around the hex world
  5. Hex grid uses thin instances for efficient rendering
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md — Hex math utilities and beveled mesh generator
- [x] 02-02-PLAN.md — Terrain generation with biomes and elevation
- [x] 02-03-PLAN.md — Hex grid rendering with thin instances
- [x] 02-04-PLAN.md — Isometric camera with pan/zoom/rotate
- [x] 02-05-PLAN.md — Visual polish and verification checkpoint (switched to Three.js)

### Phase 3: Real-Time Simulation
**Goal**: Mining simulation runs continuously and broadcasts updates to connected clients
**Depends on**: Phase 2
**Requirements**: BACKEND-01, BACKEND-02, AGENT-03, AGENT-04
**Success Criteria** (what must be TRUE):
  1. Mining tick loop runs on server and updates agent resource totals
  2. Clients receive real-time mining updates via WebSocket
  3. Redis caches hot game state for fast access
  4. Agents automatically relocate when their hex depletes (simulated)
  5. Mining state persists across server restarts
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Socket.io WebSocket server with Redis adapter
- [x] 03-02-PLAN.md — Agent cache and mining/relocation logic
- [x] 03-03-PLAN.md — Tick loop with persistence and server integration
- [x] 03-04-PLAN.md — Dev endpoints and end-to-end verification

### Phase 4: Wallet Integration
**Goal**: Users can securely connect their Solana wallet and authenticate
**Depends on**: Phase 3
**Requirements**: WALLET-01, WALLET-02, WALLET-03, WALLET-04, WORLD-06
**Success Criteria** (what must be TRUE):
  1. User can connect Phantom or Solflare wallet from the UI
  2. User sees their real-time SOL balance after connecting
  3. User can view transaction history of their on-chain activity
  4. User session persists across page refreshes via wallet signature verification
  5. User sees loading states and feedback during blockchain operations
**Plans**: 6 plans

Plans:
- [x] 04-01-PLAN.md — Solana Provider setup and wallet packages
- [x] 04-02-PLAN.md — Server auth endpoints (nonce/verify/session)
- [x] 04-03-PLAN.md — Wallet session store and hooks
- [x] 04-04-PLAN.md — Connect UI and balance display
- [x] 04-05-PLAN.md — Transaction history side panel
- [ ] 04-06-PLAN.md — Gap fix: Transaction history retry logic (UAT gap closure)

### Phase 5: Agent Deployment
**Goal**: Users can deploy agents as compressed NFTs that appear on the hex grid and mine
**Depends on**: Phase 4
**Requirements**: CONTRACT-01, AGENT-01, AGENT-02, AGENT-05, WORLD-03, WORLD-04
**Success Criteria** (what must be TRUE):
  1. User can deploy an agent for 0.1 SOL via smart contract
  2. Agent is created as compressed NFT (cNFT) owned by user's wallet
  3. User sees their agent appear on a hex and begin mining after deployment
  4. User sees their agents visually relocate when hexes deplete
  5. User can view all their deployed agents and their mining status
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: Economy & Distribution
**Goal**: Users earn passive income from PumpFun fees proportional to their mining output
**Depends on**: Phase 5
**Requirements**: CONTRACT-02, ECON-01, ECON-02, ECON-03, ECON-04, ECON-05, WORLD-05
**Success Criteria** (what must be TRUE):
  1. Fee vault collects PumpFun token trading fees on-chain
  2. User sees earnings dashboard with resources mined and projected income
  3. User can claim accumulated fee earnings to their wallet
  4. Fee distribution is weighted by cumulative resources mined per user
  5. User sees leaderboard ranking miners by total resources mined
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

### Phase 7: Scale & Launch
**Goal**: System is production-ready for mainnet launch with performance, admin tools, and audit
**Depends on**: Phase 6
**Requirements**: PERF-01, PERF-02, PERF-03, CONTRACT-03, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04
**Success Criteria** (what must be TRUE):
  1. 3D world renders 1M hexes at 60 FPS using chunking and LOD
  2. System handles Solana network congestion with retry logic and priority fees
  3. Frontend works on mobile phone browsers (responsive design)
  4. Smart contracts pass external security audit with all HIGH/CRITICAL findings fixed
  5. Admin can view metrics dashboard and manage users, economy, and emergency pause
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD
- [ ] 07-04: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete | 2026-01-20 |
| 2. 3D World Core | 5/5 | Complete | 2026-01-20 |
| 3. Real-Time Simulation | 4/4 | Complete | 2026-01-20 |
| 4. Wallet Integration | 5/6 | Gap fix in progress | - |
| 5. Agent Deployment | 0/TBD | Not started | - |
| 6. Economy & Distribution | 0/TBD | Not started | - |
| 7. Scale & Launch | 0/TBD | Not started | - |

## Requirement Coverage

All 34 v1 requirements mapped to exactly one phase.

| Category | Requirements | Phase |
|----------|-------------|-------|
| Backend & Infrastructure | BACKEND-03, BACKEND-04 | Phase 1 |
| 3D World (Core) | WORLD-01, WORLD-02 | Phase 2 |
| Backend (Simulation) | BACKEND-01, BACKEND-02 | Phase 3 |
| Agent (Mining) | AGENT-03, AGENT-04 | Phase 3 |
| Wallet & Authentication | WALLET-01, WALLET-02, WALLET-03, WALLET-04 | Phase 4 |
| World (UX) | WORLD-06 | Phase 4 |
| Smart Contracts (Agent) | CONTRACT-01 | Phase 5 |
| Agent (Deployment) | AGENT-01, AGENT-02, AGENT-05 | Phase 5 |
| World (Agents) | WORLD-03, WORLD-04 | Phase 5 |
| Smart Contracts (Economy) | CONTRACT-02 | Phase 6 |
| Economy & Earnings | ECON-01, ECON-02, ECON-03, ECON-04, ECON-05 | Phase 6 |
| World (Resources) | WORLD-05 | Phase 6 |
| Performance & Scale | PERF-01, PERF-02, PERF-03 | Phase 7 |
| Smart Contracts (Audit) | CONTRACT-03 | Phase 7 |
| Admin Dashboard | ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04 | Phase 7 |

**Total: 34/34 requirements mapped**

---
*Roadmap created: 2026-01-19*
*Last updated: 2026-01-20 (Phase 4 gap fix added)*
