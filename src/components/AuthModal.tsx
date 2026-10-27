import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api.js';
import { X, Sparkles, Check, ArrowRight, Info } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    login,
    register,
    loginWithOAuth,
    simulateOAuth,
    openAuthModal,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [discordNotice, setDiscordNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'discord' | null>(null);
  const [oauthConfig, setOauthConfig] = useState<{
    google: { configured: boolean; callbackUrl: string };
    discord: { configured: boolean; callbackUrl: string };
  } | null>(null);

  useEffect(() => {
    if (isAuthModalOpen) {
      setDiscordNotice(null);
      setError(null);
      api.getOAuthConfig().then((cfg) => {
        setOauthConfig({
          google: { configured: cfg.google.configured, callbackUrl: cfg.google.callbackUrl },
          discord: { configured: cfg.discord.configured, callbackUrl: cfg.discord.callbackUrl },
        });
      }).catch(() => {});
    }
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDiscordNotice(null);
    setSubmitting(true);

    try {
      if (authModalMode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuthClick = async (provider: 'google' | 'discord') => {
    setError(null);
    if (provider === 'discord') {
      setDiscordNotice('Discord sign-in is coming soon! Please sign in with Google to use the video optimizer.');
      return;
    }
    setDiscordNotice(null);
    setOauthLoading(provider);
    try {
      await loginWithOAuth(provider);
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}`);
    } finally {
      setOauthLoading(null);
    }
  };

  const fillDemoAccount = () => {
    setEmail('creator@blessmethod.com');
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-2xs">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full p-6 sm:p-8 relative">
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 transition-colors rounded-md p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <img
            src="/bless-logo.jpg"
            alt="BLESS METHOD"
            className="w-10 h-10 rounded-xl object-contain border border-neutral-200 shadow-2xs mb-3 bg-white p-1"
          />
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            {authModalMode === 'login' ? 'Sign in to BLESS METHOD' : 'Create Creator Account'}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {authModalMode === 'login'
              ? 'Access your saved jobs, weekly points, and HandBrake/FFmpeg dashboard.'
              : 'Every new account instantly receives 30 free points for TikTok optimization.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {discordNotice && (
          <div className="mb-4 p-3.5 rounded-xl bg-violet-50 border border-violet-200 text-xs text-neutral-800 flex items-start justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-violet-900 block text-xs">Discord Sign-In Coming Soon</span>
                <span className="text-[11px] text-neutral-600 leading-relaxed block mt-0.5">
                  {discordNotice}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDiscordNotice(null)}
              className="text-neutral-400 hover:text-neutral-700 p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Social Sign-In Buttons (Google & Discord) */}
        <div className="space-y-2.5 mb-5">
          {/* Google Sign In Button */}
          <button
            type="button"
            disabled={!!oauthLoading}
            onClick={() => handleOAuthClick('google')}
            className="w-full py-2.5 px-4 bg-white hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 text-neutral-800 text-xs font-semibold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {oauthLoading === 'google' ? 'Connecting Google...' : 'Continue with Google'}
            </span>
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 ml-auto">
              Recommended
            </span>
          </button>

          {/* Discord Sign In Button - Coming Soon */}
          <button
            type="button"
            onClick={() => handleOAuthClick('discord')}
            className="w-full py-2.5 px-4 bg-white hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 text-neutral-800 text-xs font-semibold rounded-xl transition-all shadow-2xs flex items-center justify-between gap-2.5 group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span>Continue with Discord</span>
            </div>
            <span className="text-[10px] font-semibold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full border border-neutral-200 group-hover:bg-violet-100 group-hover:text-violet-800 transition-colors">
              Coming Soon
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-neutral-400 text-[11px] font-medium">
              or continue with email
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {authModalMode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Creator Name</label>
              <input
                type="text"
                placeholder="e.g. Alex Rivera"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-600 focus:border-violet-600"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-600 focus:border-violet-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-600 focus:border-violet-600"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? (
              <span>Authenticating...</span>
            ) : authModalMode === 'login' ? (
              <>
                <span>Sign In with Email</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Register & Claim 30 Points</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Demo account shortcut */}
        <div className="mt-5 pt-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={fillDemoAccount}
            className="w-full py-2 px-3 text-xs text-neutral-700 bg-violet-50/40 hover:bg-violet-50 border border-violet-200 rounded-lg transition-colors flex items-center justify-between"
          >
            <span className="font-semibold text-violet-900">Quick Test: Fill Demo Creator</span>
            <span className="font-mono text-[11px] text-violet-700">creator@blessmethod.com</span>
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-neutral-500">
          {authModalMode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => openAuthModal('register')}
                className="font-semibold text-violet-700 hover:underline"
              >
                Sign up (Get 30 Free Points)
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="font-semibold text-violet-700 hover:underline"
              >
                Sign in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
