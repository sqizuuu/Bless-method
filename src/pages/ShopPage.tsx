import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api.js';
import { PointsPackage } from '../types.js';
import { ShoppingBag, CheckCircle2, ShieldCheck, ArrowRight, Sparkles, AlertCircle, Info } from 'lucide-react';

interface ShopPageProps {
  onOpenOptimizer: () => void;
  onOpenPoints: () => void;
}

export const ShopPage: React.FC<ShopPageProps> = ({ onOpenOptimizer, onOpenPoints }) => {
  const { user, refreshPoints, openAuthModal } = useAuth();
  const [packages, setPackages] = useState<PointsPackage[]>([]);
  const [stripeStatus, setStripeStatus] = useState<{
    configured: boolean;
    hasWebhook: boolean;
    instructions: string;
  } | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{
    package: PointsPackage;
    receiptId: string;
    newBalance: number;
  } | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    api.getShopPackages().then((data) => {
      setPackages(data.packages || []);
      setStripeStatus({
        configured: data.configured,
        hasWebhook: data.hasWebhook,
        instructions: data.instructions,
      });
    });
  }, []);

  const handleBuy = async (pkg: PointsPackage) => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    setPurchaseError(null);
    setPurchaseSuccess(null);
    setPurchasing(pkg.id);

    try {
      const res = await api.simulateTestPurchase(pkg.id);
      setPurchaseSuccess({
        package: pkg,
        receiptId: res.receiptId,
        newBalance: res.newBalance,
      });
      await refreshPoints();
    } catch (err: any) {
      setPurchaseError(err.message || 'Payment simulation failed');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 bg-white">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
            Points Shop
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Recharge your optimization credits. Points never expire and unlock instant processing.
          </p>
        </div>

        {user && (
          <button
            onClick={onOpenPoints}
            className="px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:border-violet-300 text-xs font-semibold text-neutral-800 flex items-center gap-2 shadow-2xs"
          >
            <span>Current Balance:</span>
            <span className="font-mono tabular-nums text-violet-700 font-bold">{(user.pointsBalance ?? 0).toFixed(1)} pts</span>
          </button>
        )}
      </div>

      {/* Stripe Status & Config Notice */}
      <div className="mb-8 p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 text-xs text-neutral-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold text-neutral-900">
              {stripeStatus?.configured ? 'Stripe Checkout Active' : 'Stripe Environment: Developer Test Sandbox'}
            </span>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {stripeStatus?.instructions} Packages below run in transparent test mode and credit verified points directly to your database balance.
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-white border border-neutral-200 rounded-md text-neutral-800 shrink-0">
          EUR / Cards / SEPA
        </span>
      </div>

      {purchaseSuccess && (
        <div className="mb-8 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-950">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            <span>Points Successfully Credited!</span>
          </div>
          <p>
            +{purchaseSuccess.package.points} points added to your creator account. Your updated balance is{' '}
            <strong className="font-mono">{purchaseSuccess.newBalance.toFixed(1)} pts</strong>.
          </p>
          <div className="font-mono text-[11px] text-emerald-800">
            Audit Receipt ID: {purchaseSuccess.receiptId}
          </div>
          <div className="pt-2">
            <button
              onClick={onOpenOptimizer}
              className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-medium hover:bg-emerald-900 transition-colors"
            >
              Start Optimizing Videos →
            </button>
          </div>
        </div>
      )}

      {purchaseError && (
        <div className="mb-8 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{purchaseError}</span>
        </div>
      )}

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`p-6 sm:p-8 rounded-2xl bg-white border flex flex-col justify-between space-y-6 ${
              pkg.popular ? 'border-2 border-violet-600 bg-violet-50/15 shadow-xs relative' : 'border-neutral-200 shadow-2xs'
            }`}
          >
            {pkg.popular && (
              <span className="absolute -top-3 left-6 bg-violet-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-2xs">
                Most Popular
              </span>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {pkg.name}
                </span>
                <span className="font-mono font-bold text-xs text-violet-700">
                  {pkg.priceFormatted}
                </span>
              </div>

              <div>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-neutral-900 tabular-nums">
                  {pkg.points}
                </div>
                <div className="text-xs text-neutral-500 font-medium mt-0.5">Optimization Points</div>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                {pkg.bonus}
              </p>

              <div className="pt-4 border-t border-neutral-100 space-y-2 text-xs text-neutral-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" />
                  <span>Permanent validity (no expiry)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" />
                  <span>HandBrakeCLI & FFmpeg acceleration</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" />
                  <span>Full stream metadata audits</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleBuy(pkg)}
              disabled={purchasing === pkg.id}
              className={`w-full py-2.5 px-4 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                pkg.popular
                  ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-xs'
                  : 'border border-neutral-200 text-neutral-900 hover:bg-neutral-50 shadow-2xs'
              }`}
            >
              {purchasing === pkg.id ? (
                <span>Processing...</span>
              ) : (
                <>
                  <span>Select {pkg.name} ({pkg.priceFormatted})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
