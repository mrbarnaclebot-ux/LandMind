---
phase: 06-economy-distribution
created: 2026-01-21
source: discussion
---

# Phase 6: Economy & Distribution Context

## Fee Vault Mechanics

### Fee Sources
- **Decision:** Both deployment fees AND PumpFun trading fees
- **Rationale:** Maximizes reward pool for miners

### Claim Timing
- **Decision:** On-demand anytime claims
- **Rationale:** User flexibility, no forced schedule

### Minimum Claim
- **Decision:** 0.025 SOL (~$5) minimum
- **Rationale:** Prevents dust claims that waste gas

### Unclaimed Earnings
- **Decision:** Accumulate forever (no expiry)
- **Rationale:** User-friendly, no penalty for inactivity

### Fee Split Implementation
- **Decision:** On-chain 50/50 split in smart contract
- **Rationale:** Transparent, verifiable, trustless

### Fee Display
- **Decision:** Show both user share AND platform share
- **Rationale:** Full transparency builds trust

### Fee Collection Wallet
- **Decision:** Server wallet with private key
- **Rationale:** PumpFun sends fees to designated address

### Distribution Trigger
- **Decision:** On-demand when users claim
- **Rationale:** Simple, no cron jobs needed

### Fee Token
- **Decision:** SOL only (no wrapped tokens)
- **Rationale:** Simpler UX, no token swaps needed

### Contract Upgrades
- **Decision:** Upgradeable contract
- **Rationale:** Allows bug fixes and improvements

### Emergency Pause
- **Decision:** Admin-only pause capability
- **Rationale:** Security measure for exploits

## Earnings Dashboard

### Primary Display
- **Decision:** Current claimable earnings focus
- **Rationale:** Most actionable information first

### Resource Breakdown
- **Decision:** Detailed breakdown by resource type
- **Rationale:** Transparency on contribution sources

### Rank Display
- **Decision:** Both percentage AND numeric rank
- **Rationale:** Complete context for user's position

### Projections
- **Decision:** Show projected earnings with estimate
- **Rationale:** Motivates continued engagement

### Dashboard Location
- **Decision:** Separate panel (like Agent Dashboard)
- **Rationale:** Dedicated space, consistent UI pattern

### Claim Confirmation
- **Decision:** Require confirmation dialog before claim
- **Rationale:** Prevents accidental claims

### Earnings Updates
- **Decision:** Real-time via socket
- **Rationale:** Consistent with mining updates

### Claim History
- **Decision:** Show recent claims history
- **Rationale:** Transaction transparency

## Distribution Formula

### Weighting Method
- **Decision:** Weighted by resource value (rarity-based)
- **Rationale:** Rewards strategic hex selection

### Resource Values
- **Decision:** Based on rarity (Gold > Silver > Copper > Iron)
- **Rationale:** Aligns with scarcity economics

### Early Miner Bonus
- **Decision:** No early miner bonus
- **Rationale:** Fair play, no artificial advantages

### Calculation Method
- **Decision:** Hybrid (Merkle proof + off-chain tracking)
- **Rationale:** Balance between gas efficiency and accuracy

### Snapshot Timing
- **Decision:** Real-time calculation
- **Rationale:** Always accurate, no stale data

### Inactive Agent Eligibility
- **Decision:** Only active miners earn
- **Rationale:** Rewards engagement, not parking

## Leaderboard Design

### Grouping
- **Decision:** By wallet (aggregate)
- **Rationale:** Shows total contribution per user

### Display Count
- **Decision:** Top 10
- **Rationale:** Clean, focused view

### Own Rank
- **Decision:** Always show user's rank (even if not top 10)
- **Rationale:** Personal context and motivation

### Rank Metric
- **Decision:** Weighted resources (matches fee distribution)
- **Rationale:** Consistent with reward calculation

### Update Frequency
- **Decision:** Real-time via socket
- **Rationale:** Live competition feel

## Technical Notes

### Resource Value Weights (suggested)
```
GOLD: 4x multiplier (rarest)
SILVER: 2x multiplier
COPPER: 1.5x multiplier
IRON: 1x multiplier (base)
```

### Claim Flow
1. User clicks "Claim" button
2. Confirmation dialog shows amount
3. Server validates eligibility via Merkle proof
4. Smart contract transfers SOL from vault to user
5. Update claim history and earnings display

### Socket Events (new for Phase 6)
- `earnings:update` - Real-time earnings change
- `leaderboard:update` - Rank changes
- `claim:success` - Claim confirmation

---
*Captured from discussion: 2026-01-21*
