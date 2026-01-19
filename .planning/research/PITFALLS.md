# Domain Pitfalls

**Project:** LandMind - Solana Web3 3D Mining Game
**Domain:** Web3 gaming with token-based rewards on Solana
**Researched:** 2026-01-19
**Confidence:** HIGH (verified with multiple sources)

---

## Critical Pitfalls

Mistakes that cause exploits, fund loss, or complete rewrites. These must be addressed before mainnet.

---

### Pitfall 1: Missing Account Validation in Solana Programs

**What goes wrong:** Solana's architecture requires users to provide all accounts for a program instruction. Without proper validation, attackers inject malicious accounts to manipulate program behavior, steal funds, or gain unauthorized access.

**Why it happens:** Unlike traditional smart contract platforms where access control is often protocol-enforced, Solana allows any account to be passed into a program. Developers coming from Ethereum assume the runtime protects them. The Anchor framework provides helpers, but missed checks are still possible, especially when using `remaining_accounts`.

**Consequences:**
- Unauthorized fund withdrawals from reward vault
- Agent ownership hijacking
- Fee distribution manipulation
- Complete protocol drain (see: 85.5% of severe audit findings are Business Logic, Permissions, and Validation Errors)

**Prevention:**
1. Verify ALL accounts: owner, type, address (if specific account expected), and relations with other accounts
2. Use Anchor's `#[account]` constraints religiously (`has_one`, `seeds`, `bump`, `constraint`)
3. For PDAs, always use canonical bump (highest value producing valid PDA)
4. Hardcode program IDs for CPIs instead of accepting user input
5. Add explicit signer checks on all state-modifying instructions
6. Never trust `remaining_accounts` without manual validation

**Detection (Warning Signs):**
- Code review shows accounts passed without validation
- Tests only cover "happy path" scenarios
- No explicit owner checks in Anchor account structs
- Using `UncheckedAccount` without manual validation

**Phase:** Smart Contract Development (Phase 1)
**Audit flag:** CRITICAL - External audit must cover all account validation

**Sources:**
- [Helius Guide to Solana Program Security](https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security)
- [Cantina - Securing Solana Developer Guide](https://cantina.xyz/blog/securing-solana-a-developers-guide)
- [Sec3 Solana Security Ecosystem Review 2025](https://solanasec25.sec3.dev/)

---

### Pitfall 2: Cross-Program Invocation (CPI) Vulnerabilities

**What goes wrong:** CPIs allow one program to call another, but they also forward signer privileges. Without verification of the target program ID, attackers redirect calls to malicious programs that drain funds or corrupt state.

**Why it happens:**
- Developers don't verify the callee's program ID before invoking
- Signers from previous calls can be reused in arbitrary CPIs
- Missing reload of account state after CPI completes
- Solana CPIs have a max depth of 4, but improper state management within that depth creates vulnerabilities

**Consequences:**
- Arbitrary code execution in attacker-controlled programs
- Privilege escalation via signer reuse
- SOL transfers to attacker accounts
- Stale state reads leading to double-spend scenarios

**Prevention:**
1. Always verify program ID against static values before CPI
2. Use Anchor's `Program<'info, T>` type which auto-verifies program address
3. Verify signer accounts don't have unnecessary privileges before arbitrary calls
4. Reload account state after any CPI that modifies shared state
5. Implement account isolation - per-user token accounts limit blast radius
6. Test CPI chains thoroughly, including malicious program injection

**Detection (Warning Signs):**
- CPIs accepting program ID from user input
- No program ID verification before `invoke` or `invoke_signed`
- State reads after CPI without reload
- Complex CPI chains without clear privilege boundaries

**Phase:** Smart Contract Development (Phase 1)
**Audit flag:** CRITICAL - Every CPI is a potential attack vector

**Sources:**
- [Asymmetric Research - CPI Vulnerabilities](https://www.asymmetric.re/blog-archived/invocation-security-navigating-vulnerabilities-in-solana-cpis)
- [Medium - Solana Security Blunders](https://medium.com/@ancilartech/10-shocking-solana-security-blunders-youre-probably-making-and-how-to-fix-them-3644939c38c4)

---

### Pitfall 3: Insecure Randomness for Resource Distribution

**What goes wrong:** Using predictable sources (block.timestamp, block.number, simple seeds) for resource allocation or mining rewards allows attackers to predict outcomes and game the system.

**Why it happens:** Randomness is deceptively hard in deterministic blockchain environments. Developers use convenient but exploitable sources. Validators can predict and manipulate block variables.

**Consequences:**
- Attackers mine only high-resource hexes
- Fee distribution manipulation
- "Rerolling" attacks (cancel/retry until favorable outcome)
- Meebits-style trait sniping ($700k exploit from predictable NFT traits)
- Complete destruction of game economy fairness

**Prevention:**
1. Use verifiable randomness (Switchboard VRF on Solana, or commit-reveal schemes)
2. For resource distribution: use seeded Perlin noise with server-controlled seed, revealed post-mint
3. Never expose resource values before hex claim is finalized
4. Implement commit-reveal for any on-chain randomness need
5. For off-chain simulation (mining), use cryptographically secure RNG server-side

**Detection (Warning Signs):**
- Resource allocation visible in contract state before claim
- Using slot number or timestamp as randomness source
- No VRF integration in spec
- Users can query resource values before committing to hex

**Phase:** Smart Contract Development (Phase 1), Game Design
**Audit flag:** HIGH - Economic fairness depends on this

**Sources:**
- [Sherlock - Insecure Randomness Vulnerability](https://sherlock.xyz/post/understanding-the-insecure-randomness-vulnerability)
- [Shutter - Commit-Reveal Protection](https://blog.shutter.network/top-3-riskiest-web3-dapps-that-need-commit-reveal-protection/)

---

### Pitfall 4: Integer Overflow/Underflow in Rust

**What goes wrong:** Solana programs compile in release mode, which means overflows and underflows silently wrap to incorrect values instead of panicking. Fee calculations, reward distributions, and resource tallies produce wrong results.

**Why it happens:** Developers assume Rust's safety guarantees apply. In debug mode, integer overflow panics. In release mode (production), it wraps silently. Developers are careful in some calculations but inconsistent.

**Consequences:**
- Reward distribution pays wrong amounts
- Fee calculations overflow to tiny values
- Resource tallies underflow to max u64
- Economic exploitation via calculation manipulation

**Prevention:**
1. Use `checked_add`, `checked_sub`, `checked_mul`, `checked_div` for ALL arithmetic
2. Use Anchor's built-in math helpers
3. Add overflow guards in critical calculations
4. Test edge cases: max values, zero values, boundary conditions
5. Consider using `saturating_add/sub` where overflow should cap at bounds

**Detection (Warning Signs):**
- Naked `+`, `-`, `*`, `/` operators on integers in Rust code
- No overflow tests in test suite
- Large number arithmetic without checked operations
- Fee distribution calculations using standard operators

**Phase:** Smart Contract Development (Phase 1)
**Audit flag:** HIGH - Subtle bugs that are easy to miss

**Sources:**
- [Helius Guide to Solana Program Security](https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security)
- [Mirage Audits - Solana Native Rust Vulnerabilities](https://www.mirageaudits.com/blog/solana-native-rust-security-vulnerabilities)

---

### Pitfall 5: PumpFun Integration Dependency Risk

**What goes wrong:** The entire reward model depends on PumpFun trading fees. If PumpFun changes their API, fee structure, or becomes unavailable, user earnings stop.

**Why it happens:** Tight coupling to external protocol without fallback. PumpFun is third-party infrastructure with no SLA guarantees. API rate limits and fees vary by provider (e.g., PumpPortal takes 0.5% per trade).

**Consequences:**
- Complete revenue stream interruption
- User trust collapse if earnings stop
- No way to compensate users if fees don't flow
- Legal liability if promised earnings don't materialize

**Prevention:**
1. Design fee distribution to work with OR without PumpFun (treasury backstop)
2. Implement circuit breaker: if PumpFun fees drop below threshold, pause distributions with clear communication
3. Store at least 30 days of distribution buffer in treasury
4. Monitor PumpFun API health continuously
5. Document the dependency clearly to users (earnings depend on trading activity)
6. Consider multiple fee sources (not just PumpFun)

**Detection (Warning Signs):**
- No fallback revenue source documented
- Treasury has no buffer for fee interruptions
- PumpFun integration not tested with failure scenarios
- User communications promise guaranteed earnings

**Phase:** Economic Model Design, Backend Integration
**Audit flag:** MEDIUM - Business risk, not security risk

**Sources:**
- [Moralis PumpFun API FAQ](https://docs.moralis.com/web3-data-api/solana/tutorials/pump-fun-api-faq)
- [PumpPortal API Documentation](https://pumpportal.fun/creation/)

---

## Severe Pitfalls

Mistakes that cause significant technical debt, performance issues, or user experience problems requiring major refactoring.

---

### Pitfall 6: 3D Performance Collapse with 1M Hexes

**What goes wrong:** Attempting to render or even load data for 1 million hexes crashes browsers, consumes all GPU memory, and makes the game unplayable.

**Why it happens:** Developers underestimate WebGL memory limits. Each hex needs geometry, textures, and state. Without aggressive optimization, memory and draw calls explode.

**Consequences:**
- Browser crashes on mid-range devices
- 5+ second load times
- Frame rate drops below 10 FPS
- Users abandon before seeing the game

**Prevention:**
1. **Chunking:** Divide world into chunks (16x16 recommended). Each chunk has its own InstancedMesh
2. **Frustum culling:** Only render hexes in camera view (Babylon.js handles this, but needs chunk boundaries)
3. **Level of Detail (LOD):** 4 LOD levels - reduce polygon count for distant hexes
4. **Instanced rendering:** Use InstancedMesh for identical hex geometry (reduces draw calls from N to 1)
5. **Lazy loading:** Stream hex data only for visible viewport (50-100 hexes at a time)
6. **WebWorker:** Move coordinate calculations off main thread
7. **Target:** <500 visible hexes at once, <100MB memory, 60 FPS

**Detection (Warning Signs):**
- Prototype loads all hex data on startup
- No chunking system in architecture
- Each hex is a separate Mesh object
- Memory usage exceeds 500MB in profiler
- FPS drops when panning/zooming

**Phase:** 3D Visualization Development
**Audit flag:** MEDIUM - Performance issue, not security

**Sources:**
- [Codrops - Building Efficient Three.js Scenes](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)
- [WebGL Fundamentals - Instanced Drawing](https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html)
- [Three.js Forum - Hexagonal Grid Formation](https://discourse.threejs.org/t/hexagonal-grid-formation/18396)

---

### Pitfall 7: Solana Transaction Failures During Congestion

**What goes wrong:** Transactions fail silently during network congestion. Users click "Deploy Agent" but nothing happens. The 0.1 SOL appears deducted (simulation passed) but agent never created.

**Why it happens:** Solana's local fee markets mean contention for specific program accounts causes localized congestion. Default fees don't compete. Without retry logic, failures are silent.

**Consequences:**
- Users think they've been scammed
- Support tickets explode
- Actual fund loss if transaction partially succeeds
- User abandonment during high-activity periods (launches, airdrops)

**Prevention:**
1. **Priority fees:** Add dynamic priority fees during congestion (monitor current rates)
2. **Retry with backoff:** Exponential retry (1s, 2s, 4s, 8s) with jitter
3. **Multiple RPC endpoints:** Fallback to Triton, Helius, QuickNode if primary fails
4. **Simulation first:** Always simulate transaction before sending
5. **Clear UI states:** "Pending", "Confirming", "Failed - Retry" - never leave users guessing
6. **Compute unit optimization:** Request only needed CUs, not max (reduces fee waste)

**Detection (Warning Signs):**
- No retry logic in transaction submission code
- Single RPC endpoint
- UI doesn't show transaction pending state
- No priority fee logic
- Users report "stuck" transactions

**Phase:** Backend Integration, Wallet Integration
**Audit flag:** LOW - UX issue, not security

**Sources:**
- [QuickNode - How to Use Priority Fees](https://www.quicknode.com/guides/solana-development/transactions/how-to-use-priority-fees)
- [Medium - 7 Priority Fee Moves for Solana Congestion](https://medium.com/@ThinkingLoop/7-priority-fee-moves-to-beat-solana-congestion-0680a517c933)
- [Bitmorpho - Mastering Solana Transactions](https://bitmorpho.com/en/article/mastering-solana-transactions-reducing-failures-with-priority-fees-and-cu-optimization)

---

### Pitfall 8: Tokenomics Death Spiral

**What goes wrong:** Reward emissions exceed demand. Token price drops. Users sell faster. Price drops more. Negative feedback loop until token is worthless.

**Why it happens:** Optimistic projections assume perpetual growth. Rewards designed to attract early users become unsustainable. No mechanism to adjust emissions based on economic health.

**Consequences:**
- Token price collapse
- User exodus as earnings become worthless
- Community trust destroyed
- Project becomes unrecoverable

**Prevention:**
1. **Dynamic emissions:** Tie reward rates to economic indicators (trading volume, user count, treasury balance)
2. **Burn mechanism:** Burn portion of fees to offset inflation
3. **Soft caps:** Maximum daily/weekly rewards per user
4. **Treasury reserve:** 30-day buffer minimum at all times
5. **Weekly economic audits:** Monitor Gini coefficient, ROI distribution, token velocity
6. **Transparent adjustments:** If economics unhealthy, adjust with community communication
7. **No promises of fixed returns:** Always communicate "earnings depend on platform activity"

**Detection (Warning Signs):**
- Fixed reward rates regardless of platform health
- No burn mechanism
- Treasury depleting without replenishment
- User ROI exceeds 100% monthly (unsustainable)
- Token price declining while emissions continue

**Phase:** Economic Model Design
**Audit flag:** MEDIUM - Business sustainability

**Sources:**
- [MEXC News - Why Most Web3 Game Studios Failed in 2025](https://www.mexc.com/news/337490)
- [Solana Compass - Tokenomics and Inflation](https://solanacompass.com/tokenomics)

---

### Pitfall 9: Complex User Onboarding Causing Abandonment

**What goes wrong:** Users need to: understand Web3, get SOL, install wallet, connect wallet, sign message, understand hex grid, understand mining, deploy agent. Most drop off before step 3.

**Why it happens:** Web3 developers assume users know blockchain mechanics. Every additional step loses 20-40% of funnel. Seed phrases, gas fees, wallet extensions feel foreign to Web2 users.

**Consequences:**
- Sub-1% 30-day retention (industry average for poor onboarding)
- High customer acquisition cost wasted
- Community growth stalls
- Competitors with better UX win

**Prevention:**
1. **Progressive disclosure:** Let users explore 3D world BEFORE requiring wallet
2. **Embedded wallets:** Consider Magic Link, Dynamic, or Privy for social login (email/Google)
3. **Gas sponsorship:** Pay transaction fees for users' first actions
4. **Fiat on-ramp:** Integrate MoonPay/Transak so users can buy SOL with card
5. **Interactive tutorial:** 5-minute guided experience with tooltips
6. **Skip wallet initially:** Show demo mode with simulated wallet
7. **Clear value prop:** Show potential earnings BEFORE asking for wallet

**Detection (Warning Signs):**
- Landing page immediately shows "Connect Wallet"
- No demo mode or preview
- Tutorial requires wallet connection
- Onboarding flow has 5+ steps before first interaction
- Analytics show >80% drop-off before wallet connect

**Phase:** Frontend Development, User Flow Design
**Audit flag:** LOW - UX issue

**Sources:**
- [Magic Link - User Onboarding in Web3](https://magic.link/posts/user-onboarding-web3-challenges-best-practices)
- [Sequence - Simplify Web3 Onboarding](https://sequence.xyz/blog/how-to-simplify-user-onboarding-for-a-web3-app)
- [Reown - Best Web3 Onboarding Tools 2025](https://reown.com/blog/web3-onboarding-tools-top-picks-for-2025-startups)

---

### Pitfall 10: Skipping or Rushing Smart Contract Audit

**What goes wrong:** Pressure to launch ASAP leads to skipping audit or accepting superficial review. Post-launch exploit drains funds. Users lose money. Project reputation destroyed.

**Why it happens:** Audits take 1-6 weeks and cost $10k-$100k+. Timeline pressure makes it tempting to "audit later". Developers feel confident in their code.

**Consequences:**
- Fund loss (average Solana exploit: $8M in 2025, down from $550M in 2022)
- Legal liability
- Complete project failure
- Community trust impossible to rebuild

**Prevention:**
1. **Budget for audit:** $15k-$50k minimum for complex DeFi-adjacent programs
2. **Timeline:** Start audit process 4-6 weeks before target launch
3. **Scope correctly:** All programs, all instructions, all account validations
4. **Fix all HIGH/CRITICAL:** No launch until all severe findings remediated
5. **Re-test after fixes:** Auditor verifies fixes actually work
6. **Bug bounty post-launch:** Continuous security via Immunefi or similar
7. **Trusted auditors:** Sec3, OtterSec, Soteria, Hacken, Certora for Solana

**Detection (Warning Signs):**
- "We'll audit after launch"
- Audit budget not allocated
- Audit scope excludes some programs
- HIGH findings not addressed before launch
- No bug bounty planned

**Phase:** Pre-Launch (must complete before mainnet)
**Audit flag:** CRITICAL - Non-negotiable for mainnet

**Sources:**
- [Sec3 Solana Security Ecosystem Review 2025](https://solanasec25.sec3.dev/)
- [Hacken - Solana Smart Contract Audit](https://hacken.io/services/blockchain-security/solana-smart-contract-security-audit/)
- [Solana Docs - Production Readiness](https://solana.com/docs/payments/production-readiness)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or user friction but are recoverable.

---

### Pitfall 11: Account Reinitialization/Revival Attacks

**What goes wrong:** Accounts are "closed" but can be recreated at the same address. Attackers resurrect accounts with manipulated state.

**Why it happens:** Solana's rent system garbage collects accounts below rent-exempt threshold, but the account address can be reused. Improper closing leaves accounts vulnerable to revival.

**Prevention:**
1. Zero out all account data before closing
2. Use Anchor's `#[account(close = destination)]` which handles this
3. Add `is_initialized` flag and check it on every instruction
4. Transfer ALL lamports when closing (not just data lamports)

**Detection:**
- Manual account closing without zeroing data
- No initialization checks on sensitive accounts
- Tests don't cover account recreation scenarios

**Phase:** Smart Contract Development
**Audit flag:** HIGH

---

### Pitfall 12: Ethereum Developer Assumptions on Solana

**What goes wrong:** Developers with Ethereum experience assume similar patterns work. Solana's account model, rent, and parallel execution create different requirements.

**Why it happens:** Surface similarities between Anchor and Solidity mask fundamental differences. Ethereum patterns (reentrancy guards, simple storage) don't map directly.

**Prevention:**
1. Study Solana's account model explicitly (not just Anchor abstractions)
2. Understand: accounts are separate from programs, data stored in accounts, programs are stateless
3. Learn Solana-specific vulnerabilities (CPI, PDA, account validation)
4. Don't assume Anchor handles everything automatically

**Detection:**
- Team's only blockchain experience is Ethereum/EVM
- Code patterns that look like Solidity storage
- No explicit account validation in program logic

**Phase:** Team Onboarding, Smart Contract Development
**Audit flag:** MEDIUM

**Sources:**
- [Dedaub - Ethereum Developers on Solana Common Mistakes](https://dedaub.com/blog/ethereum-developers-on-solana-common-mistakes/)

---

### Pitfall 13: Fee Distribution Complexity at Scale

**What goes wrong:** Calculating fair fee shares for 100k+ agents becomes computationally expensive. On-chain distribution hits transaction size limits. Off-chain calculation creates trust issues.

**Why it happens:** Fee distribution sounds simple (your agents / total agents) but requires maintaining global state, handling edge cases (new agents, deactivated agents), and batching transactions.

**Prevention:**
1. Pre-calculate shares off-chain, distribute hourly (not per-transaction)
2. Use merkle proofs for verifiable off-chain calculations
3. Batch distributions (max ~20 transfers per transaction on Solana)
4. Implement efficient data structures for agent ownership lookup
5. Test with 100k+ agents before launch

**Detection:**
- Distribution logic requires iterating all agents
- No batching strategy documented
- Merkle proofs not implemented
- Tests only use <100 agents

**Phase:** Smart Contract Development, Backend
**Audit flag:** MEDIUM

---

### Pitfall 14: Wallet Integration Edge Cases

**What goes wrong:** Phantom works in testing, but users report issues with Solflare, Backpack, Ledger hardware wallets. Mobile wallet behavior differs. Session management breaks.

**Why it happens:** Testing focuses on primary wallet (Phantom). Each wallet has quirks. Hardware wallets require different transaction signing flow. Mobile apps have different connection patterns.

**Prevention:**
1. Test with Phantom, Solflare, Backpack, and Ledger during development
2. Use wallet-adapter libraries that abstract differences
3. Implement silent re-authentication on session expiry
4. Handle mobile browser restrictions (WalletConnect for mobile)
5. Show clear wallet status and reconnect prompts

**Detection:**
- Only Phantom tested
- No Ledger testing
- No mobile wallet testing
- Users report connection issues with specific wallets

**Phase:** Frontend Development, Wallet Integration
**Audit flag:** LOW

**Sources:**
- [CoinBureau - Solflare vs Phantom 2025](https://coinbureau.com/analysis/solflare-vs-phantom/)
- [Magic Eden - Solana Transaction Errors](https://community.magiceden.io/learn/solana-transaction-errors)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without major refactoring.

---

### Pitfall 15: Hex Coordinate Edge Cases

**What goes wrong:** Coordinate calculations fail at grid boundaries. Neighbor lookups return invalid positions. Hexes at extreme coordinates behave unexpectedly.

**Prevention:**
1. Use cube coordinates (q, r, s where s = -q - r) for mathematical operations
2. Test boundary conditions: -500k to +500k coordinate ranges
3. Validate coordinate constraints in all inputs
4. Use SHA-256(q || r) for deterministic hex IDs to avoid collisions

**Detection:**
- Using offset coordinates without conversion
- No boundary testing
- Coordinate calculations without constraint validation

**Phase:** Backend Development
**Audit flag:** LOW

---

### Pitfall 16: Missing RPC Fallback Strategy

**What goes wrong:** Primary RPC endpoint goes down or rate limits. All transactions fail. Users can't interact with game.

**Prevention:**
1. Configure multiple RPC endpoints (Helius, Triton, QuickNode)
2. Implement automatic failover on 429/5xx errors
3. Monitor RPC health and latency
4. Consider dedicated RPC for critical operations

**Detection:**
- Single RPC endpoint hardcoded
- No error handling for RPC failures
- No RPC health monitoring

**Phase:** Backend Development, Infrastructure
**Audit flag:** LOW

---

### Pitfall 17: Off-chain/On-chain State Desync

**What goes wrong:** Off-chain database shows different state than blockchain. Users see "phantom" agents or missing rewards. Trust erodes.

**Prevention:**
1. Blockchain is source of truth for ownership, not database
2. Implement periodic reconciliation (hourly)
3. Use event indexing (Helius webhooks) for real-time sync
4. Show clear "syncing" states in UI
5. Allow users to trigger manual refresh

**Detection:**
- Database treated as source of truth
- No reconciliation job
- No event indexing
- Users report state discrepancies

**Phase:** Backend Development
**Audit flag:** LOW

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation Priority |
|-------|----------------|---------------------|
| Smart Contract Development | #1 Account Validation, #2 CPI, #4 Integer Overflow | CRITICAL |
| 3D Visualization | #6 Performance Collapse | HIGH |
| Economic Model | #3 Randomness, #5 PumpFun Dependency, #8 Death Spiral | HIGH |
| Wallet Integration | #7 Transaction Failures, #14 Edge Cases | MEDIUM |
| User Flow Design | #9 Onboarding Complexity | MEDIUM |
| Pre-Launch | #10 Skipping Audit | CRITICAL |
| Backend Development | #13 Fee Distribution, #17 State Desync | MEDIUM |

---

## Pre-Mainnet Checklist

Before deploying to mainnet, verify:

- [ ] External security audit completed with all HIGH/CRITICAL remediated
- [ ] All account validations verified (owner, signer, type, relations)
- [ ] CPI targets hardcoded, not user-provided
- [ ] Integer overflow protection on all arithmetic
- [ ] Randomness uses VRF or commit-reveal (not block data)
- [ ] Transaction retry logic with priority fees implemented
- [ ] RPC failover configured
- [ ] 3D performance tested with 500+ visible hexes at 60 FPS
- [ ] Wallet integration tested with Phantom, Solflare, Ledger
- [ ] Treasury buffer of 30+ days of distributions
- [ ] Bug bounty program ready to launch
- [ ] User onboarding tested with Web3 newcomers

---

## Sources Summary

**Smart Contract Security:**
- [Helius Guide to Solana Program Security](https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security)
- [Sec3 Solana Security Ecosystem Review 2025](https://solanasec25.sec3.dev/)
- [Cantina - Securing Solana Developer Guide](https://cantina.xyz/blog/securing-solana-a-developers-guide)
- [Asymmetric Research - CPI Vulnerabilities](https://www.asymmetric.re/blog-archived/invocation-security-navigating-vulnerabilities-in-solana-cpis)

**3D Performance:**
- [Codrops - Building Efficient Three.js Scenes](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)
- [WebGL Fundamentals - Instanced Drawing](https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html)

**User Onboarding:**
- [Magic Link - User Onboarding in Web3](https://magic.link/posts/user-onboarding-web3-challenges-best-practices)
- [Sequence - Simplify Web3 Onboarding](https://sequence.xyz/blog/how-to-simplify-user-onboarding-for-a-web3-app)

**Tokenomics:**
- [MEXC News - Why Most Web3 Game Studios Failed in 2025](https://www.mexc.com/news/337490)

**Transaction Handling:**
- [QuickNode - How to Use Priority Fees](https://www.quicknode.com/guides/solana-development/transactions/how-to-use-priority-fees)
