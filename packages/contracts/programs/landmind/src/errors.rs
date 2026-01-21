use anchor_lang::prelude::*;

#[error_code]
pub enum LandMindError {
    #[msg("Insufficient payment: 0.1 SOL required for agent deployment")]
    InsufficientPayment,

    #[msg("Invalid treasury: the provided treasury account does not match the expected PDA")]
    InvalidTreasury,

    #[msg("Unauthorized: only the authority can perform this action")]
    Unauthorized,

    #[msg("Vault is paused")]
    VaultPaused,

    #[msg("Amount below minimum claim (0.025 SOL)")]
    BelowMinimumClaim,

    #[msg("Invalid Merkle proof")]
    InvalidProof,
}
