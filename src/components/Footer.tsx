import React from 'react';

interface FooterProps {
  onSelectTab: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return (
    <footer className="bg-white border-t border-neutral-200 mt-auto py-12 text-sm text-neutral-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/bless-logo.jpg"
                alt="BLESS METHOD"
                className="w-7 h-7 rounded-lg object-contain border border-neutral-200 shadow-2xs bg-white p-0.5"
              />
              <span className="font-bold text-neutral-900 tracking-tight">BLESS METHOD</span>
            </div>
            <p className="text-xs text-neutral-600 max-w-sm leading-relaxed">
              USE THE QUALITY YOU FILMED. High-precision video optimization engineered specifically for TikTok, Reels, and high-motion gaming montages. HandBrakeCLI & FFmpeg processing architecture.
            </p>
            <div className="text-[11px] text-neutral-400">
              Zero compression simulation · Genuine H.264/AAC output · Smart Stream Copy · Server-side point verification
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-3">
              Application
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => onSelectTab('optimizer')} className="hover:text-violet-700 transition-colors">
                  Video Optimizer
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('history')} className="hover:text-violet-700 transition-colors">
                  Optimization History
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('points')} className="hover:text-violet-700 transition-colors">
                  Weekly 30 Free Points
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('shop')} className="hover:text-violet-700 transition-colors">
                  Points Shop & Packages
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('help')} className="hover:text-violet-700 font-medium text-violet-700 transition-colors flex items-center gap-1.5">
                  <span>Help & AI Support</span>
                  <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.2 rounded-full font-bold">AI</span>
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-3">
              Technical & Specs
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => onSelectTab('settings')} className="hover:text-violet-700 transition-colors">
                  HandBrakeCLI & Supabase
                </button>
              </li>
              <li>
                <span className="text-neutral-400">Low Optimization: 4.5 pts</span>
              </li>
              <li>
                <span className="text-neutral-400">Medium Optimization: 8.5 pts</span>
              </li>
              <li>
                <span className="text-neutral-400">High Optimization: 10.0 pts</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div>© {new Date().getFullYear()} BLESS METHOD. Original video processing technology. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span>HandBrakeCLI v1.6.1</span>
            <span>·</span>
            <span>FFmpeg v4.4.2</span>
            <span>·</span>
            <span>Smart Stream Copy</span>
            <span>·</span>
            <span>Pure White UI</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
