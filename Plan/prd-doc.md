# 3D Hexagonal Land Grid Mining Platform - Technical Specification

**Version:** 1.0  
**Date:** January 2026  
**Status:** Specification  
**Author:** Senior Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [1. Purpose & Overview](#1-purpose--overview)
3. [2. Core System Architecture](#2-core-system-architecture)
4. [3. Technical Stack](#3-technical-stack)
5. [4. Data Models & Schema](#4-data-models--schema)
6. [5. User Flows & Interactions](#5-user-flows--interactions)
7. [6. Smart Contract Specification](#6-smart-contract-specification)
8. [7. Admin Dashboard & Management](#7-admin-dashboard--management)
9. [8. Security Architecture](#8-security-architecture)
10. [9. Performance & Scalability](#9-performance--scalability)
11. [10. Gaps & Potential Issues](#10-gaps--potential-issues)
12. [11. Recommendations & Roadmap](#11-recommendations--roadmap)
13. [12. Risk Assessment & Mitigation](#12-risk-assessment--mitigation)

---

## Executive Summary

This specification defines a Web3-enabled 3D hexagonal land grid mining platform built on the Solana blockchain. The system combines:

- **1 million hexagonal land plots** with procedurally distributed mineral resources (gold, silver, copper, iron)
- **Solana wallet integration** for user authentication and asset ownership
- **Agent deployment system** (0.1 SOL per agent) for autonomous mining operations
- **Fee-share revenue model** distributing platform fees to agent owners based on ownership percentage
- **Real-time 3D visualization** using Babylon.js for immersive land exploration
- **Admin management system** for operational oversight and analytics

**Key Metrics:**
- Max supply: 1,000,000 hexagonal plots
- Agent cost: 0.1 SOL (~$15-20 USD at current rates)
- Fee distribution: Dynamic based on agent ownership percentage
- Transaction throughput: Leveraging Solana's 65,000+ TPS capacity
- Base transaction cost: ~0.000005-0.00001 SOL (~$0.0005-0.0015)

---

## 1. Purpose & Overview

### 1.1 Business Objectives

1. **Create an engaging Web3 gaming economy** combining real estate ownership with autonomous agent operations
2. **Establish a sustainable revenue model** through:
   - Agent deployment fees (0.1 SOL per agent)
   - Platform fees from PumpFun coin trading integration
   - Secondary market transactions
3. **Demonstrate Solana's scalability** for complex game economies with large state spaces
4. **Build community engagement** through competitive and collaborative mining mechanics
5. **Enable true asset ownership** via Solana blockchain for deployed agents (minted as compressed NFTs; hexes are system-owned)

### 1.2 Core Value Propositions

- **Real Ownership**: Users own their deployed agents on-chain as compressed NFTs; hexes are system-owned, with resource allocation verifiable off-chain
- **Passive Income**: Agent deployment generates continuous mining rewards and fee-sharing opportunities
- **Transparent Economy**: All transactions and rewards logged on immutable blockchain
- **Low Barriers to Entry**: Minimal transaction costs (sub-cent fees) enable mass participation
- **Interoperability**: Assets tradable on secondary markets (Magic Eden, Tensor, Solanart)

---

## 2. Core System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ 3D Explorer │  │ Wallet Panel │  │ Agent Dashboard  │   │
│  │ (Babylon.js)│  │ (PhantomWallet)  │ & Analytics      │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER (Backend)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Game Server (Node.js + Express)                     │   │
│  │  ├─ Hex Grid State Management                        │   │
│  │  ├─ Agent Lifecycle Management                       │   │
│  │  ├─ Mining Simulation Engine                         │   │
│  │  ├─ Fee Collection & Distribution                    │   │
│  │  └─ Real-time Event Broadcasting (WebSocket)         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Blockchain Integration Layer                        │   │
│  │  ├─ Solana Program Interactions (RPC calls)          │   │
│  │  ├─ Wallet Verification & Auth                       │   │
│  │  ├─ Transaction Broadcasting & Monitoring            │   │
│  │  └─ Event Indexing & Historical Data                 │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────────────────────────────────────────────┐
│              BLOCKCHAIN LAYER (Solana Mainnet)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  landmind (single Anchor program)                      │ │
│  │  ├─ deploy_agent  (0.1 SOL -> fee vault, emit event)   │ │
│  │  ├─ fee vault     (accumulates deploy + external fees) │ │
│  │  └─ claim_earnings (Merkle-proof fee distribution)     │ │
│  │  Hexes are system-owned (no per-tile ownership NFT)    │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────────────────────────────────────────────┐
│            DATA PERSISTENCE LAYER                             │
│  ┌──────────────────────┐  ┌──────────────────────────┐     │
│  │ Off-chain Database   │  │ Blockchain Data (Indexed)│     │
│  │ (PostgreSQL)         │  │ (Solscan, Web3.js)       │     │
│  │ ├─ Game State        │  │                          │     │
│  │ ├─ User Sessions     │  │ Source of Truth          │     │
│  │ ├─ Analytics         │  │ for On-chain State       │     │
│  │ └─ Cache Layer       │  │                          │     │
│  └──────────────────────┘  └──────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 System Components

| Component | Purpose | Technology |
|-----------|---------|-----------|
| **3D Rendering Engine** | Real-time hex grid visualization | Babylon.js 8.0 |
| **Game Server** | State management, mining simulation | Node.js + Express |
| **Blockchain Interface** | Solana RPC communication | Anchor Framework / web3.js |
| **Smart Contracts** | On-chain land ownership, agent creation | Rust (Solana Programs) |
| **Database** | Off-chain game state, analytics | PostgreSQL + Redis cache |
| **Wallet Integration** | User authentication & transactions | Phantom Wallet SDK |
| **Admin System** | Oversight and management | React Dashboard + API |

### 2.3 Architectural Principles

1. **Separation of Concerns**: Game logic decoupled from blockchain operations
2. **Off-chain Simulation**: Mining simulation runs off-chain with periodic settlement on-chain
3. **Eventual Consistency**: Off-chain state syncs with blockchain periodically (1-5 min intervals)
4. **Stateless Backend**: Easy horizontal scaling via load balancing
5. **Event-Driven**: WebSocket events broadcast real-time updates to connected clients

---

## 3. Technical Stack

### 3.1 Frontend Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **3D Rendering** | Babylon.js 8.0 | WebGL-based 3D hex grid visualization |
| **Framework** | React 18+ | UI component management |
| **State Management** | Zustand or Redux | Client-side game state |
| **Wallet Integration** | Phantom Wallet SDK | Solana wallet connection |
| **Real-time Updates** | Socket.io (client) | WebSocket communication |
| **Build Tool** | Vite | Fast development builds |
| **Visualization** | D3.js / Chart.js | Analytics dashboards |

**Browser Requirements:**
- WebGL 2.0+ support
- Chrome/Firefox/Safari/Edge (latest 2 versions)
- 4GB+ RAM for large hex grids
- Broadband connection (5+ Mbps recommended)

### 3.2 Backend Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 20+ LTS | Server runtime |
| **Framework** | Express.js 4.x | REST API |
| **Blockchain** | Anchor Framework | Solana program development & interaction |
| **Blockchain Client** | @solana/web3.js | Direct RPC communication |
| **Real-time** | Socket.io (server) | WebSocket broadcasting |
| **Database** | PostgreSQL 15+ | Persistent off-chain state |
| **Cache** | Redis 7+ | Session & state caching |
| **Indexing** | Solscan API / Helius | Blockchain event indexing |
| **Monitoring** | Winston, Prometheus | Logging & metrics |
| **Testing** | Jest, Supertest | Unit & integration tests |

### 3.3 Smart Contract Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Language** | Rust + Anchor | Solana program development |
| **Network** | Solana Mainnet-beta | Production deployment |
| **Development** | Anchor CLI | Program scaffolding & testing |
| **Token Standard** | Metaplex Bubblegum (cNFT) | Compressed NFT standard for agents (hexes are system-owned, not tokenized) |
| **Testing** | Anchor Tests | Local environment testing |
| **Deployment** | Solana CLI + Anchor | Contract verification & deployment |

### 3.4 Infrastructure Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Hosting** | Google Cloud (preferred) / AWS | Scalable compute |
| **Database** | Cloud SQL (PostgreSQL) | Managed DB service |
| **Cache** | Cloud Memorystore (Redis) | Managed cache service |
| **CDN** | Cloudflare / Cloud CDN | Static asset distribution |
| **Container** | Docker + Kubernetes | Containerization & orchestration |
| **CI/CD** | GitHub Actions | Automated testing & deployment |
| **Monitoring** | Datadog / Google Cloud Monitoring | System health monitoring |
| **API Gateway** | Cloud Load Balancer | Request routing & DDoS protection |

### 3.5 Development Workflow

```
Local Development
  ├─ Anchor: Develop & test contracts locally
  ├─ Node.js: Backend API development
  ├─ React: Frontend components with hot reload
  └─ Phantom: Wallet integration on devnet

Staging (Testnet)
  ├─ Solana Devnet deployment
  ├─ Docker containers on staging cluster
  ├─ End-to-end testing
  └─ Performance benchmarking

Production (Mainnet)
  ├─ Mainnet-beta deployment (with conservative rollout)
  ├─ Kubernetes auto-scaling
  ├─ Real user traffic with monitoring
  └─ Continuous observability
```

---

## 4. Data Models & Schema

### 4.1 Hexagonal Grid Coordinate System

**Coordinate System: Cube Coordinates (Axial Storage)**

Each hexagon is uniquely identified by axial coordinates (q, r), with the third coordinate (s) calculated as `-q - r` for mathematical operations.

```typescript
interface HexCoordinate {
  q: number;      // Q-axis (column)
  r: number;      // R-axis (row)
  s?: number;     // S-axis (derived: -q - r)
}

interface HexTile {
  id: string;                    // Unique identifier (hash of q,r)
  coordinate: HexCoordinate;
  
  // Resource allocation (sum = 100%)
  resources: {
    gold: {
      percentage: number;        // 0-100
      rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
      baseYield: number;         // Units per mining cycle
    };
    silver: { ... };
    copper: { ... };
    iron: { ... };
  };
  
  // Ownership & State
  owner: PublicKey;              // Solana wallet address
  nftMint: PublicKey;            // SPL NFT mint address
  deployedAgents: string[];      // Agent IDs deployed on this tile
  discoveredAt: number;          // Unix timestamp
  
  // Mining state
  totalMined: {
    gold: number;
    silver: number;
    copper: number;
    iron: number;
  };
  lastMiningBlock: number;       // Solana block height
}
```

**Why Cube Coordinates?**
- Simplifies neighbor calculations (6 directions)
- Enables pathfinding and distance calculations naturally
- Reduces even/odd row complexity in offset systems
- Mathematically elegant for game mechanics

### 4.2 Agent System

```typescript
interface Agent {
  id: string;                        // UUID
  nftMint: PublicKey;                // NFT token mint (agent ownership proof)
  owner: PublicKey;                  // Solana wallet (owner of agent NFT)
  
  // Deployment details
  deployedAt: number;                // Unix timestamp of creation
  deploymentTransaction: string;     // Blockchain tx hash
  
  // Location
  currentHexTile: HexCoordinate;     // Where agent is deployed
  
  // Mining configuration
  miningConfig: {
    targetResources: ('gold' | 'silver' | 'copper' | 'iron')[]; // Priority order
    miningPower: number;             // Base mining rate multiplier
    energyEfficiency: number;        // Energy per mining cycle
  };
  
  // Status & metrics
  status: 'active' | 'paused' | 'maintenance' | 'offline';
  energyLevel: number;               // 0-100%
  totalEarnings: {
    gold: number;
    silver: number;
    copper: number;
    iron: number;
  };
  
  // Upgrades
  upgrades: {
    miningPower: number;             // Level 0-10
    energyEfficiency: number;        // Level 0-10
    speed: number;                   // Level 0-10
  };
  
  // Rewards
  feeShareAllocation: number;        // % of platform fees allocated to owner
  lastRewardClaim: number;           // Timestamp of last reward claim
}
```

### 4.3 Mining & Rewards Model

```typescript
interface MiningCycle {
  agentId: string;
  hexTileId: string;
  cycleNumber: number;
  
  // Production
  resources: {
    gold: number;
    silver: number;
    copper: number;
    iron: number;
  };
  
  // Efficiency factors
  agentHealth: number;               // 0-100% (degrades over time)
  hexDepletion: number;              // 0-100% (resource exhaustion)
  
  timestamp: number;                 // Unix timestamp
  duration: number;                  // Seconds to complete cycle
}

interface FeeDistribution {
  totalPlatformFees: number;         // Total SOL collected from all sources
  distributionCycle: number;         // Cycle number
  
  // Per-agent allocation
  allocations: {
    [agentOwner: string]: {
      feeShare: number;              // SOL amount
      percentageOfTotal: number;     // % of total platform fees
      agents: string[];              // Agent IDs contributing to this share
    };
  };
  
  distributedAt: number;             // Timestamp of distribution
  transactionHash: string;           // On-chain settlement tx
}
```

### 4.4 Admin Dashboard Models

```typescript
interface AdminDashboardMetrics {
  gridStatistics: {
    totalHexes: number;              // 1,000,000
    hexesOwned: number;
    hexesUnclaimed: number;
    avgResourceDensity: number;      // Per hex
  };
  
  agentStatistics: {
    totalDeployed: number;
    activeAgents: number;
    pausedAgents: number;
    totalMiningPower: number;
  };
  
  economicsData: {
    totalSOLDeployed: number;        // Sum of agent creation costs
    totalPlatformFeesGenerated: number;
    totalResourcesMined: {
      gold: number;
      silver: number;
      copper: number;
      iron: number;
    };
    avgAgentLifetime: number;        // Hours
    agentChurnRate: number;          // % deactivated per day
  };
  
  userMetrics: {
    totalUsers: number;
    activeUsers24h: number;
    newUsersToday: number;
    retentionRate: number;
  };
  
  systemHealth: {
    serverUptime: number;            // %
    blockchainLatency: number;       // ms
    transactionFailureRate: number;  // %
    averageResponseTime: number;     // ms
  };
}
```

### 4.5 Database Schema

**PostgreSQL Tables (Key Entities)**

```sql
-- Hex Grid Data
CREATE TABLE hex_tiles (
  id VARCHAR(64) PRIMARY KEY,
  q INTEGER NOT NULL,
  r INTEGER NOT NULL,
  owner_pubkey VARCHAR(44),
  nft_mint VARCHAR(44),
  gold_percentage NUMERIC(5,2),
  gold_rarity VARCHAR(20),
  silver_percentage NUMERIC(5,2),
  silver_rarity VARCHAR(20),
  copper_percentage NUMERIC(5,2),
  copper_rarity VARCHAR(20),
  iron_percentage NUMERIC(5,2),
  iron_rarity VARCHAR(20),
  discovered_at BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_owner (owner_pubkey),
  INDEX idx_coordinates (q, r)
);

-- Agent Registry
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  nft_mint VARCHAR(44) UNIQUE NOT NULL,
  owner_pubkey VARCHAR(44) NOT NULL,
  hex_tile_id VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL,
  mining_power NUMERIC(10,4),
  energy_level NUMERIC(5,2),
  deployed_at BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (hex_tile_id) REFERENCES hex_tiles(id),
  INDEX idx_owner (owner_pubkey),
  INDEX idx_status (status),
  INDEX idx_hex (hex_tile_id)
);

-- Mining Records
CREATE TABLE mining_cycles (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL,
  hex_tile_id VARCHAR(64) NOT NULL,
  gold_mined NUMERIC(16,8),
  silver_mined NUMERIC(16,8),
  copper_mined NUMERIC(16,8),
  iron_mined NUMERIC(16,8),
  cycle_number BIGINT,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (hex_tile_id) REFERENCES hex_tiles(id),
  INDEX idx_agent (agent_id),
  INDEX idx_timestamp (timestamp)
);

-- Fee Distribution Records
CREATE TABLE fee_distributions (
  id UUID PRIMARY KEY,
  total_fees_sol NUMERIC(16,8),
  distribution_cycle BIGINT,
  transaction_hash VARCHAR(88),
  distributed_at BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_cycle (distribution_cycle),
  INDEX idx_tx_hash (transaction_hash)
);

-- User Sessions
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,
  wallet_pubkey VARCHAR(44) NOT NULL,
  last_activity BIGINT NOT NULL,
  total_agents_owned INTEGER DEFAULT 0,
  total_hexes_owned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_wallet (wallet_pubkey)
);
```

---

## 5. User Flows & Interactions

### 5.1 Onboarding Flow

```
┌─────────────────────────────────────────────────┐
│ 1. Landing Page & Education                     │
│    - Explain land ownership & mining            │
│    - Show potential earnings                    │
│    - Clarify blockchain mechanics               │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ 2. Wallet Connection                            │
│    - "Connect Wallet" button                    │
│    - Support: Phantom, Solflare, Magic Eden    │
│    - Request read-only permission               │
│    - Verify wallet has minimum 0.2 SOL         │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ 3. User Verification                           │
│    - Sign message with wallet                   │
│    - Create user session on backend             │
│    - Load historical data if returning user    │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ 4. Hex Grid Visualization                      │
│    - Load 3D Babylon.js scene                   │
│    - Stream initial viewport hexes (50-100)    │
│    - Highlight unclaimed vs owned hexes        │
│    - Show resource heatmap overlay             │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ 5. First Purchase                              │
│    - Select unclaimed hex                       │
│    - Review gas fees (~0.0001 SOL)             │
│    - Approve transaction in wallet              │
│    - Wait for blockchain confirmation (1-2s)   │
│    - Hex now shows in user's dashboard          │
└─────────────────────────────────────────────────┘
```

### 5.2 Agent Deployment Flow

```
┌──────────────────────────────────────────────────┐
│ 1. Browse Agent Types                           │
│    - Base Agent (1x mining power)               │
│    - Advanced Agent (2x mining power, 1.5x cost)│
│    - Elite Agent (3x mining power, 3x cost)    │
│    - Show ROI calculator                        │
└──────────────┬─────────────────────────────────┘
               │
┌──────────────▼─────────────────────────────────┐
│ 2. Select Deployment Location                  │
│    - Choose owned hex tile                      │
│    - Verify sufficient resources available      │
│    - Show potential mining output               │
└──────────────┬─────────────────────────────────┘
               │
┌──────────────▼─────────────────────────────────┐
│ 3. Confirm Deployment                          │
│    - Display cost: 0.1 SOL (base)              │
│    - Break down transaction costs               │
│    - Show fee-share allocation percentage       │
│    - User confirms in wallet                    │
└──────────────┬─────────────────────────────────┘
               │
┌──────────────▼─────────────────────────────────┐
│ 4. Blockchain Settlement (2-5 seconds)         │
│    - Anchor program creates Agent NFT          │
│    - Agent registered on-chain                 │
│    - 0.1 SOL transferred to program vault      │
│    - Event emitted & indexed                    │
└──────────────┬─────────────────────────────────┘
               │
┌──────────────▼─────────────────────────────────┐
│ 5. Agent Goes Live                             │
│    - Agent appears in dashboard                │
│    - Mining simulation begins                  │
│    - Real-time status updates via WebSocket    │
│    - Rewards accrue every cycle (~1 min)      │
└──────────────────────────────────────────────────┘
```

### 5.3 Mining & Rewards Flow

```
Mining Cycle (Every 60 seconds):
┌─────────────────────────────────────┐
│ 1. Calculate Mining Output           │
│    Input: Agent mining power, hex    │
│    resources, depletion factors      │
│    Output: Resource amounts mined    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 2. Update Agent State               │
│    - Add resources to agent vault    │
│    - Decrement agent energy          │
│    - Update hex depletion meter      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 3. Broadcast Real-time Update       │
│    - WebSocket event to user client  │
│    - Dashboard updates with new stats│
└──────────────────────────────────────┘

Reward Claim Flow (User-initiated):
┌─────────────────────────────────────┐
│ 1. User Clicks "Claim Rewards"      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 2. Backend Prepares Claim Tx        │
│    - Tally all resources mined      │
│    - Calculate fee-share allocation  │
│    - Create SPL token transfers     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 3. User Signs Transaction           │
│    - Phantom shows breakdown        │
│    - Fee: ~0.00005 SOL              │
│    - Approve in wallet              │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 4. Blockchain Settlement            │
│    - Resources transferred to wallet │
│    - Fee-share SOL distributed      │
│    - On-chain receipt recorded      │
│    - Backend updates database       │
└──────────────────────────────────────┘

Fee Distribution Flow (Hourly):
┌─────────────────────────────────────┐
│ 1. Hourly Batch Process Triggered   │
│    - Aggregate all platform fees    │
│    - Calculate each user's %        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 2. Generate Distribution Tx         │
│    - Create multi-instruction tx    │
│    - Calculate fair share amounts   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 3. Execute on-chain                 │
│    - Distribute SOL to agent owners │
│    - Record in FeeDistribution table│
│    - Emit event for indexing       │
└──────────────────────────────────────┘
```

### 5.4 3D Explorer Navigation

```
User Actions (Frontend/Babylon.js):
  ├─ Scroll/Pinch: Zoom in/out
  ├─ Middle-mouse drag: Pan camera
  ├─ Left-click hex: Show details panel
  ├─ Right-click hex: Context menu (claim, deploy agent, sell)
  ├─ WASD keys: First-person movement
  └─ Search bar: Jump to coordinate

Resource Visualization:
  ├─ Color coding by primary resource
  ├─ Hex height based on resource density
  ├─ Intensity glow for rarity levels
  ├─ Ownership overlay (opacity change)
  └─ Agent markers (animated icons)

Performance Optimization:
  ├─ Frustum culling: Only render visible hexes
  ├─ Level-of-Detail (LOD): Reduce polygon count for distant hexes
  ├─ Lazy-load hex data: Stream from backend
  ├─ Texture atlasing: Single texture for all resource types
  └─ WebWorker: Coordinate calculations off main thread
```

---

## 6. Smart Contract Specification

### 6.1 Program Architecture

**Single Anchor program: `landmind`.**

The on-chain surface is a single program that handles agent deployment (fee
collection into a program-owned vault) and Merkle-proof-based earnings claims.
There is **no** Land Registry program and **no** per-hex ownership NFT — hexes
are system-owned and hex/agent assignment is resolved off-chain by the
simulation. Agents are minted as Metaplex **compressed NFTs (cNFTs)** off the
deploy event rather than tracked in a per-agent on-chain account.

> **Design evolution.** This specification originally described three separate
> programs — a Land Registry (per-hex ownership NFTs), an Agent Factory, and a
> Rewards Vault. They were consolidated into the single `landmind` program to
> reduce on-chain surface area, deployment cost, and cross-program complexity.
> Per-hex ownership NFTs were removed in favour of system-owned hexes; deploy,
> the fee vault, and Merkle claims now live in one program. User-facing
> economics (0.1 SOL deploy, weighted fee distribution) are unchanged.

Program ID: `D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ`

| Instruction | Description |
|-------------|-------------|
| `deploy_agent` | Transfer 0.1 SOL to the program fee vault, emit a deploy event for off-chain cNFT minting |
| `initialize_vault` | One-time setup of the fee vault state / authority |
| `claim_earnings` | Verify a Merkle proof and transfer the caller's earned fee share |
| `update_merkle_root` | Admin updates the claimable-amounts Merkle root each distribution epoch |
| `pause_vault` / `unpause_vault` | Emergency controls |

#### A. Agent deployment (`deploy_agent`)

```rust
// landmind::deploy_agent
// Transfers the flat deploy cost to the program fee vault (a system-owned PDA)
// and emits an event. The cNFT is minted off-chain by the server from the event;
// there is no per-agent on-chain account and no hex-ownership check.

#[derive(Accounts)]
pub struct DeployAgent<'info> {
    #[account(mut)]
    pub deployer: Signer<'info>,

    /// Program-owned SOL fee vault PDA. Accumulates deploy fees + external fees.
    #[account(mut, seeds = [b"fee_vault"], bump)]
    pub fee_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn deploy_agent(ctx: Context<DeployAgent>) -> Result<()> {
    const DEPLOYMENT_COST: u64 = 100_000_000; // 0.1 SOL in lamports

    // Move the deploy fee into the program fee vault.
    let ix = system_instruction::transfer(
        ctx.accounts.deployer.key,
        ctx.accounts.fee_vault.key,
        DEPLOYMENT_COST,
    );
    invoke(
        &ix,
        &[
            ctx.accounts.deployer.to_account_info(),
            ctx.accounts.fee_vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // Emit for off-chain indexing + cNFT minting. Hex assignment happens off-chain.
    emit!(AgentDeployed {
        owner: ctx.accounts.deployer.key(),
        deployment_cost: DEPLOYMENT_COST,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

#### B. Earnings claim (`claim_earnings`)

```rust
// landmind::claim_earnings
// Verifies a Merkle proof against the current root (published per distribution
// epoch by update_merkle_root) and transfers the caller's claimable fee share
// out of the fee vault. Fee-share weighting is computed off-chain from mining.

#[derive(Accounts)]
pub struct ClaimEarnings<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(mut, seeds = [b"vault_state"], bump)]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut, seeds = [b"fee_vault"], bump)]
    pub fee_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn claim_earnings(
    ctx: Context<ClaimEarnings>,
    amount: u64,
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault_state;
    require!(!vault.paused, LandmindError::VaultPaused);

    // Leaf = hash(claimer, amount); verify against the published root.
    let leaf = hash_leaf(&ctx.accounts.claimer.key(), amount);
    require!(
        verify_merkle_proof(&proof, vault.merkle_root, leaf),
        LandmindError::InvalidProof
    );

    // Transfer the claimable share from the fee vault to the claimer.
    **ctx.accounts.fee_vault.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.claimer.to_account_info().try_borrow_mut_lamports()? += amount;

    emit!(EarningsClaimed {
        owner: ctx.accounts.claimer.key(),
        amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

#### C. Vault administration (`update_merkle_root`, pause controls)

```rust
// landmind - admin instructions guarded by the vault authority.

#[account]
pub struct VaultState {
    pub authority: Pubkey,   // admin allowed to update the root / pause
    pub merkle_root: [u8; 32],
    pub paused: bool,
    pub epoch: u64,
}

pub fn update_merkle_root(ctx: Context<UpdateRoot>, new_root: [u8; 32]) -> Result<()> {
    let vault = &mut ctx.accounts.vault_state;
    require_keys_eq!(ctx.accounts.authority.key(), vault.authority);
    vault.merkle_root = new_root;
    vault.epoch += 1;
    Ok(())
}
```

### 6.2 Event Architecture

```rust
// landmind events for off-chain indexing.
// No HexTileClaimed event — hexes are system-owned and assigned off-chain.

#[event]
pub struct AgentDeployed {
    pub owner: Pubkey,
    pub deployment_cost: u64,
    pub timestamp: i64,
}

#[event]
pub struct EarningsClaimed {
    pub owner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
```

### 6.3 Security Mechanisms

1. **Signer Verification**: All state-modifying operations require signature
2. **Owner Checks**: Accounts validated against declared owner
3. **PDA Seeds**: Deterministic account derivation prevents collisions
4. **Rent Exemption**: Accounts must be rent-exempt
5. **Overflow Protection**: Use checked math for all calculations
6. **Reentrancy Guards**: Cross-program invocations carefully audited

---

## 7. Admin Dashboard & Management

### 7.1 Admin Authentication

```typescript
interface AdminUser {
  wallet: PublicKey;
  role: 'super_admin' | 'moderator' | 'analytics';
  permissions: {
    viewMetrics: boolean;
    manageUsers: boolean;
    adjustParameters: boolean;
    emergencyShutdown: boolean;
  };
}

// Multi-sig authority recommended:
// 2-of-3 multisig for critical operations
// - Emergency pause
// - Parameter adjustments
// - Fund recovery
```

### 7.2 Admin Dashboard Features

#### A. Real-time Metrics

```typescript
GET /admin/metrics/realtime
Returns: {
  gridStatistics: {
    totalHexes: 1_000_000,
    hexesOwned: 287_500,        // 28.75%
    hexesUnclaimed: 712_500,
    topResourcesDistribution: {
      gold: { avgPercentage: 18.5, depleted: 12_500 },
      silver: { avgPercentage: 22.1, depleted: 8_200 },
      copper: { avgPercentage: 35.2, depleted: 15_600 },
      iron: { avgPercentage: 24.2, depleted: 9_800 }
    }
  },
  
  agentStatistics: {
    totalDeployed: 125_000,
    activeAgents: 118_500,
    pausedAgents: 4_200,
    deactivatedAgents: 2_300,
    totalMiningPower: 287_500,  // Cumulative
    agentsByType: {
      base: 85_000,
      advanced: 35_000,
      elite: 5_000
    }
  },
  
  economicsData: {
    totalSOLDeployed: 27_500,   // 125k agents × avg 0.22 SOL
    totalPlatformFeesGenerated: 1_845.50,
    totalRewardsClaimed: 3_210.75,
    resourcesMined: {
      gold: 4_521_000,
      silver: 3_890_000,
      copper: 5_120_000,
      iron: 4_880_000
    },
    avgAgentLifetime: 720,      // Hours
    agentChurnRate: 0.5         // % per day
  }
}
```

#### B. User Management

```typescript
GET /admin/users
Returns: Array<{
  wallet: PublicKey,
  joinDate: timestamp,
  totalHexesOwned: number,
  totalAgentsOwned: number,
  totalEarnings: number,
  feeSharePercentage: number,
  lastActivity: timestamp,
  flags: {
    suspicious: boolean,
    violatesTerms: boolean,
    blacklisted: boolean
  }
}>

POST /admin/users/{wallet}/ban
POST /admin/users/{wallet}/warn
POST /admin/users/{wallet}/audit
```

#### C. System Monitoring

```typescript
GET /admin/system/health
Returns: {
  status: 'healthy' | 'degraded' | 'critical',
  
  components: {
    database: {
      status: 'up' | 'down',
      latency: 45,        // ms
      connectionPoolUsage: 0.62
    },
    
    blockchain: {
      status: 'up' | 'down',
      latency: 125,       // ms
      confirmationTime: 2.1,  // seconds
      failureRate: 0.001  // %
    },
    
    gameServer: {
      status: 'up' | 'down',
      uptime: 99.98,      // %
      avgResponseTime: 80, // ms
      activeConnections: 2_450,
      memoryUsage: 4.2    // GB
    },
    
    blockchain_indexer: {
      status: 'up' | 'down',
      syncLag: 2,         // blocks behind
      eventsProcessed: 5_847_230
    }
  },
  
  alerts: [
    {
      severity: 'warning',
      message: 'Database connection pool at 62% capacity',
      timestamp: now()
    }
  ]
}
```

#### D. Transaction History & Audit Log

```typescript
GET /admin/audit-log?filter=deployments&limit=100
Returns: Array<{
  id: string,
  type: 'agent_deployment' | 'hex_claim' | 'reward_claim' | 'fee_distribution',
  user: PublicKey,
  details: object,
  transactionHash: string,
  blockNumber: number,
  timestamp: timestamp,
  status: 'confirmed' | 'pending' | 'failed'
}>

GET /admin/failed-transactions
GET /admin/pending-transactions
```

#### E. Emergency Controls

```typescript
POST /admin/emergency/pause-mining
  - Immediately stops all mining simulations
  - Users can still claim rewards
  - No new agents can be deployed

POST /admin/emergency/pause-deployments
  - Stops new agent deployments
  - Existing agents continue mining

POST /admin/emergency/resume
  - Resume paused operations

POST /admin/emergency/fund-vault
  - Manual SOL injection for emergency liquidity
```

### 7.3 Dashboard UI Structure

```
/admin
├─ /dashboard
│  ├─ Real-time metrics widgets
│  ├─ 24h trend charts
│  ├─ Active user map
│  └─ Alert panel
│
├─ /users
│  ├─ User list with search/filter
│  ├─ User detail modal
│  ├─ Ban/Warn/Audit actions
│  └─ Activity timeline
│
├─ /transactions
│  ├─ Transaction explorer
│  ├─ Filter by type/status
│  ├─ Failed transaction analyzer
│  └─ Retry options
│
├─ /economy
│  ├─ Resource distribution charts
│  ├─ Fee market analysis
│  ├─ Agent lifetime statistics
│  └─ Churn analysis
│
├─ /system
│  ├─ Health status dashboard
│  ├─ Performance metrics
│  ├─ Log viewer
│  └─ Emergency controls
│
└─ /settings
   ├─ Parameter adjustments
   ├─ Whitelist management
   ├─ Rate limit config
   └─ Admin user management
```

---

## 8. Security Architecture

### 8.1 Authentication & Authorization

#### User Authentication
```
┌─────────────────────────────────────┐
│ Wallet Connection (Phantom SDK)      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ Message Signing                      │
│ Message: "Sign to authenticate"      │
│ Proof: Wallet signature              │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ Backend Verification                 │
│ - Recover pubkey from signature      │
│ - Verify message hash                │
│ - Check against blockchain nonce     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ JWT Token Generation                 │
│ - exp: 7 days                        │
│ - sub: wallet pubkey                 │
│ - aud: platform domain               │
└──────────────────────────────────────┘
```

#### Admin Authorization
```
- Stored in secure environment variables
- Multi-sig required for critical operations
- All admin actions logged with signatures
- Rate limiting: 10 requests/minute per admin
- Session timeout: 30 minutes of inactivity
```

### 8.2 Blockchain Security

#### Smart Contract Audits
- **Pre-launch**: External audit by Soteria / OtterSec
- **Scope**: All 3 Anchor programs
- **Coverage**: 100% code paths
- **Focus areas**:
  - Integer overflow/underflow
  - Privilege escalation
  - Reentrancy attacks
  - Account ownership validation

#### Fund Safety
```
Program Vault Architecture:
┌─────────────────────────────┐
│  Program Vault (PDA)        │
│  Authority: Program itself  │
│  ├─ Deployment fees (SOL)   │
│  ├─ Mining rewards pool     │
│  ├─ Fee distribution buffer │
│  └─ Liquidity reserve       │
└─────────────────────────────┘

Safety Measures:
- Cold storage for 95% of funds
- Timelock on fund withdrawals (7-day delay)
- Multi-sig required for any vault transfer
- Regular fund audits & reconciliation
```

### 8.3 Data Security

#### Database
```
PostgreSQL Security:
├─ SSL/TLS for all connections
├─ Row-level security (RLS) policies
├─ Encrypted at rest with transparent data encryption
├─ Regular automated backups (hourly)
├─ Backup encryption with separate key
├─ No PII stored in database
│  (Wallets are pseudonymous by design)
└─ Connection pooling with credential rotation

Redis Cache:
├─ Redis AUTH with strong passwords
├─ Encrypted communication (TLS 1.3)
├─ Key expiration (TTL enforcement)
├─ Volatile data only (no sensitive state)
└─ Geographically distributed replicas
```

#### API Security
```
Endpoint Protection:
├─ All endpoints require HTTPS only
├─ Certificate pinning in mobile clients
├─ CORS policies: Whitelist specific domains
├─ Rate limiting: 100 requests/minute per wallet
├─ Input validation on all parameters
├─ SQL injection prevention via parameterized queries
├─ XSS prevention: CSP headers + sanitization
├─ CSRF tokens on state-modifying endpoints
└─ Request signing with wallet keys (additional verification)
```

### 8.4 Wallet Integration Security

#### Phantom Wallet Integration
```
Best Practices:
├─ Only request read-only permissions initially
├─ Explicit approval for signing transactions
├─ No private key access (keys stay in wallet)
├─ Transaction previews shown to user
├─ Timelock on sensitive operations
│  (0.1 SOL deployments require additional confirmation)
└─ Session isolation (logout clears local state)
```

#### Transaction Security
```
Before Broadcasting:
├─ Simulate transaction locally
├─ Verify recipient addresses
├─ Check transaction fees are reasonable
├─ Validate smart contract calls
├─ Ensure sufficient SOL balance
└─ Sign with wallet only after user approval

After Broadcasting:
├─ Monitor confirmation status
├─ Retry with exponential backoff
├─ Log all transactions with signatures
├─ Emit events for indexing
└─ Notify user of settlement
```

### 8.5 Frontend Security

```typescript
// CSP Headers
Content-Security-Policy: "
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https: wss:;
  font-src 'self' data:;
"

// Additional Headers
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
```

```typescript
// Application Security
├─ No sensitive data in local storage (use secure SessionStorage)
├─ Clear cache on logout
├─ Disable browser caching for sensitive pages
├─ Prevent screenshot of sensitive data (mobile)
├─ Sanitize DOM mutations
├─ Validate all user inputs
├─ Escape HTML entities
├─ Disable right-click on sensitive areas
└─ Implement timeout for inactive sessions
```

### 8.6 Monitoring & Incident Response

```
Real-time Security Monitoring:
├─ IDS/IPS: WAF rules for API endpoints
├─ Anomaly detection: Unusual transaction patterns
├─ Rate limit violations: Alert on sustained abuse
├─ Failed auth attempts: Alert after 5 attempts
├─ Large withdrawals: Alert for transfers >10 SOL
├─ Smart contract event monitoring: Unusual patterns
└─ User behavior analytics: Detect account takeover

Incident Response Plan:
1. Detection & Alerting (automated)
2. Triage & Assessment (ops team)
3. Containment (pause relevant systems)
4. Eradication & Recovery
5. Post-incident Review (RCA document)
6. Communication (user notification if needed)
```

---

## 9. Performance & Scalability

### 9.1 3D Rendering Performance

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Frame Rate** | 60 FPS | — | ⚠️ TBD |
| **Hex Rendering (visible)** | <500 hexes | — | ⚠️ TBD |
| **Viewport Memory** | <100 MB | — | ⚠️ TBD |
| **Time to Interactive** | <3 seconds | — | ⚠️ TBD |

**Optimization Strategy:**
```
┌─────────────────────────────────┐
│ Babylon.js Optimizations        │
├─────────────────────────────────┤
│ ✓ LOD system (4 levels)         │
│ ✓ Instanced meshes              │
│ ✓ Frustum culling               │
│ ✓ Occlusion queries             │
│ ✓ Texture atlasing              │
│ ✓ Lazy-loading chunks           │
│ ✓ WebWorker for calculations    │
│ ✓ gzip compression              │
└─────────────────────────────────┘
```

### 9.2 Backend API Performance

| Endpoint | Max Latency | Load Test |
|----------|------------|-----------|
| `/hex/query` | 50ms | 1k req/s |
| `/agent/deploy` | 200ms (Txn submit) | 100 req/s |
| `/rewards/claim` | 200ms (TxN submit) | 100 req/s |
| `/admin/metrics` | 100ms | 500 req/s |

**Load Test Results (Target):**
```
wrk -t4 -c200 -d30s http://localhost:3000/api/hex/query
Transfer:      12.45 MB in 30.00s
Requests/sec:  2500
Latency:       50ms (mean), 150ms (p99)
Non-2xx:       0 (0.00%)
```

### 9.3 Database Performance

```sql
-- Query optimization
EXPLAIN ANALYZE SELECT * FROM agents 
  WHERE owner_pubkey = $1 AND status = 'active';
  
-- Index statistics
INDEX idx_owner: ~287k rows
INDEX idx_status: ~118k rows
Selectivity: Good

-- Expected query time: <5ms
```

### 9.4 Blockchain Transaction Performance

| Operation | Instruction Count | Compute Units | Cost (SOL) |
|-----------|------------------|---------------|-----------|
| Claim Hex | 5 | 15,000 | 0.0001 |
| Deploy Agent | 8 | 22,500 | 0.00015 |
| Claim Rewards | 6 | 18,000 | 0.00012 |

**Confirmation Strategy:**
```
Target: 2-5 second settlement

Strategy:
1. Submit to RPC endpoint (Helius/Triton)
2. Monitor with getSignatureStatuses
3. Retry with exponential backoff on failure
4. Fallback to alternative RPC if needed
5. Notify user of 2+ confirmations
```

### 9.5 Horizontal Scalability

```yaml
Deployment Architecture:

Load Balancer (Nginx)
  └─ API Server Pool (auto-scaling)
      ├─ Instance-1 (Node.js)
      ├─ Instance-2 (Node.js)
      ├─ Instance-N (Node.js)
      └─ Health checks every 10s

Database (PostgreSQL)
  ├─ Primary (read/write)
  └─ Replica (read-only)

Cache Layer (Redis)
  ├─ Primary (write)
  └─ Replica (read)

Kubernetes Deployment:
  ├─ HPA: CPU trigger at 70%, Memory at 80%
  ├─ Min replicas: 3
  ├─ Max replicas: 30
  └─ Scale-down grace period: 300s
```

---

## 10. Gaps & Potential Issues

### 10.1 Critical Gaps

| Gap | Impact | Mitigation | Timeline |
|-----|--------|-----------|----------|
| **No smart contract audit** | HIGH | Engage external auditor (Soteria) | Pre-launch |
| **Hex grid procedural generation not finalized** | HIGH | Design deterministic seed algorithm | Week 1 |
| **Mining simulation formula needs balancing** | MEDIUM | A/B test with closed alpha | Week 2 |
| **Mobile client not planned** | MEDIUM | Scope for Phase 2 | Q2 2026 |
| **PumpFun integration details undefined** | MEDIUM | Coordinate with PumpFun team | Week 3 |
| **No uptime SLA defined** | MEDIUM | Define 99.9% target + compensation | Week 1 |

### 10.2 Technical Issues & Risks

#### A. Solana Network Congestion
**Risk**: Transaction failures during network peaks
```
Mitigation:
├─ Implement exponential retry with jitter
├─ Use priority fees during congestion
├─ Batch operations when possible
├─ Monitor network via Helius dashboard
├─ Fallback to alternative RPC endpoints
└─ Document expected delays to users
```

#### B. Hex Grid Coordinate Collisions
**Risk**: Duplicate hex IDs due to poor hashing
```
Mitigation:
├─ Use SHA-256(q || r) for deterministic IDs
├─ Unit test all coordinate edge cases
├─ Validate constraints: -500k ≤ q,r ≤ 500k
└─ Monitor for collisions in production
```

#### C. Resource Distribution Unfairness
**Risk**: Some users get much better resource allocation
```
Mitigation:
├─ Use seeded Perlin noise for fairness
├─ Analyze distribution histogram
├─ Adjust seed if Gini coefficient > 0.4
└─ Communicate distribution to users
```

#### D. Mining Simulation Exploitation
**Risk**: Players exploit formula to unfairly maximize earnings
```
Mitigation:
├─ Regular economic audits (weekly)
├─ Adjust formulas based on data
├─ Monitor ROI distribution
├─ Implement soft caps if needed
└─ Transparent updates to community
```

#### E. Fee Distribution Complexity
**Risk**: Calculating fair fee shares becomes complex with many agents
```
Mitigation:
├─ Pre-calculate fee shares off-chain
├─ Batch distribute hourly (not per-transaction)
├─ Maintain clear audit trail
├─ Test with 100k+ agents before launch
└─ Implement efficient merkle proofs
```

#### F. Database Scalability
**Risk**: PostgreSQL struggles with million-row hex table
```
Mitigation:
├─ Partition hex_tiles table by geographic region
├─ Archive old mining_cycles (>90 days)
├─ Use sharding if single instance fails
├─ Pre-optimize queries with EXPLAIN
└─ Implement caching layer (Redis)
```

#### G. Phantom Wallet Session Expiration
**Risk**: Users lose session unexpectedly
```
Mitigation:
├─ Implement silent re-authentication
├─ Show clear warnings before expiry
├─ Store session state in localStorage (encrypted)
├─ Allow up to 3 wallet reconnects per session
└─ Clear persistent data only on explicit logout
```

### 10.3 Product Issues

#### A. User Onboarding Complexity
**Issue**: New users may not understand hex grids + blockchain mechanics
```
Solutions:
├─ Interactive tutorial (5-10 minutes)
├─ Detailed tooltips on all UI elements
├─ FAQ section with common questions
├─ Video walkthroughs for key flows
└─ 24/7 Discord support channel
```

#### B. Hex Price Discovery
**Issue**: No clear mechanism for hex trading prices
```
Solutions:
├─ Integrate AMM for automated pricing
├─ Create community price oracle
├─ Support peer-to-peer trading with escrow
├─ Display "suggested floor" based on resources
└─ Volume-weighted moving average charts
```

#### C. Agent Lifecycle Ambiguity
**Issue**: Users unclear about agent degradation/maintenance
```
Solutions:
├─ Clear timeline: Agent lifespan = 365 days
├─ Automatic maintenance every 30 days
├─ Upgrading extends lifespan by 90 days
├─ Clear UI showing "Days until maintenance"
└─ Email notifications 7 days before expiry
```

#### D. Fee Distribution Transparency
**Issue**: Users don't understand how fees are calculated
```
Solutions:
├─ Real-time fee dashboard showing:
│  ├─ Your agents count
│  ├─ Your fee-share %
│  ├─ Estimated daily earnings
│  └─ Next distribution time
├─ Detailed breakdown in every transaction
└─ Community-auditable smart contracts
```

### 10.4 Regulatory Concerns

| Concern | Jurisdiction | Status | Action |
|---------|--------------|--------|--------|
| **Securities classification** | US, EU, APAC | ⚠️ Uncertain | Consult legal team |
| **KYC/AML requirements** | US, EU | ⚠️ Required if MSB | Implement Chainalysis |
| **Gaming license** | Various | ⚠️ Varies | Geo-block high-risk regions |
| **Tax reporting** | US (1099-NEC) | ⚠️ Required | Provide CSV export |

---

## 11. Recommendations & Roadmap

### 11.1 Pre-Launch Checklist

**Week 1-2: Core Development**
- [ ] Finalize hex grid procedural generation algorithm
- [ ] Implement all 3 smart contract programs
- [ ] Complete backend API (all endpoints)
- [ ] Build admin dashboard (MVP)
- [ ] Create Babylon.js 3D scene with LOD system

**Week 2-3: Security & Testing**
- [ ] External smart contract audit
- [ ] Full integration tests (devnet)
- [ ] Load testing (1k concurrent users)
- [ ] Security penetration test
- [ ] Incident response plan finalization

**Week 3-4: Community & Launch Prep**
- [ ] Deploy to testnet for closed alpha
- [ ] Gather feedback from 100 alpha users
- [ ] Adjust based on feedback (mining balance, UI)
- [ ] Prepare marketing & communication
- [ ] Set up customer support infrastructure

**Week 4: Mainnet Deployment**
- [ ] Final code freeze
- [ ] Mainnet contract deployment with conservative constraints:
  - [ ] Max 10k agents in first week
  - [ ] Max 100k hexes claimable initially
  - [ ] Min agent cost: 0.5 SOL (increase after stabilization)
- [ ] Gradual rollout (10% of users per day)
- [ ] Monitor metrics closely
- [ ] Prepare rollback procedures

### 11.2 Phase 2 Roadmap (Q2 2026)

**Hex Trading & Secondary Market**
- [ ] Implement NFT marketplace integration
- [ ] Enable hex-to-hex trades
- [ ] Add resource swaps between users
- [ ] Implement escrow system for safety

**Advanced Agent Features**
- [ ] Agent leveling system (EXP → upgrades)
- [ ] Agent breeding (create new agents from 2 parents)
- [ ] Agent trading marketplace
- [ ] Special agent types (Prospector, Excavator, Refiner)

**Mobile Client**
- [ ] React Native iOS app
- [ ] React Native Android app
- [ ] Phantom Wallet integration
- [ ] Optimized for 5G/4G latency

**Advanced Mining Mechanics**
- [ ] Cooperative mining (guilds)
- [ ] Territory control gameplay
- [ ] Resource auctions
- [ ] Dynamic difficulty adjustment

### 11.3 Optimization Recommendations

**Backend Optimization:**
```
1. Query Optimization
   └─ Add missing indexes
   └─ Optimize N+1 queries
   └─ Implement cursor-based pagination
   
2. Caching Strategy
   └─ Redis: User sessions (1 hour TTL)
   └─ Redis: Admin metrics (5 minute TTL)
   └─ Redis: Hex data (cache warmed on boot)
   └─ CDN: Static assets (24 hour TTL)

3. Database Sharding
   └─ Shard hex_tiles by (q // 1000, r // 1000)
   └─ Separate read replicas per region
   └─ Archive old mining_cycles monthly

4. Batch Operations
   └─ Batch hex claiming (10 at a time)
   └─ Batch reward claims (consolidate)
   └─ Batch fee distributions (hourly)
```

**Frontend Optimization:**
```
1. Code Splitting
   └─ Separate 3D viewer code
   └─ Lazy-load admin dashboard
   └─ Split vendor code

2. Asset Compression
   └─ gzip for all text
   └─ brotli for json/xml
   └─ WebP for textures

3. Network Optimization
   └─ Hex data streaming (in viewport)
   └─ Incremental updates via WebSocket
   └─ Deduplicated event broadcasting
   └─ Gzip compression on all responses
```

---

## 12. Risk Assessment & Mitigation

### 12.1 Risk Matrix

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|-----------|
| **Smart contract exploit** | Critical | Low | External audit + bug bounty |
| **Solana network failure** | High | Low | Monitor ecosystem + communications |
| **User funds stolen (wallet compromise)** | High | Medium | User education + hardware wallet promotion |
| **Economic imbalance (hyperinflation)** | High | Medium | Weekly audits + adjustment parameters |
| **Database corruption** | High | Low | Automated backups + test recoveries |
| **DDoS attack on API** | Medium | Medium | WAF + rate limiting + DDoS mitigation |
| **Regulatory action** | Medium | Medium | Legal consultation + geo-blocking |
| **Poor user adoption** | Medium | High | Marketing strategy + referral incentives |
| **Team turnover** | Medium | Low | Cross-training + documentation |

### 12.2 Contingency Plans

**If Smart Contract Exploit Discovered:**
```
1. Immediate (0-30 min)
   ├─ Pause affected program
   ├─ Alert security team
   ├─ Notify all users
   └─ Prepare communication

2. Short-term (30 min - 24 hours)
   ├─ Audit smart contract fully
   ├─ Identify affected accounts
   ├─ Calculate compensation needed
   └─ Deploy patch & test

3. Long-term (24 hours+)
   ├─ Reimburse affected users
   ├─ Deploy fixed contract
   ├─ Resume operations gradually
   ├─ Post-mortem analysis
   └─ Improve testing infrastructure
```

**If Economic Imbalance Detected:**
```
1. Detection
   ├─ Weekly Gini coefficient > 0.45
   ├─ Agent ROI > 500% monthly
   ├─ Resource depletion < 10%

2. Response
   ├─ Adjust mining formulas
   ├─ Increase agent cost to 0.15 SOL
   ├─ Reduce resource yields by 20%
   ├─ Announce transparently to community
   └─ Vote on major changes with DAO

3. Validation
   ├─ A/B test new formulas
   ├─ Monitor economic indicators
   ├─ Gather user feedback
   └─ Iterate until balanced
```

---

## Conclusion

This specification defines a comprehensive Web3 gaming platform leveraging Solana's high throughput and low transaction costs. The architecture separates blockchain operations (agent deployment, the fee vault, and Merkle-proof earnings claims — all in the single `landmind` program) from off-chain simulation (mining mechanics, hex assignment, 3D rendering), enabling scalability while maintaining trustlessness. Hexes are system-owned rather than tokenized.

Key strengths:
- ✅ Solana's sub-cent transaction costs enable mass participation
- ✅ Modular smart contract design for future upgrades
- ✅ Event-driven architecture for real-time gameplay
- ✅ Comprehensive admin tools for ongoing management

Key risks to monitor:
- ⚠️ Smart contract security (prioritized with external audit)
- ⚠️ Economic balance (weekly audits + adjustment parameters)
- ⚠️ User adoption (depends on marketing & community building)

**Next steps:**
1. Finalize hex grid generation algorithm
2. Engage smart contract auditor
3. Deploy to Solana devnet for internal testing
4. Begin alpha testing with 100 users on testnet
5. Gather feedback and iterate
6. Mainnet deployment with conservative constraints

**Document Version:** 1.0  
**Last Updated:** January 19, 2026  
**Next Review:** Before public testnet deployment
