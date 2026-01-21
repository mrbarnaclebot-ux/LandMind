/**
 * Umi configuration constants
 * Note: Umi instance is created in useUmi hook with wallet identity
 */

// RPC URL - prefer Helius for DAS API support
export const RPC_URL = import.meta.env.VITE_HELIUS_RPC_URL ||
  import.meta.env.VITE_SOLANA_RPC_URL ||
  'https://api.devnet.solana.com';

// Merkle tree address - set after running createMerkleTree script
export const MERKLE_TREE_ADDRESS = import.meta.env.VITE_MERKLE_TREE_ADDRESS || '';

// LandMind program ID - must match Anchor declare_id!
export const LANDMIND_PROGRAM_ID = 'D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ';

// Agent deployment cost
export const DEPLOY_COST_LAMPORTS = 100_000_000; // 0.1 SOL in lamports
export const DEPLOY_COST_SOL = 0.1;
