---
created: 2026-01-21T07:15
title: Deploy smart contract to devnet
area: contracts
files:
  - packages/contracts/Anchor.toml
  - packages/contracts/target/deploy/landmind.so
  - packages/server/scripts/initVault.ts
---

## Problem

The LandMind smart contract (`D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ`) is built but not deployed to devnet. This blocks:

1. Vault initialization (`npm run init-vault` fails with "program does not exist")
2. Claim functionality testing (earnings dashboard claim flow)
3. Full E2E verification of Phase 6 economic features

The program is compiled at `packages/contracts/target/deploy/landmind.so` but the Anchor.toml has provider cluster set to `Localnet`.

## Solution

1. Change Anchor.toml provider cluster to `devnet` (or use CLI flag)
2. Run: `cd packages/contracts && anchor deploy --provider.cluster devnet`
3. Run: `cd packages/server && npm run init-vault`
4. Verify vault state account created on devnet
