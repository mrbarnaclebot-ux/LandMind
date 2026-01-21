---
phase: 05-agent-deployment
plan: 01
subsystem: contracts
tags: [anchor, solana, smart-contract, pda, cpi]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Anchor project scaffold with program ID
provides:
  - deploy_agent instruction accepting 0.1 SOL payment
  - Treasury PDA for collecting deployment fees
  - AgentDeployedEvent for backend processing
  - TypeScript types and IDL for client integration
affects: [05-02, 05-03, 06-fee-distribution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Anchor CPI for SOL transfer using system_program::transfer
    - PDA seeds for treasury account derivation
    - Event emission for off-chain processing

key-files:
  created:
    - packages/contracts/programs/landmind/src/state.rs
    - packages/contracts/programs/landmind/src/errors.rs
  modified:
    - packages/contracts/programs/landmind/src/lib.rs
    - packages/contracts/target/idl/landmind.json
    - packages/contracts/target/types/landmind.ts

key-decisions:
  - "Agent index derived from treasury balance (lamports / DEPLOY_COST)"
  - "Treasury as SystemAccount PDA (not Program-owned account)"
  - "Manual IDL generation due to anchor-syn compatibility issues"

patterns-established:
  - "CPI pattern: CpiContext::new with Transfer struct for SOL transfers"
  - "PDA pattern: seeds = [b'treasury'] for treasury derivation"
  - "Event pattern: emit! macro with struct fields for off-chain indexing"

# Metrics
duration: 6min
completed: 2026-01-21
---

# Phase 05 Plan 01: Agent Factory Contract Summary

**Anchor smart contract with deploy_agent instruction that transfers 0.1 SOL to treasury PDA and emits AgentDeployedEvent**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-21T00:36:00Z
- **Completed:** 2026-01-21T00:42:50Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created modular Anchor contract structure with state.rs and errors.rs
- Implemented deploy_agent instruction with SOL transfer via CPI
- Treasury PDA receives 0.1 SOL payment per deployment
- AgentDeployedEvent emitted with owner, timestamp, and agent_index
- Manual IDL and TypeScript types generated for client integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create contract module structure** - `98a3267` (feat)
2. **Task 2: Implement deploy_agent instruction** - `60220c2` (feat)
3. **Task 3: Build and generate TypeScript types** - No commit (build artifacts in .gitignored target/)

## Files Created/Modified

- `packages/contracts/programs/landmind/src/state.rs` - AgentDeployedEvent and Config structs
- `packages/contracts/programs/landmind/src/errors.rs` - LandMindError enum (InsufficientPayment, InvalidTreasury, Unauthorized)
- `packages/contracts/programs/landmind/src/lib.rs` - deploy_agent instruction with CPI transfer and event emission
- `packages/contracts/target/idl/landmind.json` - Manual IDL with deploy_agent accounts and types
- `packages/contracts/target/types/landmind.ts` - TypeScript types with constants

## Decisions Made

- **Agent index from treasury balance** - Rather than maintaining a separate counter account, derive agent_index from `treasury.lamports() / DEPLOY_COST`. Simple and gas-efficient.
- **Treasury as SystemAccount** - Using `SystemAccount<'info>` with PDA seeds rather than a custom account type. Receives SOL directly without needing initialization.
- **Manual IDL generation** - anchor-syn has proc-macro2 compatibility issues (known from Phase 1). Created IDL manually with correct discriminators and types.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **anchor build IDL fails** - Expected issue from Phase 1 decisions. Workaround: `anchor build --no-idl` + manual IDL creation.
- **target/ is gitignored** - Standard Anchor practice. Build artifacts (IDL, types) regenerated on build. No code changes committed for Task 3.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Contract compiled and ready for devnet deployment
- IDL and TypeScript types available in target/ for client integration
- Treasury PDA derivation ready for client-side account resolution
- deploy_agent instruction ready to be called from client after Umi setup

---
*Phase: 05-agent-deployment*
*Completed: 2026-01-21*
