# Feature Landscape: LandMind

**Domain:** Web3 Mining/Idle Game on Solana (3D Hexagonal World)
**Researched:** 2026-01-19
**Confidence:** MEDIUM (WebSearch verified with multiple sources, PumpFun mechanics verified)

---

## Table Stakes

Features users expect. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Wallet Connection** | Entry point to Web3; users expect Phantom/Solflare support | Low | None | 71% of blockchain gamers cite asset ownership as key benefit |
| **Real-Time Balance Display** | Users need to see SOL balance and earnings at a glance | Low | Wallet connection | Must update on every transaction |
| **Transaction History** | Trust requires transparency; users verify on-chain activity | Medium | Wallet connection, backend indexing | Show deposits, claims, fee distributions |
| **Earnings Dashboard** | Core value prop; users track passive income performance | Medium | Backend aggregation, resource tracking | Show cumulative resources, projected earnings, historical data |
| **Claim/Withdraw Function** | Users must be able to claim earned rewards | Medium | Smart contract, wallet | Clear fees shown before confirmation; instant feedback |
| **Agent Deployment Flow** | Core mechanic (0.1 SOL per agent) | Medium | Smart contract, 3D world | Simple: pay -> agent appears -> starts mining |
| **Mobile-Responsive Design** | 53% of Web3 gaming happens on mobile | Medium | Frontend architecture | Not mobile-first, but must work on mobile browsers |
| **Loading States & Feedback** | Blockchain transactions are slow; users need reassurance | Low | Frontend | Spinners, progress indicators, success/error states |
| **Basic Security (2FA Optional)** | Users handling real money expect security measures | Medium | Auth system | At minimum: wallet signature verification |

### Why These Are Table Stakes

Research shows that poor UX and complex interfaces are the #1 barrier to Web3 adoption (53% of survey respondents). Players notice when:
- Balances update immediately after transactions
- Small rewards can be claimed without extra steps
- The experience works without crypto expertise

**Anti-pattern to avoid:** Games that require users to "learn new jargon, switch networks, or sign several confusing transactions just to play a quick round" see users "quietly drift back to Web2 options."

---

## Differentiators

Features that set LandMind apart. Not expected, but highly valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **3D Hex World Visualization** | Visual engagement; makes mining tangible and watchable | High | Three.js/WebGL, real-time sync | Unique in idle mining space; most competitors are 2D or text-based |
| **Live Agent Movement** | Agents visually relocate when hexes deplete; creates dynamic world | High | 3D engine, game state sync | Differentiator: most idle games are static dashboards |
| **Resource Scarcity Map** | Heat map showing resource concentration; strategic interest | Medium | Backend analytics, 3D overlay | Adds strategy layer to passive game |
| **PumpFun Fee Integration** | 50% fee distribution tied to mining output | High | PumpFun API, smart contracts | Core monetization; unique value prop |
| **Referral Program** | 15-20% commission on referrals' agent purchases | Medium | Smart contract, tracking | Industry standard is 15-30%; drives viral growth |
| **Leaderboard System** | Competitive rankings by total resources mined | Medium | Backend aggregation | Weekly/monthly resets; top performers get bonus rewards |
| **Offline Progression** | Resources accumulate while user is away | Low | Backend calculation | Standard for idle games but must communicate clearly |
| **Achievement/Badge System** | NFT badges for milestones (first agent, 1000 gold mined, etc.) | Medium | NFT minting, tracking | Badges as NFTs add collectibility; can gate future features |
| **Social Sharing** | One-click share earnings to Twitter/Discord | Low | Frontend, API integrations | Drives organic marketing; shows off earnings |
| **Agent Naming/Customization** | Personalize agents with names or minor visual tweaks | Low | Database, 3D assets | Emotional attachment increases retention |

### Differentiator Analysis

**3D Visualization is the Key Differentiator**

Most Solana idle/mining games (GNME Mining, GoMining, etc.) use:
- Telegram bots with text interfaces
- Simple 2D dashboards
- Static progress bars

LandMind's 3D hex world with animated agents provides:
- Visual proof of "something happening"
- Shareable/streamable content
- Emotional attachment to agents
- Strategic depth via spatial relationships

**Referral Economics**

Industry benchmarks from research:
- GNME Mining: 15% of referrals' SOL spending
- Blum: 20% L1, 2.5% L2 (two-tier)
- Gate Web3: 30% on various products

Recommendation: Start with single-tier 15-20%, expand to two-tier later if growth warrants complexity.

---

## Anti-Features

Features to deliberately NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Complex Tokenomics** | Axie Infinity's dual-token model crashed 95% in < 1 year; excessive minting without sinks killed economy | Use existing token (PumpFun) for rewards; no custom game token |
| **Pay-to-Win Mechanics** | Players leave games designed for investors, not players; erodes trust | All agents mine equally; no "premium" agents that mine faster |
| **Mandatory NFT Ownership** | High barrier to entry; excludes casual players | Agents are not tradeable NFTs (system-owned); entry is 0.1 SOL flat |
| **Prestige/Reset Systems** | Standard in idle games but creates anxiety about "losing progress" in real-money context | Linear progression only; never reset user's mining output |
| **Complex Upgrade Trees** | Overwhelms casual players; creates analysis paralysis | Single agent type, single mining rate; simplicity is feature |
| **Land Ownership NFTs** | Creates speculation, whales buying all land, new users priced out | Hexes are system-owned; no user land ownership |
| **Governance Token** | Adds complexity without value; most DAOs have < 5% participation | No governance; team makes decisions transparently |
| **Multi-Chain Support** | Dilutes focus; increases complexity and bugs | Solana only; optimize for one chain |
| **Breeding/Crafting** | Axie-style breeding created hyperinflation and ponzi dynamics | Agents don't breed; fixed population based on user deployment |
| **Energy/Stamina Systems** | Friction mechanics feel exploitative in earning context | Agents mine 24/7; no artificial limits |
| **Loot Boxes/Gacha** | Regulatory risk; perceived as gambling; erodes trust | No randomness in agent performance or rewards |
| **Social Login Requirement** | Reduces privacy; adds friction for crypto natives | Wallet-only authentication |

### Anti-Pattern Deep Dive

**The Axie Infinity Lesson**

Axie peaked at 2.7M daily users, then lost 45% in months. Root causes:
1. Shallow gameplay (breeding NFTs is not fun)
2. Rushed tokenomics ($SLP minting with no sinks)
3. Designed for investors, not players

LandMind avoids this by:
- Tying rewards to existing PumpFun token (no custom token to crash)
- Simple, watchable gameplay (agents mining in 3D world)
- No breeding, no speculation on agents

**"Blockchain Second" Philosophy**

2025's successful Web3 games hide blockchain complexity:
- Telegram-native games (no wallet connection friction)
- "Invisible" wallets embedded in game
- Gasless transactions where possible

LandMind recommendation: Wallet connection required (unavoidable for SOL deposit), but minimize transactions after initial agent deployment. Batch operations where possible.

---

## Feature Dependencies

```
Wallet Connection
    |
    +-- Real-Time Balance Display
    |
    +-- Transaction History
    |
    +-- Agent Deployment Flow
            |
            +-- 3D World Visualization
            |       |
            |       +-- Live Agent Movement
            |       |
            |       +-- Resource Scarcity Map
            |
            +-- Earnings Dashboard
            |       |
            |       +-- Leaderboard System
            |       |
            |       +-- Social Sharing
            |
            +-- Claim/Withdraw Function
                    |
                    +-- PumpFun Fee Integration

Referral Program (independent, can launch early)

Achievement System (depends on tracking, can launch later)
```

**Critical Path:** Wallet -> Agent Deployment -> 3D Visualization -> Earnings -> Claims

---

## MVP Recommendation

### Must Have for Launch (Table Stakes)

1. **Wallet Connection** (Phantom, Solflare)
2. **Agent Deployment** (0.1 SOL -> agent appears)
3. **3D Hex World** (agents visible, mining animated)
4. **Earnings Dashboard** (resources mined, projected income)
5. **Claim Function** (withdraw SOL from PumpFun fees)
6. **Transaction History** (basic list of user's on-chain activity)
7. **Mobile-Responsive** (must work on phone browsers)

### Should Have for Launch (Key Differentiators)

1. **Live Agent Movement** (relocation when hex depletes)
2. **Referral Program** (15% of referrals' deposits)
3. **Leaderboard** (top miners by resources)

### Defer to Post-MVP

- **Achievement/Badge System** - Nice engagement but not core
- **Resource Scarcity Map** - Adds complexity; most users won't strategize
- **Agent Customization** - Polish feature, not core
- **Social Sharing** - Low effort but not launch-critical
- **Advanced Analytics** - Historical charts, projections can come later

### Explicitly Never Build

- Custom game token
- Agent breeding/trading
- Land ownership NFTs
- Governance DAO
- Prestige/reset mechanics

---

## Competitive Landscape

### Direct Competitors (Solana Mining/Idle)

| Game | Model | Differentiator | Weakness |
|------|-------|----------------|----------|
| **GNME Mining** | Telegram bot, 0.1 SOL = 100 hash power | Simple, accessible | Text-only, no visualization |
| **GoMining (Miner Wars)** | Real BTC mining infrastructure backing | Real asset backing | Complex, high entry cost |

### Indirect Competitors (Web3 Idle/Mining)

| Game | Chain | Model | Notes |
|------|-------|-------|-------|
| **Alien Worlds** | WAX/BNB | Mine TLM, DAO governance | High activity but complex |
| **RollerCoin** | Multi | Browser mining sim | Game of Year 2025; fun-first |
| **Hamster Kombat** | Telegram | Tap-to-earn | 200M+ users but shallow |

### LandMind's Position

Unique combination:
1. **Visual engagement** (3D world vs text bots)
2. **Real yield** (PumpFun fees vs inflationary tokens)
3. **Low barrier** (0.1 SOL vs high NFT costs)
4. **Simplicity** (no tokens, no breeding, no governance)

---

## Sources

### High Confidence (Official/Context7)
- [Pump.fun Fee Documentation](https://pump.fun/docs/fees) - Verified 1% swap fee, 50% creator share mechanics

### Medium Confidence (Multiple Sources Agree)
- [DappRadar State of Blockchain Gaming Q2 2025](https://dappradar.com/blog/state-of-blockchain-gaming-in-q2-2025) - 4.66M daily active wallets
- [ChainPlay Web3 Gaming 2025](https://chainplay.gg/blog/from-play-to-earn-to-play-because-its-fun-what-2025-taught-web3-gaming/) - Fun-first design retention data
- [Alchemy Web3 Games on Solana](https://www.alchemy.com/dapps/list-of/web3-games-on-solana) - Competitor landscape
- [Web3 Referral Best Practices](https://www.metacrm.inc/blog/how-web3-referral-works-common-program-models-use-cases) - Commission structure benchmarks
- [MEXC: Why Web3 Game Studios Failed](https://www.mexc.com/en-GB/news/337490) - Tokenomics anti-patterns
- [CoinMarketCap: Web3 Game Tokenomics](https://coinmarketcap.com/academy/article/web3-game-tokenomics-extrapolating-the-future-from-the-past) - Axie Infinity case study
- [Machinations: How to Design Idle Games](https://machinations.io/articles/idle-games-and-how-to-design-them) - Core loop design

### Low Confidence (Single Source, Needs Validation)
- [CCN: GoMining Strategy](https://www.ccn.com/news/crypto/gomining-bitcoin-game-miner-wars/) - 165K active players claim
- [Three.js Game Development 2025](https://playgama.com/blog/general/master-browser-based-game-development-with-three-js/) - Performance recommendations
