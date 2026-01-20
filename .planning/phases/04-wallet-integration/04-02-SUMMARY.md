---
phase: 04-wallet-integration
plan: 02
subsystem: auth
tags: [solana, jwt, siws, ed25519, tweetnacl, jose, express, cookies]

# Dependency graph
requires:
  - phase: 03-real-time-simulation
    provides: Server foundation with Redis and PostgreSQL
  - phase: 01-foundation
    provides: Prisma User model with walletPubkey field
provides:
  - Server-side wallet authentication endpoints
  - SIWS (Sign In With Solana) nonce generation
  - Ed25519 signature verification
  - JWT session management with httpOnly cookies
  - Auth middleware for protected routes
affects: [04-03-client-auth-flow, 05-solana-contracts]

# Tech tracking
tech-stack:
  added: [@solana/web3.js, tweetnacl, bs58, jose, cookie-parser]
  patterns: [SIWS authentication flow, JWT in httpOnly cookies]

key-files:
  created:
    - packages/server/src/lib/solana.ts
    - packages/server/src/middleware/authMiddleware.ts
    - packages/server/src/routes/auth.ts
  modified:
    - packages/server/package.json
    - packages/server/src/index.ts

key-decisions:
  - "tweetnacl for Ed25519 verification (battle-tested, used by Solana internally)"
  - "jose for JWT (modern ESM-native, Edge-compatible)"
  - "httpOnly cookies for session (XSS protection)"
  - "SIWS message format for standardized signing"
  - "5-minute nonce TTL for reasonable auth window"
  - "24-hour JWT expiry for session duration"

patterns-established:
  - "Nonce storage: Redis with TTL using key pattern nonce:{address}"
  - "Auth flow: /nonce -> sign -> /verify -> JWT cookie"
  - "Token location: cookies.session or Authorization: Bearer"

# Metrics
duration: 8min
completed: 2026-01-20
---

# Phase 04 Plan 02: Server Auth Endpoints Summary

**SIWS authentication with Redis nonce storage, tweetnacl Ed25519 verification, and JWT sessions in httpOnly cookies**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-20T12:21:00Z
- **Completed:** 2026-01-20T12:29:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Nonce generation endpoint with 5-minute TTL in Redis
- Ed25519 signature verification using tweetnacl
- JWT session issuance with 24-hour expiry in httpOnly cookie
- Session check and logout endpoints
- CORS configured with credentials support for cookies

## Task Commits

Each task was committed atomically:

1. **Task 1: Install auth packages** - `9d2d708` (chore)
2. **Task 2: Create auth routes and middleware** - `726b42f` (feat)
3. **Task 3: Register auth routes and enable cookies** - `e0b197f` (feat)

## Files Created/Modified

- `packages/server/src/lib/solana.ts` - Ed25519 signature verification using tweetnacl
- `packages/server/src/middleware/authMiddleware.ts` - JWT verification middleware with AuthenticatedRequest type
- `packages/server/src/routes/auth.ts` - /nonce, /verify, /logout, /session endpoints
- `packages/server/package.json` - Added @solana/web3.js, tweetnacl, bs58, jose, cookie-parser
- `packages/server/src/index.ts` - Added cookieParser, authRouter, CORS credentials

## Decisions Made

- **tweetnacl for Ed25519:** Battle-tested library used by Solana internally for signature verification
- **jose for JWT:** Modern ESM-native library that's Edge-compatible (unlike jsonwebtoken)
- **httpOnly cookies:** Session tokens stored in httpOnly cookies for XSS protection
- **SIWS message format:** Using Sign In With Solana standard format for wallet signing
- **5-minute nonce TTL:** Provides reasonable window for signing while preventing stale nonces
- **24-hour JWT expiry:** Balance between security and user convenience

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all dependencies installed successfully and TypeScript compiled without errors.

## User Setup Required

Users should set the following environment variables in production:

```bash
JWT_SECRET=<strong-random-secret>
CORS_ORIGIN=https://your-production-domain.com
```

The dev defaults (`dev-jwt-secret-change-in-production` and `http://localhost:5173`) work for local development.

## Next Phase Readiness

- Server auth endpoints ready for client integration
- Client needs to implement wallet connection and signing flow (04-03)
- Auth middleware available for protecting future endpoints

---
*Phase: 04-wallet-integration*
*Completed: 2026-01-20*
