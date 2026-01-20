# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** Users earn passive income from PumpFun trading fees proportional to how much their agents have mined
**Current focus:** Phase 2 - 3D World Core (In Progress)

## Current Position

Phase: 2 of 7 (3D World Core)
Plan: 1 of 5 in current phase
Status: In progress
Last activity: 2026-01-20 — Completed 02-01-PLAN.md (Hex Math & Mesh Foundation)

Progress: [█████░░░░░] ~17% (5/~30 plans estimated)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 10 min
- Total execution time: 50 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4 | 45 min | 11 min |
| 02-3d-world-core | 1 | 5 min | 5 min |

**Recent Trend:**
- Last 5 plans: 02-01 (5 min), 01-02 (8 min), 01-04 (25 min), 01-03 (4 min), 01-01 (8 min)
- Trend: Fast execution for focused utility plans

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
- react-babylonjs for scene composition — declarative JSX over imperative Babylon.js API
- PostgreSQL on port 5433 (not 5432) — avoids conflict with existing host PostgreSQL
- Anchor 0.30.1 via cargo install — avm had auth issues, direct cargo install works
- Build with --no-idl flag — anchor-syn compatibility issue with newer proc-macro2
- Load .env from project root using explicit path — workspace compatibility for server package
- Express 5 with async handlers — latest stable with built-in async error handling
- Separate Redis clients for pub/sub — subscriber mode blocks regular commands
- Flat-top hex orientation with corners at 0, 60, 120, 180, 240, 300 degrees
- Axial coordinates (q,r) based on Red Blob Games reference

### Pending Todos

None yet.

### Blockers/Concerns

- Anchor IDL generation requires workaround (--no-idl flag + manual IDL)
- Solana platform-tools cargo version (1.84.0) limits some dependency versions

## Session Continuity

Last session: 2026-01-20
Stopped at: Completed 02-01-PLAN.md (Hex Math & Mesh Foundation)
Resume file: None
Next: 02-02-PLAN.md (Terrain Generation)
