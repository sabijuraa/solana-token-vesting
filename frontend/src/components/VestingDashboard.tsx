import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useVesting } from '../hooks/useVesting';
import { VestingCard } from './VestingCard';

type TabType = 'beneficiary' | 'admin';

export const VestingDashboard: FC = () => {
  const { publicKey } = useWallet();
  const { beneficiarySchedules, adminSchedules, claim, revoke, loading, refreshSchedules } = useVesting();
  const [activeTab, setActiveTab] = useState<TabType>('beneficiary');

  if (!publicKey) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Connect Your Wallet</h2>
        <p className="text-gray-600">Please connect your wallet to view your vesting schedules.</p>
      </div>
    );
  }

  const handleClaim = async (admin: string, mint: string) => {
    await claim(admin, mint);
  };

  const handleRevoke = async (beneficiary: string, mint: string) => {
    await revoke(beneficiary, mint);
  };

  const currentSchedules = activeTab === 'beneficiary' ? beneficiarySchedules : adminSchedules;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Vesting Dashboard</h2>
        <button
          onClick={refreshSchedules}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('beneficiary')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            activeTab === 'beneficiary'
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          My Vestings ({beneficiarySchedules.length})
        </button>
        <button
          onClick={() => setActiveTab('admin')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            activeTab === 'admin'
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Created by Me ({adminSchedules.length})
        </button>
      </div>

      {/* Schedules Grid */}
      {currentSchedules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentSchedules.map((schedule) => (
            <VestingCard
              key={schedule.publicKey.toBase58()}
              schedule={schedule}
              isAdmin={activeTab === 'admin'}
              onClaim={() => handleClaim(
                schedule.account.admin.toBase58(),
                schedule.account.mint.toBase58()
              )}
              onRevoke={() => handleRevoke(
                schedule.account.beneficiary.toBase58(),
                schedule.account.mint.toBase58()
              )}
              loading={loading}
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">
            {activeTab === 'beneficiary' ? '📭' : '📝'}
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {activeTab === 'beneficiary' 
              ? 'No Vesting Schedules Found' 
              : 'No Schedules Created'}
          </h3>
          <p className="text-gray-500">
            {activeTab === 'beneficiary'
              ? "You don't have any vesting schedules assigned to you yet."
              : "You haven't created any vesting schedules yet."}
          </p>
        </div>
      )}
    </div>
  );
};
