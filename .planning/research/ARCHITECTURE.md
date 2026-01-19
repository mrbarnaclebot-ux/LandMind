# Architecture Patterns

**Project:** LandMind - Solana Web3 Mining Game
**Domain:** Web3 3D gaming with real-time simulation
**Researched:** 2026-01-19
**Confidence:** HIGH (verified via official docs and multiple authoritative sources)

---

## Executive Summary

LandMind requires a **hybrid architecture** separating concerns across blockchain (ownership, economy), game server (simulation, state), and client (rendering, interaction). The key architectural insight: **run simulation off-chain, commit results on-chain**. This is the standard pattern for Solana games achieving both performance and decentralization.

---

## System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                    CLIENTS                                         |
+-----------------------------------------------------------------------------------+
|                                                                                    |
|   +---------------------------+          +---------------------------+            |
|   |     3D Renderer           |          |      React Dashboard      |            |
|   |     (Babylon.js)          |          |      (Vite + React)       |            |
|   |                           |          |                           |            |
|   | - Hex grid (thin inst.)   |          | - Wallet connection       |            |
|   | - Agent visualization     |          | - Agent management        |            |
|   | - Mining animations       |          | - Stats & history         |            |
|   | - Camera controls         |          | - Fee distribution view   |            |
|   +------------+--------------+          +------------+--------------+            |
|                |                                      |                            |
|                +----------------+---------------------+                            |
|                                 |                                                  |
|                                 v                                                  |
|                    +-------------------------+                                     |
|                    |    State Manager        |                                     |
|                    |    (Zustand/Jotai)      |                                     |
|                    |                         |                                     |
|                    | - Local game state      |                                     |
|                    | - Optimistic updates    |                                     |
|                    | - Wallet state          |                                     |
|                    +------------+------------+                                     |
|                                 |                                                  |
+-----------------------------------------------------------------------------------+
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
+-------------------+---+           +-----------+-----------+
|   WebSocket Server    |           |    Solana RPC/WS      |
|   (Game Server)       |           |    (Helius/Triton)    |
+-------------------+---+           +-----------+-----------+
                    |                           |
                    v                           v
+-------------------+-------------------+   +---+-----------------------+
|         GAME SERVER (Node.js)        |   |      SOLANA BLOCKCHAIN    |
+--------------------------------------+   +---------------------------+
|                                      |   |                           |
|  +----------------+  +-----------+   |   |  +---------------------+  |
|  | Simulation     |  | State     |   |   |  | LandMind Program    |  |
|  | Engine         |  | Manager   |   |   |  | (Anchor/Rust)       |  |
|  |                |  |           |   |   |  |                     |  |
|  | - Mining tick  |  | - Redis   |   |   |  | - Agent creation    |  |
|  | - Resource     |  |   cache   |   |   |  | - Fee collection    |  |
|  |   generation   |  | - Session |   |   |  | - Reward distrib.   |  |
|  | - Agent AI     |  |   state   |   |   |  | - Ownership (cNFT)  |  |
|  +-------+--------+  +-----+-----+   |   |  +----------+----------+  |
|          |                 |         |   |             |              |
|          v                 v         |   |             v              |
|  +-------------------------------+   |   |  +---------------------+  |
|  |     PostgreSQL               |   |   |  | Merkle Tree (cNFT)  |  |
|  |     (Persistent State)       |   |   |  | - Agent metadata    |  |
|  |                              |   |   |  | - Ownership proofs  |  |
|  | - World state (hex grid)     |   |   |  +---------------------+  |
|  | - Agent positions/history    |   |   |                           |
|  | - Mining results             |   |   |  +---------------------+  |
|  | - User accounts              |   |   |  | SPL Token           |  |
|  +------------------------------+   |   |  | - $MIND token       |  |
|                                      |   |  | - Fee vault         |  |
+--------------------------------------+   |  +---------------------+  |
                                           +---------------------------+
                    |
                    v
+--------------------------------------+
|         ADMIN DASHBOARD              |
+--------------------------------------+
| - Metrics (Grafana/custom)           |
| - User management                    |
| - Economy controls                   |
| - World editor                       |
+--------------------------------------+
```

---

## Component Boundaries

### 1. Frontend Layer

| Component | Responsibility | Technology | Communicates With |
|-----------|---------------|------------|-------------------|
| **3D Renderer** | Hex grid visualization, agent display, animations | Babylon.js 8.x | State Manager, Game Server (WS) |
| **React Dashboard** | UI panels, wallet, agent management | React 19, Vite | State Manager, Solana RPC |
| **State Manager** | Local state, optimistic updates, sync | Zustand or Jotai | All frontend components |

**Key Boundary Decision:** Babylon.js runs in a separate canvas element alongside React. Use `react-babylonjs` for declarative scene management but keep heavy rendering logic in pure Babylon.js for performance.

### 2. Game Server Layer

| Component | Responsibility | Technology | Communicates With |
|-----------|---------------|------------|-------------------|
| **Simulation Engine** | Mining tick loop, resource generation, agent AI | Node.js (TypeScript) | State Manager, PostgreSQL |
| **WebSocket Server** | Real-time client updates, event broadcasting | Socket.io or ws | Frontend clients, Redis Pub/Sub |
| **State Manager** | Session state, caching, hot data | Redis | Simulation, WebSocket, PostgreSQL |
| **Persistence Layer** | Durable game state, history, analytics | PostgreSQL | Simulation Engine |

**Key Boundary Decision:** Simulation runs at fixed tick rate (e.g., 1-10 Hz for mining). State changes broadcast via WebSocket. Only economically significant events commit to Solana.

### 3. Blockchain Layer

| Component | Responsibility | Technology | Communicates With |
|-----------|---------------|------------|-------------------|
| **LandMind Program** | Agent creation, fee logic, rewards | Anchor (Rust) | Game Server, Frontend |
| **cNFT System** | Agent ownership, metadata | Bubblegum + State Compression | Program, Helius DAS API |
| **Token System** | $MIND token, fee vaults | SPL Token / Token-2022 | Program, Wallets |

**Key Boundary Decision:** Agents are compressed NFTs (cheap mass minting). Agent state (position, mining progress) lives OFF-chain. Only ownership and economic events go ON-chain.

---

## Data Flow Patterns

### Pattern 1: Mining Simulation Loop (Off-Chain)

```
Server Tick (every 100-1000ms)
       |
       v
+------+-------+
| For each     |
| active agent |
+------+-------+
       |
       v
+------+-------+
| Calculate    |
| mining yield |
| based on:    |
| - hex type   |
| - agent attr |
| - time delta |
+------+-------+
       |
       v
+------+-------+
| Update Redis |
| (hot state)  |
+------+-------+
       |
       v
+------+-------+
| Broadcast    |
| via WebSocket|
| (delta only) |
+------+-------+
       |
       v (periodic)
+------+-------+
| Persist to   |
| PostgreSQL   |
+------+-------+
```

**Rationale:** Mining is computationally simple but happens continuously. Running this on-chain would be prohibitively expensive. Off-chain simulation with periodic persistence is the industry standard.

### Pattern 2: Agent Creation (On-Chain)

```
User clicks "Create Agent"
       |
       v
+------+-------+
| Frontend     |
| builds tx    |
+------+-------+
       |
       v
+------+-------+
| Wallet signs |
| transaction  |
+------+-------+
       |
       v
+------+-------+
| Solana       |
| Program      |
| executes:    |
| - Mint cNFT  |
| - Deduct fee |
| - Init state |
+------+-------+
       |
       v
+------+-------+
| WebSocket    |
| notifies     |
| game server  |
+------+-------+
       |
       v
+------+-------+
| Server adds  |
| agent to     |
| simulation   |
+------+-------+
```

**Rationale:** Agent creation involves real money (SOL/token) and ownership. Must be on-chain for trust, provenance, and tradability.

### Pattern 3: Fee Distribution (On-Chain + Scheduled)

```
Daily/Weekly Cron
       |
       v
+------+-------+
| Game Server  |
| calculates   |
| rewards per  |
| agent based  |
| on mining    |
| history      |
+------+-------+
       |
       v
+------+-------+
| Server signs |
| distribution |
| transaction  |
| (PDA auth)   |
+------+-------+
       |
       v
+------+-------+
| Solana       |
| Program      |
| distributes  |
| from vault   |
| to holders   |
+------+-------+
       |
       v
+------+-------+
| Emit events  |
| for frontend |
| notification |
+------+-------+
```

**Rationale:** Batch distribution is cheaper than per-action rewards. Use PDA-controlled vault for trustless distribution.

### Pattern 4: Real-Time 3D Updates

```
Server State Change
       |
       v
+------+-------+
| Publish to   |
| Redis Pub/Sub|
+------+-------+
       |
       v (fan-out)
+------+-------+
| All WebSocket|
| servers recv |
+------+-------+
       |
       v
+------+-------+
| Send to      |
| connected    |
| clients      |
| (delta only) |
+------+-------+
       |
       v
+------+-------+
| Client       |
| applies to   |
| local state  |
+------+-------+
       |
       v
+------+-------+
| Babylon.js   |
| updates      |
| visuals      |
| (interpolate)|
+------+-------+
```

**Rationale:** Delta compression reduces bandwidth. Client-side interpolation smooths updates between ticks.

---

## On-Chain vs Off-Chain Decision Matrix

| Data/Action | Location | Rationale |
|-------------|----------|-----------|
| Agent ownership | ON-CHAIN (cNFT) | Trust, tradability, provenance |
| Agent position | OFF-CHAIN (Redis/PG) | Changes too frequently |
| Mining progress | OFF-CHAIN (Redis/PG) | Simulation state |
| Mining rewards (accrued) | OFF-CHAIN (PG) | Tracked for batch distribution |
| Fee distribution | ON-CHAIN (Program) | Trustless, verifiable |
| World hex data | OFF-CHAIN (PG) | Static, loaded at startup |
| User preferences | OFF-CHAIN (PG) | Not economically significant |
| Agent creation | ON-CHAIN | Payment + ownership |
| Agent upgrade | ON-CHAIN | Economic transaction |
| Agent transfer | ON-CHAIN (cNFT) | Ownership change |

**Key Principle:** On-chain for anything involving money, ownership, or trust. Off-chain for game state that changes frequently.

---

## Rendering Architecture: 1M Hexes

### The Challenge

1 million hexes cannot be rendered as 1 million individual meshes. Draw calls would exceed browser limits.

### Solution: Thin Instances + LOD + Chunking

```
World (1M hexes)
       |
       +-- Chunked into 1000x1000 regions
       |
       v
+------+-------+
| For visible  |
| chunks only: |
+------+-------+
       |
       v
+------+-------+
| Group hexes  |
| by type      |
| (grass, ore, |
| water, etc.) |
+------+-------+
       |
       v
+------+-------+
| Render each  |
| type as THIN |
| INSTANCES    |
| (1 draw call |
| per type per |
| chunk)       |
+------+-------+
```

**Implementation Details:**

1. **Thin Instances** (Babylon.js): Store transformation matrices in GPU buffer. 10K-100K hexes per draw call.

2. **Chunking**: Divide world into 32x32 or 64x64 hex chunks. Only render chunks in view frustum.

3. **LOD (Level of Detail)**:
   - Close: Full hex geometry with bevels
   - Medium: Simplified hex (fewer vertices)
   - Far: Flat colored planes or texture atlas
   - Very far: Merged into single colored region

4. **Texture Atlas**: Combine all hex textures into one atlas to minimize material switches.

**Performance Target:** 60 FPS with 50K-100K visible hexes at any time.

```typescript
// Pseudo-code for thin instance rendering
const hexGeometry = createHexGeometry();
const hexMaterial = new StandardMaterial("hex");

// Per hex type
const grassMatrices = new Float32Array(visibleGrassCount * 16);
// Fill matrices based on positions...

hexMesh.thinInstanceSetBuffer("matrix", grassMatrices, 16);
```

### Sources:
- [Babylon.js Thin Instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances)
- [Babylon.js Instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances)

---

## Agent System Architecture

### Compressed NFTs for Agents

**Why cNFTs:**
- Mint 1M agents for ~5 SOL (vs 12,000 SOL for regular NFTs)
- Ownership verifiable on-chain
- Tradable on marketplaces (Tensor, Magic Eden support cNFTs)
- Metadata updateable (for agent level-ups)

**Architecture:**

```
+------------------+
| Merkle Tree      |
| (on-chain root)  |
+--------+---------+
         |
         v
+--------+---------+
| Leaf = Agent     |
| - owner (Pubkey) |
| - name           |
| - attributes     |
| - creation_time  |
+------------------+
         |
         v (indexed by)
+--------+---------+
| Helius DAS API   |
| - Query by owner |
| - Query by attr  |
+------------------+
```

**Minting Flow:**
1. User pays creation fee (SOL or $MIND)
2. Bubblegum program mints cNFT to user
3. Metadata includes: name, base attributes, creation block
4. Game server receives event, initializes agent in simulation

**Sources:**
- [Helius NFT Compression Guide](https://www.helius.dev/blog/solana-nft-compression)
- [Metaplex Bubblegum](https://developers.metaplex.com/bubblegum)

---

## Fee Distribution Architecture

### Token Economics Flow

```
+------------------+     +-----------------+     +------------------+
|  Users pay fees  | --> |   Fee Vault     | --> |  Distribution    |
|  (agent creation |     |   (PDA-owned)   |     |  (scheduled)     |
|   upgrades, etc) |     |                 |     |                  |
+------------------+     +-----------------+     +------------------+
                                                         |
                         +-------------------------------+
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
    +----------+   +----------+   +----------+
    | Treasury |   | Stakers  |   | Active   |
    | (team)   |   | (if any) |   | Miners   |
    +----------+   +----------+   +----------+
       20%            30%            50%
```

### Recommended Program Structure (Anchor)

```rust
// accounts
pub struct FeeVault {
    pub authority: Pubkey,      // PDA
    pub total_collected: u64,
    pub last_distribution: i64,
    pub distribution_config: DistributionConfig,
}

pub struct DistributionConfig {
    pub treasury_bps: u16,      // basis points (2000 = 20%)
    pub staker_bps: u16,
    pub miner_bps: u16,
}

// instructions
pub fn collect_fee(ctx: Context<CollectFee>, amount: u64) -> Result<()>
pub fn distribute_rewards(ctx: Context<Distribute>) -> Result<()>
```

**Distribution Strategy:**
- **Batch distribution**: Collect fees continuously, distribute weekly
- **Proof submission**: Game server submits mining proofs (Merkle root of rewards)
- **Claim mechanism**: Users claim their share via on-chain instruction

**Sources:**
- [SPL Token Staking Architecture](https://github.com/mithraiclabs/spl-token-staking)
- [Token-2022 Transfer Hooks](https://spl.solana.com/token-2022)

---

## Database Schema (PostgreSQL)

### Core Tables

```sql
-- World definition (static, loaded once)
CREATE TABLE hexes (
    id SERIAL PRIMARY KEY,
    q INT NOT NULL,           -- axial coordinate
    r INT NOT NULL,           -- axial coordinate
    hex_type VARCHAR(20),     -- 'grass', 'ore', 'water', etc
    resource_amount BIGINT,   -- remaining resources
    UNIQUE(q, r)
);
CREATE INDEX idx_hexes_coords ON hexes(q, r);

-- Agents (synced with cNFT ownership)
CREATE TABLE agents (
    id UUID PRIMARY KEY,
    cnft_address VARCHAR(64) UNIQUE,  -- Solana address
    owner_wallet VARCHAR(64),
    name VARCHAR(100),
    level INT DEFAULT 1,
    current_q INT,
    current_r INT,
    mining_power DECIMAL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_agents_owner ON agents(owner_wallet);
CREATE INDEX idx_agents_position ON agents(current_q, current_r);

-- Mining history (for reward calculation)
CREATE TABLE mining_events (
    id BIGSERIAL PRIMARY KEY,
    agent_id UUID REFERENCES agents(id),
    hex_id INT REFERENCES hexes(id),
    amount_mined BIGINT,
    mined_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_mining_agent ON mining_events(agent_id);
CREATE INDEX idx_mining_time ON mining_events(mined_at);

-- Reward tracking
CREATE TABLE reward_epochs (
    id SERIAL PRIMARY KEY,
    epoch_start TIMESTAMP,
    epoch_end TIMESTAMP,
    total_distributed BIGINT,
    merkle_root VARCHAR(128),  -- for on-chain verification
    distributed_at TIMESTAMP
);

CREATE TABLE agent_rewards (
    id BIGSERIAL PRIMARY KEY,
    epoch_id INT REFERENCES reward_epochs(id),
    agent_id UUID REFERENCES agents(id),
    reward_amount BIGINT,
    claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP
);
```

### Redis Schema

```
# Session/hot state
agent:{agent_id}:state     -> JSON {position, mining_progress, last_action}
user:{wallet}:agents       -> SET of agent_ids
chunk:{q}:{r}:agents       -> SET of agent_ids in chunk

# Pub/Sub channels
game:events                -> broadcast channel for all clients
chunk:{q}:{r}:events       -> per-chunk updates
```

---

## Suggested Build Order

Based on component dependencies, here is the recommended implementation sequence:

### Phase 1: Foundation

```
1. PostgreSQL schema + basic CRUD
2. Game server skeleton (Express/Fastify + TypeScript)
3. Basic Babylon.js scene (single hex rendering)
4. Solana program scaffold (Anchor)
```

**Rationale:** Establishes core infrastructure. Each piece is independently testable.

### Phase 2: Core Loop

```
1. Hex grid rendering (thin instances, single chunk)
2. Simulation engine (tick loop, mining calculation)
3. WebSocket server + client connection
4. Redis integration for hot state
```

**Rationale:** Proves the real-time simulation concept works before blockchain complexity.

### Phase 3: Blockchain Integration

```
1. cNFT minting (Bubblegum integration)
2. Agent creation instruction
3. Wallet connection (Solana wallet-adapter)
4. Agent display from on-chain data
```

**Rationale:** Adds ownership layer. Players can now own agents.

### Phase 4: Economy

```
1. Fee collection (vault PDA)
2. Mining reward tracking
3. Distribution mechanism
4. Claim instruction
```

**Rationale:** Completes the economic loop. Game becomes playable.

### Phase 5: Scale

```
1. World chunking + LOD
2. Multi-server support (Redis Pub/Sub)
3. Admin dashboard
4. Monitoring + alerting
```

**Rationale:** Scales to production. World expands to full size.

### Dependency Graph

```
PostgreSQL ─────┬─────> Game Server ────┬───> WebSocket
                │                       │
                │                       └───> Simulation
                │
Babylon.js ─────┴─────> Frontend ──────────> React Dashboard
                              │
Anchor Program ───────────────┘
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Everything On-Chain

**What:** Storing positions, mining progress, every action on Solana
**Why Bad:**
- Transaction costs ($0.00025 * millions of actions = expensive)
- 400ms block time too slow for real-time feel
- Solana account size limits
**Instead:** Hybrid model. Only ownership and economic events on-chain.

### Anti-Pattern 2: Individual Mesh Per Hex

**What:** Creating 1M Babylon.js Mesh objects
**Why Bad:**
- JavaScript object overhead
- 1M draw calls (browser will freeze)
- Memory explosion
**Instead:** Thin instances grouped by type. Chunking. LOD.

### Anti-Pattern 3: Polling for Updates

**What:** Frontend polling server every N seconds
**Why Bad:**
- High latency
- Wasted requests
- Poor user experience
**Instead:** WebSocket with delta updates. Solana account subscriptions for on-chain changes.

### Anti-Pattern 4: Synchronous Blockchain Calls

**What:** Awaiting on-chain confirmation in game loop
**Why Bad:**
- 400ms+ delays block gameplay
- Transaction failures break flow
**Instead:** Optimistic updates. Show pending state. Reconcile on confirmation/failure.

### Anti-Pattern 5: Uncompressed NFTs for Agents

**What:** Minting regular Metaplex NFTs for each agent
**Why Bad:**
- 0.012 SOL per mint (12,000 SOL for 1M agents)
- Account rent
- Query complexity
**Instead:** Compressed NFTs. 5 SOL for 1M agents. Use Helius DAS API for queries.

---

## Technology Recommendations

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| 3D Engine | Babylon.js | 8.x | Best WebGL perf, thin instances, active development |
| React Integration | react-babylonjs | latest | Declarative scene, TypeScript support |
| Frontend | React + Vite | 19.x / 6.x | Fast dev, modern tooling |
| State | Zustand | 5.x | Simple, performant, TypeScript |
| Game Server | Node.js + Fastify | 22.x / 5.x | Fast, async, TypeScript |
| WebSocket | Socket.io | 4.x | Robust reconnection, rooms |
| Cache | Redis | 7.x | Pub/Sub, sorted sets, speed |
| Database | PostgreSQL | 16.x | Reliable, indexed queries |
| Blockchain | Solana + Anchor | 1.18+ / 0.30+ | Dominant framework, good DX |
| NFTs | Bubblegum (cNFT) | latest | Cost-efficient mass minting |
| RPC | Helius | - | DAS API, WebSocket, reliability |

---

## Scalability Considerations

| Concern | At 1K Users | At 100K Users | At 1M Users |
|---------|-------------|---------------|-------------|
| **Hex rendering** | Single chunk | Chunking + LOD | Streaming chunks |
| **Game server** | Single instance | Horizontal scale + Redis | Sharded by region |
| **WebSocket** | Single server | Redis Pub/Sub fanout | Multiple WS servers |
| **Database** | Single PG | Read replicas | Sharded by user |
| **RPC** | Shared | Dedicated | Multiple providers |

---

## Sources

### Official Documentation (HIGH confidence)
- [Babylon.js Instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances)
- [Babylon.js Thin Instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances)
- [Solana Gaming Guide](https://solana.com/developers/guides/games/game-examples)
- [Anchor Documentation](https://www.anchor-lang.com/docs)
- [Helius NFT Compression](https://www.helius.dev/blog/solana-nft-compression)
- [Helius WebSocket](https://www.helius.dev/docs/rpc/websocket)
- [SPL Token Program](https://spl.solana.com/token)

### Architecture Patterns (MEDIUM confidence)
- [On-Chain vs Off-Chain Gaming](https://www.antiersolutions.com/blogs/on-chain-game-logic-vs-off-chain-processing-choosing-the-right-architecture-for-web3-games/)
- [Solana Gaming Overview](https://solana.com/developers/gaming)
- [Redis Game Architecture](https://redis.io/blog/how-to-build-an-app-that-allows-you-to-build-real-time-multiplayer-games-using-redis/)
- [Game Server Tick Architecture](https://mropert.github.io/2025/04/30/making_games_tick_part2/)
- [react-babylonjs](https://github.com/brianzinn/react-babylonjs)

### Community Patterns (MEDIUM confidence)
- [cNFT Mass Minting Patterns](https://medium.com/@ThinkingLoop/5-cnft-patterns-for-penny-cheap-mass-minting-757b88d666f0)
- [Socket.io + Redis Multiplayer](https://dev.to/dowerdev/building-a-real-time-multiplayer-game-server-with-socketio-and-redis-architecture-and-583m)
- [SPL Token Staking](https://github.com/mithraiclabs/spl-token-staking)
