# LandMind Deployment Guide

This guide covers deploying the LandMind smart contract and setting up the required on-chain infrastructure.

## Prerequisites

- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) v1.18+
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) v0.30+
- [Rust](https://rustup.rs) toolchain
- Node.js 20+
- Devnet SOL for deployment (2+ SOL recommended)

## 1. Get Devnet SOL

The deployment requires approximately 2 SOL for:
- Program deployment (~1.5 SOL)
- Merkle tree creation (~0.3 SOL)
- Vault initialization (~0.003 SOL)

### Option A: Web Faucet (Recommended)
Visit [https://faucet.solana.com](https://faucet.solana.com) and request SOL for your wallet address.

### Option B: CLI Airdrop
```bash
# Set CLI to devnet
solana config set --url devnet

# Show your wallet address
solana address

# Request airdrop (may be rate-limited)
solana airdrop 2
```

### Option C: Solana Discord Faucet
Join the [Solana Discord](https://discord.gg/solana) and use the faucet bot in #devnet-faucet.

## 2. Deploy Smart Contract

### Build the Program

```bash
cd packages/contracts

# Build (uses --no-idl due to anchor-syn compatibility)
anchor build --no-idl

# The build generates:
# - target/deploy/landmind.so (program binary)
# - target/deploy/landmind-keypair.json (program keypair)
# - target/idl/landmind.json (IDL for client)
```

### Deploy to Devnet

```bash
# Ensure CLI is on devnet
solana config set --url devnet

# Deploy the program
anchor deploy --provider.cluster devnet

# Expected output:
# Deploying program "landmind"...
# Program Id: D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ
```

### Verify Deployment

```bash
# Check program exists on-chain
solana program show D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ
```

## 3. Create Merkle Tree (cNFT Storage)

The Merkle tree stores compressed NFTs (agents). This is a one-time setup.

### Configure Server Wallet

Add your deployment wallet's secret key to `.env`:

```bash
# Generate keypair if needed
solana-keygen new --outfile server-keypair.json

# Convert to base58 and add to .env
# The secret key is a 64-byte array - encode the full array
cat server-keypair.json  # Copy the array

# In .env, use base58 encoding of the secret key
SERVER_WALLET_SECRET="your-base58-encoded-secret-key"
```

### Run Creation Script

```bash
cd packages/server

# Create the Merkle tree
npx tsx scripts/createMerkleTree.ts
```

Expected output:
```
Using RPC: https://api.devnet.solana.com
Tree creator: <your-wallet>
Creating Merkle tree: <tree-address>
Configuration:
  maxDepth: 14 (16,384 max agents)
  maxBufferSize: 64 (concurrent minting support)
  canopyDepth: 8 (reduced proof size)

Tree created successfully!
Signature: <tx-signature>

=====================================
Add to .env:
MERKLE_TREE_ADDRESS=<tree-address>
=====================================
```

### Update Configuration

Add the tree address to your `.env`:

```env
MERKLE_TREE_ADDRESS="<tree-address-from-script>"
```

## 4. Initialize Fee Vault

The fee vault manages claim distributions. This is a one-time setup.

```bash
cd packages/server

# Initialize the vault
npx tsx scripts/initVault.ts
```

Expected output:
```
=== LandMind Vault Initialization ===

Authority: <your-wallet>
RPC URL: https://api.devnet.solana.com
Authority balance: X.XX SOL
Vault State PDA: <vault-pda>
Vault Bump: <bump>

Initializing vault...

Vault initialized successfully!
Signature: <tx-signature>

=====================================
Vault State PDA: <vault-pda>
Authority: <your-wallet>
=====================================
```

## 5. Verify Full Setup

### Check Program
```bash
solana program show D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ
```

### Check Merkle Tree
```bash
# The tree should exist and be owned by the Bubblegum program
solana account $MERKLE_TREE_ADDRESS
```

### Check Vault State
```bash
# Re-run init script - should show "Vault already initialized!"
cd packages/server
npx tsx scripts/initVault.ts
```

## 6. Update Client Configuration

Ensure the client `.env` has the correct values:

```env
VITE_API_URL="http://localhost:3001"
VITE_WS_URL="http://localhost:3001"
VITE_SOLANA_RPC_URL="https://api.devnet.solana.com"
VITE_HEX_GRID_RADIUS="20"
```

## Troubleshooting

### "Insufficient balance for transaction fees"
Request more devnet SOL using the web faucet or Discord bot.

### "anchor-syn" compatibility error
Use the `--no-idl` flag when building:
```bash
anchor build --no-idl
```

### "Program deployment failed"
1. Check you have enough SOL (2+ recommended)
2. Verify the program keypair exists: `ls target/deploy/landmind-keypair.json`
3. Try deploying with explicit provider: `anchor deploy --provider.cluster devnet`

### "Tree creation failed"
1. Ensure SERVER_WALLET_SECRET is correctly formatted (base58 or JSON array)
2. Verify wallet has at least 0.5 SOL
3. Check Helius RPC URL is valid (if using)

### "Vault initialization failed"
1. Check program is deployed first
2. Verify wallet has SOL for fees
3. If re-initializing, the script will detect existing vault

## Production Deployment (Mainnet)

For mainnet deployment:

1. **Audit First**: Have the contracts audited before mainnet
2. **Use Production RPC**: Configure a reliable mainnet RPC (Helius, QuickNode, etc.)
3. **Secure Keys**: Use hardware wallets or HSM for authority keys
4. **Monitor**: Set up transaction and account monitoring

```bash
# Switch to mainnet
solana config set --url mainnet-beta

# Deploy with production keypair
anchor deploy --provider.cluster mainnet
```

---

## Quick Reference

| Item | Address/Value |
|------|---------------|
| Program ID | `D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ` |
| Treasury PDA | Derived from `seeds=[b"treasury"]` |
| Vault State PDA | Derived from `seeds=[b"vault_state"]` |
| Deploy Cost | 0.1 SOL |
| Min Claim | 0.025 SOL |
| Max Agents | 16,384 (tree depth 14) |
