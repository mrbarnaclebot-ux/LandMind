# LandMind

## What This Is

A Web3 mining game on Solana where users deploy autonomous agents on a 3D hexagonal world. Agents mine virtual resources (gold, silver, copper, iron) which determine their owner's share of platform fees generated from PumpFun token trading. The 3D hex world is the visual experience; agents are the only user-owned asset.

## Core Value

Users earn passive income from PumpFun trading fees proportional to how much their agents have mined — deploy once, earn forever.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 3D hexagonal world visualization with Babylon.js (1M system-owned hexes)
- [ ] Solana wallet connection (Phantom) for authentication
- [ ] Agent deployment system (0.1 SOL per agent)
- [ ] Virtual resource mining simulation (gold, silver, copper, iron)
- [ ] Hex depletion mechanics with automatic free agent relocation
- [ ] PumpFun token integration for fee generation
- [ ] Fee distribution system (50% to agent owners weighted by resources mined)
- [ ] Linear resource mining growth over time
- [ ] Real-time mining updates via WebSocket
- [ ] User dashboard showing agents, resources mined, earnings
- [ ] Admin dashboard with metrics, user management, economy controls
- [ ] Smart contracts: Agent Factory, Rewards Distribution (Anchor/Rust)

### Out of Scope

- Land ownership NFTs — hexes are system-owned visual backdrop, not tradeable assets
- Tradeable resource tokens — resources are virtual, used only for fee weighting
- Agent trading/marketplace — agents are non-transferable for v1
- Mobile app — web-first, mobile deferred
- Cooperative/guild mechanics — solo mining only for v1
- Agent breeding/leveling — single agent type for v1

## Context

**PRD Reference:** `Plan/prd-doc.md` contains detailed technical specification, though several aspects have been simplified:
- Land Registry NFT program removed (system-owned hexes)
- Resource tokenization removed (virtual resources only)
- Economic model clarified (PumpFun fees, not resource trading)

**Economic Model:**
- Agent deployment (0.1 SOL) → Platform treasury
- PumpFun token trading generates fees
- 50% of fees → Platform treasury
- 50% of fees → Distributed to agent owners by mining weight
- Mining weight = cumulative resources mined by user's agents
- Longer mining = more resources = larger fee share

**Tech Stack (from PRD):**
- Frontend: React 18+, Babylon.js 8.0, Zustand, Vite, Socket.io
- Backend: Node.js 20+, Express, PostgreSQL 15+, Redis 7+
- Blockchain: Solana, Anchor Framework, SPL tokens
- Infrastructure: Google Cloud (preferred), Docker, Kubernetes

**Target:** Production mainnet launch, ASAP timeline

## Constraints

- **Blockchain**: Solana mainnet — leveraging low fees and high throughput
- **3D Engine**: Babylon.js — must render 1M hex grid performantly (LOD, culling, instancing)
- **Timeline**: ASAP — scope must be tight, defer non-essentials
- **Security**: Smart contract audit required before mainnet (real money at stake)
- **Wallet**: Phantom SDK primary, others secondary

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| System-owned hexes (no land NFTs) | Simplifies contracts, reduces scope, focuses value on agents | — Pending |
| Virtual resources (not tokens) | Resources are fee-weighting mechanism, not tradeable assets | — Pending |
| Linear mining growth | Predictable, easy to understand economics | — Pending |
| Automatic free relocation | Reduces friction, agents mine forever once deployed | — Pending |
| 50/50 fee split | Fair balance between platform sustainability and user rewards | — Pending |

---
*Last updated: 2026-01-19 after initialization*
