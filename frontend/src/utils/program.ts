import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import IDL from '../idl/token_vesting.json';

// Program ID - Update this after deploying to your cluster
export const PROGRAM_ID = new PublicKey('4JHtvoNPJ8GzPk5C2M6fvMnFzSkV3intLHVLUvxuZxhM');

// Seeds for PDA derivation
export const VESTING_SEED = Buffer.from('vesting');
export const VAULT_SEED = Buffer.from('vault');

// Types
export interface VestingSchedule {
  admin: PublicKey;
  beneficiary: PublicKey;
  mint: PublicKey;
  totalAmount: BN;
  claimedAmount: BN;
  startTime: BN;
  cliffDuration: BN;
  vestingDuration: BN;
  isRevoked: boolean;
  revokedAmount: BN;
  bump: number;
  vaultBump: number;
}

export interface VestingInfo {
  publicKey: PublicKey;
  account: VestingSchedule;
  vestedAmount: BN;
  claimableAmount: BN;
  cliffEnd: Date;
  vestingEnd: Date;
  percentVested: number;
}

/**
 * Get the Anchor program instance
 */
export function getProgram(provider: AnchorProvider): Program {
  return new Program(IDL as Idl, provider);
}

/**
 * Derive the vesting schedule PDA
 */
export function getVestingPDA(
  admin: PublicKey,
  beneficiary: PublicKey,
  mint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VESTING_SEED, admin.toBuffer(), beneficiary.toBuffer(), mint.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive the vault PDA
 */
export function getVaultPDA(vestingSchedule: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, vestingSchedule.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Calculate vested amount at a given time
 */
export function calculateVestedAmount(
  schedule: VestingSchedule,
  currentTime: number
): BN {
  if (schedule.isRevoked) {
    return schedule.totalAmount.sub(schedule.revokedAmount);
  }

  const startTime = schedule.startTime.toNumber();
  const cliffDuration = schedule.cliffDuration.toNumber();
  const vestingDuration = schedule.vestingDuration.toNumber();
  const cliffEnd = startTime + cliffDuration;
  const vestingEnd = startTime + vestingDuration;

  if (currentTime < cliffEnd) {
    return new BN(0);
  }

  if (currentTime >= vestingEnd) {
    return schedule.totalAmount;
  }

  const elapsed = currentTime - startTime;
  const vested = schedule.totalAmount
    .mul(new BN(elapsed))
    .div(new BN(vestingDuration));

  return vested;
}

/**
 * Calculate claimable amount at a given time
 */
export function calculateClaimableAmount(
  schedule: VestingSchedule,
  currentTime: number
): BN {
  const vested = calculateVestedAmount(schedule, currentTime);
  const claimable = vested.sub(schedule.claimedAmount);
  return claimable.gt(new BN(0)) ? claimable : new BN(0);
}

/**
 * Create a new vesting schedule
 */
export async function createVestingSchedule(
  program: Program,
  admin: PublicKey,
  beneficiary: PublicKey,
  mint: PublicKey,
  totalAmount: BN,
  startTime: BN,
  cliffDuration: BN,
  vestingDuration: BN
): Promise<string> {
  const [vestingPDA] = getVestingPDA(admin, beneficiary, mint);
  const [vaultPDA] = getVaultPDA(vestingPDA);
  const adminTokenAccount = getAssociatedTokenAddressSync(mint, admin);

  const tx = await program.methods
    .createVestingSchedule(totalAmount, startTime, cliffDuration, vestingDuration)
    .accounts({
      admin,
      beneficiary,
      mint,
      vestingSchedule: vestingPDA,
      vault: vaultPDA,
      adminTokenAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  return tx;
}

/**
 * Claim vested tokens
 */
export async function claimTokens(
  program: Program,
  beneficiary: PublicKey,
  admin: PublicKey,
  mint: PublicKey
): Promise<string> {
  const [vestingPDA] = getVestingPDA(admin, beneficiary, mint);
  const [vaultPDA] = getVaultPDA(vestingPDA);
  const beneficiaryTokenAccount = getAssociatedTokenAddressSync(mint, beneficiary);

  const tx = await program.methods
    .claim()
    .accounts({
      beneficiary,
      vestingSchedule: vestingPDA,
      mint,
      vault: vaultPDA,
      beneficiaryTokenAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  return tx;
}

/**
 * Revoke a vesting schedule (admin only)
 */
export async function revokeVesting(
  program: Program,
  admin: PublicKey,
  beneficiary: PublicKey,
  mint: PublicKey
): Promise<string> {
  const [vestingPDA] = getVestingPDA(admin, beneficiary, mint);
  const [vaultPDA] = getVaultPDA(vestingPDA);
  const adminTokenAccount = getAssociatedTokenAddressSync(mint, admin);

  const tx = await program.methods
    .revoke()
    .accounts({
      admin,
      vestingSchedule: vestingPDA,
      mint,
      vault: vaultPDA,
      adminTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  return tx;
}

/**
 * Fetch a specific vesting schedule
 */
export async function fetchVestingSchedule(
  program: Program,
  vestingPDA: PublicKey
): Promise<VestingSchedule | null> {
  try {
    const account = await program.account.vestingSchedule.fetch(vestingPDA);
    return account as unknown as VestingSchedule;
  } catch {
    return null;
  }
}

/**
 * Fetch all vesting schedules for a beneficiary
 */
export async function fetchVestingSchedulesForBeneficiary(
  program: Program,
  beneficiary: PublicKey
): Promise<VestingInfo[]> {
  const currentTime = Math.floor(Date.now() / 1000);
  
  const accounts = await program.account.vestingSchedule.all([
    {
      memcmp: {
        offset: 8 + 32, // Skip discriminator + admin pubkey
        bytes: beneficiary.toBase58(),
      },
    },
  ]);

  return accounts.map(({ publicKey, account }) => {
    const schedule = account as unknown as VestingSchedule;
    const vestedAmount = calculateVestedAmount(schedule, currentTime);
    const claimableAmount = calculateClaimableAmount(schedule, currentTime);
    
    const startTime = schedule.startTime.toNumber() * 1000;
    const cliffEnd = new Date(startTime + schedule.cliffDuration.toNumber() * 1000);
    const vestingEnd = new Date(startTime + schedule.vestingDuration.toNumber() * 1000);
    
    const percentVested = schedule.totalAmount.gt(new BN(0))
      ? vestedAmount.mul(new BN(100)).div(schedule.totalAmount).toNumber()
      : 0;

    return {
      publicKey,
      account: schedule,
      vestedAmount,
      claimableAmount,
      cliffEnd,
      vestingEnd,
      percentVested,
    };
  });
}

/**
 * Fetch all vesting schedules created by an admin
 */
export async function fetchVestingSchedulesForAdmin(
  program: Program,
  admin: PublicKey
): Promise<VestingInfo[]> {
  const currentTime = Math.floor(Date.now() / 1000);
  
  const accounts = await program.account.vestingSchedule.all([
    {
      memcmp: {
        offset: 8, // Skip discriminator
        bytes: admin.toBase58(),
      },
    },
  ]);

  return accounts.map(({ publicKey, account }) => {
    const schedule = account as unknown as VestingSchedule;
    const vestedAmount = calculateVestedAmount(schedule, currentTime);
    const claimableAmount = calculateClaimableAmount(schedule, currentTime);
    
    const startTime = schedule.startTime.toNumber() * 1000;
    const cliffEnd = new Date(startTime + schedule.cliffDuration.toNumber() * 1000);
    const vestingEnd = new Date(startTime + schedule.vestingDuration.toNumber() * 1000);
    
    const percentVested = schedule.totalAmount.gt(new BN(0))
      ? vestedAmount.mul(new BN(100)).div(schedule.totalAmount).toNumber()
      : 0;

    return {
      publicKey,
      account: schedule,
      vestedAmount,
      claimableAmount,
      cliffEnd,
      vestingEnd,
      percentVested,
    };
  });
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: BN, decimals: number = 9): string {
  const divisor = new BN(10).pow(new BN(decimals));
  const integerPart = amount.div(divisor);
  const fractionalPart = amount.mod(divisor);
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  if (trimmedFractional) {
    return `${integerPart.toString()}.${trimmedFractional}`;
  }
  return integerPart.toString();
}

/**
 * Parse token amount from string
 */
export function parseTokenAmount(amount: string, decimals: number = 9): BN {
  const [integerPart, fractionalPart = ''] = amount.split('.');
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  const fullAmount = integerPart + paddedFractional;
  return new BN(fullAmount);
}

/**
 * Shorten a public key for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
