---
phase: 05-agent-deployment
plan: 02
subsystem: infra
tags: [metaplex, umi, bubblegum, cnft, compressed-nft, solana]

# Dependency graph
requires:
  - phase: 04-wallet-integration
    provides: wallet adapter and authentication foundation
provides:
  - Server Umi instance with keypair identity for minting
  - Client Umi hook with wallet adapter identity
  - Merkle tree creation script for cNFT storage
  - cNFT configuration constants (RPC_URL, MERKLE_TREE_ADDRESS, DEPLOY_COST)
affects: [05-agent-deployment, fee-economics]

# Tech tracking
tech-stack:
  added:
    - "@metaplex-foundation/umi@0.9.2"
    - "@metaplex-foundation/umi-bundle-defaults@1.4.1"
    - "@metaplex-foundation/mpl-bubblegum@5.0.2"
    - "@metaplex-foundation/digital-asset-standard-api@2.0.0"
    - "@metaplex-foundation/umi-signer-wallet-adapters@1.4.1"
  patterns:
    - "Umi singleton pattern for server (lazy initialization)"
    - "useUmi hook with wallet identity for client"

key-files:
  created:
    - packages/server/src/lib/umi.ts
    - packages/server/scripts/createMerkleTree.ts
    - packages/server/.env.example
    - packages/client/src/lib/umi.ts
    - packages/client/src/hooks/useUmi.ts
  modified:
    - packages/server/package.json
    - packages/client/package.json
    - package-lock.json

key-decisions:
  - "Helius RPC preferred for DAS API support (getAssetsByOwner)"
  - "Merkle tree: maxDepth 14 (16,384 agents), canopyDepth 8 (reduced proof size)"
  - "Client Umi returns null when wallet disconnected"
  - "Used --legacy-peer-deps for client to resolve Umi peer conflicts"

patterns-established:
  - "Server creates Umi via getServerUmi() singleton"
  - "Client uses useUmi() hook that integrates with wallet adapter"
  - "cNFT constants centralized in packages/client/src/lib/umi.ts"

# Metrics
duration: 3min
completed: 2026-01-21
---

# Phase 5 Plan 2: Umi Setup Summary

**Metaplex Umi SDK configured on server (keypair identity) and client (wallet adapter identity) with Merkle tree creation script ready for cNFT minting**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-21T00:38:23Z
- **Completed:** 2026-01-21T00:41:13Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Installed Metaplex Umi SDK with Bubblegum and DAS API on both server and client
- Created server Umi library with lazy-initialized singleton pattern
- Created one-time Merkle tree creation script with optimized parameters
- Created useUmi React hook that bridges wallet adapter to Umi identity
- Documented all cNFT-related env vars in .env.example

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Umi packages on server and client** - `8c9b393` (chore)
2. **Task 2: Create server Umi setup and Merkle tree script** - `0824976` (feat)
3. **Task 3: Create client Umi hook with wallet integration** - `f24e5c5` (feat)

## Files Created/Modified

- `packages/server/src/lib/umi.ts` - Server Umi with createServerUmi/getServerUmi exports
- `packages/server/scripts/createMerkleTree.ts` - One-time script to create Merkle tree
- `packages/server/.env.example` - Documents HELIUS_RPC_URL, SERVER_WALLET_SECRET, MERKLE_TREE_ADDRESS
- `packages/client/src/lib/umi.ts` - RPC_URL, MERKLE_TREE_ADDRESS, DEPLOY_COST constants
- `packages/client/src/hooks/useUmi.ts` - useUmi hook with walletAdapterIdentity
- `packages/server/package.json` - Added Umi dependencies
- `packages/client/package.json` - Added Umi dependencies + umi-signer-wallet-adapters
- `package-lock.json` - Updated lockfile

## Decisions Made

- **Helius RPC priority:** Prefer HELIUS_RPC_URL over standard RPC because DAS API (getAssetsByOwner) requires Helius or similar indexer
- **Merkle tree config:** maxDepth 14 (16,384 max agents), canopyDepth 8 (reduces proof size for cheaper transfers)
- **useUmi returns null:** When wallet not connected, hook returns null rather than a broken Umi instance
- **Legacy peer deps:** Used --legacy-peer-deps for client install to resolve Umi version conflicts in monorepo

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Client npm peer conflict:** Umi packages had peer dependency conflicts with existing hoisted packages in monorepo. Resolved by using `--legacy-peer-deps` flag. Server install succeeded without this flag.

## User Setup Required

**External services require manual configuration:**

Before running the Merkle tree creation script, configure:

1. **HELIUS_RPC_URL** - Get free API key at https://dev.helius.xyz/dashboard
2. **SERVER_WALLET_SECRET** - Generate and fund a devnet keypair:
   - `solana-keygen new --outfile keypair.json`
   - Fund with devnet SOL: `solana airdrop 2 $(solana-keygen pubkey keypair.json) --url devnet`
   - Encode: base58 encode the secret key array
3. Run: `cd packages/server && npx tsx scripts/createMerkleTree.ts`
4. Copy resulting MERKLE_TREE_ADDRESS to .env

## Next Phase Readiness

- Server can now create Umi instances for minting cNFTs
- Client can create Umi instances with connected wallet identity
- Ready for Plan 03: Agent minting endpoint and deployment flow
- Merkle tree must be created before minting (one-time setup)

---
*Phase: 05-agent-deployment*
*Completed: 2026-01-21*
