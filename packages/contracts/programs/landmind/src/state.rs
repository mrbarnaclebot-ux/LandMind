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

/// Configuration account for program-wide settings (for future use)
#[account]
pub struct Config {
    /// The authority that can update configuration
    pub authority: Pubkey,
    /// Current agent deployment cost in lamports
    pub deploy_cost: u64,
    /// Total number of agents deployed
    pub total_agents: u64,
    /// Bump seed for the config PDA
    pub bump: u8,
}

impl Config {
    pub const SIZE: usize = 8 + // discriminator
        32 + // authority
        8 + // deploy_cost
        8 + // total_agents
        1; // bump
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
    /// Emergency pause flag
    pub paused: bool,
    /// PDA bump seed
    pub bump: u8,
}

impl FeeVaultState {
    // 8 discriminator + 32 authority + 32 merkle_root + 8 total_distributed + 1 paused + 1 bump
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 1 + 1;
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
