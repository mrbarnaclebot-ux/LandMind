use anchor_lang::prelude::*;

declare_id!("D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ");

#[program]
pub mod landmind {
    use super::*;

    /// Initialize the LandMind program.
    /// This is a placeholder instruction for Phase 1.
    /// Real implementation will be added in Phase 5 (Agent Deployment).
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("LandMind program initialized");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
