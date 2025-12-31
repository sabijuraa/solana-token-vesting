use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("4JHtvoNPJ8GzPk5C2M6fvMnFzSkV3intLHVLUvxuZxhM");

#[program]
pub mod token_vesting {
    use super::*;

    pub fn create_vesting_schedule(
        ctx: Context<CreateVestingSchedule>,
        total_amount: u64,
        start_time: i64,
        cliff_duration: i64,
        vesting_duration: i64,
    ) -> Result<()> {
        instructions::create_vesting::handler(
            ctx,
            total_amount,
            start_time,
            cliff_duration,
            vesting_duration,
        )
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handler(ctx)
    }

    pub fn revoke(ctx: Context<Revoke>) -> Result<()> {
        instructions::revoke::handler(ctx)
    }
}