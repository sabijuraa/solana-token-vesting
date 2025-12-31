use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::{
    constants::{VAULT_SEED, VESTING_SEED},
    error::VestingError,
    state::VestingSchedule,
};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    #[account(
        mut,
        seeds = [
            VESTING_SEED,
            vesting_schedule.admin.as_ref(),
            beneficiary.key().as_ref(),
            mint.key().as_ref(),
        ],
        bump = vesting_schedule.bump,
        has_one = beneficiary,
        has_one = mint,
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vesting_schedule.key().as_ref()],
        bump = vesting_schedule.vault_bump,
        token::mint = mint,
        token::authority = vesting_schedule,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = beneficiary,
        associated_token::mint = mint,
        associated_token::authority = beneficiary,
    )]
    pub beneficiary_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Claim>) -> Result<()> {
    let vesting_schedule = &ctx.accounts.vesting_schedule;
    let clock = Clock::get()?;

    require!(!vesting_schedule.is_revoked, VestingError::VestingRevoked);

    require!(
        vesting_schedule.is_cliff_reached(clock.unix_timestamp),
        VestingError::CliffNotReached
    );

    let claimable = vesting_schedule.calculate_claimable_amount(clock.unix_timestamp)?;
    
    require!(claimable > 0, VestingError::NothingToClaim);

    let admin_key = vesting_schedule.admin;
    let beneficiary_key = ctx.accounts.beneficiary.key();
    let mint_key = ctx.accounts.mint.key();
    
    let signer_seeds: &[&[&[u8]]] = &[&[
        VESTING_SEED,
        admin_key.as_ref(),
        beneficiary_key.as_ref(),
        mint_key.as_ref(),
        &[vesting_schedule.bump],
    ]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.beneficiary_token_account.to_account_info(),
                authority: ctx.accounts.vesting_schedule.to_account_info(),
            },
            signer_seeds,
        ),
        claimable,
    )?;

    let vesting_schedule = &mut ctx.accounts.vesting_schedule;
    vesting_schedule.claimed_amount = vesting_schedule
        .claimed_amount
        .checked_add(claimable)
        .ok_or(VestingError::CalculationOverflow)?;

    emit!(TokensClaimed {
        beneficiary: ctx.accounts.beneficiary.key(),
        mint: ctx.accounts.mint.key(),
        amount: claimable,
        total_claimed: vesting_schedule.claimed_amount,
        remaining: vesting_schedule.total_amount - vesting_schedule.claimed_amount,
    });

    msg!(
        "Claimed {} tokens. Total: {}/{}",
        claimable,
        vesting_schedule.claimed_amount,
        vesting_schedule.total_amount
    );

    Ok(())
}

#[event]
pub struct TokensClaimed {
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub total_claimed: u64,
    pub remaining: u64,
}