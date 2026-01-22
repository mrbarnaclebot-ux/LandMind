use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;
use anchor_lang::system_program::{transfer, Transfer};

pub mod errors;
pub mod state;

use errors::*;
use state::*;

declare_id!("D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ");

/// Cost to deploy an agent: 0.1 SOL in lamports
pub const DEPLOY_COST: u64 = 100_000_000;

/// Minimum claim amount: 0.025 SOL in lamports
pub const MIN_CLAIM: u64 = 25_000_000;

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

        // Generate agent index from treasury lamports using checked arithmetic
        // Each agent adds 0.1 SOL, so we can derive index from balance
        let agent_index = ctx
            .accounts
            .treasury
            .lamports()
            .checked_div(DEPLOY_COST)
            .ok_or(LandMindError::Overflow)?;

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

    /// Initialize the fee vault state account (one-time setup)
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.authority = ctx.accounts.authority.key();
        vault_state.merkle_root = [0u8; 32]; // Empty root initially
        vault_state.total_distributed = 0;
        vault_state.paused = false;
        vault_state.bump = ctx.bumps.vault_state;

        emit!(VaultInitializedEvent {
            authority: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Fee vault initialized with authority {}", ctx.accounts.authority.key());
        Ok(())
    }

    /// Claim earnings using a Merkle proof
    pub fn claim_earnings(
        ctx: Context<ClaimEarnings>,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let vault_state = &ctx.accounts.vault_state;

        // Check not paused
        require!(!vault_state.paused, LandMindError::VaultPaused);

        // Check minimum claim
        require!(amount >= MIN_CLAIM, LandMindError::BelowMinimumClaim);

        // Verify merkle root is not empty (prevents claims before initialization)
        require!(
            vault_state.merkle_root != [0u8; 32],
            LandMindError::EmptyMerkleRoot
        );

        // Verify treasury has sufficient balance
        let treasury_balance = ctx.accounts.treasury.lamports();
        require!(
            treasury_balance >= amount,
            LandMindError::InsufficientTreasuryBalance
        );

        // Verify Merkle proof - hash pubkey (32 bytes) + amount (8 bytes, padded to 32)
        let mut amount_bytes = [0u8; 32];
        amount_bytes[..8].copy_from_slice(&amount.to_le_bytes());
        let leaf = keccak::hashv(&[
            &ctx.accounts.claimer.key().to_bytes(),
            &amount_bytes,
        ]);

        require!(
            verify_proof(&proof, vault_state.merkle_root, leaf.0),
            LandMindError::InvalidProof
        );

        // Transfer from treasury to claimer
        let treasury_bump = ctx.bumps.treasury;
        let seeds = &[b"treasury".as_ref(), &[treasury_bump]];
        let signer_seeds = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.claimer.to_account_info(),
            },
            signer_seeds,
        );
        transfer(cpi_context, amount)?;

        // Update total distributed using checked arithmetic
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_distributed = vault_state
            .total_distributed
            .checked_add(amount)
            .ok_or(LandMindError::Overflow)?;

        emit!(ClaimEvent {
            claimer: ctx.accounts.claimer.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Claimed {} lamports for {}", amount, ctx.accounts.claimer.key());
        Ok(())
    }

    /// Pause the vault (admin only)
    pub fn pause_vault(ctx: Context<AdminAction>) -> Result<()> {
        // Check vault is not already paused
        require!(!ctx.accounts.vault_state.paused, LandMindError::VaultPaused);

        ctx.accounts.vault_state.paused = true;
        emit!(VaultPausedEvent {
            authority: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        msg!("Vault paused by {}", ctx.accounts.authority.key());
        Ok(())
    }

    /// Unpause the vault (admin only)
    pub fn unpause_vault(ctx: Context<AdminAction>) -> Result<()> {
        // Check vault is actually paused
        require!(ctx.accounts.vault_state.paused, LandMindError::VaultNotPaused);

        ctx.accounts.vault_state.paused = false;
        emit!(VaultUnpausedEvent {
            authority: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        msg!("Vault unpaused by {}", ctx.accounts.authority.key());
        Ok(())
    }

    /// Update the Merkle root (admin only)
    pub fn update_merkle_root(ctx: Context<AdminAction>, new_root: [u8; 32]) -> Result<()> {
        let old_root = ctx.accounts.vault_state.merkle_root;
        ctx.accounts.vault_state.merkle_root = new_root;

        emit!(MerkleRootUpdatedEvent {
            authority: ctx.accounts.authority.key(),
            old_root,
            new_root,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Merkle root updated by {}", ctx.accounts.authority.key());
        Ok(())
    }
}

/// Verify Merkle proof (OpenZeppelin pattern with sorted hashing)
fn verify_proof(proof: &[[u8; 32]], root: [u8; 32], leaf: [u8; 32]) -> bool {
    let mut computed_hash = leaf;

    for proof_element in proof.iter() {
        // OpenZeppelin sorted hashing - smaller hash first for deterministic ordering
        if computed_hash <= *proof_element {
            computed_hash = keccak::hashv(&[&computed_hash, proof_element]).0;
        } else {
            computed_hash = keccak::hashv(&[proof_element, &computed_hash]).0;
        }
    }

    computed_hash == root
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

/// Accounts required for initializing the fee vault
#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = FeeVaultState::SIZE,
        seeds = [b"vault_state"],
        bump
    )]
    pub vault_state: Account<'info, FeeVaultState>,

    pub system_program: Program<'info, System>,
}

/// Accounts required for claiming earnings
#[derive(Accounts)]
pub struct ClaimEarnings<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_state"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, FeeVaultState>,

    /// CHECK: Treasury PDA that holds fees - validated by seeds constraint
    #[account(
        mut,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Accounts required for admin actions (pause, unpause, update root)
#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_state"],
        bump = vault_state.bump,
        has_one = authority @ LandMindError::Unauthorized,
    )]
    pub vault_state: Account<'info, FeeVaultState>,
}
