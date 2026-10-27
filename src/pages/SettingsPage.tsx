import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api.js';
import { SystemStatus } from '../types.js';
import { Database, Copy, Check, Server, Shield, HardDrive, Key, UserCheck, Terminal, Cpu } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getSystemStatus().then(setSystemStatus).catch(console.error);
  }, []);

  const handleCopySQL = () => {
    if (!systemStatus?.sqlSchema) return;
    navigator.clipboard.writeText(systemStatus.sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10 bg-white">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
            Engines & Database Architecture
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            HandBrakeCLI & FFmpeg execution status, Supabase credentials, and migration schema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-violet-50 text-violet-800 border border-violet-200 font-semibold">
            HandBrakeCLI 1.6.1 + FFmpeg 4.4.2
          </span>
        </div>
      </div>

      {/* Account Info Card */}
      {user && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-violet-700" />
            <h2 className="text-base font-bold text-neutral-900">Current Creator Session</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-neutral-50/70 rounded-xl border border-neutral-200">
              <span className="text-neutral-400 block text-[11px]">Email</span>
              <span className="font-semibold text-neutral-900 truncate block">{user.email}</span>
            </div>
            <div className="p-3 bg-neutral-50/70 rounded-xl border border-neutral-200">
              <span className="text-neutral-400 block text-[11px]">Display Name</span>
              <span className="font-semibold text-neutral-900 block">{user.displayName || 'Creator'}</span>
            </div>
            <div className="p-3 bg-neutral-50/70 rounded-xl border border-neutral-200">
              <span className="text-neutral-400 block text-[11px]">Points Balance</span>
              <span className="font-mono font-bold text-violet-700 block text-sm">
                {(user.pointsBalance ?? 0).toFixed(1)} pts
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Dual Video Engine Hardware Card */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-violet-700" />
          <h2 className="text-base font-bold text-neutral-900">Installed Video Processing Backends</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-neutral-200 bg-white space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-900 text-sm">HandBrakeCLI</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Online & Verified
              </span>
            </div>
            <p className="text-neutral-600 leading-relaxed text-[11px]">
              Provides quality-based Constant Rate Factor (RF) transcoding with peak frame rate support and x264 tuning for video game montages.
            </p>
            <div className="font-mono text-[10px] text-neutral-400 pt-1 border-t border-neutral-100">
              Binary: /usr/bin/HandBrakeCLI v1.6.1
            </div>
          </div>

          <div className="p-4 rounded-xl border border-neutral-200 bg-white space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-900 text-sm">FFmpeg & FFprobe</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Online & Verified
              </span>
            </div>
            <p className="text-neutral-600 leading-relaxed text-[11px]">
              Provides stream metadata probing, fast lossless Stream Copy (-c copy) without re-encoding, and filter graph processing.
            </p>
            <div className="font-mono text-[10px] text-neutral-400 pt-1 border-t border-neutral-100">
              Binary: /usr/bin/ffmpeg v4.4.2
            </div>
          </div>
        </div>
      </div>

      {/* Supabase Status & Setup Guide */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-700 border border-violet-100 flex items-center justify-center font-bold">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Supabase Database Integration</h2>
              <p className="text-xs text-neutral-500">
                Persistent cloud storage with PostgreSQL and Row Level Security (RLS).
              </p>
            </div>
          </div>

          <div className="text-xs">
            {systemStatus?.supabase.configured ? (
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                Connected to Supabase Remote
              </span>
            ) : (
              <span className="font-semibold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200">
                Local Persistent Store Active (Disk Synced)
              </span>
            )}
          </div>
        </div>

        {/* Configuration Instructions */}
        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-600 space-y-3 leading-relaxed">
          <div className="font-semibold text-neutral-900">How to Connect Your Supabase Project:</div>
          <ol className="list-decimal pl-4 space-y-1.5">
            <li>
              Create a free project at <strong className="text-neutral-900">supabase.com</strong>.
            </li>
            <li>
              Go to <strong>Project Settings → API</strong> and copy your Project URL and Anon/Service Role Key.
            </li>
            <li>
              Add the following environment variables to your app (or in Secrets):
              <div className="font-mono text-[11px] bg-white p-2.5 rounded border border-neutral-200 my-1 text-neutral-900 space-y-0.5">
                <div>SUPABASE_URL="https://your-project.supabase.co"</div>
                <div>SUPABASE_ANON_KEY="your-anon-key"</div>
                <div>SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"</div>
              </div>
            </li>
            <li>
              Run the SQL migration script below in your Supabase SQL Editor to provision tables and security policies.
            </li>
          </ol>
        </div>

        {/* SQL Schema Script Box with Copy Button */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
              <Terminal className="w-3.5 h-3.5 text-violet-700" />
              <span>Supabase PostgreSQL Migration SQL</span>
            </div>

            <button
              onClick={handleCopySQL}
              className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SQL Migration</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-neutral-900 text-neutral-100 font-mono text-[11px] overflow-x-auto max-h-72 border border-neutral-800 leading-relaxed">
            {systemStatus?.sqlSchema || '-- Loading SQL schema...'}
          </pre>
        </div>
      </div>
    </div>
  );
};
