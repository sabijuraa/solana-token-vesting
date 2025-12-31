use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VestingSchedule {
    pub admin: Pubkey,
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub total_amount: u64,
    pub claimed_amount: u64,
    pub start_time: i64,
    pub cliff_duration: i64,
    pub vesting_duration: i64,
    pub is_revoked: bool,
    pub revoked_amount: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl VestingSchedule {
    pub fn calculate_vested_amount(&self, current_time: i64) -> Result<u64> {
        if self.is_revoked {
            return Ok(self.total_amount.saturating_sub(self.revoked_amount));
        }

        let cliff_end = self.start_time
            .checked_add(self.cliff_duration)
            .ok_or(error!(crate::error::VestingError::CalculationOverflow))?;

        if current_time < cliff_end {
            return Ok(0);
        }

        let vesting_end = self.start_time
            .checked_add(self.vesting_duration)
            .ok_or(error!(crate::error::VestingError::CalculationOverflow))?;

        if current_time >= vesting_end {
            return Ok(self.total_amount);
        }

        let elapsed = (current_time - self.start_time) as u128;
        let duration = self.vesting_duration as u128;
        let total = self.total_amount as u128;

        let vested = total
            .checked_mul(elapsed)
            .ok_or(error!(crate::error::VestingError::CalculationOverflow))?
            .checked_div(duration)
            .ok_or(error!(crate::error::VestingError::CalculationOverflow))?;

        Ok(vested as u64)
    }

    pub fn calculate_claimable_amount(&self, current_time: i64) -> Result<u64> {
        let vested = self.calculate_vested_amount(current_time)?;
        Ok(vested.saturating_sub(self.claimed_amount))
    }

    pub fn calculate_unvested_amount(&self, current_time: i64) -> Result<u64> {
        let vested = self.calculate_vested_amount(current_time)?;
        Ok(self.total_amount.saturating_sub(vested))
    }

    pub fn is_cliff_reached(&self, current_time: i64) -> bool {
        current_time >= self.start_time + self.cliff_duration
    }

    pub fn is_fully_vested(&self, current_time: i64) -> bool {
        current_time >= self.start_time + self.vesting_duration
    }
}