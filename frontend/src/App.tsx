import { FC, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Toaster } from 'react-hot-toast';
import { CreateVesting } from './components/CreateVesting';
import { VestingDashboard } from './components/VestingDashboard';

type ViewType = 'dashboard' | 'create';

const App: FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Toast notifications */}
      <Toaster position="top-right" />
      
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl">⏳</span>
              </div>
              <h1 className="text-xl font-bold text-gray-800">Token Vesting</h1>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'dashboard'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('create')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'create'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Create Vesting
              </button>
              
              {/* Wallet Button */}
              <WalletMultiButton className="!bg-gradient-to-r !from-purple-600 !to-blue-600 !rounded-lg" />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' ? (
          <VestingDashboard />
        ) : (
          <div className="max-w-2xl mx-auto">
            <CreateVesting onSuccess={() => setCurrentView('dashboard')} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <p>Token Vesting Protocol on Solana</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-purple-600 transition-colors">Documentation</a>
              <a href="#" className="hover:text-purple-600 transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
