import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api.js';
import { PointTransaction } from '../types.js';
import { Coins, Sparkles, Clock, CheckCircle2, ArrowRight, ShoppingBag, AlertCircle } from 'lucide-react';

interface PointsPageProps {
  onOpenShop: () => void;
}

export const PointsPage: React.FC<PointsPageProps> = ({ onOpenShop }) => {
  const { user, pointsStatus, refreshPoints, openAuthModal } = useAuth();
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

  useEffect(() => {
    if (pointsStatus) {
      setCountdownSeconds(pointsStatus.secondsUntilNextClaim || 0);
    }
  }, [pointsStatus]);

  // Live countdown timer ticker
  useEffect(() => {
    if (countdownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdownSeconds]);

  const fetchTransactions = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getTransactions();
      setTransactions(data);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  const handleClaimWeekly = async () => {
    setClaiming(true);
    setClaimMessage(null);
    setClaimError(null);
    try {
      const res = await api.claimWeeklyReward();
      setClaimMessage(res.message);
      await refreshPoints();
      await fetchTransactions();
    } catch (err: any) {
      setClaimError(err.message || 'Could not claim weekly points');
    } finally {
      setClaiming(false);
    }
  };

  const formatCountdown = (totalSec: number) => {
    const days = Math.floor(totalSec / (24 * 3600));
    const hours = Math.floor((totalSec % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4 bg-white">
        <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center mx-auto border border-violet-100">
          <Coins className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Sign in to manage your points</h2>
        <p className="text-xs text-neutral-500">
          Each account receives 30 free points every 7 days. Track your transparent transaction ledger and balances.
        </p>
        <button
          onClick={() => openAuthModal('login')}
          className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-700 transition-colors shadow-xs"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 bg-white">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
            Points & Balance
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Transparent server-side points ledger with fractional point precision.
          </p>
        </div>

        <button
          onClick={onOpenShop}
          className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-700 transition-colors shadow-xs flex items-center gap-2"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Points Shop</span>
        </button>
      </div>

      {claimMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{claimMessage}</span>
        </div>
      )}

      {claimError && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{claimError}</span>
        </div>
      )}

      {/* Top Cards: Balance + Weekly Grant */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-10">
        {/* Balance Card */}
        <div className="md:col-span-5 bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Current Points Balance
            </span>
            <div className="flex items-baseline gap-2 pt-2">
              <span className="text-4xl font-extrabold font-mono text-neutral-900 tabular-nums">
                {(user.pointsBalance ?? 0).toFixed(1)}
              </span>
              <span className="text-sm text-violet-700 font-semibold">points</span>
            </div>
            <p className="text-xs text-neutral-500 pt-1">
              Supports up to {Math.floor((user.pointsBalance ?? 0) / 4.5)} Low, {Math.floor((user.pointsBalance ?? 0) / 8.5)} Medium, or {Math.floor((user.pointsBalance ?? 0) / 10)} High optimizations.
            </p>
          </div>

          <div className="pt-6 border-t border-neutral-100 flex items-center justify-between text-xs">
            <span className="text-neutral-500">Need more capacity?</span>
            <button
              onClick={onOpenShop}
              className="font-semibold text-violet-700 hover:underline flex items-center gap-1"
            >
              <span>Explore packages</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Weekly Grant Card */}
        <div className="md:col-span-7 bg-white rounded-2xl border-2 border-violet-600 bg-violet-50/20 p-6 shadow-2xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">
                Weekly Free Reward
              </span>
              <span className="font-mono text-xs font-bold text-violet-800">+30.0 PTS</span>
            </div>
            <h3 className="text-lg font-bold text-neutral-900">
              Claim 30 Free Points Every 7 Days
            </h3>
            <p className="text-xs text-neutral-600 leading-relaxed max-w-lg">
              BLESS METHOD rewards creators with a weekly replenishment of 30.0 points. Points never expire and stack with purchased credits.
            </p>
          </div>

          <div className="pt-6 border-t border-neutral-200/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              {pointsStatus?.canClaimWeekly ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Your 30.0 points reward is ready to claim!</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Next claim unlock in:</span>
                  <span className="font-mono font-bold text-neutral-900 tabular-nums">
                    {formatCountdown(countdownSeconds)}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={handleClaimWeekly}
              disabled={!pointsStatus?.canClaimWeekly || claiming}
              className="py-2.5 px-5 bg-violet-600 text-white disabled:opacity-40 text-xs font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-xs shrink-0 flex items-center justify-center gap-1.5"
            >
              {claiming ? (
                <span>Crediting balance...</span>
              ) : pointsStatus?.canClaimWeekly ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Claim +30.0 Free Points</span>
                </>
              ) : (
                <span>On 7-Day Cooldown</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Transaction History Ledger */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-900">
            Immutable Transaction Ledger
          </h3>
          <span className="text-xs text-neutral-500">
            {transactions.length} record(s) logged
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-500 font-mono">
            Loading ledger...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            No transactions found on this account yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Description</th>
                  <th className="py-3 px-5">Reference</th>
                  <th className="py-3 px-5">Amount</th>
                  <th className="py-3 px-5">Balance After</th>
                  <th className="py-3 px-5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {transactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  const isZero = tx.amount === 0;

                  return (
                    <tr key={tx.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3.5 px-5">
                        <span className="font-semibold capitalize font-mono text-neutral-900">
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 font-medium text-neutral-900 max-w-sm truncate">
                        {tx.description}
                      </td>

                      <td className="py-3.5 px-5 font-mono text-neutral-400 text-[11px]">
                        {tx.referenceJobId || '—'}
                      </td>

                      <td className="py-3.5 px-5 font-mono tabular-nums font-semibold">
                        {isZero ? (
                          <span className="text-neutral-500">0.0 pts</span>
                        ) : isPositive ? (
                          <span className="text-emerald-700">+{tx.amount.toFixed(1)} pts</span>
                        ) : (
                          <span className="text-violet-700">{tx.amount.toFixed(1)} pts</span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 font-mono tabular-nums text-neutral-700">
                        {tx.balanceAfter.toFixed(1)} pts
                      </td>

                      <td className="py-3.5 px-5 font-mono text-neutral-500 tabular-nums">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
