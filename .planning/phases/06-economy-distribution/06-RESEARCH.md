# Phase 6: Economy & Distribution - Research

**Researched:** 2026-01-21
**Domain:** Solana Fee Vault, Merkle-based Claims, Real-time Leaderboards, Three.js Heat Maps
**Confidence:** MEDIUM-HIGH

## Summary

This phase implements the core economic layer: a fee vault that collects SOL from deployment fees and PumpFun trading revenue, distributes 50% to users weighted by their mining output, and provides real-time earnings visibility. The technical approach combines: (1) an Anchor program extension with a fee vault PDA, pause capability, and claim instruction using Merkle proof verification, (2) server-side tracking of PumpFun fee transfers to a designated wallet, (3) Redis sorted sets for real-time leaderboard ranking, and (4) per-instance color attributes for Three.js heat map visualization.

The project already has the treasury PDA receiving deployment fees, Socket.io with typed events, Redis caching infrastructure, and InstancedMesh for hex rendering. The main work involves: extending the Anchor program with claim functionality and pause controls, adding database tables for fee tracking and claims, implementing Merkle proof generation/verification for claim eligibility, creating the earnings dashboard UI, and adding a heat map overlay to the hex grid.

**Primary recommendation:** Use the existing treasury PDA as the fee vault, extend it with claim functionality using off-chain Merkle proofs for weighted share verification. Track PumpFun fees via wallet monitoring (Helius webhooks or polling). Use Redis ZSET for O(log n) leaderboard operations.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| anchor-lang | 0.30.1 | Anchor program framework | Already deployed, stable |
| @solana/web3.js | ^1.98 | Solana client interactions | Already in use |
| Socket.io | ^4.8 | Real-time events | Already configured with Redis adapter |
| Redis (ioredis) | ^5.x | Caching, pub/sub | Already in use for agent state |
| Prisma | ^6.x | Database ORM | Already in use |
| React Three Fiber | ^8.x | 3D rendering | Already in use |
| @react-three/drei | ^10.x | R3F utilities | Already installed |

### New Dependencies

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @coral-xyz/anchor (client) | 0.30.1 | Anchor IDL client | For claim transaction building |
| merkle-distributor pattern | - | Merkle proof verification | On-chain claim verification |
| solana_program::keccak | native | Keccak256 hashing | Merkle leaf/node hashing |
| @helius-labs/sdk | latest | Webhook subscription | PumpFun fee monitoring (optional) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Merkle proof claims | Store all shares on-chain | Merkle is O(1) storage vs O(n); much cheaper |
| Redis ZSET leaderboard | PostgreSQL queries | Redis is O(log n) rank vs O(n log n) sort |
| Helius webhooks | RPC polling | Webhooks are push vs pull; lower latency |
| Per-instance color shader | heatmap.js texture | Shader integrates with existing InstancedMesh |

**No new npm installations required for core functionality.** The existing stack covers all needs.

## Architecture Patterns

### Recommended Database Schema Extension

```prisma
// Add to schema.prisma

model FeeDeposit {
  id            String   @id @default(uuid())
  txSignature   String   @unique @map("tx_signature")
  amount        BigInt   // Lamports
  source        FeeSource
  depositedAt   DateTime @default(now()) @map("deposited_at")
  processed     Boolean  @default(false)

  @@map("fee_deposits")
}

model Claim {
  id            String   @id @default(uuid())
  user          User     @relation(fields: [userId], references: [id])
  userId        String   @map("user_id")
  amount        BigInt   // Lamports claimed
  txSignature   String   @unique @map("tx_signature")
  claimedAt     DateTime @default(now()) @map("claimed_at")

  @@map("claims")
}

model EarningsSnapshot {
  id            String   @id @default(uuid())
  user          User     @relation(fields: [userId], references: [id])
  userId        String   @map("user_id")
  weightedScore BigInt   @map("weighted_score")  // Cumulative weighted resources
  sharePercent  Float    @map("share_percent")   // Percentage of total pool
  snapshotAt    DateTime @default(now()) @map("snapshot_at")

  @@map("earnings_snapshots")
}

enum FeeSource {
  DEPLOYMENT
  PUMPFUN
}
```

### Pattern 1: Fee Vault with Claim Instruction (Anchor)

**What:** Extend treasury PDA to support claims with Merkle proof verification
**When to use:** When users claim their share of accumulated fees
**Why:** On-chain verification ensures only eligible users can claim their correct share

```rust
// packages/contracts/programs/landmind/src/lib.rs (extension)
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use solana_program::keccak;

/// Fee vault state account
#[account]
pub struct FeeVaultState {
    pub authority: Pubkey,          // Admin authority
    pub merkle_root: [u8; 32],      // Current Merkle root for claims
    pub total_distributed: u64,      // Total lamports distributed
    pub paused: bool,               // Emergency pause flag
    pub bump: u8,
}

impl FeeVaultState {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 1 + 1;
}

/// Claim accumulated earnings using Merkle proof
pub fn claim_earnings(
    ctx: Context<ClaimEarnings>,
    amount: u64,
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    let vault_state = &ctx.accounts.vault_state;

    // Check not paused
    require!(!vault_state.paused, ErrorCode::VaultPaused);

    // Check minimum claim amount (0.025 SOL = 25_000_000 lamports)
    require!(amount >= 25_000_000, ErrorCode::BelowMinimumClaim);

    // Verify Merkle proof
    let leaf = keccak::hashv(&[
        &ctx.accounts.claimer.key().to_bytes(),
        &amount.to_le_bytes(),
    ]);

    require!(
        verify_proof(&proof, vault_state.merkle_root, leaf.0),
        ErrorCode::InvalidProof
    );

    // Transfer from vault to claimer
    let vault_bump = vault_state.bump;
    let seeds = &[b"treasury".as_ref(), &[vault_bump]];
    let signer_seeds = &[&seeds[..]];

    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.claimer.to_account_info(),
        },
        signer_seeds,
    );
    transfer(cpi_context, amount)?;

    // Emit claim event
    emit!(ClaimEvent {
        claimer: ctx.accounts.claimer.key(),
        amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

/// Verify Merkle proof (OpenZeppelin pattern)
fn verify_proof(proof: &[[u8; 32]], root: [u8; 32], leaf: [u8; 32]) -> bool {
    let mut computed_hash = leaf;

    for proof_element in proof.iter() {
        if computed_hash <= *proof_element {
            computed_hash = keccak::hashv(&[&computed_hash, proof_element]).0;
        } else {
            computed_hash = keccak::hashv(&[proof_element, &computed_hash]).0;
        }
    }

    computed_hash == root
}

#[derive(Accounts)]
pub struct ClaimEarnings<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(
        seeds = [b"vault_state"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, FeeVaultState>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[event]
pub struct ClaimEvent {
    pub claimer: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Vault is paused")]
    VaultPaused,
    #[msg("Amount below minimum claim (0.025 SOL)")]
    BelowMinimumClaim,
    #[msg("Invalid Merkle proof")]
    InvalidProof,
}
```

### Pattern 2: Admin Pause/Unpause

**What:** Emergency pause capability for the fee vault
**When to use:** If exploit detected or maintenance needed
**Why:** Security measure, user decision from CONTEXT.md

```rust
/// Pause the vault (admin only)
pub fn pause_vault(ctx: Context<AdminAction>) -> Result<()> {
    ctx.accounts.vault_state.paused = true;
    emit!(VaultPausedEvent {
        authority: ctx.accounts.authority.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

/// Unpause the vault (admin only)
pub fn unpause_vault(ctx: Context<AdminAction>) -> Result<()> {
    ctx.accounts.vault_state.paused = false;
    emit!(VaultUnpausedEvent {
        authority: ctx.accounts.authority.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_state"],
        bump = vault_state.bump,
        has_one = authority,
    )]
    pub vault_state: Account<'info, FeeVaultState>,
}
```

### Pattern 3: Merkle Root Update (Server-Side)

**What:** Periodically recalculate weighted shares and update on-chain Merkle root
**When to use:** After each earning period or on-demand before claims
**Why:** Keeps claim eligibility in sync with mining progress

```typescript
// packages/server/src/services/merkleService.ts
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from '@ethersproject/keccak256';
import { Buffer } from 'buffer';

interface UserShare {
  wallet: string;
  claimableAmount: bigint;
}

/**
 * Generate Merkle tree from user shares
 */
export function generateMerkleTree(shares: UserShare[]): {
  root: string;
  tree: MerkleTree;
  leaves: Buffer[];
} {
  // Create leaves: keccak256(wallet + amount)
  const leaves = shares.map(share => {
    const walletBytes = Buffer.from(share.wallet, 'base58'); // or proper decoding
    const amountBytes = Buffer.alloc(8);
    amountBytes.writeBigUInt64LE(share.claimableAmount);

    return keccak256(Buffer.concat([walletBytes, amountBytes]));
  });

  const tree = new MerkleTree(leaves, keccak256, { sort: true });

  return {
    root: tree.getHexRoot(),
    tree,
    leaves: leaves.map(l => Buffer.from(l.slice(2), 'hex')),
  };
}

/**
 * Generate proof for a specific user's claim
 */
export function generateProof(
  tree: MerkleTree,
  wallet: string,
  amount: bigint
): string[] {
  const walletBytes = Buffer.from(wallet, 'base58');
  const amountBytes = Buffer.alloc(8);
  amountBytes.writeBigUInt64LE(amount);

  const leaf = keccak256(Buffer.concat([walletBytes, amountBytes]));
  return tree.getHexProof(leaf);
}
```

### Pattern 4: Redis Sorted Set Leaderboard

**What:** Real-time leaderboard using Redis ZSET
**When to use:** Ranking users by weighted resources
**Why:** O(log n) operations, automatic sorting, efficient rank queries

```typescript
// packages/server/src/services/leaderboardService.ts
import { redis } from '../lib/redis.js';

const LEADERBOARD_KEY = 'leaderboard:weighted';

/**
 * Update user's weighted score
 * Called after each mining tick
 */
export async function updateUserScore(
  walletPubkey: string,
  weightedScore: bigint
): Promise<void> {
  // ZADD with score as number (Redis scores are doubles)
  // For very large BigInts, may need scaling
  await redis.zadd(LEADERBOARD_KEY, Number(weightedScore), walletPubkey);
}

/**
 * Get top N users
 */
export async function getTopUsers(count: number = 10): Promise<Array<{
  wallet: string;
  score: number;
  rank: number;
}>> {
  // ZREVRANGE with scores, highest first
  const results = await redis.zrevrange(LEADERBOARD_KEY, 0, count - 1, 'WITHSCORES');

  const users: Array<{ wallet: string; score: number; rank: number }> = [];
  for (let i = 0; i < results.length; i += 2) {
    users.push({
      wallet: results[i],
      score: parseFloat(results[i + 1]),
      rank: i / 2 + 1,
    });
  }

  return users;
}

/**
 * Get user's rank and score
 */
export async function getUserRank(walletPubkey: string): Promise<{
  rank: number | null;
  score: number;
  totalUsers: number;
}> {
  const [rank, score, totalUsers] = await Promise.all([
    redis.zrevrank(LEADERBOARD_KEY, walletPubkey),
    redis.zscore(LEADERBOARD_KEY, walletPubkey),
    redis.zcard(LEADERBOARD_KEY),
  ]);

  return {
    rank: rank !== null ? rank + 1 : null, // Convert 0-indexed to 1-indexed
    score: score ? parseFloat(score) : 0,
    totalUsers,
  };
}

/**
 * Get user's percentile
 */
export async function getUserPercentile(walletPubkey: string): Promise<number> {
  const { rank, totalUsers } = await getUserRank(walletPubkey);
  if (rank === null || totalUsers === 0) return 0;

  return Math.round(((totalUsers - rank) / totalUsers) * 100);
}
```

### Pattern 5: Socket Events for Real-Time Updates

**What:** Extend typed socket events for earnings and leaderboard
**When to use:** Real-time UI updates
**Why:** Consistent with existing socket infrastructure

```typescript
// Extend packages/server/src/events/types.ts

// Add to ServerToClientEvents
export interface ServerToClientEvents {
  // ... existing events ...

  // Phase 6: Economy events
  'earnings:update': (data: {
    claimable: string;      // BigInt as string (lamports)
    projected24h: string;   // Projected earnings next 24h
    weightedScore: string;  // User's weighted resource total
    rank: number;
    percentile: number;
  }) => void;

  'leaderboard:update': (data: {
    top10: Array<{
      wallet: string;
      displayName: string;  // Truncated wallet
      score: string;
      rank: number;
    }>;
    userRank: number | null;
    userScore: string;
  }) => void;

  'claim:success': (data: {
    txSignature: string;
    amount: string;
    newBalance: string;
  }) => void;

  'claim:error': (data: {
    error: string;
    code: string;
  }) => void;
}
```

### Pattern 6: Heat Map Overlay with Per-Instance Colors

**What:** Visualize resource concentration on hex grid
**When to use:** WORLD-05 requirement - resource heat map overlay
**Why:** Shows strategic value of hexes visually

```typescript
// packages/client/src/scene/HeatMapOverlay.tsx
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface HexHeatData {
  q: number;
  r: number;
  heat: number; // 0-1 normalized value
}

interface HeatMapOverlayProps {
  hexData: HexHeatData[];
  visible: boolean;
}

// Heat color gradient: blue (cold) -> green -> yellow -> red (hot)
function heatToColor(heat: number): THREE.Color {
  const color = new THREE.Color();

  if (heat < 0.25) {
    // Blue to Cyan
    color.setHSL(0.6 - heat * 0.4, 0.8, 0.5);
  } else if (heat < 0.5) {
    // Cyan to Green
    color.setHSL(0.4 - (heat - 0.25) * 0.4, 0.8, 0.5);
  } else if (heat < 0.75) {
    // Green to Yellow
    color.setHSL(0.2 - (heat - 0.5) * 0.4, 0.8, 0.5);
  } else {
    // Yellow to Red
    color.setHSL(0.1 - (heat - 0.75) * 0.4, 0.9, 0.5);
  }

  return color;
}

export function HeatMapOverlay({ hexData, visible }: HeatMapOverlayProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Build color attribute for each instance
  const colors = useMemo(() => {
    const colorArray = new Float32Array(hexData.length * 3);

    hexData.forEach((hex, i) => {
      const color = heatToColor(hex.heat);
      colorArray[i * 3] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
    });

    return colorArray;
  }, [hexData]);

  // Update instance colors when data changes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Use instanceColor for per-instance colors
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceColor.needsUpdate = true;
  }, [colors]);

  // Opacity animation for fade in/out
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!materialRef.current) return;
    const targetOpacity = visible ? 0.6 : 0;
    materialRef.current.opacity += (targetOpacity - materialRef.current.opacity) * 0.1;
  });

  if (hexData.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, hexData.length]}
      position={[0, 0.01, 0]} // Slightly above hexes
    >
      <planeGeometry args={[0.9, 0.9]} />
      <meshBasicMaterial
        ref={materialRef}
        transparent
        opacity={0}
        depthWrite={false}
        vertexColors
      />
    </instancedMesh>
  );
}
```

### Anti-Patterns to Avoid

- **Storing all user shares on-chain:** Expensive, use Merkle root instead
- **Polling leaderboard from PostgreSQL:** Use Redis ZSET for O(log n) rank
- **Recalculating shares on every tick:** Batch updates, snapshot periodically
- **Syncing Merkle root on every resource change:** Update root on claim or schedule
- **Using individual mesh for heat overlay:** Use InstancedMesh with instanceColor

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Merkle proof verification | Custom hashing logic | OpenZeppelin MerkleProof pattern | Battle-tested, well-documented |
| Leaderboard ranking | PostgreSQL ORDER BY | Redis ZADD/ZREVRANK | O(log n) vs O(n log n) |
| Real-time updates | HTTP polling | Existing Socket.io | Already configured, typed |
| Pause/unpause | Custom flag system | Anchor account state | Atomic, verifiable |
| Fee tracking | Manual balance checks | Helius webhooks or getSignaturesForAddress | Reliable, indexed |

**Key insight:** The claim verification pattern from merkle-distributor is the gold standard for Solana fee distribution. It's used by major protocols for airdrops and is specifically optimized for Solana's constraints.

## Common Pitfalls

### Pitfall 1: Merkle Root Stale During High Activity

**What goes wrong:** Users mine resources but can't claim because Merkle root hasn't been updated
**Why it happens:** Root updates are expensive, can't update on every tick
**How to avoid:** Hybrid approach - show "pending" earnings vs "claimable" earnings. Update root on-demand when user requests claim, or on schedule (e.g., hourly)
**Warning signs:** Users complaining about stale claim amounts

### Pitfall 2: PumpFun Fee Attribution

**What goes wrong:** Can't determine which fee deposits came from PumpFun vs other sources
**Why it happens:** PumpFun sends SOL to a wallet, no built-in tagging
**How to avoid:** Use dedicated wallet for PumpFun fees only. Track by sender address if PumpFun uses consistent source
**Warning signs:** Fee totals don't match expected PumpFun revenue

### Pitfall 3: Claim Transaction Frontrunning

**What goes wrong:** Merkle root changes between proof generation and transaction submission
**Why it happens:** Another user's claim updates the root
**How to avoid:** Claims should use cumulative amounts with "claimed so far" tracking, not "current balance" proofs. Or use nonce-based invalidation
**Warning signs:** "Invalid proof" errors on seemingly valid claims

### Pitfall 4: BigInt Overflow in Score Calculations

**What goes wrong:** Weighted scores exceed Number.MAX_SAFE_INTEGER
**Why it happens:** Mining accumulates forever, weighted by 4x for gold
**How to avoid:** Use BigInt everywhere on server, scale down for Redis (which uses doubles). Consider periodic resets or normalization
**Warning signs:** Leaderboard scores show wrong values for top miners

### Pitfall 5: Heat Map Performance

**What goes wrong:** Frame rate drops when heat map overlay is visible
**Why it happens:** Updating thousands of instance colors every frame
**How to avoid:** Only update colors when data changes, not every frame. Use instanceColor attribute, not individual setColorAt calls
**Warning signs:** FPS drops from 60 to below 30 when overlay enabled

### Pitfall 6: Fee Distribution Precision

**What goes wrong:** Rounding errors cause total distributed to exceed vault balance
**Why it happens:** Floating point share percentages don't sum to exactly 1
**How to avoid:** Use integer math throughout. Distribute floor(share), accumulate remainder. Last claimant gets remainder
**Warning signs:** Vault balance goes negative, claims fail

## Code Examples

### Weighted Resource Calculation

```typescript
// packages/server/src/services/earningsService.ts

// Resource weights from CONTEXT.md
const RESOURCE_WEIGHTS = {
  GOLD: 4n,
  SILVER: 2n,
  COPPER: 1500n, // 1.5x as BigInt (multiply by 1000, divide later)
  IRON: 1000n,   // 1x as BigInt
} as const;

const WEIGHT_DIVISOR = 1000n; // For COPPER's decimal weight

/**
 * Calculate weighted score for a user's total resources
 */
export function calculateWeightedScore(resources: {
  gold: bigint;
  silver: bigint;
  copper: bigint;
  iron: bigint;
}): bigint {
  return (
    (resources.gold * RESOURCE_WEIGHTS.GOLD * WEIGHT_DIVISOR) +
    (resources.silver * RESOURCE_WEIGHTS.SILVER * WEIGHT_DIVISOR) +
    (resources.copper * RESOURCE_WEIGHTS.COPPER) +
    (resources.iron * RESOURCE_WEIGHTS.IRON)
  ) / WEIGHT_DIVISOR;
}

/**
 * Calculate user's share of the fee pool
 */
export function calculateUserShare(
  userWeightedScore: bigint,
  totalWeightedScore: bigint,
  totalFeePool: bigint
): bigint {
  if (totalWeightedScore === 0n) return 0n;

  // Integer division to avoid precision issues
  // User gets (userScore / totalScore) * (totalPool * 50%)
  const userPool = (totalFeePool * 50n) / 100n; // 50% to users
  return (userWeightedScore * userPool) / totalWeightedScore;
}
```

### PumpFun Fee Monitoring

```typescript
// packages/server/src/services/feeMonitor.ts
import { Connection, PublicKey } from '@solana/web3.js';

const PUMPFUN_FEE_WALLET = new PublicKey(process.env.PUMPFUN_FEE_WALLET!);
const CHECK_INTERVAL = 60_000; // 1 minute

let lastProcessedSlot = 0;

/**
 * Poll for new fee deposits from PumpFun
 * Alternative: Use Helius webhooks for push-based monitoring
 */
export async function checkForFeeDeposits(connection: Connection): Promise<void> {
  const signatures = await connection.getSignaturesForAddress(
    PUMPFUN_FEE_WALLET,
    { limit: 20 }
  );

  for (const sig of signatures) {
    if (sig.slot <= lastProcessedSlot) continue;

    const tx = await connection.getParsedTransaction(sig.signature);
    if (!tx) continue;

    // Find SOL transfer to our wallet
    const preBalance = tx.meta?.preBalances?.[0] ?? 0;
    const postBalance = tx.meta?.postBalances?.[0] ?? 0;
    const depositAmount = postBalance - preBalance;

    if (depositAmount > 0) {
      // Record fee deposit
      await prisma.feeDeposit.create({
        data: {
          txSignature: sig.signature,
          amount: BigInt(depositAmount),
          source: 'PUMPFUN',
        },
      });

      console.log(`Recorded PumpFun fee: ${depositAmount} lamports`);
    }

    lastProcessedSlot = Math.max(lastProcessedSlot, sig.slot);
  }
}

// Start monitoring
export function startFeeMonitor(connection: Connection): void {
  setInterval(() => checkForFeeDeposits(connection), CHECK_INTERVAL);
}
```

### Claim Flow (Client)

```typescript
// packages/client/src/hooks/useClaimEarnings.ts
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useState, useCallback } from 'react';

export function useClaimEarnings() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet not connected');
      return;
    }

    setIsClaiming(true);
    setError(null);

    try {
      // 1. Request claim transaction from server
      const response = await fetch('/api/earnings/claim', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }

      const { transaction, amount, proof } = await response.json();

      // 2. Deserialize and sign
      const tx = Transaction.from(Buffer.from(transaction, 'base64'));
      const signed = await wallet.signTransaction(tx);

      // 3. Send and confirm
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      // 4. Notify server of successful claim
      await fetch('/api/earnings/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, amount }),
      });

      return { signature, amount };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claim failed');
      throw err;
    } finally {
      setIsClaiming(false);
    }
  }, [wallet, connection]);

  return { claim, isClaiming, error };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store all shares on-chain | Merkle root + off-chain tree | Standard | 99% cost reduction |
| Polling for rank | Redis ZSET pub/sub | Standard | Real-time, O(log n) |
| Manual fee distribution | On-demand claims with proofs | Standard | No admin intervention |
| Cron-based snapshots | Event-driven updates | Standard | Fresher data |

**Deprecated/outdated:**
- Push-based fee distribution (where admin sends to all): Gas inefficient, doesn't scale
- Fixed periodic snapshots: Replaced by real-time tracking with on-demand claim

## Open Questions

Things that couldn't be fully resolved:

1. **PumpFun Fee Delivery Mechanism**
   - What we know: PumpFun has creator fee sharing, can assign percentages to wallets
   - What's unclear: Exact timing/batching of fee transfers, whether there's a webhook API
   - Recommendation: Start with polling getSignaturesForAddress, upgrade to Helius webhooks if latency matters

2. **Merkle Root Update Frequency**
   - What we know: Can update on-chain, costs ~0.000005 SOL per update
   - What's unclear: Optimal frequency vs user expectation
   - Recommendation: Update on user claim request (lazy update), or hourly batch if many users

3. **Heat Map Data Source**
   - What we know: Need resource concentration per hex
   - What's unclear: Should it show current resources, or weighted mining value?
   - Recommendation: Show weighted resource value (Gold hexes hotter) to match fee distribution logic

4. **Claim Confirmation UX**
   - What we know: User decision requires confirmation dialog
   - What's unclear: What information to show in dialog
   - Recommendation: Show claimable amount, gas estimate, wallet balance after claim

## Sources

### Primary (HIGH confidence)
- [Solana Storing SOL in PDA](https://solana.com/developers/guides/games/store-sol-in-pda) - PDA vault pattern
- [QuickNode System Program PDA Guide](https://www.quicknode.com/guides/solana-development/anchor/system-program-pda) - Transfer from PDA
- [Redis Leaderboards](https://redis.io/solutions/leaderboards/) - ZSET patterns
- [Metaplex Token Claimer Guide](https://developers.metaplex.com/token-metadata/guides/anchor/token-claimer-smart-contract) - Merkle proof verification
- [Drei Instances Documentation](https://drei.docs.pmnd.rs/performances/instances) - Per-instance attributes

### Secondary (MEDIUM confidence)
- [PumpPortal Creator Fee API](https://pumpportal.fun/creator-fee/) - Fee claiming mechanism
- [merkle-distributor crate](https://docs.rs/merkle-distributor) - Solana Merkle distribution pattern
- [RareSkills Solana Events](https://rareskills.io/post/solana-logs-transaction-history) - Event emission/listening
- [Helius Solana Data Streaming](https://www.helius.dev/blog/solana-data-streaming) - Webhook options
- [Medium Hyperscale Leaderboard](https://dilipkumar.medium.com/hyperscale-real-time-leaderboard-system-design-eb845373598f) - Leaderboard scaling patterns

### Tertiary (LOW confidence - verify before use)
- Heat map shader patterns: Found examples but no official Three.js documentation
- PumpFun webhook integration: No official API documentation found
- anchor-merkle-tree crate: Limited documentation, may need to examine source

## Metadata

**Confidence breakdown:**
- Fee vault pattern: HIGH - Official Solana/Anchor documentation
- Merkle claims: HIGH - Metaplex guide + merkle-distributor reference
- Leaderboard: HIGH - Redis official documentation
- Heat map: MEDIUM - Community patterns, no official R3F docs
- PumpFun integration: LOW - Third-party API, unclear official support

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - core patterns are stable)
