# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** Users earn passive income from PumpFun trading fees proportional to how much their agents have mined
**Current focus:** Phase 3 Complete - Ready for Phase 4 (Deployment) or Phase 5 (Solana Contracts)

## Current Position

Phase: 3 of 7 (Real-Time Simulation) - COMPLETE
Plan: 4 of 4 in current phase - COMPLETE
Status: Phase complete
Last activity: 2026-01-20 - Completed 03-04-PLAN.md (Integration Testing)

Progress: [████████░░] ~38% (13/~34 plans estimated)

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: ~12.2 min
- Total execution time: ~158.5 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4 | 45 min | 11 min |
| 02-3d-world-core | 5 | 90 min | 18 min |
| 03-real-time-simulation | 4 | 23.5 min | 6 min |

**Recent Trend:**
- Phase 3 completed very efficiently (6 min average)
- Full simulation pipeline operational and verified
- Ready for deployment or Solana contract work

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

### Pending Todos

None yet.

### Blockers/Concerns

- Anchor IDL generation requires workaround (--no-idl flag + manual IDL)
- Solana platform-tools cargo version (1.84.0) limits some dependency versions

## Session Continuity

Last session: 2026-01-20
Stopped at: Completed 03-04-PLAN.md (Integration Testing) - Phase 3 COMPLETE
Resume file: None
Next: Phase 4 (Deployment) or Phase 5 (Solana Contracts) - user choice
