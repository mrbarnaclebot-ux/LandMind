# Project Research Summary

**Project:** LandMind
**Domain:** Web3 3D Mining Game on Solana
**Researched:** 2026-01-19
**Confidence:** HIGH

## Executive Summary

LandMind is a Web3 idle mining game requiring a hybrid architecture: off-chain game simulation with on-chain ownership and economics. The pattern is well-established in Solana gaming — run simulation on servers, commit economic events to blockchain. The recommended stack centers on Vite + React 19 for a SPA frontend (no SSR needed for games), Babylon.js 8.x for 3D rendering (superior instancing for 1M hex grids), and Anchor/Rust for Solana smart contracts with compressed NFTs for cost-efficient agent ownership.

The critical success factors are: (1) aggressive 3D optimization using thin instances, chunking, and LOD to render a 1M hex world without killing browser performance, (2) bulletproof smart contract security with proper account validation and CPI protection — 85% of Solana audit findings are validation errors, and (3) sustainable tokenomics tied to PumpFun trading fees rather than inflationary game tokens. The anti-patterns are clear: no custom game token (Axie lesson), no breeding mechanics, no land speculation — these killed prior Web3 games.

The primary risks are PumpFun API dependency (no official API exists, third-party only) and Solana transaction failures during congestion. Both are mitigated through fallbacks: treasury buffer for fee interruptions, priority fees and retry logic for transactions. A professional smart contract audit is non-negotiable before mainnet — budget $15-50k and 4-6 weeks timeline.

---

## Key Findings

### Recommended Stack

**Frontend:** Vite 6 + React 19 + TypeScript 5.7. Vite over Next.js because games are client-side SPAs with no SSR/SEO benefit — Vite offers 10x faster HMR and simpler mental model.

**3D Engine:** Babylon.js 8.45 with thin instances for hex grid rendering. Babylon.js has superior built-in optimization (SceneOptimizer, freezeActiveMeshes) and better TypeScript support than Three.js. Critical: use thin instances (not regular instances) for the hex grid.

**Blockchain:** @solana/kit 3.x (modern replacement for web3.js) + Anchor 0.32 (de facto standard). Agents as compressed NFTs via Bubblegum — mint 1M agents for ~5 SOL vs 12,000 SOL for regular NFTs.

**Core technologies:**
- **Babylon.js 8.x:** 3D hex grid with 1M hexes — thin instances reduce draw calls to near-zero
- **@solana/kit + Anchor:** Modern Solana SDK + smart contract framework — auto-generates TypeScript client from IDL
- **PostgreSQL + Redis:** Game state persistence (Postgres) + hot state cache and pub/sub (Redis)
- **Socket.io + Yellowstone gRPC:** Real-time game updates (Socket.io) + sub-50ms blockchain event streaming (Yellowstone)
- **Helius:** Primary RPC with DAS API for compressed NFT queries and webhooks for on-chain events

### Expected Features

**Must have (table stakes):**
- Wallet connection (Phantom, Solflare) — entry point to Web3
- Agent deployment flow (0.1 SOL -> agent appears -> starts mining)
- 3D hex world visualization — core differentiator from text-based competitors
- Earnings dashboard showing resources mined and projected income
- Claim/withdraw function for PumpFun fee earnings
- Transaction history for trust/transparency
- Mobile-responsive design — 53% of Web3 gaming is mobile

**Should have (competitive):**
- Live agent movement when hexes deplete — dynamic world, not static dashboard
- Referral program (15-20% commission) — drives viral growth
- Leaderboard system — competitive engagement

**Defer (v2+):**
- Achievement/badge NFTs — nice engagement but not core
- Resource scarcity heat map — adds complexity most users won't use
- Agent customization/naming — polish feature
- Social sharing integration

**Never build:**
- Custom game token — use PumpFun token, avoid death spiral
- Agent breeding/trading NFTs — Axie lesson
- Land ownership NFTs — creates speculation, prices out new users
- Governance DAO — complexity without value
- Energy/stamina systems — feels exploitative in earning context

### Architecture Approach

Hybrid architecture with clear boundaries: blockchain for ownership and economics (agent creation, fee distribution, claims), off-chain servers for game simulation (mining tick loop, resource generation, agent AI), and PostgreSQL for persistent state. The key insight: mining simulation runs at 1-10 Hz off-chain with results broadcast via WebSocket; only economically significant events commit to Solana.

**Major components:**
1. **Frontend (Vite + React + Babylon.js)** — 3D hex grid rendering, wallet connection, dashboard UI
2. **Game Server (Node.js + Socket.io)** — Mining simulation engine, WebSocket broadcasts, state management
3. **Solana Programs (Anchor)** — Agent creation (cNFT minting), fee vault, reward distribution
4. **Data Layer (PostgreSQL + Redis)** — Persistent world/agent state, hot cache, pub/sub for real-time sync

### Critical Pitfalls

1. **Missing account validation in Solana programs** — Verify ALL accounts (owner, type, seeds, relations). Use Anchor constraints religiously. 85% of audit findings are validation errors.

2. **CPI vulnerabilities** — Always verify program ID before CPI. Use Anchor's `Program<'info, T>` type. Reload state after CPI. Never accept program ID from user input.

3. **3D performance collapse with 1M hexes** — Use thin instances grouped by hex type, chunk world into 32x32 regions, implement LOD with 4 levels. Target: <500 visible hexes, 60 FPS.

4. **PumpFun integration dependency** — No official API exists. Maintain treasury buffer (30+ days), implement circuit breaker if fees drop, communicate earnings dependency to users.

5. **Skipping smart contract audit** — Budget $15-50k, start 4-6 weeks before launch, fix all HIGH/CRITICAL findings. Non-negotiable for mainnet.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Core Infrastructure

**Rationale:** Establishes independently testable infrastructure before complexity. Database schema and server skeleton enable all subsequent work. Single hex rendering proves Babylon.js setup works.

**Delivers:** PostgreSQL schema, game server skeleton, basic Babylon.js scene, Anchor program scaffold

**Addresses:** Transaction history (schema), earnings tracking (schema), backend foundation

**Avoids:** None directly — foundational work

### Phase 2: Simulation and Real-Time Core Loop

**Rationale:** Proves the real-time mining concept works before blockchain complexity. If simulation performance fails, discover early.

**Delivers:** Hex grid rendering with thin instances (single chunk), mining tick loop, WebSocket server, Redis hot state

**Addresses:** Offline progression (simulation), mining mechanics

**Avoids:** #6 Performance collapse — implement thin instances from the start

**Uses:** Babylon.js thin instances, Socket.io, Redis

### Phase 3: Blockchain Integration and Agent Ownership

**Rationale:** Adds ownership layer once simulation works. Users can now own agents that participate in the working simulation.

**Delivers:** cNFT minting (Bubblegum), agent creation instruction, wallet connection (wallet-adapter), agent display from on-chain data

**Addresses:** Wallet connection, agent deployment flow, basic security (wallet verification)

**Avoids:** #1 Account validation — implement proper validation from day one, #5 uncompressed NFTs — use cNFTs

**Implements:** Blockchain layer from architecture

### Phase 4: Economy and Fee Distribution

**Rationale:** Completes the economic loop. Game becomes playable with real earnings. This phase has highest risk — tokenomics mistakes here are fatal.

**Delivers:** Fee vault (PDA), mining reward tracking, batch distribution mechanism, claim instruction, PumpFun integration

**Addresses:** Claim/withdraw function, earnings dashboard, PumpFun fee integration

**Avoids:** #5 PumpFun dependency — implement treasury buffer and circuit breaker, #8 death spiral — use existing token, no custom tokenomics

**Implements:** Fee distribution architecture

### Phase 5: Scale, Polish, and Launch Prep

**Rationale:** Scales to production. World expands to full 1M hex size. Includes all pre-launch requirements.

**Delivers:** World chunking + LOD for full scale, multi-server support, admin dashboard, monitoring/alerting, smart contract audit remediation

**Addresses:** Mobile responsive, loading states, leaderboard, referral program

**Avoids:** #6 Performance at scale — chunking and LOD enable 1M hexes, #7 transaction failures — implement priority fees and retry, #10 skipping audit — budget and timeline built in

### Phase Ordering Rationale

- **Foundation before features:** Database schema and server structure inform all subsequent work
- **Simulation before blockchain:** Cheaper to iterate on off-chain code; proves concept before on-chain commitments
- **Ownership before economy:** Users need agents before they can earn from them; natural dependency
- **Economy late:** Tokenomics is highest risk — defer until core game works, allows more time for economic modeling
- **Scale last:** Optimization for 1M hexes is only needed when actually scaling; premature optimization wastes effort

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Economy):** PumpFun API integration has no official documentation; need to validate QuickNode Metis API capabilities. Fee distribution batching at scale needs prototyping.
- **Phase 3 (Blockchain):** Compressed NFT minting with Bubblegum is well-documented but metadata structure for agents needs design decisions.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** PostgreSQL + Prisma + Express/Fastify are extremely well-documented standard patterns
- **Phase 2 (Simulation):** Babylon.js thin instances and Socket.io real-time are well-documented; multiple tutorials and examples available
- **Phase 5 (Scale):** Chunking and LOD patterns are standard in game development; monitoring/alerting follows standard DevOps practices

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via npm, GitHub releases, official docs (Jan 2026) |
| Features | MEDIUM | Based on competitor analysis and Web3 gaming research; PumpFun fee mechanics verified |
| Architecture | HIGH | Hybrid on-chain/off-chain pattern is documented standard for Solana games |
| Pitfalls | HIGH | Security findings from Sec3 2025 report, Helius guides, multiple audit firms |

**Overall confidence:** HIGH

### Gaps to Address

- **PumpFun API specifics:** No official API exists. QuickNode Metis and Bitquery are third-party. Need to validate rate limits, reliability, and fee tracking capabilities during Phase 4 planning.

- **Hex grid scale testing:** Research indicates thin instances handle 100k+ meshes, but 1M hex world with variable terrain types needs prototyping to confirm memory/performance targets.

- **Referral smart contract design:** Standard patterns exist but on-chain referral tracking vs off-chain tracking decision needs architectural consideration during Phase 4.

- **Audit firm selection:** Research identifies Sec3, OtterSec, Soteria, Hacken as reputable Solana auditors. Need to evaluate availability, timeline, and pricing during Phase 5 planning.

---

## Sources

### Primary (HIGH confidence)
- [Babylon.js npm @babylonjs/core 8.45.3](https://www.npmjs.com/package/@babylonjs/core) — version verification
- [@solana/kit npm](https://www.npmjs.com/package/@solana/kit) — SDK version
- [Anchor GitHub Releases](https://github.com/solana-foundation/anchor/releases) — framework version
- [Helius Guide to Solana Program Security](https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security) — security patterns
- [Babylon.js Thin Instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances) — rendering optimization
- [Helius NFT Compression](https://www.helius.dev/blog/solana-nft-compression) — cNFT architecture

### Secondary (MEDIUM confidence)
- [Sec3 Solana Security Ecosystem Review 2025](https://solanasec25.sec3.dev/) — audit findings statistics
- [DappRadar State of Blockchain Gaming Q2 2025](https://dappradar.com/blog/state-of-blockchain-gaming-in-q2-2025) — industry data
- [QuickNode Pump.fun API Guide](https://www.quicknode.com/guides/solana-development/tooling/web3-2/pump-fun-api) — PumpFun integration
- [On-Chain vs Off-Chain Gaming](https://www.antiersolutions.com/blogs/on-chain-game-logic-vs-off-chain-processing-choosing-the-right-architecture-for-web3-games/) — architecture patterns

### Tertiary (LOW confidence)
- [MEXC: Why Web3 Game Studios Failed](https://www.mexc.com/en-GB/news/337490) — tokenomics warnings (single source)
- [CCN: GoMining Strategy](https://www.ccn.com/news/crypto/gomining-bitcoin-game-miner-wars/) — competitor analysis

---
*Research completed: 2026-01-19*
*Ready for roadmap: yes*
