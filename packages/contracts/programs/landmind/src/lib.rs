use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

pub mod errors;
pub mod state;

#[allow(unused_imports)]
use errors::*;
use state::*;

declare_id!("D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ");

/// Cost to deploy an agent: 0.1 SOL in lamports
pub const DEPLOY_COST: u64 = 100_000_000;

#[program]
pub mod landmind {
    use super::*;

    /// Initialize the LandMind program.
    /// This is a placeholder instruction for Phase 1.
    /// Real implementation will be added in Phase 5 (Agent Deployment).
    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("LandMind program initialized");
        Ok(())
    }

    /// Deploy a new agent by paying 0.1 SOL to the treasury.
    /// Emits an AgentDeployedEvent for backend processing.
    pub fn deploy_agent(ctx: Context<DeployAgent>) -> Result<()> {
        // Transfer 0.1 SOL from payer to treasury PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        transfer(cpi_context, DEPLOY_COST)?;

        // Get current timestamp
        let clock = Clock::get()?;

        // Generate agent index from treasury lamports (simple incrementing approach)
        // Each agent adds 0.1 SOL, so we can derive index from balance
        let agent_index = ctx.accounts.treasury.lamports() / DEPLOY_COST;

        // Emit event for backend to process and mint cNFT
        emit!(AgentDeployedEvent {
            owner: ctx.accounts.payer.key(),
            timestamp: clock.unix_timestamp,
            agent_index,
        });

        msg!(
            "Agent {} deployed by {} at timestamp {}",
            agent_index,
            ctx.accounts.payer.key(),
            clock.unix_timestamp
        );

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

/// Accounts required for deploying an agent
#[derive(Accounts)]
pub struct DeployAgent<'info> {
    /// The user deploying the agent (pays 0.1 SOL)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Treasury PDA that receives the deployment fee
    /// CHECK: Validated by seeds constraint - this is the program's treasury
    #[account(
        mut,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: SystemAccount<'info>,

    /// System program for SOL transfers
    pub system_program: Program<'info, System>,
}
