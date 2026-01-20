---
phase: 04-wallet-integration
status: discussed
started: 2026-01-20T14:00:00Z
---

# Phase 4: Wallet Integration - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can securely connect their Solana wallet and authenticate. Includes wallet connection UI, session management via signature verification, balance display, transaction history, and loading/error states.

**Not in scope:** Agent deployment (Phase 5), resource visualization (separate feature).

</domain>

<decisions>
## Implementation Decisions

### Connect UI placement
- Connect button in header/navbar (standard Web3 pattern)
- After connected: shows SOL balance + truncated address
- Clicking connected wallet opens account menu dropdown
  - Shows: balance, copy address, disconnect, view on explorer
- Wallet selection via modal with wallet list (Phantom, Solflare, etc.)

### Session & auth flow
- Sign message on connect to prove wallet ownership
- Session stored in cookie/localStorage
- 24-hour session duration before requiring re-authentication
- Silent re-auth prompt when session expires (modal, no data loss)
- Verify wallet address matches on page refresh
  - If user switched wallets in Phantom, prompt to reconnect

### Balance & tx display
- Detailed balance and transaction history in side panel/drawer
  - Slides out from wallet dropdown, stays in main view
- Transaction history shows LandMind transactions only
  - Agent deployments, claims, etc. - not all wallet activity
- Card per transaction showing:
  - Type (deploy/claim), amount, timestamp, status
  - Link to Solana explorer
- Auto-refresh balance every 30 seconds

### Loading & error states
- Connection in progress: button spinner + "Connecting..." text
- Connection errors: toast notification (non-blocking, auto-dismisses)
- Signature rejection: toast "Signature required to continue", stay disconnected
- Network indicator: "Devnet" badge when not on mainnet, nothing shown on mainnet

### Claude's Discretion
- Exact toast styling and duration
- Side panel width and animation
- Avatar/identicon style for wallet addresses
- Polling interval optimization

</decisions>

<specifics>
## Specific Ideas

- Standard Web3 wallet connection UX - users expect modal with wallet options
- Transaction cards similar to block explorer style
- Balance should feel "live" with auto-refresh

</specifics>

<deferred>
## Deferred Ideas

- Resource visualization per tile — suggested during discussion, belongs in Phase 5 or later
- Resources being mined display — game visualization feature, not wallet integration

</deferred>

---

*Phase: 04-wallet-integration*
*Context gathered: 2026-01-20*
