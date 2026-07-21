/**
 * Merkle tree service for generating claim proofs.
 *
 * Pure hashing lives in `../lib/merkleCrypto.ts` and is re-exported here so
 * existing importers keep working. This module owns tree construction, proof
 * generation, the contract wire format, and an in-memory tree cache.
 *
 * Scheme (pinned contract):
 *   - Leaf  = keccak256(0x00 || pubkey(32) || total_allowance_le_u64(8))
 *   - Inner = keccak256(0x01 || min(a,b) || max(a,b))
 *   where total_allowance is the user's CUMULATIVE lifetime allowance.
 */
import {
  hashLeaf,
  hashPair,
  compareBytes,
  rootToHex,
  LEAF_PREFIX,
  NODE_PREFIX,
} from '../lib/merkleCrypto.js';

// Re-export pure crypto so existing imports from merkleService keep working.
export { hashLeaf, hashPair, compareBytes, rootToHex, LEAF_PREFIX, NODE_PREFIX };

/**
 * User share data for Merkle tree generation.
 *
 * `totalAllowance` is the user's CUMULATIVE lifetime allowance (lamports) — the
 * value the on-chain leaf commits to. On-chain payout = total_allowance -
 * claimed_total, so this is NOT the per-claim amount.
 */
export interface UserShare {
  wallet: string; // Base58 wallet pubkey
  totalAllowance: bigint; // Cumulative lifetime allowance in lamports
}

/**
 * Result of Merkle tree generation.
 */
export interface MerkleTreeResult {
  root: Uint8Array;
  tree: Map<string, Uint8Array[]>; // wallet -> proof
  leaves: Uint8Array[];
  // wallet -> allowance used to build that wallet's leaf (for verification)
  allowances: Map<string, bigint>;
}

/**
 * Generate a Merkle tree from user shares (cumulative allowances).
 */
export function generateMerkleTree(shares: UserShare[]): MerkleTreeResult {
  if (shares.length === 0) {
    return {
      root: new Uint8Array(32),
      tree: new Map(),
      leaves: [],
      allowances: new Map(),
    };
  }

  // Generate leaves from shares
  const leaves: { hash: Uint8Array; wallet: string; allowance: bigint }[] = shares.map(
    (share) => ({
      hash: hashLeaf(share.wallet, share.totalAllowance),
      wallet: share.wallet,
      allowance: share.totalAllowance,
    })
  );

  // Sort leaves for a deterministic tree (by hash bytes)
  leaves.sort((a, b) => compareBytes(a.hash, b.hash));

  // Build tree bottom-up
  const levels: Uint8Array[][] = [leaves.map((l) => l.hash)];

  while (levels[levels.length - 1].length > 1) {
    const currentLevel = levels[levels.length - 1];
    const nextLevel: Uint8Array[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      // If odd number of nodes, duplicate the last one
      const right = currentLevel[i + 1] ?? currentLevel[i];
      nextLevel.push(hashPair(left, right));
    }

    levels.push(nextLevel);
  }

  const root = levels[levels.length - 1][0];

  // Generate proofs and record allowances for each leaf
  const tree = new Map<string, Uint8Array[]>();
  const allowances = new Map<string, bigint>();

  for (let i = 0; i < leaves.length; i++) {
    tree.set(leaves[i].wallet, generateProofFromLevels(i, levels));
    allowances.set(leaves[i].wallet, leaves[i].allowance);
  }

  return {
    root,
    tree,
    leaves: leaves.map((l) => l.hash),
    allowances,
  };
}

/**
 * Get the proof for a specific wallet from a MerkleTreeResult.
 *
 * @param wallet - Base58-encoded wallet public key
 * @param treeResult - MerkleTreeResult from generateMerkleTree
 * @returns Proof array or null if wallet not in tree
 */
export function generateProof(
  wallet: string,
  treeResult: MerkleTreeResult
): Uint8Array[] | null {
  return treeResult.tree.get(wallet) ?? null;
}

/**
 * Verify a Merkle proof locally, using the same algorithm as the contract.
 */
export function verifyProof(
  proof: Uint8Array[],
  root: Uint8Array,
  leaf: Uint8Array
): boolean {
  let computedHash = leaf;
  for (const proofElement of proof) {
    computedHash = hashPair(computedHash, proofElement);
  }
  return compareBytes(computedHash, root) === 0;
}

/**
 * Generate proof for a leaf at given index from tree levels.
 */
function generateProofFromLevels(
  leafIndex: number,
  levels: Uint8Array[][]
): Uint8Array[] {
  const proof: Uint8Array[] = [];
  let currentIndex = leafIndex;

  for (let level = 0; level < levels.length - 1; level++) {
    const currentLevel = levels[level];
    const siblingIndex =
      currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;

    if (siblingIndex < currentLevel.length) {
      proof.push(currentLevel[siblingIndex]);
    } else {
      // Odd number of nodes - sibling is same node (duplicated)
      proof.push(currentLevel[currentIndex]);
    }

    currentIndex = Math.floor(currentIndex / 2);
  }

  return proof;
}

/**
 * Convert a proof to the format expected by the smart contract instruction
 * (Vec<[u8; 32]>): an array of 32-length number arrays.
 */
export function proofToContractFormat(proof: Uint8Array[]): number[][] {
  return proof.map((p) => Array.from(p));
}

// ---------------------------------------------------------------------------
// In-memory tree cache
//
// The tree only changes when snapshot data changes (i.e. on flush or an
// explicit merkle-root update). Rebuilding it on every claim request is
// wasteful, so callers can cache the built tree keyed by an opaque version and
// invalidate it via invalidateMerkleTreeCache().
// ---------------------------------------------------------------------------

let cachedTree: MerkleTreeResult | null = null;

/**
 * Build (or return a cached) Merkle tree from the provided shares.
 *
 * The cache is invalidated explicitly via invalidateMerkleTreeCache(), which
 * should be called whenever the underlying snapshot data changes (flush /
 * updateMerkleRoot). Pass `forceRebuild` to bypass the cache.
 */
export function getOrBuildMerkleTree(
  shares: UserShare[],
  forceRebuild = false
): MerkleTreeResult {
  if (!forceRebuild && cachedTree) {
    return cachedTree;
  }
  cachedTree = generateMerkleTree(shares);
  return cachedTree;
}

/** Invalidate the cached Merkle tree (call on flush / updateMerkleRoot). */
export function invalidateMerkleTreeCache(): void {
  cachedTree = null;
}
