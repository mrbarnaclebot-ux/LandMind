/**
 * Merkle tree service for generating claim proofs
 *
 * Uses keccak256 hashing to match the Solana smart contract (solana_program::keccak)
 * Proofs can be verified on-chain via the claim_earnings instruction
 */
import { keccak_256 } from '@noble/hashes/sha3';
import bs58 from 'bs58';

/**
 * User share data for Merkle tree generation
 */
export interface UserShare {
  wallet: string;        // Base58 wallet pubkey
  claimableAmount: bigint;  // Lamports
}

/**
 * Result of Merkle tree generation
 */
export interface MerkleTreeResult {
  root: Uint8Array;
  tree: Map<string, Uint8Array[]>;  // wallet -> proof
  leaves: Uint8Array[];
}

/**
 * Hash a leaf node: keccak256(wallet_pubkey || padded_amount)
 * Matches the smart contract hashing format
 *
 * @param wallet - Base58-encoded wallet public key
 * @param amount - Claimable amount in lamports
 * @returns 32-byte leaf hash
 */
export function hashLeaf(wallet: string, amount: bigint): Uint8Array {
  // Decode wallet from base58 to bytes (32 bytes)
  const walletBytes = bs58.decode(wallet);

  // Create 32-byte buffer for amount (padded, little-endian)
  // Matches: amount_bytes[..8].copy_from_slice(&amount.to_le_bytes())
  const amountBytes = new Uint8Array(32);
  const amountView = new DataView(amountBytes.buffer);
  // Store amount as little-endian u64
  amountView.setBigUint64(0, amount, true);

  // Concatenate wallet and amount, then hash
  const data = new Uint8Array(64);
  data.set(walletBytes, 0);
  data.set(amountBytes, 32);

  return keccak_256(data);
}

/**
 * Generate a Merkle tree from user shares
 *
 * @param shares - Array of user shares (wallet + claimable amount)
 * @returns MerkleTreeResult with root, proof map, and leaves
 */
export function generateMerkleTree(shares: UserShare[]): MerkleTreeResult {
  if (shares.length === 0) {
    // Empty tree has zero root
    return {
      root: new Uint8Array(32),
      tree: new Map(),
      leaves: [],
    };
  }

  // Generate leaves from shares
  const leaves: { hash: Uint8Array; wallet: string }[] = shares.map(share => ({
    hash: hashLeaf(share.wallet, share.claimableAmount),
    wallet: share.wallet,
  }));

  // Sort leaves for deterministic tree (by hash bytes)
  leaves.sort((a, b) => compareBytes(a.hash, b.hash));

  // Build tree bottom-up
  // Keep track of node positions for proof generation
  const levels: Uint8Array[][] = [leaves.map(l => l.hash)];

  // Build levels until we reach the root
  while (levels[levels.length - 1].length > 1) {
    const currentLevel = levels[levels.length - 1];
    const nextLevel: Uint8Array[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      // If odd number of nodes, duplicate the last one
      const right = currentLevel[i + 1] ?? currentLevel[i];

      // Hash pair in sorted order (OpenZeppelin pattern)
      const combined = hashPair(left, right);
      nextLevel.push(combined);
    }

    levels.push(nextLevel);
  }

  const root = levels[levels.length - 1][0];

  // Generate proofs for each leaf
  const tree = new Map<string, Uint8Array[]>();

  for (let i = 0; i < leaves.length; i++) {
    const proof = generateProofFromLevels(i, levels);
    tree.set(leaves[i].wallet, proof);
  }

  return {
    root,
    tree,
    leaves: leaves.map(l => l.hash),
  };
}

/**
 * Generate proof for a specific wallet from a MerkleTreeResult
 *
 * @param wallet - Base58-encoded wallet public key
 * @param amount - Claimable amount (unused, kept for API compatibility)
 * @param treeResult - MerkleTreeResult from generateMerkleTree
 * @returns Proof array or null if wallet not in tree
 */
export function generateProof(
  wallet: string,
  _amount: bigint,
  treeResult: MerkleTreeResult
): Uint8Array[] | null {
  return treeResult.tree.get(wallet) ?? null;
}

/**
 * Verify a Merkle proof locally
 * Uses the same algorithm as the smart contract
 *
 * @param proof - Array of 32-byte proof elements
 * @param root - Expected 32-byte root
 * @param leaf - 32-byte leaf hash
 * @returns True if proof is valid
 */
export function verifyProof(
  proof: Uint8Array[],
  root: Uint8Array,
  leaf: Uint8Array
): boolean {
  let computedHash = leaf;

  for (const proofElement of proof) {
    // Hash in sorted order (OpenZeppelin pattern)
    // Matches: if computed_hash <= *proof_element
    computedHash = hashPair(computedHash, proofElement);
  }

  return compareBytes(computedHash, root) === 0;
}

/**
 * Hash two nodes together in sorted order (OpenZeppelin pattern)
 * This ensures the same result regardless of left/right ordering
 */
function hashPair(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (compareBytes(a, b) <= 0) {
    const combined = new Uint8Array(64);
    combined.set(a, 0);
    combined.set(b, 32);
    return keccak_256(combined);
  } else {
    const combined = new Uint8Array(64);
    combined.set(b, 0);
    combined.set(a, 32);
    return keccak_256(combined);
  }
}

/**
 * Compare two byte arrays lexicographically
 */
function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

/**
 * Generate proof for a leaf at given index from tree levels
 */
function generateProofFromLevels(
  leafIndex: number,
  levels: Uint8Array[][]
): Uint8Array[] {
  const proof: Uint8Array[] = [];
  let currentIndex = leafIndex;

  // Walk up the tree, collecting sibling hashes
  for (let level = 0; level < levels.length - 1; level++) {
    const currentLevel = levels[level];

    // Find sibling index
    const siblingIndex = currentIndex % 2 === 0
      ? currentIndex + 1
      : currentIndex - 1;

    // If sibling exists, add to proof
    if (siblingIndex < currentLevel.length) {
      proof.push(currentLevel[siblingIndex]);
    } else {
      // Odd number of nodes - sibling is same node (duplicated)
      proof.push(currentLevel[currentIndex]);
    }

    // Move to parent index
    currentIndex = Math.floor(currentIndex / 2);
  }

  return proof;
}

/**
 * Convert proof to format expected by smart contract
 *
 * @param proof - Array of Uint8Array proof elements
 * @returns Array of 32-byte arrays as number arrays
 */
export function proofToContractFormat(proof: Uint8Array[]): number[][] {
  return proof.map(p => Array.from(p));
}

/**
 * Utility: Convert root to hex string for display/logging
 */
export function rootToHex(root: Uint8Array): string {
  return Array.from(root)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
