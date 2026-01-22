# LandMind Audit Preparation

## Contract Overview

LandMind is a Solana Anchor program for a mining game where users deploy agents (cNFTs) and claim earnings based on merkle proof verification. The on-chain program handles:

1. Agent deployment payments (0.1 SOL per agent)
2. Fee distribution via merkle proof claims
3. Emergency pause/unpause functionality
4. Merkle root updates for claim eligibility

## Program ID

```
D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ
```

## Key Instructions

### 1. initialize

- **Purpose:** Legacy placeholder (no-op)
- **Access:** Public
- **State Changes:** None
- **Accounts:** None required

### 2. deploy_agent

- **Purpose:** Accept 0.1 SOL payment for agent deployment
- **Access:** Public (any wallet)
- **State Changes:** Transfers SOL to treasury PDA
- **Events:** AgentDeployedEvent
- **Validation:** System program CPI for transfer

### 3. initialize_vault

- **Purpose:** One-time vault state initialization
- **Access:** Any (first caller becomes authority)
- **State Changes:** Creates FeeVaultState PDA account
- **Events:** VaultInitializedEvent
- **Note:** Can only be called once (PDA already exists check)

### 4. claim_earnings

- **Purpose:** Allow users to claim earnings via merkle proof
- **Access:** Public (valid proof required)
- **State Changes:**
  - Transfers SOL from treasury to claimer
  - Increments total_distributed counter
- **Events:** ClaimEvent
- **Validation:**
  - Vault not paused
  - Amount >= 0.025 SOL minimum
  - Merkle root is not empty
  - Treasury has sufficient balance
  - Merkle proof is valid

### 5. pause_vault

- **Purpose:** Emergency pause of claims
- **Access:** Authority only
- **State Changes:** Sets paused flag to true
- **Events:** VaultPausedEvent
- **Validation:** Vault must not already be paused

### 6. unpause_vault

- **Purpose:** Resume claims after pause
- **Access:** Authority only
- **State Changes:** Sets paused flag to false
- **Events:** VaultUnpausedEvent
- **Validation:** Vault must be paused

### 7. update_merkle_root

- **Purpose:** Update the merkle root for claims
- **Access:** Authority only
- **State Changes:** Updates merkle_root in vault state
- **Events:** MerkleRootUpdatedEvent (includes old and new root)

## PDA Derivations

| PDA | Seeds | Bump Storage | Purpose |
|-----|-------|--------------|---------|
| Treasury | `["treasury"]` | Derived at runtime | Holds SOL for claims |
| Vault State | `["vault_state"]` | Stored in account (vault_state.bump) | Stores config and merkle root |

## Account Structures

### FeeVaultState (128 bytes with padding)

```rust
pub struct FeeVaultState {
    pub authority: Pubkey,        // 32 bytes - Admin who can pause/update
    pub merkle_root: [u8; 32],    // 32 bytes - Current merkle root
    pub total_distributed: u64,    // 8 bytes - Total lamports claimed
    pub paused: bool,             // 1 byte - Emergency pause flag
    pub bump: u8,                 // 1 byte - PDA bump
    // 46 bytes padding for future fields
}
```

## Economic Model

| Operation | Amount | Direction |
|-----------|--------|-----------|
| Agent deployment | 0.1 SOL | User -> Treasury |
| Claim earnings | Variable (min 0.025 SOL) | Treasury -> User |

**Fee Distribution Model:**
- Off-chain system calculates earnings per user
- Merkle tree generated with (pubkey, amount) leaves
- Merkle root published on-chain
- Users claim with valid proof

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | Unauthorized | Admin signature required |
| 6001 | InvalidSigner | Invalid signer |
| 6002 | VaultPaused | Vault is currently paused |
| 6003 | VaultNotPaused | Vault is not paused |
| 6004 | InvalidProof | Invalid Merkle proof |
| 6005 | EmptyMerkleRoot | Merkle root is empty |
| 6006 | BelowMinimumClaim | Claim below 0.025 SOL |
| 6007 | InsufficientTreasuryBalance | Treasury balance too low |
| 6008 | ClaimExceedsAllowance | Claim exceeds allowed |
| 6009 | Overflow | Arithmetic overflow |
| 6010 | Underflow | Arithmetic underflow |
| 6011 | InsufficientDeployPayment | Not enough for deploy |
| 6012 | InvalidPDA | Invalid PDA derivation |
| 6013 | BumpMismatch | Bump mismatch |

## Scope of Audit

### In Scope

1. All Anchor program code in `programs/landmind/src/`
   - lib.rs (main program logic)
   - state.rs (account structures and events)
   - errors.rs (error definitions)
2. Account validation and constraints
3. Arithmetic safety (overflow/underflow)
4. Authorization checks
5. Fund transfer security
6. Merkle proof verification algorithm
7. PDA derivation correctness

### Out of Scope

- Backend services (off-chain Merkle tree generation)
- Frontend code
- cNFT minting (handled by Metaplex Bubblegum)
- Fee monitoring system

## Security Concerns to Review

1. **Merkle proof verification** - Ensure proof cannot be replayed or manipulated
2. **Treasury fund safety** - Verify funds cannot be drained unexpectedly
3. **Authority control** - Verify only authority can pause/update
4. **Integer arithmetic** - Verify no overflow in total_distributed
5. **Claim amount validation** - Verify minimum claim enforced correctly

## Timeline Request

- **Audit Duration:** 2-3 weeks
- **Priority:** HIGH/CRITICAL findings blocking
- **Remediation Window:** 1 week post-report
- **Re-audit:** If critical findings require significant changes

## Files to Review

```
packages/contracts/
├── programs/
│   └── landmind/
│       └── src/
│           ├── lib.rs         # Main program logic (303 lines)
│           ├── state.rs       # Account structures and events (93 lines)
│           └── errors.rs      # Error definitions (44 lines)
├── Anchor.toml                # Program configuration
└── Cargo.toml                 # Dependencies
```

## Dependencies

```toml
[dependencies]
anchor-lang = "0.30.1"
```

Anchor version 0.30.1 is used for stability and compatibility.

## Contact

For questions during the audit, please reach out to the development team.

## Additional Documentation

- `SECURITY_CHECKLIST.md` - Pre-audit security verification checklist
- Project documentation in `.planning/` directory
