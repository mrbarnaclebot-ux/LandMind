/**
 * Pure Merkle hashing primitives (no tree/proof state).
 *
 * Matches the pinned on-chain contract scheme:
 *   - Leaf  = keccak256(0x00 || claimer_pubkey_bytes(32) || total_allowance_le_u64(8))
 *   - Inner = keccak256(0x01 || min(a,b) || max(a,b))   (sorted pair, domain prefix 0x01)
 *
 * `total_allowance` is the user's CUMULATIVE lifetime allowance (not per-claim).
 */
import { keccak_256 } from '@noble/hashes/sha3';
import bs58 from 'bs58';

/** Domain separation prefixes (must match on-chain program). */
export const LEAF_PREFIX = 0x00;
export const NODE_PREFIX = 0x01;

/**
 * Hash a leaf: keccak256(0x00 || pubkey(32) || total_allowance_le_u64(8)).
 *
 * @param wallet - Base58-encoded claimer public key (32 bytes when decoded)
 * @param totalAllowance - Cumulative lifetime allowance in lamports (u64)
 * @returns 32-byte leaf hash
 */
export function hashLeaf(wallet: string, totalAllowance: bigint): Uint8Array {
  const walletBytes = bs58.decode(wallet);
  if (walletBytes.length !== 32) {
    throw new Error(`Invalid wallet pubkey length: expected 32, got ${walletBytes.length}`);
  }

  // 1 (prefix) + 32 (pubkey) + 8 (u64 LE allowance)
  const data = new Uint8Array(1 + 32 + 8);
  data[0] = LEAF_PREFIX;
  data.set(walletBytes, 1);

  const view = new DataView(data.buffer);
  view.setBigUint64(1 + 32, totalAllowance, true); // little-endian

  return keccak_256(data);
}

/**
 * Hash an internal node: keccak256(0x01 || min(a,b) || max(a,b)).
 * Sorted-pair ordering means the same result regardless of input order.
 */
export function hashPair(a: Uint8Array, b: Uint8Array): Uint8Array {
  const [lo, hi] = compareBytes(a, b) <= 0 ? [a, b] : [b, a];

  const data = new Uint8Array(1 + 32 + 32);
  data[0] = NODE_PREFIX;
  data.set(lo, 1);
  data.set(hi, 1 + 32);

  return keccak_256(data);
}

/**
 * Compare two byte arrays lexicographically.
 * @returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

/** Convert a 32-byte hash to a hex string for display/logging. */
export function rootToHex(root: Uint8Array): string {
  return Array.from(root)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
