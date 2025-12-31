use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    constants::{VAULT_SEED, VESTING_SEED},
    error::VestingError,
    state::VestingSchedule,
};

#[derive(Accounts)]
pub struct Revoke<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [
            VESTING_SEED,
            admin.key().as_ref(),
            vesting_schedule.beneficiary.as_ref(),
            mint.key().as_ref(),
        ],
        bump = vesting_schedule.bump,
        has_one = admin,
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
        mut,
        associated_token::mint = mint,
        associated_token::authority = admin,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Revoke>) -> Result<()> {
    let vesting_schedule = &ctx.accounts.vesting_schedule;
    let clock = Clock::get()?;

    require!(!vesting_schedule.is_revoked, VestingError::VestingRevoked);

    require!(
        !vesting_schedule.is_fully_vested(clock.unix_timestamp),
        VestingError::VestingCompleted
    );

    let unvested = vesting_schedule.calculate_unvested_amount(clock.unix_timestamp)?;

    if unvested > 0 {
        let admin_key = ctx.accounts.admin.key();
        let beneficiary_key = vesting_schedule.beneficiary;
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
                    to: ctx.accounts.admin_token_account.to_account_info(),
                    authority: ctx.accounts.vesting_schedule.to_account_info(),
                },
                signer_seeds,
            ),
            unvested,
        )?;
    }

    let vesting_schedule = &mut ctx.accounts.vesting_schedule;
    vesting_schedule.is_revoked = true;
    vesting_schedule.revoked_amount = unvested;

    emit!(VestingRevoked {
        admin: ctx.accounts.admin.key(),
        beneficiary: vesting_schedule.beneficiary,
        mint: ctx.accounts.mint.key(),
        unvested_amount: unvested,
        vested_amount: vesting_schedule.total_amount - unvested,
    });

    msg!("Revoked. {} tokens returned to admin", unvested);

    Ok(())
}

#[event]
pub struct VestingRevoked {
    pub admin: Pubkey,
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub unvested_amount: u64,
    pub vested_amount: u64,
}