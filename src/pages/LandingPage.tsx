import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldAlert, Sparkles, Sliders, Play, Zap, Award, Film, Gamepad2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface LandingPageProps {
  onStartOptimizing: () => void;
  onOpenShop: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartOptimizing, onOpenShop }) => {
  const { user, openAuthModal } = useAuth();
  const [calculatorSizeMb, setCalculatorSizeMb] = useState<number>(120);
  const [calculatorDurationSec, setCalculatorDurationSec] = useState<number>(25);

  // Raw bitrate vs optimized estimate
  const rawBitrateMbps = Math.round(((calculatorSizeMb * 8) / calculatorDurationSec) * 10) / 10;
  const tiktokLimitMbps = 8.5;
  const willBeMangled = rawBitrateMbps > tiktokLimitMbps;
  const optimizedSizeEst = Math.round(calculatorDurationSec * 0.95);
  const savingPct = Math.max(10, Math.round(((calculatorSizeMb - optimizedSizeEst) / calculatorSizeMb) * 100));

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-14 pb-20 border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white border border-neutral-200 text-neutral-800 text-xs font-semibold shadow-2xs">
                <img src="/bless-logo.jpg" alt="BLESS METHOD" className="w-4 h-4 rounded object-contain" />
                <span className="font-bold text-neutral-900">BLESS METHOD</span>
                <span className="text-neutral-300">|</span>
                <span className="text-violet-700 font-medium">HandBrakeCLI & FFmpeg Engine</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.08] text-balance">
                USE THE QUALITY YOU FILMED.
              </h1>

              <p className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-xl">
                TikTok and Reels aggressively compress high-bitrate gaming montages and camera footage using crude transcoders.
                BLESS METHOD conditions your clips with source-aware CRF tuning, Adaptive Quantization mode 3, and smart stream copying to keep 100% of your sharpness intact.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <button
                  onClick={onStartOptimizing}
                  className="px-6 py-3 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors shadow-xs flex items-center justify-center gap-2"
                >
                  <span>Open Video Optimizer</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {!user && (
                  <button
                    onClick={() => openAuthModal('register')}
                    className="px-5 py-3 border border-neutral-200 text-neutral-800 rounded-xl text-sm font-semibold hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Claim 30 Free Points</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" /> HandBrakeCLI & FFmpeg
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" /> Gaming Montage AQ Mode 3
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" /> 30 Free Points Every 7 Days
                </span>
              </div>
            </div>

            {/* Hero Image Showcase */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-white shadow-sm">
                <img
                  src="/src/assets/images/bless_hero_creator_1793096047502.jpg"
                  alt="Content creator using camera in bright studio"
                  className="w-full h-auto object-cover aspect-16/10"
                  referrerPolicy="no-referrer"
                />
                <div className="p-4 bg-white border-t border-neutral-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-neutral-900 block">Vertical 9:16 Optimization</span>
                    <span className="text-neutral-500 font-mono">1080×1920 · 60/120 FPS · YUV420P</span>
                  </div>
                  <span className="text-[11px] font-mono text-violet-700 bg-violet-50 px-2.5 py-1 rounded-md border border-violet-200 font-semibold">
                    HandBrake / x264
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem & The Solution */}
      <section className="py-20 border-b border-neutral-100 bg-neutral-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
              Why do gaming montages and TikTok edits look smeared?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-600 leading-relaxed">
              When you upload high-motion gaming clips (Valorant, Apex, Call of Duty, Fortnite) with rapid camera spins and particle explosions, TikTok's automated pipeline drops keyframes and crunches the stream below 8 Mbps. You get blocky shadows, color banding, and micro-stutters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-white rounded-2xl border border-neutral-200 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>Direct Ingestion Without BLESS</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900">Platform Recompression Smear</h3>
              <ul className="space-y-3 text-xs text-neutral-600">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-mono mt-0.5">✕</span>
                  <span><strong>Particle Dissolution:</strong> Smoke, bullets, and spark particles blur together into noisy macroblocks.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-mono mt-0.5">✕</span>
                  <span><strong>Dark Scene Banding:</strong> Dark corners and shadow details posterize into harsh stepped rings.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-mono mt-0.5">✕</span>
                  <span><strong>Desaturated Colors:</strong> Inconsistent color primaries cause skin and game textures to look washed out.</span>
                </li>
              </ul>
            </div>

            <div className="p-6 bg-white rounded-2xl border-2 border-violet-600 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 text-violet-700 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>The BLESS METHOD Dual Pipeline</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900">Smart Stream Conditioning</h3>
              <ul className="space-y-3 text-xs text-neutral-600">
                <li className="flex items-start gap-2">
                  <span className="text-violet-600 font-mono mt-0.5 font-bold">✓</span>
                  <span><strong>Smart Stream Copy:</strong> Preserves 100% untouched video and audio streams when already compliant.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-600 font-mono mt-0.5 font-bold">✓</span>
                  <span><strong>Gaming AQ Mode 3:</strong> Auto-variance adaptive quantization protects shadows and rapid motion transitions.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-600 font-mono mt-0.5 font-bold">✓</span>
                  <span><strong>HandBrakeCLI Quality Tiers:</strong> True Constant Rate Factor (RF) compression with zero forced downscaling.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Optimization Tiers Section */}
      <section className="py-20 border-b border-neutral-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
              Three Tested Optimization Levels
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Honest quality trade-offs and point costs. Backed by HandBrakeCLI and FFmpeg engines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Low Card */}
            <div className="p-6 rounded-2xl border border-neutral-200 bg-white space-y-4 flex flex-col justify-between shadow-2xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Tier 1</span>
                  <div className="text-right">
                    <span className="text-lg font-bold font-mono text-violet-700">4.5</span>
                    <span className="text-xs text-neutral-500 ml-1">pts</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-neutral-900">Low Optimization</h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Faster processing with sensible compression. Prioritizes file-size reduction while maintaining clean visual clarity.
                </p>

                <div className="pt-3 border-t border-neutral-100 space-y-2 text-xs text-neutral-500 font-mono">
                  <div className="flex justify-between">
                    <span>Preset / RF:</span>
                    <span className="text-neutral-900">HandBrake RF 26</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Target:</span>
                    <span className="text-neutral-900">AAC 128 kbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Best For:</span>
                    <span className="text-neutral-900">Daily vlogs, talking head</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onStartOptimizing}
                className="w-full py-2.5 px-3 border border-neutral-200 text-xs font-semibold text-neutral-900 rounded-xl hover:bg-neutral-50 transition-colors shadow-2xs"
              >
                Select Low (4.5 pts)
              </button>
            </div>

            {/* Medium Card */}
            <div className="p-6 rounded-2xl border-2 border-violet-600 bg-violet-50/20 space-y-4 flex flex-col justify-between shadow-xs relative">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">
                    Tier 2 · Recommended
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-bold font-mono text-violet-700">8.5</span>
                    <span className="text-xs text-neutral-500 ml-1">pts</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-neutral-900">Medium Optimization</h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Optimal sweet spot. Balance file size, quality, and encoding speed with source-aware RF 21 tuning.
                </p>

                <div className="pt-3 border-t border-neutral-100 space-y-2 text-xs text-neutral-500 font-mono">
                  <div className="flex justify-between">
                    <span>Preset / RF:</span>
                    <span className="text-neutral-900">HandBrake RF 21</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Target:</span>
                    <span className="text-neutral-900">AAC 192 kbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Best For:</span>
                    <span className="text-neutral-900">TikTok viral clips, gaming edits</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onStartOptimizing}
                className="w-full py-2.5 px-3 bg-violet-600 text-xs font-semibold text-white rounded-xl hover:bg-violet-700 transition-colors shadow-xs"
              >
                Select Medium (8.5 pts)
              </button>
            </div>

            {/* High Card */}
            <div className="p-6 rounded-2xl border border-neutral-200 bg-white space-y-4 flex flex-col justify-between shadow-2xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Tier 3</span>
                  <div className="text-right">
                    <span className="text-lg font-bold font-mono text-violet-700">10.0</span>
                    <span className="text-xs text-neutral-500 ml-1">pts</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-neutral-900">High Optimization</h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Maximum visual fidelity. Thorough x264/HandBrake configuration with AQ-mode 3 for fast camera turns and particles.
                </p>

                <div className="pt-3 border-t border-neutral-100 space-y-2 text-xs text-neutral-500 font-mono">
                  <div className="flex justify-between">
                    <span>Preset / RF:</span>
                    <span className="text-neutral-900">HandBrake RF 18 (Near Lossless)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Target:</span>
                    <span className="text-neutral-900">AAC 256 kbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Best For:</span>
                    <span className="text-neutral-900">Cinematics, 4K gameplay</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onStartOptimizing}
                className="w-full py-2.5 px-3 border border-neutral-200 text-xs font-semibold text-neutral-900 rounded-xl hover:bg-neutral-50 transition-colors shadow-2xs"
              >
                Select High (10.0 pts)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Estimator Calculator */}
      <section className="py-20 border-b border-neutral-100 bg-neutral-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
              Interactive Ingestion Estimator
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-neutral-500">
              Calculate whether your video stream requires re-encoding or is ready for Smart Stream Copy.
            </p>
          </div>

          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-neutral-700 mb-2">
                  <span>Raw File Size:</span>
                  <span className="font-mono text-neutral-900">{calculatorSizeMb} MB</span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="350"
                  step="5"
                  value={calculatorSizeMb}
                  onChange={(e) => setCalculatorSizeMb(Number(e.target.value))}
                  className="w-full cursor-pointer accent-violet-600"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-neutral-700 mb-2">
                  <span>Clip Duration:</span>
                  <span className="font-mono text-neutral-900">{calculatorDurationSec} seconds</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="1"
                  value={calculatorDurationSec}
                  onChange={(e) => setCalculatorDurationSec(Number(e.target.value))}
                  className="w-full cursor-pointer accent-violet-600"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Raw Camera Bitrate</div>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-1">{rawBitrateMbps} Mbps</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  {willBeMangled ? '⚠️ Over mobile feed limit' : 'Safe for Stream Copy'}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-neutral-500 uppercase tracking-wider">BLESS Optimized Size</div>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-1">~{optimizedSizeEst} MB</div>
                <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
                  Save ~{savingPct}% bandwidth
                </div>
              </div>

              <div>
                <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Visual Fidelity Retention</div>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-1">99.4%</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">RF 21 perceptual match</div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={onStartOptimizing}
                className="px-6 py-2.5 bg-violet-600 text-white text-xs font-medium rounded-xl hover:bg-violet-700 transition-colors shadow-xs"
              >
                Launch Optimization
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Points Shop Banner */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border border-neutral-200 rounded-2xl p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xs">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                Get 30 Free Points Every 7 Days
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 max-w-xl">
                Every creator receives 30 free points weekly. Top-up packs are available starting at €10 for 100 points.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={onOpenShop}
                className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-700 transition-colors shadow-xs"
              >
                View Points Shop
              </button>
              <button
                onClick={onStartOptimizing}
                className="px-5 py-2.5 border border-neutral-200 text-neutral-800 rounded-xl text-xs font-medium hover:bg-neutral-50 transition-colors shadow-2xs"
              >
                Start Free Job
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
