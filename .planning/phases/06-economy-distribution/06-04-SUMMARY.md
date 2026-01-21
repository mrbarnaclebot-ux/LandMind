---
phase: 06-economy-distribution
plan: 04
subsystem: economy
tags: [merkle, proofs, fees, monitoring, vault]
dependency-graph:
  requires: ["06-01", "06-02"]
  provides: ["merkle-proofs", "fee-monitoring", "vault-init"]
  affects: ["06-05"]
tech-stack:
  added: []
  patterns: ["merkle-tree", "keccak-hashing", "interval-polling"]
key-files:
  created:
    - packages/server/src/services/merkleService.ts
    - packages/server/src/services/feeMonitor.ts
    - packages/server/scripts/initVault.ts
  modified:
    - packages/server/package.json
decisions:
  - key: merkle-keccak
    choice: "@noble/hashes keccak256"
    why: "Matches Solana keccak (solana_program::keccak), already available as transitive dependency"
  - key: sorted-hashing
    choice: "OpenZeppelin-style sorted pair hashing"
    why: "Deterministic trees regardless of input order, matches contract pattern"
  - key: fee-monitor-interval
    choice: "60-second polling"
    why: "Balance between responsiveness and RPC rate limits"
metrics:
  duration: "4 min"
  completed: "2026-01-21"
---

# Phase 6 Plan 4: Merkle Proofs and Fee Monitoring Summary

**One-liner:** Merkle tree service for claim proofs with keccak256 hashing, fee deposit monitoring for treasury and PumpFun wallet, and vault initialization script.

## What Was Built

### 1. Merkle Tree Service (`merkleService.ts`)

Core functions for generating and verifying Merkle proofs:

- **`hashLeaf(wallet, amount)`**: Creates leaf hash matching contract format (pubkey + padded amount)
- **`generateMerkleTree(shares)`**: Builds sorted tree with proof map for all wallets
- **`generateProof(wallet, amount, tree)`**: Retrieves proof for specific wallet
- **`verifyProof(proof, root, leaf)`**: Local verification matching on-chain algorithm

Key implementation details:
- Uses `@noble/hashes` keccak_256 (same as Solana's keccak)
- Sorted leaf ordering for deterministic roots
- OpenZeppelin-style sorted pair hashing for proof verification
- Handles odd leaf counts by duplicating last leaf

### 2. Fee Monitoring Service (`feeMonitor.ts`)

Tracks incoming fee deposits from two sources:

- **Treasury PDA**: Agent deployment fees (0.1 SOL each)
- **PumpFun wallet**: Trading fees (optional, from PUMPFUN_FEE_WALLET env)

Features:
- 60-second polling interval
- Deduplication via database signature lookup
- Distinguishes deposits from withdrawals (balance change direction)
- Graceful handling when PUMPFUN_FEE_WALLET not configured
- Query functions: `getTotalFeePool()`, `getFeePoolSummary()`

### 3. Vault Initialization Script (`initVault.ts`)

One-time setup for FeeVaultState account:

- Derives vault_state PDA (seeds = ["vault_state"])
- Checks if already initialized (skips if so)
- Displays current state if vault exists
- Supports both base58 and JSON array key formats
- Added `npm run init-vault` script

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `ee413a6` | Merkle tree service for claim proofs |
| 2 | `038abcf` | Fee monitoring service |
| 3 | `95b46b1` | Vault initialization script |

## Decisions Made

1. **Keccak256 via @noble/hashes**: Uses the same hashing as Solana's keccak module, ensuring proof compatibility with smart contract
2. **Sorted Merkle tree**: Leaves sorted by hash bytes, enabling deterministic root regardless of input order
3. **60-second monitoring interval**: Balances real-time updates with RPC rate limits
4. **Optional PumpFun wallet**: Service runs without PUMPFUN_FEE_WALLET, only monitors treasury

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] `npm run build` succeeds
- [x] Merkle proofs verify correctly for test wallets
- [x] generateProof returns valid proof for known wallet
- [x] verifyProof confirms proof validity
- [x] feeMonitor exports all required functions
- [x] initVault script runs (fails on devnet due to undeployed program - expected)

## Next Phase Readiness

Ready for 06-05 (Claim API):
- Merkle proofs can be generated server-side for claim transactions
- Fee deposits are tracked and queryable
- Vault initialization script ready for when program is deployed

**Blockers:** None
**Dependencies satisfied:** Schema (06-01), Smart contract (06-02)
