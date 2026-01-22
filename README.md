<div align="center">

# LandMind

### Autonomous Mining Agents on Solana

Deploy AI agents on a 3D hexagonal world. Watch them mine virtual resources. Earn passive income from platform fees.

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?style=for-the-badge&logo=solana&logoColor=white)](https://solana.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r182-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[Live Demo](#) · [Documentation](#architecture) · [Report Bug](https://github.com/mrbarnaclebot-ux/LandMind/issues)

</div>

---

## Overview

LandMind is a Web3 mining game built on Solana where users deploy autonomous agents that mine virtual resources on a procedurally-generated 3D hexagonal world. The resources mined determine each user's share of platform fees — **deploy once, earn forever**.

### How It Works

1. **Connect Wallet** — Link your Phantom or Solflare wallet
2. **Deploy Agent** — Pay 0.1 SOL to mint an agent as a compressed NFT (cNFT)
3. **Watch Mining** — Agents automatically mine gold, silver, copper, and iron
4. **Earn Fees** — Claim your share of platform fees based on total resources mined

### Key Features

- **3D Hex World** — Explore a massive procedurally-generated world with 6 distinct biomes
- **Real-Time Mining** — Watch agents mine resources with live updates via WebSocket
- **Compressed NFTs** — Agents are minted as Metaplex cNFTs for minimal on-chain cost
- **Merkle Claims** — Gas-efficient fee distribution using Merkle proof verification
- **Mobile Ready** — Fully responsive with touch controls and bottom sheet navigation
- **Admin Dashboard** — Real-time metrics, user management, and economy controls

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| [React 19](https://react.dev) | UI framework with latest features |
| [Three.js](https://threejs.org) + [React Three Fiber](https://r3f.docs.pmnd.rs) | 3D rendering with declarative JSX |
| [Zustand](https://zustand-demo.pmnd.rs) | Lightweight state management |
| [Vite](https://vitejs.dev) | Fast build tooling and HMR |
| [Socket.io Client](https://socket.io) | Real-time WebSocket communication |

### Backend
| Technology | Purpose |
|------------|---------|
| [Node.js 20+](https://nodejs.org) | Runtime environment |
| [Express 5](https://expressjs.com) | HTTP server with async support |
| [Prisma](https://prisma.io) | Type-safe database ORM |
| [PostgreSQL 16](https://postgresql.org) | Primary database |
| [Redis 7](https://redis.io) | Caching, pub/sub, leaderboards |
| [Socket.io](https://socket.io) | Real-time event broadcasting |

### Blockchain
| Technology | Purpose |
|------------|---------|
| [Solana](https://solana.com) | High-throughput blockchain |
| [Anchor](https://anchor-lang.com) | Solana program framework |
| [Metaplex Bubblegum](https://developers.metaplex.com/bubblegum) | Compressed NFT minting |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  3D Scene    │  │   Wallet     │  │    Dashboards        │  │
│  │  (Three.js)  │  │  (Adapter)   │  │  (Agent/Earnings)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP + WebSocket
┌────────────────────────────┴────────────────────────────────────┐
│                        SERVER (Express)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Auth (JWT)  │  │  Mining      │  │    Fee Monitor       │  │
│  │  + SIWS      │  │  Simulation  │  │    (PumpFun)         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │     Redis       │  │     Solana      │
│   (Prisma)      │  │  (Cache/PubSub) │  │   (Devnet)      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Smart Contract

The `landmind` program (Anchor/Rust) handles:

| Instruction | Description |
|-------------|-------------|
| `deploy_agent` | Transfer 0.1 SOL to treasury, emit event for cNFT minting |
| `initialize_vault` | One-time setup of fee vault state |
| `claim_earnings` | Verify Merkle proof and transfer earned fees |
| `update_merkle_root` | Admin updates claimable amounts root |
| `pause_vault` / `unpause_vault` | Emergency controls |

Program ID: `D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ`

---

## Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Docker](https://docker.com) (for PostgreSQL and Redis)
- [Rust](https://rustup.rs) + [Anchor CLI](https://anchor-lang.com/docs/installation) (for contracts)
- [Phantom](https://phantom.app) or [Solflare](https://solflare.com) wallet

### Quick Start

```bash
# Clone the repository
git clone https://github.com/mrbarnaclebot-ux/LandMind.git
cd LandMind

# Install dependencies
npm install

# Start PostgreSQL and Redis
docker-compose up -d

# Configure environment
cp .env.example .env
# Edit .env with your values (see Configuration section)

# Initialize database
cd packages/server
npm run db:push
npm run db:seed
cd ../..

# Start development servers (in separate terminals)
npm run server    # Backend on http://localhost:3001
npm run client    # Frontend on http://localhost:5173
```

### Configuration

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://landmind:landmind_dev@localhost:5433/landmind?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Server
PORT=3001
NODE_ENV=development
JWT_SECRET="your-secret-key-min-32-chars"
CORS_ORIGIN="http://localhost:5173"

# Solana
SOLANA_RPC_URL="https://api.devnet.solana.com"
HELIUS_RPC_URL="https://devnet.helius-rpc.com/?api-key=YOUR_KEY"
SERVER_WALLET_SECRET="[your,wallet,secret,array]"
MERKLE_TREE_ADDRESS="your-merkle-tree-address"

# Admin (optional)
ADMIN_WALLET_1="your-admin-wallet-pubkey"

# PumpFun Integration (optional)
PUMPFUN_FEE_WALLET="pumpfun-fee-wallet-address"
```

For the client, create `packages/client/.env`:

```env
VITE_API_URL="http://localhost:3001"
VITE_WS_URL="http://localhost:3001"
VITE_SOLANA_RPC_URL="https://api.devnet.solana.com"
VITE_HEX_GRID_RADIUS="20"
```

---

## Project Structure

```
LandMind/
├── packages/
│   ├── client/                 # React frontend
│   │   ├── src/
│   │   │   ├── admin/          # Admin dashboard components
│   │   │   ├── components/     # UI components
│   │   │   │   ├── agents/     # Agent deployment & dashboard
│   │   │   │   ├── earnings/   # Earnings & claims
│   │   │   │   ├── mobile/     # Mobile-specific components
│   │   │   │   ├── ui/         # Shared UI elements
│   │   │   │   └── wallet/     # Wallet connection
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── providers/      # Context providers
│   │   │   ├── rendering/      # 3D rendering (LOD, chunking)
│   │   │   ├── scene/          # Three.js scene components
│   │   │   ├── stores/         # Zustand state stores
│   │   │   └── styles/         # CSS styles
│   │   └── package.json
│   │
│   ├── server/                 # Express backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   └── seed.ts         # Database seeder
│   │   ├── src/
│   │   │   ├── middleware/     # Auth, admin guards
│   │   │   ├── routes/         # API endpoints
│   │   │   ├── services/       # Business logic
│   │   │   └── socket/         # WebSocket handlers
│   │   └── package.json
│   │
│   └── contracts/              # Solana programs
│       └── programs/
│           └── landmind/
│               └── src/
│                   ├── lib.rs      # Main program
│                   ├── state.rs    # Account structures
│                   └── errors.rs   # Custom errors
│
├── docker-compose.yml          # PostgreSQL + Redis
├── package.json                # Workspace root
└── README.md
```

---

## API Reference

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/nonce` | GET | Get signing nonce for wallet |
| `/auth/verify` | POST | Verify signature and get JWT |
| `/auth/session` | GET | Get current session info |
| `/auth/logout` | POST | Clear session |

### Agents

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/agents` | GET | Yes | List user's agents |
| `/agents/deploy` | POST | Yes | Deploy new agent |
| `/agents/:id` | GET | Yes | Get agent details |

### Earnings

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/earnings` | GET | Yes | Get user earnings summary |
| `/earnings/proof` | GET | Yes | Get Merkle proof for claim |
| `/earnings/leaderboard` | GET | No | Top miners leaderboard |

### Admin

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/admin/metrics` | GET | Admin | System metrics |
| `/admin/users` | GET | Admin | User management |
| `/admin/economy` | GET/PUT | Admin | Economy configuration |
| `/admin/pause` | POST | Admin | Emergency pause |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `mining:tick` | Server → Client | Mining progress update |
| `agent:placed` | Server → Client | Agent assigned to hex |
| `earnings:update` | Server → Client | Earnings snapshot changed |

---

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run specific package tests
npm test --workspace=@landmind/server
npm test --workspace=@landmind/client
```

### Building for Production

```bash
# Build all packages
npm run build --workspaces

# Build specific package
npm run build --workspace=@landmind/client
```

### Smart Contract Development

```bash
cd packages/contracts

# Build the program
anchor build --no-idl

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run tests
anchor test
```

---

## Economic Model

```
┌────────────────────┐
│  Agent Deployment  │──── 0.1 SOL ────▶ Treasury
│    (User pays)     │
└────────────────────┘

┌────────────────────┐
│   PumpFun Trading  │──── Fees ────▶ Treasury
│  (External source) │
└────────────────────┘

         Treasury
            │
    ┌───────┴───────┐
    │               │
   50%             50%
    │               │
    ▼               ▼
 Platform      Distribution
 Operations    ────────────▶ Users (weighted by mining)
```

### Mining Weights

| Resource | Base Rate | Weight |
|----------|-----------|--------|
| Gold     | 10/tick   | 4.0x   |
| Silver   | 20/tick   | 2.0x   |
| Copper   | 35/tick   | 1.5x   |
| Iron     | 50/tick   | 1.0x   |

**Weighted Score** = (Gold × 4000) + (Silver × 2000) + (Copper × 1500) + (Iron × 1000)

Your share = Your Weighted Score / Total Weighted Score × Available Fees

---

## Roadmap

- [x] **Phase 1** — Foundation (Monorepo, Docker, DB schema)
- [x] **Phase 2** — 3D World (Hex rendering, LOD, chunking)
- [x] **Phase 3** — Real-Time Simulation (Mining engine, WebSocket)
- [x] **Phase 4** — Wallet Integration (Auth, SIWS, session)
- [x] **Phase 5** — Agent Deployment (Smart contract, cNFT minting)
- [x] **Phase 6** — Economy & Distribution (Claims, Merkle proofs)
- [x] **Phase 7** — Scale & Launch (Mobile, admin, performance)
- [ ] **Phase 8** — Mainnet Launch (Audit, deployment, monitoring)

---

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Solana](https://solana.com) — High-performance blockchain
- [Metaplex](https://metaplex.com) — NFT infrastructure
- [Three.js](https://threejs.org) — 3D graphics library
- [Red Blob Games](https://www.redblobgames.com/grids/hexagons/) — Hexagonal grid reference
- [PumpFun](https://pump.fun) — Fee generation integration

---

<div align="center">

**Built with determination by the LandMind team**

[Website](#) · [Twitter](#) · [Discord](#)

</div>
