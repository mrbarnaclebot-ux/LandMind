# LandMind Smart Contract Security Checklist

Pre-audit verification checklist based on Solana/Anchor security best practices.

## Account Validation

- [x] All accounts have explicit type constraints (Signer, Account, SystemAccount)
- [x] All PDAs use seeds constraint with explicit bump
- [x] has_one constraint used for authority validation
- [x] Signer required for all state-modifying operations
- [x] SystemProgram explicitly required for SOL transfers

## Arithmetic Safety

- [x] All addition uses checked_add()
- [x] All division uses checked_div()
- [x] Overflow/underflow returns explicit error codes (LandMindError::Overflow)
- [x] No unchecked arithmetic in critical paths

## Authorization

- [x] Admin operations gated by has_one = authority
- [x] Authority is single Pubkey (consider upgrade to multisig for mainnet)
- [x] Emergency pause functionality implemented
- [x] Pause state checked in claim_earnings instruction
- [x] Pause/unpause have idempotency guards

## Fund Safety

- [x] Treasury balance checked before withdrawals
- [x] Minimum claim threshold enforced (0.025 SOL)
- [x] Transfer amounts validated against available balance
- [x] PDA signing seeds match expected derivation
- [x] Treasury is SystemAccount (SOL-native)

## Merkle Proof Verification

- [x] OpenZeppelin-compatible sorted hashing (smaller hash first)
- [x] Leaf format: keccak256(pubkey || padded_amount)
- [x] Empty root check (prevents claims before initialization)
- [x] Proof length bounded (implicit by compute limits)

## Error Handling

- [x] All error conditions have explicit error codes (6000-6059 range)
- [x] Error messages are descriptive
- [x] No silent failures (all paths return Result)
- [x] Error codes grouped by category for easier debugging

## Events

- [x] AgentDeployedEvent emitted on deploy
- [x] ClaimEvent emitted on successful claim
- [x] VaultInitializedEvent emitted on init
- [x] VaultPausedEvent/UnpausedEvent emitted on state change
- [x] MerkleRootUpdatedEvent emitted on root update with old/new values

## Known Limitations (Document for Auditor)

1. **Single admin authority** (not multisig) - acceptable for v1, upgrade path available
2. **No claim deduplication** - relies on merkle root updates per epoch
3. **Treasury is SystemAccount** - SOL only for v1
4. **Agent index derived from treasury balance** - assumes no withdrawals outside claims

## Test Coverage

- [ ] Unit tests for all instructions
- [ ] Integration tests for full flow
- [ ] Edge case tests (zero amounts, max amounts, etc.)
- [ ] Pause state tests
- [ ] Invalid proof rejection tests
- [ ] Overflow boundary tests

## Deployment Checklist

- [ ] Program deployed to devnet with test wallet
- [ ] All instructions tested on devnet
- [ ] Treasury PDA initialized and funded
- [ ] Vault state initialized with authority
- [ ] Merkle root updated with test data
- [ ] Claim flow tested end-to-end
- [ ] Pause/unpause cycle tested
- [ ] Invalid proof rejection verified

## Security Patterns Used

| Pattern | Implementation |
|---------|----------------|
| Checks-Effects-Interactions | Validations before state changes |
| PDA Seeds Validation | All PDAs use seeds constraint |
| Authority Separation | Admin vs user instructions |
| Emergency Stop | Pause/unpause mechanism |
| Explicit Error Codes | Typed errors with messages |
| Event Logging | All state changes emit events |

## Recommended Pre-Mainnet Actions

1. Add multisig support for authority operations
2. Consider timelocks for merkle root updates
3. Add rate limiting documentation
4. Document epoch-based claiming model
5. Consider claim deduplication account
