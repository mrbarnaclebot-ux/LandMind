/**
 * Single source of truth for the LandMind Anchor program ID.
 *
 * Reads PROGRAM_ID from the environment and falls back to the known devnet
 * deployment. Every server module that needs the program ID (PDA derivation,
 * on-chain tx verification) should import from here.
 */
import { PublicKey } from '@solana/web3.js';

const DEFAULT_PROGRAM_ID = 'D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ';

export const LANDMIND_PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || DEFAULT_PROGRAM_ID
);
