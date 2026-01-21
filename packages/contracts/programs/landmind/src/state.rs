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
