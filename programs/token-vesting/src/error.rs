use anchor_lang::prelude::*;

#[error_code]
pub enum VestingError {
    #[msg("Vesting duration must be at least 1 day")]
    DurationTooShort,

    #[msg("Vesting duration cannot exceed 10 years")]
    DurationTooLong,

    #[msg("Cliff duration cannot exceed vesting duration")]
    CliffTooLong,

    #[msg("Cliff cannot exceed 50% of vesting duration")]
    CliffPercentageTooHigh,

    #[msg("Vesting start time must be in the future")]
    StartTimeInPast,

    #[msg("Cannot claim during cliff period")]
    CliffNotReached,

    #[msg("No tokens available for claiming")]
    NothingToClaim,

    #[msg("This vesting schedule has been revoked")]
    VestingRevoked,

    #[msg("Cannot revoke completed vesting schedule")]
    VestingCompleted,

    #[msg("Calculation overflow")]
    CalculationOverflow,

    #[msg("Vesting amount must be greater than zero")]
    InvalidAmount,
}