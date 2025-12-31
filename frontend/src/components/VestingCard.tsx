import { FC, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { VestingInfo, formatTokenAmount, shortenAddress } from '../utils/program';

interface Props {
  schedule: VestingInfo;
  isAdmin: boolean;
  onClaim?: () => Promise<void>;
  onRevoke?: () => Promise<void>;
  loading?: boolean;
}

export const VestingCard: FC<Props> = ({
  schedule,
  isAdmin,
  onClaim,
  onRevoke,
  loading = false,
}) => {
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Update time every second for live progress
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { account, cliffEnd, vestingEnd, percentVested } = schedule;
  
  const startTime = account.startTime.toNumber() * 1000;
  const isStarted = currentTime >= startTime;
  const isCliffReached = currentTime >= cliffEnd.getTime();
  const isFullyVested = currentTime >= vestingEnd.getTime();
  
  const claimableAmount = schedule.claimableAmount;
  const hasClaimable = claimableAmount.gt(schedule.claimableAmount.sub(schedule.claimableAmount));

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (isFullyVested) return 'Fully vested';
    if (!isCliffReached) {
      const remaining = cliffEnd.getTime() - currentTime;
      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return `Cliff in ${days}d ${hours}h`;
    }
    const remaining = vestingEnd.getTime() - currentTime;
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    return `${days} days remaining`;
  };

  const getStatusColor = () => {
    if (account.isRevoked) return 'bg-red-100 text-red-800';
    if (isFullyVested) return 'bg-green-100 text-green-800';
    if (isCliffReached) return 'bg-blue-100 text-blue-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getStatusText = () => {
    if (account.isRevoked) return 'Revoked';
    if (isFullyVested) return 'Fully Vested';
    if (isCliffReached) return 'Vesting';
    if (isStarted) return 'Cliff Period';
    return 'Not Started';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-white font-semibold">
              Token: {shortenAddress(account.mint.toBase58())}
            </h3>
            <p className="text-purple-200 text-sm">
              {isAdmin ? `To: ${shortenAddress(account.beneficiary.toBase58())}` : `From: ${shortenAddress(account.admin.toBase58())}`}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{percentVested}% vested</span>
          <span>{getTimeRemaining()}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(percentVested, 100)}%` }}
          />
        </div>
      </div>

      {/* Details */}
      <div className="px-6 py-4 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Total Amount</span>
            <p className="font-semibold">{formatTokenAmount(account.totalAmount)}</p>
          </div>
          <div>
            <span className="text-gray-500">Claimed</span>
            <p className="font-semibold">{formatTokenAmount(account.claimedAmount)}</p>
          </div>
          <div>
            <span className="text-gray-500">Cliff Ends</span>
            <p className="font-semibold">{format(cliffEnd, 'MMM d, yyyy')}</p>
          </div>
          <div>
            <span className="text-gray-500">Vesting Ends</span>
            <p className="font-semibold">{format(vestingEnd, 'MMM d, yyyy')}</p>
          </div>
        </div>

        {/* Claimable Amount */}
        {!isAdmin && isCliffReached && !account.isRevoked && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-green-600 text-sm">Available to Claim</span>
                <p className="text-green-800 font-bold text-lg">
                  {formatTokenAmount(claimableAmount)} tokens
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-gray-50">
        {isAdmin ? (
          <button
            onClick={onRevoke}
            disabled={loading || account.isRevoked || isFullyVested}
            className="w-full bg-red-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {account.isRevoked ? 'Already Revoked' : isFullyVested ? 'Cannot Revoke' : loading ? 'Processing...' : 'Revoke Vesting'}
          </button>
        ) : (
          <button
            onClick={onClaim}
            disabled={loading || !isCliffReached || account.isRevoked || claimableAmount.isZero()}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {!isCliffReached
              ? 'Cliff Not Reached'
              : account.isRevoked
              ? 'Vesting Revoked'
              : claimableAmount.isZero()
              ? 'Nothing to Claim'
              : loading
              ? 'Claiming...'
              : 'Claim Tokens'}
          </button>
        )}
      </div>
    </div>
  );
};
