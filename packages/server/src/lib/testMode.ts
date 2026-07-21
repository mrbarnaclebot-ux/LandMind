/**
 * Fake-SOL test mode gating.
 *
 * When FAKE_SOL_MODE === 'true' the server exposes a set of test-only endpoints
 * that let agents be deployed and mined WITHOUT real SOL, a wallet extension, or
 * the (undeployed) on-chain program.
 *
 * SECURITY: Every test-only code path MUST be gated behind isFakeSolMode().
 * When the flag is off, those routes return 404 and the real, on-chain-verified
 * production paths are the only ones reachable. This must never weaken the
 * hardened /api/agents/confirm on-chain payment verification in production.
 */

import crypto from 'crypto';

/** True only when the FAKE_SOL_MODE env flag is explicitly set to 'true'. */
export function isFakeSolMode(): boolean {
  return process.env.FAKE_SOL_MODE === 'true';
}

/** Prefix that marks a fake (non-on-chain) deploy transaction signature. */
export const FAKE_SIG_PREFIX = 'FAKE-';

/** Prefix that marks a fake (non-cNFT) minted asset id. */
export const FAKE_ASSET_PREFIX = 'FAKE-ASSET-';

/** True when a signature was produced by the fake deploy path. */
export function isFakeSignature(sig: unknown): sig is string {
  return typeof sig === 'string' && sig.startsWith(FAKE_SIG_PREFIX);
}

/**
 * Base58 alphabet (Bitcoin/Solana ordering) for generating wallet-like ids.
 */
const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Encode a byte buffer as a base58 string (no external dependency). */
function base58Encode(bytes: Buffer): string {
  // Standard base58 big-integer encoding.
  let num = 0n;
  for (const b of bytes) {
    num = num * 256n + BigInt(b);
  }
  let out = '';
  while (num > 0n) {
    const rem = Number(num % 58n);
    num = num / 58n;
    out = BASE58_ALPHABET[rem] + out;
  }
  // Preserve leading zero bytes as leading '1's.
  for (const b of bytes) {
    if (b === 0) out = '1' + out;
    else break;
  }
  return out;
}

/**
 * Generate a deterministic-per-call fake wallet address. Format: 'TEST' + base58
 * of 28 random bytes. Stored in the users table like a normal wallet pubkey so
 * every downstream (sockets, rooms, leaderboard) treats it as a real wallet.
 */
export function generateTestWallet(): string {
  return 'TEST' + base58Encode(crypto.randomBytes(28));
}

/**
 * Loud, multi-line startup warning printed when fake-SOL mode is enabled.
 */
export function logFakeSolModeWarning(): void {
  if (!isFakeSolMode()) return;
  const line = '='.repeat(72);
  console.warn(
    '\n' +
      line +
      '\n' +
      '  ⚠  TEST MODE ENABLED — FAKE SOL DEPLOYMENTS ARE ACTIVE  ⚠\n' +
      '\n' +
      '  FAKE_SOL_MODE=true. Agents can be deployed and mined WITHOUT real SOL,\n' +
      '  a wallet extension, or the on-chain program. On-chain payment\n' +
      '  verification is BYPASSED for signatures starting with "' +
      FAKE_SIG_PREFIX +
      '".\n' +
      '\n' +
      '  DO NOT run this configuration with real funds or production data.\n' +
      line +
      '\n'
  );
}
