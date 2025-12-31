# Token Vesting on Solana - Complete Tutorial
## From Theory to Production: A Deep Dive Guide

---

# Table of Contents

1. [What is Token Vesting?](#part-1-what-is-token-vesting)
2. [Understanding the Architecture](#part-2-understanding-the-architecture)
3. [Line-by-Line Code Explanation](#part-3-line-by-line-code-explanation)
4. [How to Build Such Applications](#part-4-how-to-build-such-applications)
5. [Frontend Integration](#part-5-frontend-integration)
6. [Deployment Guide](#part-6-deployment-guide)
7. [Testing](#part-7-testing)

---

# Part 1: What is Token Vesting?

## 1.1 The Problem Token Vesting Solves

Imagine you're starting a company and want to give your employees shares (tokens). If you give them all the shares immediately:

- They might sell immediately and leave
- There's no incentive to stay long-term
- It creates volatility in your token price

**Token Vesting** solves this by releasing tokens gradually over time.

## 1.2 Real-World Analogy

Think of it like a treasure chest that unlocks piece by piece:

```
Day 1 (Start): Chest is locked 🔒
|
Month 6 (Cliff): First lock opens, 0% available initially
|                but you've proven commitment
Month 12: 25% of treasure unlocked 💰
Month 24: 50% of treasure unlocked 💰💰
Month 36: 75% of treasure unlocked 💰💰💰
Month 48: 100% - All treasure available! 💰💰💰💰
```

## 1.3 Key Terms Explained

### Cliff Period
The **cliff** is a waiting period before ANY tokens unlock.

```
Example: 1-year cliff with 4-year vesting

Year 0-1: NO tokens available (cliff period)
Year 1: Suddenly 25% unlocks! (cliff ends)
Year 2-4: Remaining 75% unlocks gradually
```

Why have a cliff?
- Ensures commitment before any payout
- Protects against "grab and run" scenarios
- Standard in startup equity (usually 1 year)

### Vesting Duration
The total time over which ALL tokens become available.

```
100 tokens, 4-year vesting:
Year 1: 25 tokens vested
Year 2: 50 tokens vested
Year 3: 75 tokens vested  
Year 4: 100 tokens vested (fully vested)
```

### Linear Vesting
Tokens unlock at a constant rate over time.

```
Formula: vested_amount = total_amount × (time_elapsed / total_duration)

Example: 1000 tokens, 365 days
Day 100: 1000 × (100/365) = 273.97 ≈ 273 tokens
Day 200: 1000 × (200/365) = 547.94 ≈ 547 tokens
```

---

# Part 2: Understanding the Architecture

## 2.1 Solana Program Architecture

On Solana, smart contracts are called **Programs**. Here's how our vesting program is structured:

```
┌─────────────────────────────────────────────────────────────┐
│                    TOKEN VESTING PROGRAM                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│   │    CREATE     │  │     CLAIM     │  │    REVOKE     │   │
│   │   VESTING     │  │    TOKENS     │  │   VESTING     │   │
│   └───────────────┘  └───────────────┘  └───────────────┘   │
│          │                  │                  │             │
│          ▼                  ▼                  ▼             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              VESTING SCHEDULE (State)                │   │
│   │  - admin, beneficiary, mint                          │   │
│   │  - total_amount, claimed_amount                      │   │
│   │  - start_time, cliff_duration, vesting_duration      │   │
│   │  - is_revoked, revoked_amount                        │   │
│   └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    VAULT (Token Account)              │   │
│   │         Holds tokens until they're claimed            │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 2.2 Account Model Explanation

Solana uses an **Account Model** where all data is stored in accounts:

```
┌─────────────────────────────────────────────────────────────┐
│                      ACCOUNT TYPES                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. VESTING SCHEDULE ACCOUNT (PDA)                          │
│     ├── Seeds: ["vesting", admin, beneficiary, mint]        │
│     ├── Stores: Schedule configuration & state              │
│     └── Authority: The program itself                       │
│                                                              │
│  2. VAULT ACCOUNT (Token Account PDA)                       │
│     ├── Seeds: ["vault", vesting_schedule_address]          │
│     ├── Stores: The actual SPL tokens                       │
│     └── Authority: Vesting Schedule account (PDA signer)    │
│                                                              │
│  3. USER TOKEN ACCOUNTS                                      │
│     ├── Admin's token account (source of tokens)            │
│     └── Beneficiary's token account (receives claimed)      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 2.3 What is a PDA (Program Derived Address)?

A PDA is a special address that:
1. Is **derived deterministically** from seeds
2. **Cannot sign transactions** (no private key)
3. **Only the program** can sign for it

```rust
// PDA derivation formula (conceptual)
PDA = hash(seeds + program_id + bump)

// Our vesting PDA:
seeds = ["vesting", admin_pubkey, beneficiary_pubkey, mint_pubkey]
```

Why use PDAs?
- Program can "own" accounts without a private key
- Addresses are predictable (anyone can derive them)
- Secure: only the program can authorize transfers

---

# Part 3: Line-by-Line Code Explanation

## 3.1 Cargo.toml - Project Configuration

```toml
[package]
name = "token-vesting"      # Crate name (like npm package name)
version = "0.1.0"           # Semantic versioning
edition = "2021"            # Rust edition (syntax version)

[lib]
crate-type = ["cdylib", "lib"]  # Compile as C-compatible dynamic lib (for Solana)
name = "token_vesting"          # Library name (underscores, not hyphens)

[features]
no-entrypoint = []          # Disable program entrypoint (for testing)
no-idl = []                 # Skip IDL generation
no-log-ix-name = []         # Skip instruction name logging
cpi = ["no-entrypoint"]     # Cross-Program Invocation mode
default = []                # No default features

[dependencies]
anchor-lang = "0.30.1"      # Anchor framework (like Express for Solana)
anchor-spl = "0.30.1"       # SPL token integration
```

### Why These Dependencies?

**anchor-lang**: The main framework that provides:
- `#[program]` macro for defining instructions
- `#[account]` macro for defining state
- Account validation and security
- Error handling

**anchor-spl**: Provides:
- Token account types
- Token transfer helpers
- Associated token account support

## 3.2 lib.rs - Program Entry Point

```rust
use anchor_lang::prelude::*;
```
**What this does**: Imports everything from Anchor's prelude - common types like `Pubkey`, `Context`, `Result`, macros like `#[program]`, etc.

```rust
pub mod constants;   // Configuration constants
pub mod error;       // Custom error types
pub mod instructions; // The actual instruction logic
pub mod state;       // Data structures (accounts)
```
**What this does**: Declares sub-modules. Rust's module system is like folders - each module is a separate file.

```rust
use instructions::*;
```
**What this does**: Brings all public items from instructions into scope, so we can use `CreateVestingSchedule` instead of `instructions::create_vesting::CreateVestingSchedule`.

```rust
declare_id!("4JHtvoNPJ8GzPk5C2M6fvMnFzSkV3intLHVLUvxuZxhM");
```
**What this does**: Declares the program's on-chain address. This is generated when you run `anchor keys list`. It's like your program's unique ID on Solana.

```rust
#[program]
pub mod token_vesting {
    use super::*;
```
**What this does**: 
- `#[program]` macro tells Anchor "this module contains the program's instructions"
- `use super::*` imports everything from the parent module

```rust
    pub fn create_vesting_schedule(
        ctx: Context<CreateVestingSchedule>,  // Accounts for this instruction
        total_amount: u64,                     // How many tokens to vest
        start_time: i64,                       // When vesting starts (Unix timestamp)
        cliff_duration: i64,                   // Cliff period in seconds
        vesting_duration: i64,                 // Total vesting time in seconds
    ) -> Result<()> {
```
**What this does**: Defines an instruction. The function signature becomes the transaction format:

```
┌─────────────────────────────────────────────────────────────┐
│  INSTRUCTION: create_vesting_schedule                        │
├─────────────────────────────────────────────────────────────┤
│  Accounts: (defined by Context<CreateVestingSchedule>)       │
│    - admin (signer, mutable)                                 │
│    - beneficiary                                             │
│    - mint                                                    │
│    - vesting_schedule (will be created)                      │
│    - vault (will be created)                                 │
│    - admin_token_account                                     │
│    - system_program, token_program, associated_token_program │
├─────────────────────────────────────────────────────────────┤
│  Data:                                                       │
│    - total_amount: u64                                       │
│    - start_time: i64                                         │
│    - cliff_duration: i64                                     │
│    - vesting_duration: i64                                   │
└─────────────────────────────────────────────────────────────┘
```

## 3.3 constants.rs - Configuration Values

```rust
pub const VESTING_SEED: &[u8] = b"vesting";
pub const VAULT_SEED: &[u8] = b"vault";
```
**What this does**: Defines seeds for PDA derivation.
- `b"vesting"` creates a byte slice from the string "vesting"
- These seeds make PDAs predictable and unique

```rust
pub const MIN_VESTING_DURATION: i64 = 86_400;      // 1 day in seconds
pub const MAX_VESTING_DURATION: i64 = 315_360_000; // 10 years in seconds
pub const MAX_CLIFF_PERCENTAGE: u64 = 50;          // Cliff can't be > 50% of duration
```
**What this does**: Business logic constraints.
- Prevents creating absurdly short or long vesting schedules
- Ensures cliff isn't too long (protects beneficiary)

**Why these values?**
```
86,400 seconds = 60 sec × 60 min × 24 hours = 1 day
315,360,000 = 86,400 × 365 × 10 ≈ 10 years
```

## 3.4 error.rs - Custom Errors

```rust
use anchor_lang::prelude::*;

#[error_code]
pub enum VestingError {
    #[msg("Vesting duration must be at least 1 day")]
    DurationTooShort,
    
    #[msg("Vesting duration cannot exceed 10 years")]
    DurationTooLong,
    // ... more errors
}
```

**What this does**: 
- `#[error_code]` macro generates error codes (6000+)
- `#[msg("...")]` provides human-readable messages
- When used with `require!()`, throws these as transaction errors

**How errors work on Solana**:
```
Transaction fails → Error code returned → Client sees:
"Error: AnchorError { error_code: 6001, error_msg: "Vesting duration cannot exceed 10 years" }"
```

## 3.5 state.rs - Data Structures

```rust
#[account]
#[derive(InitSpace)]
pub struct VestingSchedule {
```
**What this does**:
- `#[account]` marks this as a Solana account data structure
- `#[derive(InitSpace)]` automatically calculates the account size

```rust
    pub admin: Pubkey,        // 32 bytes - Who created this vesting
    pub beneficiary: Pubkey,  // 32 bytes - Who receives tokens
    pub mint: Pubkey,         // 32 bytes - Which token type
    pub total_amount: u64,    // 8 bytes - Total tokens to vest
    pub claimed_amount: u64,  // 8 bytes - Tokens already claimed
    pub start_time: i64,      // 8 bytes - Unix timestamp
    pub cliff_duration: i64,  // 8 bytes - Cliff in seconds
    pub vesting_duration: i64, // 8 bytes - Total duration
    pub is_revoked: bool,     // 1 byte - Has admin revoked?
    pub revoked_amount: u64,  // 8 bytes - How much was returned
    pub bump: u8,             // 1 byte - PDA bump seed
    pub vault_bump: u8,       // 1 byte - Vault PDA bump
}
// Total: 32*3 + 8*5 + 1*3 = 96 + 40 + 3 = 139 bytes
// With 8-byte discriminator: 147 bytes
```

### The calculate_vested_amount Method

```rust
impl VestingSchedule {
    pub fn calculate_vested_amount(&self, current_time: i64) -> Result<u64> {
```
**What this does**: Calculates how many tokens have vested at a given time.

```rust
        // If revoked, only return non-revoked portion
        if self.is_revoked {
            return Ok(self.total_amount.saturating_sub(self.revoked_amount));
        }
```
**What this does**: If vesting was revoked, only the vested portion at revoke time counts.
- `saturating_sub` prevents underflow (returns 0 instead of panicking)

```rust
        let cliff_end = self.start_time
            .checked_add(self.cliff_duration)
            .ok_or(error!(crate::error::VestingError::CalculationOverflow))?;
```
**What this does**: Calculate when cliff ends.
- `checked_add` returns `None` on overflow instead of panicking
- `ok_or(...)` converts `None` to an error
- `?` propagates the error if it occurred

```rust
        if current_time < cliff_end {
            return Ok(0);  // Before cliff = no tokens vested
        }
```
**What this does**: During cliff period, nothing is claimable.

```rust
        let vesting_end = self.start_time
            .checked_add(self.vesting_duration)
            .ok_or(error!(crate::error::VestingError::CalculationOverflow))?;

        if current_time >= vesting_end {
            return Ok(self.total_amount);  // Fully vested
        }
```
**What this does**: After vesting ends, everything is vested.

```rust
        // Linear vesting calculation
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
```
**What this does**: Linear vesting formula.
```
vested = total_amount × (elapsed_time / vesting_duration)
```

**Why u128?** To prevent overflow during multiplication:
```
worst case: u64::MAX × u64::MAX would overflow u64
            but fits in u128
```

## 3.6 create_vesting.rs - Create Instruction

### Account Definitions

```rust
#[derive(Accounts)]
pub struct CreateVestingSchedule<'info> {
```
**What this does**: Defines all accounts needed for this instruction.
- `'info` is a lifetime parameter (Rust memory safety)

```rust
    #[account(mut)]
    pub admin: Signer<'info>,
```
**What this does**:
- `Signer<'info>` = This account must sign the transaction
- `#[account(mut)]` = Account will be modified (pays for creation)

```rust
    /// CHECK: Can be any valid pubkey
    pub beneficiary: UncheckedAccount<'info>,
```
**What this does**:
- `UncheckedAccount` = No validation, just need the pubkey
- `/// CHECK:` comment is REQUIRED by Anchor to confirm you thought about it
- Beneficiary doesn't need to sign (they're receiving, not sending)

```rust
    pub mint: Account<'info, Mint>,
```
**What this does**:
- Validates this is a real SPL Token Mint
- `Mint` type from anchor-spl

```rust
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
```
**What this does**:
- `init` = Create this account
- `payer = admin` = Admin pays the rent
- `space = 8 + VestingSchedule::INIT_SPACE` = 8-byte discriminator + data size
- `seeds = [...]` = PDA seeds
- `bump` = Auto-find valid bump

**Space calculation**:
```
8 (discriminator) + 139 (VestingSchedule data) = 147 bytes
Rent ≈ 0.00114 SOL for 147 bytes
```

```rust
    #[account(
        init,
        payer = admin,
        seeds = [VAULT_SEED, vesting_schedule.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vesting_schedule,
    )]
    pub vault: Account<'info, TokenAccount>,
```
**What this does**:
- Creates a token account owned by the vesting_schedule PDA
- `token::authority = vesting_schedule` means only vesting_schedule can transfer from it

### Handler Function

```rust
pub fn handler(
    ctx: Context<CreateVestingSchedule>,
    total_amount: u64,
    start_time: i64,
    cliff_duration: i64,
    vesting_duration: i64,
) -> Result<()> {
```

```rust
    require!(total_amount > 0, VestingError::InvalidAmount);
```
**What this does**: `require!` is like assert - fails transaction if false.

```rust
    require!(
        vesting_duration >= MIN_VESTING_DURATION,
        VestingError::DurationTooShort
    );
```
**What this does**: Ensures minimum 1 day vesting.

```rust
    let cliff_percentage = (cliff_duration as u64)
        .checked_mul(100)
        .ok_or(VestingError::CalculationOverflow)?
        .checked_div(vesting_duration as u64)
        .ok_or(VestingError::CalculationOverflow)?;
    
    require!(
        cliff_percentage <= MAX_CLIFF_PERCENTAGE,
        VestingError::CliffPercentageTooHigh
    );
```
**What this does**: Cliff can't be more than 50% of total vesting duration.

```rust
    let clock = Clock::get()?;
    require!(
        start_time > clock.unix_timestamp,
        VestingError::StartTimeInPast
    );
```
**What this does**: 
- `Clock::get()` gets current blockchain time
- Ensures vesting starts in the future

```rust
    let vesting_schedule = &mut ctx.accounts.vesting_schedule;
    
    vesting_schedule.admin = ctx.accounts.admin.key();
    vesting_schedule.beneficiary = ctx.accounts.beneficiary.key();
    // ... set all fields
```
**What this does**: Initialize all fields of the new account.

```rust
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
```
**What this does**: Cross-Program Invocation (CPI) to transfer tokens.
- Calls the SPL Token program
- Transfers from admin's account to the vault
- Admin is signing, so they authorize

```rust
    emit!(VestingCreated {
        admin: ctx.accounts.admin.key(),
        beneficiary: ctx.accounts.beneficiary.key(),
        // ... event data
    });
```
**What this does**: Emits an event that clients can listen to.

## 3.7 claim.rs - Claim Instruction

### Key Account Validation

```rust
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
```
**What this does**:
- `seeds = [...]` validates the PDA matches expected seeds
- `bump = vesting_schedule.bump` uses stored bump (faster than recalculating)
- `has_one = beneficiary` ensures `vesting_schedule.beneficiary == beneficiary.key()`

### PDA Signing

```rust
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
            signer_seeds,  // PDA "signs" the transfer
        ),
        claimable,
    )?;
```
**What this does**:
- PDA can't actually sign (no private key)
- Instead, we pass the seeds that derive it
- Solana runtime verifies: "yes, these seeds + program_id = this PDA"
- If correct, it's like the PDA signed

## 3.8 revoke.rs - Revoke Instruction

```rust
    require!(!vesting_schedule.is_revoked, VestingError::VestingRevoked);

    require!(
        !vesting_schedule.is_fully_vested(clock.unix_timestamp),
        VestingError::VestingCompleted
    );
```
**What this does**:
- Can't revoke twice
- Can't revoke if fully vested (nothing to reclaim)

```rust
    let unvested = vesting_schedule.calculate_unvested_amount(clock.unix_timestamp)?;

    if unvested > 0 {
        // Transfer unvested tokens back to admin
        token::transfer(
            CpiContext::new_with_signer(
                // ... same pattern as claim
            ),
            unvested,
        )?;
    }

    let vesting_schedule = &mut ctx.accounts.vesting_schedule;
    vesting_schedule.is_revoked = true;
    vesting_schedule.revoked_amount = unvested;
```
**What this does**:
- Calculates how much hasn't vested yet
- Returns unvested tokens to admin
- Marks schedule as revoked
- Beneficiary can still claim the vested portion

---

# Part 4: How to Build Such Applications

## 4.1 Step-by-Step Development Process

### Step 1: Define Requirements
```
What does your program need to do?
├── What data needs to be stored? → State design
├── What actions can users take? → Instructions
├── Who can do what? → Access control
└── What can go wrong? → Error handling
```

### Step 2: Design State (Accounts)
```rust
// Ask yourself:
// 1. What information do I need to track?
// 2. How are things related?
// 3. What's the minimal data needed?

#[account]
pub struct MyState {
    pub owner: Pubkey,      // Who owns this?
    pub data: u64,          // What's being stored?
    pub status: bool,       // What's the current state?
    pub bump: u8,           // PDA bump
}
```

### Step 3: Design Instructions
```
For each action:
├── What accounts are needed?
│   ├── Who needs to sign? (Signer)
│   ├── What gets modified? (mut)
│   ├── What gets created? (init)
│   └── What's just read? (none)
├── What parameters are needed?
└── What validations are required?
```

### Step 4: Implement with Testing
```bash
# Write test first
anchor test --skip-deploy

# Iterate on implementation
# Fix errors
# Add more tests
```

## 4.2 Project Structure Best Practices

```
programs/my-program/
├── Cargo.toml              # Dependencies
├── src/
│   ├── lib.rs              # Entry point, instruction routing
│   ├── state.rs            # All account structures
│   ├── error.rs            # Custom errors
│   ├── constants.rs        # Configuration
│   └── instructions/
│       ├── mod.rs          # Re-exports
│       ├── create.rs       # Create instruction
│       ├── update.rs       # Update instruction
│       └── delete.rs       # Delete instruction
```

## 4.3 Security Checklist

```
□ All arithmetic uses checked_* methods
□ All signers are validated
□ PDAs have unique seeds
□ Access control on sensitive operations
□ Edge cases handled (empty, max values)
□ Reentrancy considerations
□ Integer overflow/underflow protected
```

---

# Part 5: Frontend Integration

## 5.1 Frontend Architecture

```
frontend/
├── src/
│   ├── components/         # React components
│   │   ├── WalletProvider.tsx
│   │   ├── CreateVesting.tsx
│   │   ├── ClaimTokens.tsx
│   │   ├── VestingDashboard.tsx
│   │   └── VestingCard.tsx
│   ├── hooks/              # Custom hooks
│   │   ├── useVesting.ts
│   │   └── useProgram.ts
│   ├── utils/              # Helper functions
│   │   ├── program.ts
│   │   └── helpers.ts
│   ├── idl/                # Program IDL
│   │   └── token_vesting.json
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

## 5.2 Key Frontend Concepts

### Connecting to Solana
```typescript
import { Connection, PublicKey } from '@solana/web3.js';

// Connect to cluster
const connection = new Connection('https://api.devnet.solana.com');
```

### Using Anchor on Frontend
```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

// Get provider
const { connection } = useConnection();
const wallet = useWallet();
const provider = new AnchorProvider(connection, wallet, {});

// Get program
const program = new Program(IDL, PROGRAM_ID, provider);
```

### Deriving PDAs
```typescript
// Same seeds as on-chain
const [vestingPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from('vesting'),
    admin.toBuffer(),
    beneficiary.toBuffer(),
    mint.toBuffer(),
  ],
  PROGRAM_ID
);
```

### Calling Instructions
```typescript
await program.methods
  .createVestingSchedule(
    new BN(totalAmount),
    new BN(startTime),
    new BN(cliffDuration),
    new BN(vestingDuration)
  )
  .accounts({
    admin: wallet.publicKey,
    beneficiary: beneficiaryPubkey,
    mint: mintPubkey,
    vestingSchedule: vestingPda,
    vault: vaultPda,
    adminTokenAccount: adminAta,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  })
  .rpc();
```

---

# Part 6: Deployment Guide

## 6.1 Deploy to Devnet

```bash
# 1. Build the program
anchor build

# 2. Get program keypair
anchor keys list
# Copy the key and update lib.rs declare_id!()

# 3. Rebuild with correct ID
anchor build

# 4. Deploy
anchor deploy --provider.cluster devnet

# 5. Note the program ID for frontend
```

## 6.2 Frontend Deployment

```bash
# Build frontend
cd frontend
npm run build

# Deploy to Vercel/Netlify
# Or serve the dist folder
```

## 6.3 Mainnet Considerations

```
□ Full security audit
□ Fuzz testing
□ Mainnet program ID
□ Production RPC endpoint
□ Error monitoring
□ Rate limiting
```

---

# Part 7: Testing

## 7.1 Test Structure

```typescript
describe("token-vesting", () => {
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  it("Creates vesting schedule", async () => {
    // Arrange
    const totalAmount = new BN(1_000_000_000);
    const startTime = new BN(Date.now() / 1000 + 3600);
    
    // Act
    await program.methods
      .createVestingSchedule(totalAmount, startTime, cliff, duration)
      .accounts({ ... })
      .rpc();
    
    // Assert
    const schedule = await program.account.vestingSchedule.fetch(pda);
    expect(schedule.totalAmount.toNumber()).to.equal(1_000_000_000);
  });
  
  it("Fails if cliff too long", async () => {
    try {
      await program.methods
        .createVestingSchedule(amount, start, tooLongCliff, duration)
        .accounts({ ... })
        .rpc();
      assert.fail("Should have thrown");
    } catch (e) {
      expect(e.error.errorCode.code).to.equal("CliffPercentageTooHigh");
    }
  });
});
```

## 7.2 Test Scenarios

```
Happy Path:
□ Create vesting schedule
□ Wait for cliff
□ Claim partial
□ Claim rest
□ Verify fully claimed

Edge Cases:
□ Claim before cliff (should fail)
□ Claim with nothing available (should fail)
□ Revoke before any vesting
□ Revoke after partial vesting
□ Claim after revoke (should work for vested)
□ Try to revoke twice (should fail)

Boundary Tests:
□ Minimum vesting duration
□ Maximum vesting duration
□ 50% cliff (max allowed)
□ 51% cliff (should fail)
```

---

This completes the theoretical and code-level explanation. The next sections contain the actual implementation files.
