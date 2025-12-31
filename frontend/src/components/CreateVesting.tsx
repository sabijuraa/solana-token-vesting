import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useVesting } from '../hooks/useVesting';

interface Props {
  onSuccess?: () => void;
}

export const CreateVesting: FC<Props> = ({ onSuccess }) => {
  const { publicKey } = useWallet();
  const { create, loading } = useVesting();
  
  const [formData, setFormData] = useState({
    beneficiary: '',
    mint: '',
    amount: '',
    startDate: '',
    startTime: '',
    cliffDays: '90',
    vestingDays: '365',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey) return;

    // Calculate timestamps
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    const startTimestamp = Math.floor(startDateTime.getTime() / 1000);
    const cliffSeconds = parseInt(formData.cliffDays) * 86400;
    const vestingSeconds = parseInt(formData.vestingDays) * 86400;

    const result = await create(
      formData.beneficiary,
      formData.mint,
      formData.amount,
      startTimestamp,
      cliffSeconds,
      vestingSeconds,
      9 // Assuming 9 decimals (like SOL)
    );

    if (result && onSuccess) {
      onSuccess();
      setFormData({
        beneficiary: '',
        mint: '',
        amount: '',
        startDate: '',
        startTime: '',
        cliffDays: '90',
        vestingDays: '365',
      });
    }
  };

  if (!publicKey) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">Please connect your wallet to create a vesting schedule.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Create Vesting Schedule</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Beneficiary */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Beneficiary Address
          </label>
          <input
            type="text"
            name="beneficiary"
            value={formData.beneficiary}
            onChange={handleChange}
            placeholder="Enter beneficiary wallet address"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
        </div>

        {/* Token Mint */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Token Mint Address
          </label>
          <input
            type="text"
            name="mint"
            value={formData.mint}
            onChange={handleChange}
            placeholder="Enter SPL token mint address"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Amount
          </label>
          <input
            type="text"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            placeholder="e.g., 1000000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
        </div>

        {/* Start Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <input
              type="time"
              name="startTime"
              value={formData.startTime}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        {/* Cliff & Vesting Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliff Period (days)
            </label>
            <input
              type="number"
              name="cliffDays"
              value={formData.cliffDays}
              onChange={handleChange}
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Must be ≤50% of vesting</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vesting Duration (days)
            </label>
            <input
              type="number"
              name="vestingDays"
              value={formData.vestingDays}
              onChange={handleChange}
              min="1"
              max="3650"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Min 1 day, max 10 years</p>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Creating...' : 'Create Vesting Schedule'}
        </button>
      </form>
    </div>
  );
};
