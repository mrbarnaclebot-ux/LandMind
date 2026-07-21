use anchor_lang::prelude::*;

/// Event emitted when an agent is successfully deployed
#[event]
pub struct AgentDeployedEvent {
    /// The public key of the wallet that deployed the agent
    pub owner: Pubkey,
    /// Unix timestamp when the agent was deployed
    pub timestamp: i64,
    /// Unique index for this agent (incremented per deployment)
    pub agent_index: u64,
}

/// Configuration account for program-wide settings.
/// Holds the real on-chain agent counter (C5).
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// The authority that can update configuration
    pub authority: Pubkey,
    /// Current agent deployment cost in lamports
    pub deploy_cost: u64,
    /// Total number of agents deployed (monotonic counter, used as agent_index)
    pub total_agents: u64,
    /// Bump seed for the config PDA
    pub bump: u8,
}

impl Config {
    // 8 discriminator + InitSpace (32 + 8 + 8 + 1)
    pub const SIZE: usize = 8 + Config::INIT_SPACE;
}

/// Per-claimer state tracking cumulative claimed lamports (CR-3 double-claim protection).
/// PDA seeds: [b"claim", claimer.key()]
#[account]
#[derive(InitSpace)]
pub struct ClaimState {
    /// The wallet this claim state belongs to
    pub claimer: Pubkey,
    /// Cumulative lamports already claimed by this claimer
    pub claimed_total: u64,
    /// PDA bump seed
    pub bump: u8,
}

/// Fee vault state for claim management
#[account]
pub struct FeeVaultState {
    /// Admin authority who can pause/update
    pub authority: Pubkey,
    /// Current Merkle root for claim verification
    pub merkle_root: [u8; 32],
    /// Total lamports distributed via claims
    pub total_distributed: u64,
    /// Total lamports deposited into the treasury via deposit_fees (CR-5)
    pub total_deposited: u64,
    /// Total lamports claimed out of the treasury (CR-5)
    pub total_claimed: u64,
    /// Emergency pause flag
    pub paused: bool,
    /// PDA bump seed
    pub bump: u8,
}

impl FeeVaultState {
    // discriminator (8) + authority (32) + merkle_root (32) + total_distributed (8)
    //   + total_deposited (8) + total_claimed (8) + paused (1) + bump (1) = 98
    // Add padding for forward compatibility.
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 30;
}

/// Event emitted when the vault is initialized
#[event]
pub struct VaultInitializedEvent {
    pub authority: Pubkey,
    pub timestamp: i64,
}

/// Event emitted when a claim is processed
#[event]
pub struct ClaimEvent {
    pub claimer: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

/// Event emitted when fees are deposited into the treasury
#[event]
pub struct FeesDepositedEvent {
    pub depositor: Pubkey,
    pub amount: u64,
    pub total_deposited: u64,
    pub timestamp: i64,
}

/// Event emitted when the vault is paused
#[event]
pub struct VaultPausedEvent {
    pub authority: Pubkey,
    pub timestamp: i64,
}

/// Event emitted when the vault is unpaused
#[event]
pub struct VaultUnpausedEvent {
    pub authority: Pubkey,
    pub timestamp: i64,
}

/// Event emitted when the merkle root is updated
#[event]
pub struct MerkleRootUpdatedEvent {
    pub authority: Pubkey,
    pub old_root: [u8; 32],
    pub new_root: [u8; 32],
    pub timestamp: i64,
}
