use anchor_lang::prelude::*;

#[error_code]
pub enum LandMindError {
    // Authorization errors (6000-6009)
    #[msg("Unauthorized: Admin signature required")]
    Unauthorized,
    #[msg("Invalid signer")]
    InvalidSigner,

    // Vault errors (6010-6019)
    #[msg("Vault is currently paused")]
    VaultPaused,
    #[msg("Vault is not paused")]
    VaultNotPaused,
    #[msg("Invalid Merkle proof")]
    InvalidProof,
    #[msg("Merkle root is empty")]
    EmptyMerkleRoot,

    // Claim errors (6020-6029)
    #[msg("Claim amount below minimum (0.025 SOL)")]
    BelowMinimumClaim,
    #[msg("Insufficient treasury balance")]
    InsufficientTreasuryBalance,
    #[msg("Claim amount exceeds allowance")]
    ClaimExceedsAllowance,

    // Arithmetic errors (6030-6039)
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Arithmetic underflow")]
    Underflow,

    // Deploy errors (6040-6049)
    #[msg("Insufficient payment for agent deployment")]
    InsufficientDeployPayment,

    // PDA errors (6050-6059)
    #[msg("Invalid PDA derivation")]
    InvalidPDA,
    #[msg("Bump mismatch")]
    BumpMismatch,
}
