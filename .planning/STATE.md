# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** Users earn passive income from PumpFun trading fees proportional to how much their agents have mined
**Current focus:** Phase 6 IN PROGRESS - Economy/Distribution layer, smart contract and schema complete

## Current Position

Phase: 6 of 7 (Economy Distribution)
Plan: 5 of ? in current phase (06-01 through 06-05 complete)
Status: In progress
Last activity: 2026-01-21 - Completed 06-05-PLAN.md (Claim API)

Progress: [██████████████░] ~89% (32/~36 plans estimated)

## Performance Metrics

**Velocity:**
- Total plans completed: 32
- Average duration: ~8 min
- Total execution time: ~249 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4 | 45 min | 11 min |
| 02-3d-world-core | 5 | 90 min | 18 min |
| 03-real-time-simulation | 4 | 23.5 min | 6 min |
| 04-wallet-integration | 5 | ~31 min | 6 min |
| 05-agent-deployment | 8 | 24 min | 3 min |
| 06-economy-distribution | 5 | 22 min | 4 min |

**Recent Trend:**
- Phase 6 progressing - Claim API (06-05) complete in 3 min
- Earnings routes: GET /api/earnings, POST /claim, POST /confirm
- Leaderboard route: GET /api/leaderboard with optional auth
- Socket events for real-time claim feedback
- Next: Phase 6 completion or Phase 7 planning

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- System-owned hexes (no land NFTs) - simplifies contracts, focuses value on agents
- Virtual resources (not tokens) - resources are fee-weighting mechanism only
- Linear mining growth - predictable, easy to understand economics
- Automatic free relocation - reduces friction, agents mine forever once deployed
- 50/50 fee split - balance between platform sustainability and user rewards
- Monorepo with npm workspaces (packages/*) - supports client, server, contracts packages
- **Three.js instead of Babylon.js** - switched during Phase 2 for better visual results
- react-three-fiber for scene composition - declarative JSX for Three.js
- PostgreSQL on port 5433 (not 5432) - avoids conflict with existing host PostgreSQL
- Anchor 0.30.1 via cargo install - avm had auth issues, direct cargo install works
- Build with --no-idl flag - anchor-syn compatibility issue with newer proc-macro2
- Load .env from project root using explicit path - workspace compatibility for server package
- Express 5 with async handlers - latest stable with built-in async error handling
- Separate Redis clients for pub/sub - subscriber mode blocks regular commands
- Flat-top hex orientation with corners at 0, 60, 120, 180, 240, 300 degrees
- Axial coordinates (q,r) based on Red Blob Games reference
- simplex-noise + alea for deterministic terrain generation
- 6 biomes with Minecraft-style vibrant colors
- OrbitControls for camera navigation (pan, zoom, rotate)
- InstancedMesh for efficient hex rendering (one per biome)
- **Socket.io with typed events** - full TypeScript safety for real-time communication
- **Redis adapter for Socket.io** - enables multi-instance scaling without sticky sessions
- **User rooms via user:{walletPubkey}** - isolated updates per wallet
- **Mining rates by resource type** - GOLD:10, SILVER:20, COPPER:35, IRON:50 per tick
- **BigInt as string** - for Redis/JSON serialization compatibility
- **Active agent index Set** - efficient getAllAgents without key scanning
- **5-second tick interval** - balances real-time feel with server load
- **30-second flush interval** - 6 ticks between DB writes reduces I/O
- **Recursive setTimeout** - prevents timing drift vs setInterval
- **Dev routes guarded by NODE_ENV** - returns 404 in production
- **Explicit .env path in seed scripts** - workspace compatibility
- **tweetnacl for Ed25519 verification** - battle-tested, used by Solana internally
- **jose for JWT** - modern ESM-native, Edge-compatible
- **httpOnly cookies for session** - XSS protection
- **SIWS message format** - standardized signing for wallet auth
- **5-minute nonce TTL** - reasonable auth window, prevents stale nonces
- **24-hour JWT expiry** - balance between security and convenience
- **Zustand persist: metadata only** - session state persisted, JWT in httpOnly cookie
- **30-second clock skew buffer** - session expiry check accounts for clock differences
- **bs58 signature encoding** - standard Solana encoding for wallet signatures
- **Empty wallets array with Wallet Standard** - auto-detects modern wallets (Phantom, Solflare)
- **Devnet default with VITE_SOLANA_RPC_URL** - configurable RPC for production
- **autoConnect enabled** - better UX for returning users
- **Minecraft pixel UI theme** - Press Start 2P font, 3D blocky buttons, inventory-slot styling
- **30-second balance refresh** - real-time balance updates without excessive RPC calls
- **Helius RPC for DAS API** - required for getAssetsByOwner to fetch cNFTs
- **Merkle tree: maxDepth 14, canopyDepth 8** - 16K agents max, reduced proof size
- **useUmi hook returns null when disconnected** - components handle gracefully
- **Agent index from treasury balance** - derive from lamports/DEPLOY_COST, no counter account needed
- **Treasury as SystemAccount PDA** - seeds=[b"treasury"], receives SOL directly
- **DeployStatus enum** - tracks deployment flow: idle, requesting, signing, sending, confirming, success, error
- **Soft cap 10 / hard cap 20** - visual warning at 10 agents, button disabled at 20
- **Two-phase deployment flow** - client signs SOL transfer, server confirms and mints cNFT
- **Asset ID derivation via findLeafAssetIdPda** - merkle tree + leaf index for cNFT asset ID
- **requireAuth middleware** - extracts userId from JWT for protected routes
- **Agent placement on random hex** - assigns agents to hexes with resources and room
- **agent:placed socket event** - real-time notification when agent assigned to hex
- **AgentDashboard side panel** - slides from left, mirrors WalletDrawer pattern
- **InstancedMesh for agent rendering** - GPU-efficient rendering for multiple agents
- **Typed socket events on client** - duplicated server types for type safety
- **Mining animation** - bobbing (0.04 amplitude) + rotation (0.1 amplitude) for mining agents
- **Full HEX_TILE_HEIGHT for agent Y** - hex geometry places top face at y=height, not y=height/2
- **CSS pulse animation for live indicators** - pulsing green dot shows real-time activity
- **BigInt for lamport amounts in economy tables** - consistent with mining state pattern
- **FeeSource enum (DEPLOYMENT, PUMPFUN)** - categorize fee deposits by source
- **EarningsSnapshot as cumulative tracker** - one per user, updated as mining progresses
- **prisma db push for schema drift** - database had existing tables without migration tracking
- **FeeVaultState PDA** - seeds=[b"vault_state"], stores merkle_root and paused flag
- **Merkle proof verification pattern** - hash(pubkey, padded_amount) as leaf, keccak-based tree
- **MIN_CLAIM of 0.025 SOL** - prevents dust claims and reduces transaction overhead
- **Authority via has_one constraint** - vault creator is permanent admin
- **Resource weights scaled by 1000** - Gold 4000n, Silver 2000n, Copper 1500n, Iron 1000n for BigInt precision
- **Redis ZSET for leaderboard** - O(log N) rank operations with ZADD, ZREVRANGE, ZREVRANK
- **Earnings snapshot in flush cycle** - automatically updated every 30 seconds with mining state
- **@noble/hashes keccak256 for Merkle** - matches Solana keccak (solana_program::keccak)
- **OpenZeppelin sorted hashing** - deterministic Merkle trees regardless of input order
- **60-second fee monitoring** - balances responsiveness with RPC rate limits
- **Optional PUMPFUN_FEE_WALLET** - fee monitor works without PumpFun wallet configured
- **optionalAuth middleware** - sets user context if token valid, otherwise null (for public routes)
- **Claim instruction data format** - discriminator (8) + amount (u64 LE) + proof (vec of [u8; 32])

### Pending Todos

None yet.

### Blockers/Concerns

- Anchor IDL generation requires workaround (--no-idl flag + manual IDL)
- Solana platform-tools cargo version (1.84.0) limits some dependency versions
- Merkle tree must be created before minting (one-time setup with SERVER_WALLET_SECRET)

## Session Continuity

Last session: 2026-01-21
Stopped at: Completed 06-05-PLAN.md (Claim API)
Resume file: None
Next: Phase 6 completion or Phase 7 planning
