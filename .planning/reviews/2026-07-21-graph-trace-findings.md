# LandMind Graph Trace Findings — 2026-07-21

Traces of all 7 suggested questions from GRAPH_REPORT.md, each verified against source by Opus tracer agents. Companion to `2026-07-21-visual-and-logic-review.md`.

## Verdicts per question

| Q | Question | Verdict |
|---|---|---|
| 1 | `buffer` bridge (betweenness 0.145) | ~90% graph artifact (npm `buffer` package node collapsed with every `Buffer` global usage incl. server files). One real risk underneath: client polyfill fragility. |
| 2 | `getTreasuryBalance()` bridge (0.107) | 100% artifact — sole cross-community edge is the same `buffer` node (`Buffer.from('treasury')`). Real risk found nearby: PDA seed strings duplicated across 3 server files. |
| 3 | `useAgentDeploy()` bridge (0.099) | Borderline god-hook — primitives are well extracted (priorityFees, transactionRetry, agents API) but one 155-line callback owns tx assembly + retry + toast lifecycle + store mutation, imported by 2 UI shells. |
| 4 | 341 (now 548) weakly-connected nodes | ~90% inert (config keys, planning docs, screenshots). Core signal: 6 confirmed unwired integrations + ~5 dead exports. |
| 5 | Split "Server Core Utilities"? | Cohesion 0.05 is a size-normalized density artifact (real intra-edge ratio 0.81). Genuine smells: `merkleService.ts` (12 exports) and `earningsService.ts` mix concerns. |
| 6 | Split "App Shell & Header UI"? | Real smell: `App.tsx` is a 286-line mini-monolith holding Header (L29-131), ControlsOverlay (L133-208), and App wiring hub (12 imports, 8 feature areas). |
| 7 | Split "Real-Time Socket Simulation"? | Pure artifact — community is 100% `.planning/` docs (0 code nodes, 0 inter-edges). No action. |

## Confirmed integration gaps (designed-but-unwired)

- **C1 [HIGH]** `app.set('io', io)` never called (server index.ts:32) → route emits `agent:placed` (agents.ts:238,267), `claim:success` (earnings.ts:276), `claim:error` (earnings.ts:303) all silently no-op. Fix: one line, or refactor routes to `getIO()` like tickLoop.ts:53.
- **C2 [HIGH]** `earnings:update` declared (server events/types.ts:60) and client-subscribed (useEarnings.ts:182) but never emitted. Fix: emit per-user in tickLoop.ts alongside `mining:update` (~L80).
- **C3 [MED]** `updateUserEarningsSnapshot()` (earningsService.ts:188) superseded by divergent inline logic in persistence.ts:136-157. Consolidate or delete.
- **C4 [MED]** `calculateMissedTicks()` (persistence.ts:167) — crash-recovery designed, never built. Wire into startTickLoop() or delete.
- **C5 [MED]** on-chain `Config.total_agents` (state.rs:22) never initialized/read; `agent_index` derived from treasury lamports instead (lib.rs:49) — broken after claims. Add Config PDA counter or delete struct.
- **C6 [LOW]** `ClaimExceedsAllowance` (errors.rs:27) never raised — the allowance guard it was written for is absent from claim_earnings.

False positives from earlier review: `getUserPercentile` IS wired (leaderboard.ts:47); `verify_proof` IS called (lib.rs:127) — graph degree artifacts.

## Dead code candidates (zero callers via grep)
`getUserContext()` (leaderboardService.ts:141), `updateUserEarningsSnapshot()`, `calculateMissedTicks()`, `Config` struct, `ClaimExceedsAllowance`, empty `migrations/deploy.ts` body.

## Unbuilt promises (docs vs reality)
- PRD promises a three-program architecture (Land Registry / Agent Factory / Rewards Vault); implementation is one `landmind` program. Legit design change, but PRD/README still describe the unbuilt split — update docs.
- Crash-recovery tick catch-up (C4) and real-time earnings channel (C2) promised, never delivered.

## New solutions from tracing (beyond the main review)

1. **[S]** Harden Buffer polyfill: add `vite-plugin-node-polyfills` (or `define: { global: 'globalThis' }`) to packages/client/vite.config.ts — currently the manual `window.Buffer` shim in main.tsx:1-3 is the sole mechanism; chunk reordering/workers can break prod.
2. **[S]** Extract shared PDA seed constants (`TREASURY_SEED='treasury'`, `VAULT_STATE_SEED='vault_state'`) — duplicated across metricsService.ts:134, initVault.ts:93, feeMonitor.ts; must match lib.rs seeds; getTreasuryBalance fails silently (catch → 0) on drift.
3. **[M]** Refactor useAgentDeploy: extract generic `useSendAndConfirm` (L81-131 retry/fee-escalation loop) reusable for claim/relocate; move toasts to an effect-driven `useDeployToast(status)`; move Agent-object assembly to lib/agents.ts.
4. **[M]** Split App.tsx into components/layout/Header.tsx + ControlsOverlay.tsx; App.tsx becomes pure composition.
5. **[S/M]** Split merkleService.ts (pure crypto / tree+proof gen / contract-format adapters) and earningsService.ts (pure scoring fns / DB persistence).
6. **[S]** Wire C1 + C2 (the two one-liner-ish real-time gaps) — biggest UX payoff per effort; do AFTER fixing socket auth (H-1/CR-7 from main review) so unauthenticated rooms don't leak claim data.
7. **[S]** Delete dead code list above; update PRD/README to single-program reality.
