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

/// Expected admin authority for privileged initialization (H-3 init takeover guard).
///
/// No hardcoded admin pubkey is discoverable in the repo: the server derives its
/// authority at runtime from `SERVER_WALLET_SECRET` and admin wallets come from
/// `ADMIN_WALLET_1/2` env vars, and there is no local `~/.config/solana/id.json`.
/// This is therefore a placeholder set to the program ID.
// TODO: set to the real admin/upgrade-authority pubkey before deploy.
pub const EXPECTED_ADMIN: Pubkey = pubkey!("D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ");

#[program]
pub mod landmind {
    use super::*;

    /// Initialize the LandMind program config account (one-time setup).
    /// Sets up the on-chain agent counter (C5). Only the expected admin may call this
    /// (H-3 init takeover guard).
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == EXPECTED_ADMIN,
            LandMindError::Unauthorized
        );

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.deploy_cost = DEPLOY_COST;
        config.total_agents = 0;
        config.bump = ctx.bumps.config;

        msg!("LandMind program initialized by {}", ctx.accounts.authority.key());
        Ok(())
    }

    /// Deploy a new agent by paying 0.1 SOL to the treasury.
    /// Uses the on-chain Config counter for a deterministic agent index (C5).
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

        // Use the on-chain counter as the agent index, then increment it.
        let config = &mut ctx.accounts.config;
        let agent_index = config.total_agents;
        config.total_agents = config
            .total_agents
            .checked_add(1)
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

    /// Deposit fees into the treasury and record them against the vault's
    /// distributable balance (CR-5). Any depositor may fund the treasury.
    pub fn deposit_fees(ctx: Context<DepositFees>, amount: u64) -> Result<()> {
        require!(amount > 0, LandMindError::BelowMinimumClaim);

        // Move lamports from the depositor into the treasury PDA.
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.depositor.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        transfer(cpi_context, amount)?;

        // Track the deposit for 50/50 enforcement.
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_deposited = vault_state
            .total_deposited
            .checked_add(amount)
            .ok_or(LandMindError::Overflow)?;

        emit!(FeesDepositedEvent {
            depositor: ctx.accounts.depositor.key(),
            amount,
            total_deposited: vault_state.total_deposited,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Deposited {} lamports into treasury", amount);
        Ok(())
    }

    /// Initialize the fee vault state account (one-time setup).
    /// Only the expected admin may call this (H-3 init takeover guard).
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == EXPECTED_ADMIN,
            LandMindError::Unauthorized
        );

        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.authority = ctx.accounts.authority.key();
        vault_state.merkle_root = [0u8; 32]; // Empty root initially
        vault_state.total_distributed = 0;
        vault_state.total_deposited = 0;
        vault_state.total_claimed = 0;
        vault_state.paused = false;
        vault_state.bump = ctx.bumps.vault_state;

        emit!(VaultInitializedEvent {
            authority: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Fee vault initialized with authority {}", ctx.accounts.authority.key());
        Ok(())
    }

    /// Claim earnings using a Merkle proof over a CUMULATIVE allowance (CR-3, H-2, CR-5).
    ///
    /// The Merkle leaf encodes the claimer's total lifetime allowance; the payout is
    /// the difference between that allowance and what has already been claimed. This
    /// makes replays a no-op (the allowance never exceeds the recorded total again).
    pub fn claim_earnings(
        ctx: Context<ClaimEarnings>,
        total_allowance: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let vault_state = &ctx.accounts.vault_state;

        // Check not paused
        require!(!vault_state.paused, LandMindError::VaultPaused);

        // Verify merkle root is not empty (prevents claims before initialization)
        require!(
            vault_state.merkle_root != [0u8; 32],
            LandMindError::EmptyMerkleRoot
        );

        // Verify Merkle proof for (claimer, total_allowance).
        // Leaf: keccak(0x00 || claimer_pubkey(32) || total_allowance_le_u64(8)) (H-2 domain separation)
        let leaf = keccak::hashv(&[
            &[LEAF_PREFIX],
            &ctx.accounts.claimer.key().to_bytes(),
            &total_allowance.to_le_bytes(),
        ]);

        require!(
            verify_proof(&proof, vault_state.merkle_root, leaf.0),
            LandMindError::InvalidProof
        );

        // CR-3: cumulative allowance must exceed what has already been claimed.
        let claim_state = &ctx.accounts.claim_state;
        require!(
            total_allowance > claim_state.claimed_total,
            LandMindError::ClaimExceedsAllowance
        );

        // Payout is the incremental amount owed.
        let payout = total_allowance
            .checked_sub(claim_state.claimed_total)
            .ok_or(LandMindError::Underflow)?;

        // Enforce minimum claim on the incremental payout.
        require!(payout >= MIN_CLAIM, LandMindError::BelowMinimumClaim);

        // Verify treasury has sufficient balance for the payout.
        let treasury_balance = ctx.accounts.treasury.lamports();
        require!(
            treasury_balance >= payout,
            LandMindError::InsufficientTreasuryBalance
        );

        // CR-5: on-chain 50/50 enforcement. total_claimed + payout must not exceed
        // half of everything ever deposited.
        let new_total_claimed = vault_state
            .total_claimed
            .checked_add(payout)
            .ok_or(LandMindError::Overflow)?;
        let claimable_cap = vault_state
            .total_deposited
            .checked_div(2)
            .ok_or(LandMindError::Overflow)?;
        require!(
            new_total_claimed <= claimable_cap,
            LandMindError::VaultShareExceeded
        );

        // Transfer payout from treasury to claimer
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
        transfer(cpi_context, payout)?;

        // Persist the new cumulative claimed total for this claimer (CR-3).
        let claim_state = &mut ctx.accounts.claim_state;
        claim_state.claimer = ctx.accounts.claimer.key();
        claim_state.claimed_total = total_allowance;
        claim_state.bump = ctx.bumps.claim_state;

        // Update vault accounting using checked arithmetic.
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_distributed = vault_state
            .total_distributed
            .checked_add(payout)
            .ok_or(LandMindError::Overflow)?;
        vault_state.total_claimed = new_total_claimed;

        emit!(ClaimEvent {
            claimer: ctx.accounts.claimer.key(),
            amount: payout,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Claimed {} lamports for {}", payout, ctx.accounts.claimer.key());
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

/// Domain-separation prefix for Merkle leaves (H-2).
pub const LEAF_PREFIX: u8 = 0x00;
/// Domain-separation prefix for Merkle internal nodes (H-2).
pub const NODE_PREFIX: u8 = 0x01;

/// Verify Merkle proof (OpenZeppelin pattern with sorted hashing + domain separation).
/// Internal node hash: keccak(0x01 || min(a,b) || max(a,b)) (H-2).
fn verify_proof(proof: &[[u8; 32]], root: [u8; 32], leaf: [u8; 32]) -> bool {
    let mut computed_hash = leaf;

    for proof_element in proof.iter() {
        // Sorted hashing with a 0x01 node-domain prefix - smaller hash first.
        if computed_hash <= *proof_element {
            computed_hash =
                keccak::hashv(&[&[NODE_PREFIX], &computed_hash, proof_element]).0;
        } else {
            computed_hash =
                keccak::hashv(&[&[NODE_PREFIX], proof_element, &computed_hash]).0;
        }
    }

    computed_hash == root
}

/// Accounts required for initializing the program Config (C5 agent counter).
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Config::SIZE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

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

    /// Program config holding the on-chain agent counter (C5)
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    /// System program for SOL transfers
    pub system_program: Program<'info, System>,
}

/// Accounts required for depositing fees into the treasury (CR-5)
#[derive(Accounts)]
pub struct DepositFees<'info> {
    /// The account funding the treasury
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_state"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, FeeVaultState>,

    /// Treasury PDA that receives the fees
    /// CHECK: Validated by seeds constraint - this is the program's treasury
    #[account(
        mut,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: SystemAccount<'info>,

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

/// Accounts required for claiming earnings.
/// Account order is part of the pinned server interface (CR-4) - do not reorder.
#[derive(Accounts)]
pub struct ClaimEarnings<'info> {
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

    /// Per-claimer cumulative-claim state (CR-3). Created on first claim.
    #[account(
        init_if_needed,
        payer = claimer,
        space = 8 + ClaimState::INIT_SPACE,
        seeds = [b"claim", claimer.key().as_ref()],
        bump
    )]
    pub claim_state: Account<'info, ClaimState>,

    #[account(mut)]
    pub claimer: Signer<'info>,

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
