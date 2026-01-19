# Requirements: LandMind

**Defined:** 2026-01-19
**Core Value:** Users earn passive income from PumpFun trading fees proportional to how much their agents have mined

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Wallet & Authentication

- [ ] **WALLET-01**: User can connect Solana wallet (Phantom, Solflare)
- [ ] **WALLET-02**: User sees real-time SOL balance after connecting
- [ ] **WALLET-03**: User can view transaction history of their on-chain activity
- [ ] **WALLET-04**: User session persists via wallet signature verification

### 3D World & Visualization

- [ ] **WORLD-01**: User sees 3D hexagonal world rendered in browser (Babylon.js)
- [ ] **WORLD-02**: User can navigate the hex world (pan, zoom, rotate)
- [ ] **WORLD-03**: User sees their deployed agents on the hex grid
- [ ] **WORLD-04**: User sees agents visually relocate when hexes deplete
- [ ] **WORLD-05**: User sees resource concentration heat map overlay
- [ ] **WORLD-06**: User receives loading states and feedback during blockchain operations

### Agent System

- [ ] **AGENT-01**: User can deploy an agent for 0.1 SOL
- [ ] **AGENT-02**: User sees agent appear on a hex and begin mining after deployment
- [ ] **AGENT-03**: User's agent mines virtual resources (gold, silver, copper, iron)
- [ ] **AGENT-04**: User's agent automatically relocates to new hex when current hex depletes (free)
- [ ] **AGENT-05**: User can view all their deployed agents and their mining status

### Economy & Earnings

- [ ] **ECON-01**: User sees earnings dashboard with resources mined and projected income
- [ ] **ECON-02**: User can claim accumulated PumpFun fee earnings to their wallet
- [ ] **ECON-03**: System distributes 50% of PumpFun token trading fees to agent owners
- [ ] **ECON-04**: Fee distribution is weighted by cumulative resources mined per user
- [ ] **ECON-05**: User sees leaderboard ranking miners by total resources mined

### Smart Contracts

- [ ] **CONTRACT-01**: Agent Factory program creates agents as compressed NFTs (cNFT)
- [ ] **CONTRACT-02**: Fee Vault program collects and distributes PumpFun fees
- [ ] **CONTRACT-03**: Smart contracts pass external security audit before mainnet

### Backend & Infrastructure

- [ ] **BACKEND-01**: Mining simulation runs off-chain with periodic state sync
- [ ] **BACKEND-02**: Real-time updates delivered via WebSocket
- [ ] **BACKEND-03**: PostgreSQL stores persistent game state
- [ ] **BACKEND-04**: Redis caches hot state and enables real-time pub/sub

### Admin Dashboard

- [ ] **ADMIN-01**: Admin sees metrics dashboard (active agents, fees, user counts)
- [ ] **ADMIN-02**: Admin can view and manage users
- [ ] **ADMIN-03**: Admin can adjust economy parameters
- [ ] **ADMIN-04**: Admin can trigger emergency pause of operations

### Performance & Scale

- [ ] **PERF-01**: 3D world renders 1M hexes at 60 FPS using thin instances and chunking
- [ ] **PERF-02**: System handles Solana network congestion with retry logic and priority fees
- [ ] **PERF-03**: Frontend is mobile-responsive (works on phone browsers)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Engagement

- **ENGAGE-01**: User can name and customize their agents
- **ENGAGE-02**: User earns 15-20% commission from referrals' agent purchases
- **ENGAGE-03**: User earns achievement badges as NFTs for milestones
- **ENGAGE-04**: User can share earnings to social media

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Custom game token | Axie lesson — use existing PumpFun token, avoid death spiral |
| Agent breeding/trading | Creates hyperinflation and ponzi dynamics |
| Land ownership NFTs | Creates speculation, prices out new users |
| Governance DAO | Complexity without value; <5% participation typical |
| Energy/stamina systems | Feels exploitative in earning context |
| Prestige/reset mechanics | Creates anxiety about losing progress with real money |
| Multi-chain support | Dilutes focus; Solana only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WALLET-01 | TBD | Pending |
| WALLET-02 | TBD | Pending |
| WALLET-03 | TBD | Pending |
| WALLET-04 | TBD | Pending |
| WORLD-01 | TBD | Pending |
| WORLD-02 | TBD | Pending |
| WORLD-03 | TBD | Pending |
| WORLD-04 | TBD | Pending |
| WORLD-05 | TBD | Pending |
| WORLD-06 | TBD | Pending |
| AGENT-01 | TBD | Pending |
| AGENT-02 | TBD | Pending |
| AGENT-03 | TBD | Pending |
| AGENT-04 | TBD | Pending |
| AGENT-05 | TBD | Pending |
| ECON-01 | TBD | Pending |
| ECON-02 | TBD | Pending |
| ECON-03 | TBD | Pending |
| ECON-04 | TBD | Pending |
| ECON-05 | TBD | Pending |
| CONTRACT-01 | TBD | Pending |
| CONTRACT-02 | TBD | Pending |
| CONTRACT-03 | TBD | Pending |
| BACKEND-01 | TBD | Pending |
| BACKEND-02 | TBD | Pending |
| BACKEND-03 | TBD | Pending |
| BACKEND-04 | TBD | Pending |
| ADMIN-01 | TBD | Pending |
| ADMIN-02 | TBD | Pending |
| ADMIN-03 | TBD | Pending |
| ADMIN-04 | TBD | Pending |
| PERF-01 | TBD | Pending |
| PERF-02 | TBD | Pending |
| PERF-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 0
- Unmapped: 34

---
*Requirements defined: 2026-01-19*
*Last updated: 2026-01-19 after initial definition*
