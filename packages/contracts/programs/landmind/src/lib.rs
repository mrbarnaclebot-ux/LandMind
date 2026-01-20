use anchor_lang::prelude::*;

declare_id!("D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ");

#[program]
pub mod landmind {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
