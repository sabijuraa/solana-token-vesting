use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::{
    constants::{MAX_CLIFF_PERCENTAGE, MAX_VESTING_DURATION, MIN_VESTING_DURATION, VAULT_SEED, VESTING_SEED},
    error::VestingError,
    state::VestingSchedule,
};

#[derive(Accounts)]
pub struct CreateVestingSchedule<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Can be any valid pubkey
    pub beneficiary: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = 8 + VestingSchedule::INIT_SPACE,
        seeds = [
            VESTING_SEED,
            admin.key().as_ref(),
            beneficiary.key().as_ref(),
            mint.key().as_ref(),
        ],
        bump,
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>,

    #[account(
        init,
        payer = admin,
        seeds = [VAULT_SEED, vesting_schedule.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vesting_schedule,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = admin,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(
    ctx: Context<CreateVestingSchedule>,
    total_amount: u64,
    start_time: i64,
    cliff_duration: i64,
    vesting_duration: i64,
) -> Result<()> {
    require!(total_amount > 0, VestingError::InvalidAmount);

    require!(
        vesting_duration >= MIN_VESTING_DURATION,
        VestingError::DurationTooShort
    );
    require!(
        vesting_duration <= MAX_VESTING_DURATION,
        VestingError::DurationTooLong
    );

    require!(
        cliff_duration <= vesting_duration,
        VestingError::CliffTooLong
    );

    let cliff_percentage = (cliff_duration as u64)
        .checked_mul(100)
        .ok_or(VestingError::CalculationOverflow)?
        .checked_div(vesting_duration as u64)
        .ok_or(VestingError::CalculationOverflow)?;
    
    require!(
        cliff_percentage <= MAX_CLIFF_PERCENTAGE,
        VestingError::CliffPercentageTooHigh
    );

    let clock = Clock::get()?;
    require!(
        start_time > clock.unix_timestamp,
        VestingError::StartTimeInPast
    );

    let vesting_schedule = &mut ctx.accounts.vesting_schedule;
    
    vesting_schedule.admin = ctx.accounts.admin.key();
    vesting_schedule.beneficiary = ctx.accounts.beneficiary.key();
    vesting_schedule.mint = ctx.accounts.mint.key();
    vesting_schedule.total_amount = total_amount;
    vesting_schedule.claimed_amount = 0;
    vesting_schedule.start_time = start_time;
    vesting_schedule.cliff_duration = cliff_duration;
    vesting_schedule.vesting_duration = vesting_duration;
    vesting_schedule.is_revoked = false;
    vesting_schedule.revoked_amount = 0;
    vesting_schedule.bump = ctx.bumps.vesting_schedule;
    vesting_schedule.vault_bump = ctx.bumps.vault;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.admin_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
        ),
        total_amount,
    )?;

    emit!(VestingCreated {
        admin: ctx.accounts.admin.key(),
        beneficiary: ctx.accounts.beneficiary.key(),
        mint: ctx.accounts.mint.key(),
        total_amount,
        start_time,
        cliff_duration,
        vesting_duration,
    });

    msg!(
        "Vesting created: {} tokens for {} over {} seconds",
        total_amount,
        ctx.accounts.beneficiary.key(),
        vesting_duration
    );

    Ok(())
}

#[event]
pub struct VestingCreated {
    pub admin: Pubkey,
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub total_amount: u64,
    pub start_time: i64,
    pub cliff_duration: i64,
    pub vesting_duration: i64,
}