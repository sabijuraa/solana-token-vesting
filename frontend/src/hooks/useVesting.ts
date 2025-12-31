import { useState, useCallback, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';
import {
  getProgram,
  createVestingSchedule,
  claimTokens,
  revokeVesting,
  fetchVestingSchedulesForBeneficiary,
  fetchVestingSchedulesForAdmin,
  VestingInfo,
} from '../utils/program';

export function useVesting() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [beneficiarySchedules, setBeneficiarySchedules] = useState<VestingInfo[]>([]);
  const [adminSchedules, setAdminSchedules] = useState<VestingInfo[]>([]);

  // Get provider and program
  const getProviderAndProgram = useCallback(() => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      throw new Error('Wallet not connected');
    }

    const provider = new AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      },
      { commitment: 'confirmed' }
    );

    const program = getProgram(provider);
    return { provider, program };
  }, [connection, wallet]);

  // Refresh all schedules
  const refreshSchedules = useCallback(async () => {
    if (!wallet.publicKey) return;

    try {
      const { program } = getProviderAndProgram();
      
      const [beneficiary, admin] = await Promise.all([
        fetchVestingSchedulesForBeneficiary(program, wallet.publicKey),
        fetchVestingSchedulesForAdmin(program, wallet.publicKey),
      ]);

      setBeneficiarySchedules(beneficiary);
      setAdminSchedules(admin);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    }
  }, [wallet.publicKey, getProviderAndProgram]);

  // Auto-refresh on wallet change
  useEffect(() => {
    if (wallet.publicKey) {
      refreshSchedules();
    } else {
      setBeneficiarySchedules([]);
      setAdminSchedules([]);
    }
  }, [wallet.publicKey, refreshSchedules]);

  // Create vesting schedule
  const create = useCallback(
    async (
      beneficiary: string,
      mint: string,
      totalAmount: string,
      startTime: number,
      cliffDuration: number,
      vestingDuration: number,
      decimals: number = 9
    ) => {
      if (!wallet.publicKey) {
        toast.error('Please connect your wallet');
        return null;
      }

      setLoading(true);
      const toastId = toast.loading('Creating vesting schedule...');

      try {
        const { program } = getProviderAndProgram();
        
        // Parse the amount with proper decimals
        const [intPart, fracPart = ''] = totalAmount.split('.');
        const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
        const amountBN = new BN(intPart + paddedFrac);

        const tx = await createVestingSchedule(
          program,
          wallet.publicKey,
          new PublicKey(beneficiary),
          new PublicKey(mint),
          amountBN,
          new BN(startTime),
          new BN(cliffDuration),
          new BN(vestingDuration)
        );

        toast.success('Vesting schedule created!', { id: toastId });
        await refreshSchedules();
        return tx;
      } catch (error: any) {
        console.error('Create vesting error:', error);
        const errorMsg = error?.message || 'Failed to create vesting schedule';
        toast.error(errorMsg, { id: toastId });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [wallet.publicKey, getProviderAndProgram, refreshSchedules]
  );

  // Claim tokens
  const claim = useCallback(
    async (admin: string, mint: string) => {
      if (!wallet.publicKey) {
        toast.error('Please connect your wallet');
        return null;
      }

      setLoading(true);
      const toastId = toast.loading('Claiming tokens...');

      try {
        const { program } = getProviderAndProgram();

        const tx = await claimTokens(
          program,
          wallet.publicKey,
          new PublicKey(admin),
          new PublicKey(mint)
        );

        toast.success('Tokens claimed successfully!', { id: toastId });
        await refreshSchedules();
        return tx;
      } catch (error: any) {
        console.error('Claim error:', error);
        const errorMsg = error?.message || 'Failed to claim tokens';
        toast.error(errorMsg, { id: toastId });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [wallet.publicKey, getProviderAndProgram, refreshSchedules]
  );

  // Revoke vesting
  const revoke = useCallback(
    async (beneficiary: string, mint: string) => {
      if (!wallet.publicKey) {
        toast.error('Please connect your wallet');
        return null;
      }

      setLoading(true);
      const toastId = toast.loading('Revoking vesting schedule...');

      try {
        const { program } = getProviderAndProgram();

        const tx = await revokeVesting(
          program,
          wallet.publicKey,
          new PublicKey(beneficiary),
          new PublicKey(mint)
        );

        toast.success('Vesting revoked successfully!', { id: toastId });
        await refreshSchedules();
        return tx;
      } catch (error: any) {
        console.error('Revoke error:', error);
        const errorMsg = error?.message || 'Failed to revoke vesting';
        toast.error(errorMsg, { id: toastId });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [wallet.publicKey, getProviderAndProgram, refreshSchedules]
  );

  return {
    loading,
    beneficiarySchedules,
    adminSchedules,
    create,
    claim,
    revoke,
    refreshSchedules,
  };
}
