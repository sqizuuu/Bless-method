import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Video, History, Coins, ShoppingBag, Database, UserCheck, LogOut, Sparkles } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { user, pointsStatus, logout, openAuthModal } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200/90 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTab('landing')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <img
              src="/bless-logo.jpg"
              alt="BLESS METHOD"
              className="w-9 h-9 rounded-lg object-contain border border-neutral-200 shadow-2xs group-hover:border-violet-300 transition-colors bg-white p-0.5"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold tracking-tight text-neutral-900 block leading-tight">
                  BLESS METHOD
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-600 inline-block"></span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium block">
                Use the quality you filmed
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: 4–5 single-line clean navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-600">
          <button
            onClick={() => onSelectTab('optimizer')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-neutral-900 relative py-1 ${
              currentTab === 'optimizer'
                ? 'text-neutral-950 font-semibold'
                : ''
            }`}
          >
            Optimizer
            {currentTab === 'optimizer' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 rounded-full"></span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-neutral-900 relative py-1 ${
              currentTab === 'history'
                ? 'text-neutral-950 font-semibold'
                : ''
            }`}
          >
            History
            {currentTab === 'history' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 rounded-full"></span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('points')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-neutral-900 relative py-1 ${
              currentTab === 'points'
                ? 'text-neutral-950 font-semibold'
                : ''
            }`}
          >
            Points
            {currentTab === 'points' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 rounded-full"></span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('shop')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-neutral-900 relative py-1 ${
              currentTab === 'shop'
                ? 'text-neutral-950 font-semibold'
                : ''
            }`}
          >
            Shop
            {currentTab === 'shop' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 rounded-full"></span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('settings')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-neutral-900 relative py-1 ${
              currentTab === 'settings'
                ? 'text-neutral-950 font-semibold'
                : ''
            }`}
          >
            Engines & DB
            {currentTab === 'settings' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 rounded-full"></span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('help')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-neutral-900 relative py-1 flex items-center gap-1.5 ${
              currentTab === 'help'
                ? 'text-neutral-950 font-semibold'
                : ''
            }`}
          >
            <span>Help</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 uppercase tracking-wider">
              AI
            </span>
            {currentTab === 'help' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 rounded-full"></span>
            )}
          </button>
        </nav>

        {/* Zone 3: 1 primary action / Account Area */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSelectTab('points')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:border-violet-300 text-xs font-medium text-neutral-800 transition-colors shadow-2xs"
                title="View points & transaction history"
              >
                <Coins className="w-3.5 h-3.5 text-violet-600" />
                <span className="font-mono tabular-nums font-bold text-neutral-900">
                  {(user.pointsBalance ?? 0).toFixed(1)}
                </span>
                <span className="text-neutral-400">pts</span>
              </button>

              <button
                onClick={() => onSelectTab('settings')}
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-950 transition-colors"
                title={user.email}
              >
                <UserCheck className="w-3.5 h-3.5 text-neutral-500" />
                <span className="max-w-[110px] truncate">{user.displayName || user.email.split('@')[0]}</span>
              </button>

              <button
                onClick={() => logout()}
                className="p-1.5 text-neutral-400 hover:text-neutral-800 transition-colors rounded-md"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuthModal('login')}
                className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-950 transition-colors whitespace-nowrap"
              >
                Sign In
              </button>
              <button
                onClick={() => openAuthModal('register')}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-xs whitespace-nowrap flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3" />
                <span>30 Free Points</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav bar strip */}
      <div className="md:hidden flex items-center justify-around px-2 py-2 border-t border-neutral-100 bg-white text-xs text-neutral-600">
        <button
          onClick={() => onSelectTab('optimizer')}
          className={`px-2 py-1 ${currentTab === 'optimizer' ? 'font-semibold text-violet-700' : ''}`}
        >
          Optimizer
        </button>
        <button
          onClick={() => onSelectTab('history')}
          className={`px-2 py-1 ${currentTab === 'history' ? 'font-semibold text-violet-700' : ''}`}
        >
          History
        </button>
        <button
          onClick={() => onSelectTab('points')}
          className={`px-2 py-1 ${currentTab === 'points' ? 'font-semibold text-violet-700' : ''}`}
        >
          Points
        </button>
        <button
          onClick={() => onSelectTab('shop')}
          className={`px-2 py-1 ${currentTab === 'shop' ? 'font-semibold text-violet-700' : ''}`}
        >
          Shop
        </button>
        <button
          onClick={() => onSelectTab('settings')}
          className={`px-2 py-1 ${currentTab === 'settings' ? 'font-semibold text-violet-700' : ''}`}
        >
          Engines
        </button>
        <button
          onClick={() => onSelectTab('help')}
          className={`px-2 py-1 flex items-center gap-1 ${currentTab === 'help' ? 'font-semibold text-violet-700' : ''}`}
        >
          <span>Help</span>
          <span className="text-[9px] bg-violet-100 text-violet-700 px-1 rounded-sm font-bold">AI</span>
        </button>
      </div>
    </header>
  );
};
