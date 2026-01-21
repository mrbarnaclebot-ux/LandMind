# Phase 7: Scale & Launch - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

System is production-ready for mainnet launch with performance optimization (1M hexes at 60 FPS), admin dashboard, security audit, and mobile responsive design. This phase prepares the existing features for scale, not adding new user-facing features.

</domain>

<decisions>
## Implementation Decisions

### Admin Dashboard Scope
- **Purpose:** Full control panel — metrics, user management, economy tuning, all controls
- **User management:** View details, suspend/ban users, reset user state, impersonate (view as user)
- **Economy controls:** Adjust fee distribution weights, set minimum claim threshold, manual fee deposits, pause/resume claims
- **Metrics displayed:** Real-time stats (active users, mining agents, resources/min, TPS), financial overview (treasury balance, claims, fee inflows), system health (CPU, memory, Redis, DB, RPC latency), leaderboard insights (top miners, whale detection, fairness metrics)

### Mobile UI Adaptation
- **Touch controls:** Standard mobile gestures — pinch to zoom, two-finger pan, single-finger rotate
- **Panel layout:** Bottom sheets — slide up from bottom, can be partially visible
- **Quality settings:** User-controlled Low/Medium/High quality setting in app
- **Wallet connection:** Both deep link to wallet apps AND in-app browser support (detect context)

### Performance Targets
- **Desktop FPS:** Solid 60 FPS target
- **World scaling:** Both chunking + LOD combined for maximum performance
- **Render distance:** Prioritize seeing far, sacrifice detail at distance (aggressive LOD)
- **Agent rendering at scale:** Cluster markers for distant agents, not individual rendering

### Network Congestion UX
- **Delay feedback:** Toast notifications for retry/status changes
- **Priority fees:** Auto-add when needed (show cost, don't prompt)
- **Retry limit:** 5 retries before failing
- **Degraded network:** Banner warning, but allow transaction attempts

### Claude's Discretion
- Exact chunk size and LOD level thresholds
- Admin dashboard UI/UX details
- Priority fee calculation algorithm
- Mobile breakpoints and responsive behavior
- Security audit vendor selection and process

</decisions>

<specifics>
## Specific Ideas

- Bottom sheets for mobile panels (like many modern mobile apps)
- Cluster markers for distant agents (like map applications showing grouped pins)
- Auto-add priority fees without prompting (reduce friction during congestion)
- Full admin control panel including impersonation for debugging

</specifics>

<deferred>
## Deferred Ideas

- Remaining todos mentioned: "deploy contract to devnet" and "add clouds to environment" — captured in `.planning/todos/pending/`

</deferred>

---

*Phase: 07-scale-launch*
*Context gathered: 2026-01-21*
