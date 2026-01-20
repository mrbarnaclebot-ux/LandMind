# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** Users earn passive income from PumpFun trading fees proportional to how much their agents have mined
**Current focus:** Phase 3 - Real-Time Simulation (next)

## Current Position

Phase: 2 of 7 (3D World Core) - COMPLETE
Plan: 5 of 5 in current phase
Status: Phase complete
Last activity: 2026-01-20 — Completed 02-05-PLAN.md (Visual Polish - switched to Three.js)

Progress: [██████░░░░] ~27% (9/~34 plans estimated)

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: ~15 min
- Total execution time: ~135 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4 | 45 min | 11 min |
| 02-3d-world-core | 5 | 90 min | 18 min |

**Recent Trend:**
- Phase 2 took longer due to visual iteration (Babylon.js → Three.js switch)
- Multiple checkpoint iterations for visual quality

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- System-owned hexes (no land NFTs) — simplifies contracts, focuses value on agents
- Virtual resources (not tokens) — resources are fee-weighting mechanism only
- Linear mining growth — predictable, easy to understand economics
- Automatic free relocation — reduces friction, agents mine forever once deployed
- 50/50 fee split — balance between platform sustainability and user rewards
- Monorepo with npm workspaces (packages/*) — supports client, server, contracts packages
- **Three.js instead of Babylon.js** — switched during Phase 2 for better visual results
- react-three-fiber for scene composition — declarative JSX for Three.js
- PostgreSQL on port 5433 (not 5432) — avoids conflict with existing host PostgreSQL
- Anchor 0.30.1 via cargo install — avm had auth issues, direct cargo install works
- Build with --no-idl flag — anchor-syn compatibility issue with newer proc-macro2
- Load .env from project root using explicit path — workspace compatibility for server package
- Express 5 with async handlers — latest stable with built-in async error handling
- Separate Redis clients for pub/sub — subscriber mode blocks regular commands
- Flat-top hex orientation with corners at 0, 60, 120, 180, 240, 300 degrees
- Axial coordinates (q,r) based on Red Blob Games reference
- simplex-noise + alea for deterministic terrain generation
- 6 biomes with Minecraft-style vibrant colors
- OrbitControls for camera navigation (pan, zoom, rotate)
- InstancedMesh for efficient hex rendering (one per biome)

### Pending Todos

None yet.

### Blockers/Concerns

- Anchor IDL generation requires workaround (--no-idl flag + manual IDL)
- Solana platform-tools cargo version (1.84.0) limits some dependency versions

## Session Continuity

Last session: 2026-01-20
Stopped at: Completed Phase 2 (3D World Core) - All 5 plans executed, phase verified
Resume file: None
Next: Phase 3 planning (Real-Time Simulation)
