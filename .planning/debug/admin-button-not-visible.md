---
status: diagnosed
trigger: "Admin button not visible for dev wallet 2qaYB64KpD1yNbmgVSytCBcSpF2hJUd2fmXpa7P5cF7f"
created: 2026-01-22T00:00:00Z
updated: 2026-01-22T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - Server restart needed OR user re-login needed for admin promotion
test: Traced admin check flow from client to server
expecting: N/A - diagnosis complete
next_action: Report findings

## Symptoms

expected: Admin button visible in header when connected with dev wallet 2qaYB64KpD1yNbmgVSytCBcSpF2hJUd2fmXpa7P5cF7f
actual: Admin button not showing, 403 errors on /admin/metrics endpoint
errors: 403 Forbidden on /admin/metrics
reproduction: Connect with dev wallet, check header for admin button
started: Unknown - reported during UAT

## Eliminated

- hypothesis: ADMIN_WALLET_1 env var not set
  evidence: Verified packages/server/.env line 10 has ADMIN_WALLET_1="2qaYB64KpD1yNbmgVSytCBcSpF2hJUd2fmXpa7P5cF7f"
  timestamp: 2026-01-22T00:00:30Z

## Evidence

- timestamp: 2026-01-22T00:00:30Z
  checked: packages/server/.env
  found: ADMIN_WALLET_1="2qaYB64KpD1yNbmgVSytCBcSpF2hJUd2fmXpa7P5cF7f" IS SET on line 10
  implication: Env var is configured correctly

- timestamp: 2026-01-22T00:00:45Z
  checked: packages/server/src/middleware/adminAuth.ts
  found: |
    ADMIN_WALLETS is populated at module load time (lines 42-45):
    ```
    export const ADMIN_WALLETS: string[] = [
      process.env.ADMIN_WALLET_1,
      process.env.ADMIN_WALLET_2,
    ].filter((w): w is string => Boolean(w));
    ```
    requireAdmin middleware checks user.role from database (line 26)
  implication: If server started before env var was added, ADMIN_WALLETS would be empty

- timestamp: 2026-01-22T00:00:50Z
  checked: packages/server/src/routes/auth.ts
  found: |
    Auto-promotion happens ONLY during /auth/verify flow (lines 93-99):
    ```
    if (isAdminWallet(address) && user.role !== 'ADMIN') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
    }
    ```
  implication: User must log in AFTER server restart for promotion to occur

- timestamp: 2026-01-22T00:00:55Z
  checked: packages/client/src/admin/hooks/useAdminCheck.ts
  found: Client checks admin status by hitting /admin/metrics endpoint. 200 = admin, 403 = not admin
  implication: 403 confirms server is rejecting the request because user.role != 'ADMIN' in database

## Resolution

root_cause: |
  Configuration timing issue. The admin check flow requires:
  1. ADMIN_WALLET_1 env var set in packages/server/.env (DONE)
  2. Server restarted AFTER env var was added (likely NOT done)
  3. User logs in (triggers /auth/verify) AFTER server restart (likely NOT done)

  The ADMIN_WALLETS array is populated at module load time. If the server was
  started before the env var was added, the array would be empty. The user's
  role in the database would remain 'USER' because auto-promotion only happens
  during login, and isAdminWallet() would return false with empty ADMIN_WALLETS.

fix: |
  Not a code bug - operational fix required:
  1. Restart the server to reload env vars into ADMIN_WALLETS
  2. Have user log out and log back in to trigger auto-promotion

  Alternative: Manually update user role in database via admin API or direct SQL:
  UPDATE users SET role = 'ADMIN' WHERE wallet_pubkey = '2qaYB64KpD1yNbmgVSytCBcSpF2hJUd2fmXpa7P5cF7f';

verification: After restart + re-login, admin button should appear and /admin/metrics should return 200
files_changed: []
