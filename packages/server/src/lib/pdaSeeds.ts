/**
 * PDA seed constants for the LandMind Anchor program.
 *
 * Centralized here so every PDA derivation across the server uses the exact
 * same byte seeds. Keep these in sync with the on-chain program's `seeds = [...]`.
 */

// seeds = [b"treasury"]
export const TREASURY_SEED = 'treasury';

// seeds = [b"vault_state"]
export const VAULT_STATE_SEED = 'vault_state';

// seeds = [b"claim", claimer]
export const CLAIM_SEED = 'claim';
