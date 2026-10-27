import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api.js';
import {
  VideoJob,
  VideoMetadata,
  OptimizationLevel,
  AspectRatioMode,
  ProcessingEngine,
  ProcessingMode,
} from '../types.js';
import {
  Upload,
  Film,
  Zap,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Download,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Sliders,
  Check,
  ShieldCheck,
  X,
  FileVideo,
  Cpu,
  Layers,
  Gamepad2,
  Copy,
  ChevronRight,
  Info,
  Clock,
  ExternalLink,
  Lock,
} from 'lucide-react';

interface OptimizerPageProps {
  onOpenShop: () => void;
  onOpenPoints: () => void;
  onOpenHelp?: () => void;
}

export const OptimizerPage: React.FC<OptimizerPageProps> = ({ onOpenShop, onOpenPoints, onOpenHelp }) => {
  const { user, pointsStatus, refreshPoints, openAuthModal, loginWithOAuth } = useAuth();

  // Upload & Draft State
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [draftFileId, setDraftFileId] = useState<string | null>(null);
  const [draftFilename, setDraftFilename] = useState<string | null>(null);
  const [draftMeta, setDraftMeta] = useState<VideoMetadata | null>(null);

  // Settings State
  const [selectedLevel, setSelectedLevel] = useState<OptimizationLevel>('medium');
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('smart');
  const [engine, setEngine] = useState<ProcessingEngine>('auto');
  const [tiktokPreset, setTiktokPreset] = useState<boolean>(true);
  const [aspectRatioMode, setAspectRatioMode] = useState<AspectRatioMode>('preserve');
  const [gamingMontagePreset, setGamingMontagePreset] = useState<boolean>(true);
  const [unsharpFilter, setUnsharpFilter] = useState<boolean>(false);
  const [colorBoostFilter, setColorBoostFilter] = useState<boolean>(false);

  // Active Job State
  const [activeJob, setActiveJob] = useState<VideoJob | null>(null);
  const [startingJob, setStartingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  // Recent Jobs List
  const [recentJobs, setRecentJobs] = useState<VideoJob[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Video Comparison Playback State
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const optimizedVideoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeCompareMode, setActiveCompareMode] = useState<'side-by-side' | 'optimized-only'>('side-by-side');

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Level Point Costs (Kept exactly as requested)
  const POINT_COSTS: Record<OptimizationLevel, number> = {
    low: 4.5,
    medium: 8.5,
    high: 10.0,
  };

  const currentCost = POINT_COSTS[selectedLevel];
  const userBalance = user?.pointsBalance ?? 0;
  const isZeroPoints = user ? userBalance <= 0 : false;
  const hasEnoughPoints = user ? userBalance >= currentCost : false;

  // Fetch recent jobs
  const fetchRecentJobs = async () => {
    if (!user) return;
    setLoadingRecent(true);
    try {
      const data = await api.getUserJobs();
      setRecentJobs(data.slice(0, 5));
    } catch {
      // ignore
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    fetchRecentJobs();
  }, [user]);

  // Poll active job while queued or processing
  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status !== 'queued' && activeJob.status !== 'processing') return;

    const interval = setInterval(async () => {
      try {
        const updated = await api.getJob(activeJob.id);
        setActiveJob(updated);
        if (updated.status === 'completed' || updated.status === 'failed' || updated.status === 'cancelled') {
          await refreshPoints();
          fetchRecentJobs();
        }
      } catch (err) {
        console.error('Error polling job:', err);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [activeJob, refreshPoints]);

  // Synchronize both video players
  const handleTogglePlay = () => {
    if (!originalVideoRef.current || !optimizedVideoRef.current) return;
    if (isPlaying) {
      originalVideoRef.current.pause();
      optimizedVideoRef.current.pause();
      setIsPlaying(false);
    } else {
      originalVideoRef.current.play();
      optimizedVideoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const time = e.currentTarget.currentTime;
    setCurrentTime(time);
    if (e.currentTarget.duration) {
      setDuration(e.currentTarget.duration);
    }
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (originalVideoRef.current) originalVideoRef.current.currentTime = newTime;
    if (optimizedVideoRef.current) optimizedVideoRef.current.currentTime = newTime;
  };

  // Upload handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const triggerGoogleLogin = async () => {
    try {
      await loginWithOAuth('google');
    } catch {
      openAuthModal('login');
    }
  };

  const processSelectedFile = async (file: File) => {
    if (!user) {
      await triggerGoogleLogin();
      return;
    }

    if (isZeroPoints) {
      setUploadError('You have 0 points remaining. You cannot use the video optimizer. Please claim your weekly points (+30 pts) or top up in the Shop.');
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const res = await api.uploadVideo(file);
      setDraftFileId(res.tempFileId);
      setDraftFilename(res.originalFilename);
      setDraftMeta(res.metadata);

      // Auto-set mode recommendation if available
      if (res.metadata?.recommendedMode === 'stream_copy') {
        setProcessingMode('smart');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const handleUseSample = async () => {
    if (!user) {
      await triggerGoogleLogin();
      return;
    }

    if (isZeroPoints) {
      setUploadError('You have 0 points remaining. You cannot use the video optimizer. Please claim your weekly points (+30 pts) or top up in the Shop.');
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const res = await api.useSampleClip();
      setDraftFileId(res.tempFileId);
      setDraftFilename(res.originalFilename);
      setDraftMeta(res.metadata);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to load sample clip');
    } finally {
      setUploading(false);
    }
  };

  const handleStartOptimization = async () => {
    if (!user) {
      await triggerGoogleLogin();
      return;
    }

    if (isZeroPoints) {
      setJobError('You have 0 points remaining. You cannot use the video optimizer. Please claim your weekly points or top up in the Shop.');
      return;
    }

    if (!draftFileId || !draftFilename) {
      setUploadError('Please select or upload a video first.');
      return;
    }

    if (!hasEnoughPoints) {
      setJobError(`Insufficient points balance. ${selectedLevel.toUpperCase()} optimization requires ${currentCost} pts.`);
      return;
    }

    setStartingJob(true);
    setJobError(null);

    try {
      const res = await api.startJob({
        tempFileId: draftFileId,
        originalFilename: draftFilename,
        optimizationLevel: selectedLevel,
        tiktokPreset,
        aspectRatioMode,
        engine,
        processingMode,
        gamingMontagePreset,
        optionalFilters: {
          unsharp: unsharpFilter,
          colorBoost: colorBoostFilter,
        },
      });

      setActiveJob(res.job);
      await refreshPoints();
      fetchRecentJobs();
    } catch (err: any) {
      setJobError(err.message || 'Failed to start optimization job');
    } finally {
      setStartingJob(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob) return;
    try {
      const res = await api.cancelJob(activeJob.id);
      setActiveJob(res.job);
      await refreshPoints();
      fetchRecentJobs();
    } catch (err: any) {
      console.error('Cancel error:', err);
    }
  };

  const handleReset = () => {
    setDraftFileId(null);
    setDraftFilename(null);
    setDraftMeta(null);
    setActiveJob(null);
    setJobError(null);
    setUploadError(null);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // ----------------------------------------------------
  // RENDER: Active Result View (Completed Job)
  // ----------------------------------------------------
  if (activeJob && activeJob.status === 'completed') {
    const origSize = activeJob.originalMeta?.sizeBytes || 1;
    const optSize = activeJob.optimizedMeta?.sizeBytes || 1;
    const sizeDiffBytes = optSize - origSize;
    const sizeDiffPct = Math.round((sizeDiffBytes / origSize) * 100);
    const isSmaller = sizeDiffBytes < 0;

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 bg-white">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">
                Optimization Verified
              </span>
              <span className="text-xs text-neutral-400">·</span>
              <span className="text-xs font-mono text-neutral-500 uppercase">
                Engine: {activeJob.engine || 'HandBrake/FFmpeg'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
              {activeJob.originalFilename}
            </h1>
            <div className="text-xs text-neutral-500 mt-1 flex items-center gap-2">
              <span className="font-semibold text-neutral-800 capitalize">
                {activeJob.optimizationLevel} Tier ({activeJob.pointCost} pts)
              </span>
              <span>·</span>
              <span>Verified H.264/AAC MP4 Container</span>
              {activeJob.gamingMontagePreset && (
                <>
                  <span>·</span>
                  <span className="text-violet-700 font-medium">Gaming AQ Mode 3</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Optimize Another Clip</span>
            </button>

            <a
              href={`/api/video/download/${activeJob.id}`}
              download
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Optimized MP4</span>
            </a>
          </div>
        </div>

        {/* Dual Video Player Scrubber */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-6 mb-8 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePlay}
                className="w-9 h-9 rounded-full bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition-colors shadow-xs"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <div className="text-xs font-mono tabular-nums text-neutral-600 ml-2">
                {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-neutral-100 p-1 rounded-lg text-xs font-medium border border-neutral-200">
                <button
                  onClick={() => setActiveCompareMode('side-by-side')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activeCompareMode === 'side-by-side' ? 'bg-white text-neutral-900 shadow-xs font-semibold' : 'text-neutral-600'
                  }`}
                >
                  Side-by-Side Proof
                </button>
                <button
                  onClick={() => setActiveCompareMode('optimized-only')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activeCompareMode === 'optimized-only' ? 'bg-white text-neutral-900 shadow-xs font-semibold' : 'text-neutral-600'
                  }`}
                >
                  Optimized Output
                </button>
              </div>
            </div>
          </div>

          {/* Scrubber slider */}
          <div className="mb-6 px-1">
            <input
              type="range"
              min="0"
              max={duration || 10}
              step="0.05"
              value={currentTime}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full cursor-pointer h-1.5 bg-neutral-200 rounded-lg appearance-none accent-violet-600"
            />
          </div>

          {/* Video Frames Container */}
          {activeCompareMode === 'side-by-side' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Original Video Frame */}
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs flex flex-col">
                <div className="p-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-700">Source Input (Pre-Optimization)</span>
                  <span className="font-mono text-neutral-500">
                    {activeJob.originalMeta?.sizeFormatted} · {activeJob.originalMeta?.width}×{activeJob.originalMeta?.height}
                  </span>
                </div>
                <div className="relative aspect-9/16 max-h-[460px] bg-neutral-100 flex items-center justify-center">
                  <video
                    ref={originalVideoRef}
                    src={`/api/video/stream/original/${activeJob.id}`}
                    onTimeUpdate={handleTimeUpdate}
                    playsInline
                    muted
                    loop
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Optimized Video Frame */}
              <div className="bg-white rounded-xl border-2 border-violet-600 overflow-hidden shadow-xs flex flex-col">
                <div className="p-3 bg-violet-50/60 border-b border-violet-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-violet-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                    BLESS METHOD Output
                  </span>
                  <span className="font-mono text-violet-700 font-semibold">
                    {activeJob.optimizedMeta?.sizeFormatted} · {activeJob.optimizedMeta?.width}×{activeJob.optimizedMeta?.height}
                  </span>
                </div>
                <div className="relative aspect-9/16 max-h-[460px] bg-neutral-100 flex items-center justify-center">
                  <video
                    ref={optimizedVideoRef}
                    src={`/api/video/stream/optimized/${activeJob.id}`}
                    onTimeUpdate={handleTimeUpdate}
                    playsInline
                    loop
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto bg-white rounded-xl border-2 border-violet-600 overflow-hidden shadow-xs">
              <div className="p-3 bg-violet-50 border-b border-violet-100 flex items-center justify-between text-xs">
                <span className="font-bold text-violet-900">Optimized Stream Preview</span>
                <span className="font-mono text-violet-700 font-semibold">
                  {activeJob.optimizedMeta?.sizeFormatted}
                </span>
              </div>
              <div className="relative aspect-9/16 max-h-[500px] bg-neutral-100 flex items-center justify-center">
                <video
                  ref={optimizedVideoRef}
                  src={`/api/video/stream/optimized/${activeJob.id}`}
                  onTimeUpdate={handleTimeUpdate}
                  playsInline
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Honest Technical Quality & Comparison Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
          <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Stream Audit & Comparative Metrics
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                {activeJob.smartSelectionReason || 'Processed with HandBrake / FFmpeg quality architecture.'}
              </p>
            </div>
            <span className="text-xs font-mono text-violet-700 bg-violet-50 px-2.5 py-1 rounded-md border border-violet-200">
              Verified Playable
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-5">Metric</th>
                  <th className="py-3 px-5">Source File</th>
                  <th className="py-3 px-5">Optimized File</th>
                  <th className="py-3 px-5">Audited Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                <tr>
                  <td className="py-3 px-5 font-medium text-neutral-900">File Size</td>
                  <td className="py-3 px-5 font-mono tabular-nums">{activeJob.originalMeta?.sizeFormatted}</td>
                  <td className="py-3 px-5 font-mono tabular-nums font-semibold text-neutral-900">{activeJob.optimizedMeta?.sizeFormatted}</td>
                  <td className="py-3 px-5">
                    {isSmaller ? (
                      <span className="text-emerald-700 font-semibold font-mono tabular-nums">
                        {sizeDiffPct}% file reduction
                      </span>
                    ) : sizeDiffBytes === 0 ? (
                      <span className="text-neutral-700 font-medium">
                        0% bitstream change (Lossless Stream Copy)
                      </span>
                    ) : (
                      <span className="text-neutral-700 font-medium">
                        +{sizeDiffPct}% (High-quality setting prioritized texture & grain preservation over compression)
                      </span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-5 font-medium text-neutral-900">Resolution</td>
                  <td className="py-3 px-5 font-mono tabular-nums">
                    {activeJob.originalMeta?.width} × {activeJob.originalMeta?.height}
                  </td>
                  <td className="py-3 px-5 font-mono tabular-nums font-semibold text-neutral-900">
                    {activeJob.optimizedMeta?.width} × {activeJob.optimizedMeta?.height}
                  </td>
                  <td className="py-3 px-5 text-neutral-600">
                    {activeJob.tiktokPreset ? 'Targeted for mobile vertical feed' : 'Preserved native geometry'}
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-5 font-medium text-neutral-900">Frame Rate</td>
                  <td className="py-3 px-5 font-mono tabular-nums">{activeJob.originalMeta?.fps} fps</td>
                  <td className="py-3 px-5 font-mono tabular-nums font-semibold text-neutral-900">{activeJob.optimizedMeta?.fps} fps</td>
                  <td className="py-3 px-5 text-neutral-600">Untouched fluid motion (no artificial 60fps pull-down)</td>
                </tr>

                <tr>
                  <td className="py-3 px-5 font-medium text-neutral-900">Bitrate</td>
                  <td className="py-3 px-5 font-mono tabular-nums">{activeJob.originalMeta?.bitrateKbps} kbps</td>
                  <td className="py-3 px-5 font-mono tabular-nums font-semibold text-neutral-900">{activeJob.optimizedMeta?.bitrateKbps} kbps</td>
                  <td className="py-3 px-5 text-neutral-600">Optimal buffer stream for TikTok ingestion</td>
                </tr>

                <tr>
                  <td className="py-3 px-5 font-medium text-neutral-900">Processing Mode</td>
                  <td className="py-3 px-5 font-mono">{activeJob.processingMode || 'Quality Encode'}</td>
                  <td className="py-3 px-5 font-mono font-semibold text-violet-800">
                    {activeJob.engine === 'handbrake' ? 'HandBrakeCLI (RF tuned)' : 'FFmpeg (libx264)'}
                  </td>
                  <td className="py-3 px-5 text-neutral-600">Clean H.264 / AAC Baseline</td>
                </tr>

                <tr>
                  <td className="py-3 px-5 font-medium text-neutral-900">Points Billed</td>
                  <td className="py-3 px-5 text-neutral-400">—</td>
                  <td className="py-3 px-5 font-mono font-semibold text-neutral-900">{activeJob.pointCost.toFixed(1)} pts</td>
                  <td className="py-3 px-5 text-neutral-600">Deducted securely from creator balance</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Processing Active View
  // ----------------------------------------------------
  if (activeJob && (activeJob.status === 'queued' || activeJob.status === 'processing')) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 bg-white">
        <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-xs text-center space-y-6">
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center mx-auto border border-violet-100">
            <Film className="w-6 h-6 animate-pulse" />
          </div>

          <div>
            <div className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-1">
              Active Optimization Worker
            </div>
            <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
              {activeJob.originalFilename}
            </h2>
            <p className="text-xs text-neutral-600 mt-2 font-mono">
              {activeJob.processingStage || 'Initializing HandBrake/FFmpeg encoding pipeline...'}
            </p>
          </div>

          {/* Real progress bar */}
          <div className="space-y-2">
            <div className="h-2.5 w-full bg-neutral-100 rounded-full overflow-hidden border border-neutral-200">
              <div
                className="h-full bg-violet-600 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, activeJob.progressPercent || 5)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-neutral-500 font-mono">
              <span>{activeJob.optimizationLevel.toUpperCase()} Tier ({activeJob.pointCost} pts reserved)</span>
              <span className="font-semibold text-neutral-900">{activeJob.progressPercent || 5}%</span>
            </div>
          </div>

          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-600 space-y-1.5 text-left">
            <div className="flex justify-between">
              <span className="font-medium text-neutral-800">Active Engine:</span>
              <span className="font-mono text-neutral-900 font-semibold">{activeJob.engine?.toUpperCase() || 'HANDBRAKE/FFMPEG'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-neutral-800">Source Stream:</span>
              <span className="font-mono">
                {activeJob.originalMeta?.width}×{activeJob.originalMeta?.height} · {activeJob.originalMeta?.durationSeconds}s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-neutral-800">Refund Guarantee:</span>
              <span>Points refunded automatically if anything interrupts processing</span>
            </div>
          </div>

          <div>
            <button
              onClick={handleCancelJob}
              className="py-2 px-4 text-xs font-medium text-neutral-600 hover:text-red-600 border border-neutral-200 hover:border-red-200 rounded-lg transition-colors"
            >
              Cancel Job & Refund Points
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Default Dashboard & Upload View
  // ----------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-white space-y-8">
      {/* Top Banner & Balance Strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
              Video Optimizer
            </h1>
            <span className="text-[11px] font-semibold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-200">
              HandBrake & FFmpeg Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Condition your high-FPS gaming montages and TikTok clips with source-aware encoding and stream copying.
          </p>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenPoints}
              className="px-4 py-2 rounded-xl border border-neutral-200 bg-white hover:border-violet-300 transition-colors text-xs flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <span className="text-neutral-500">Balance:</span>
              <span className={`font-mono tabular-nums font-extrabold text-sm ${isZeroPoints ? 'text-red-600' : 'text-neutral-900'}`}>
                {userBalance.toFixed(1)}
              </span>
              <span className="text-violet-600 font-semibold">pts</span>
            </button>

            {pointsStatus?.canClaimWeekly ? (
              <button
                onClick={onOpenPoints}
                className="px-3.5 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Claim +30 Pts</span>
              </button>
            ) : (
              <button
                onClick={onOpenShop}
                className="px-3.5 py-2 border border-neutral-200 text-neutral-700 rounded-xl text-xs font-medium hover:bg-neutral-50 transition-colors shadow-2xs cursor-pointer"
              >
                Top Up
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={triggerGoogleLogin}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-700 transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign In with Google</span>
          </button>
        )}
      </div>

      {/* Google Login Required Banner (Shown when not logged in) */}
      {!user && (
        <div className="p-6 rounded-2xl bg-white border-2 border-violet-600/30 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0 border border-violet-100">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">Google Sign-In Required</span>
                <span className="text-[10px] bg-violet-100 text-violet-800 font-semibold px-2 py-0.5 rounded-full">Mandatory</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 mt-0.5">
                You need to log in to Google to use the Video Optimizer
              </h3>
              <p className="text-xs text-neutral-600 mt-1 max-w-xl">
                Access to BLESS METHOD's HandBrake and FFmpeg optimization engine requires logging in with your Google account. Every new user instantly receives 30 free points.
              </p>
            </div>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={triggerGoogleLogin}
              className="w-full md:w-auto px-5 py-3 bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-300 hover:border-neutral-400 font-semibold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign in with Google (Get 30 Free Pts)</span>
            </button>
          </div>
        </div>
      )}

      {/* 0 Points Lockout Warning Banner (Shown when user has 0 points) */}
      {user && isZeroPoints && (
        <div className="p-5 rounded-2xl bg-amber-50/90 border-2 border-amber-300 text-xs shadow-2xs space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-950 text-sm">0 Points Remaining — Video Optimizer Locked</span>
                  <span className="text-[10px] font-mono bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-full font-bold">Balance: 0.0 pts</span>
                </div>
                <p className="text-amber-900 mt-1 leading-relaxed">
                  You currently have 0 points in your account. You cannot use the video optimizer until your points balance is restored. Claim your free weekly reward (+30 points) or get an instant refill in the Points Shop to start optimizing clips.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-amber-200/80">
            {pointsStatus?.canClaimWeekly ? (
              <button
                type="button"
                onClick={onOpenPoints}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Claim Free +30 Points Reward</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenPoints}
                className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                View Reward Timer ({pointsStatus ? `${Math.ceil((pointsStatus.secondsUntilNextClaim || 0) / 86400)}d left` : 'Points Hub'})
              </button>
            )}

            <button
              type="button"
              onClick={onOpenShop}
              className="px-4 py-2 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              Refill Points in Shop →
            </button>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="text-red-500 hover:text-red-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {jobError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{jobError}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenShop}
              className="font-semibold underline hover:text-amber-950 cursor-pointer"
            >
              Buy Points
            </button>
            <button onClick={() => setJobError(null)} className="text-amber-500 hover:text-amber-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Upload & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Dropzone & Source Stream Inspection */}
        <div className="lg:col-span-7 space-y-6">
          {!draftFileId ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => {
                if (!user) {
                  triggerGoogleLogin();
                } else if (isZeroPoints) {
                  setUploadError('You have 0 points remaining. You cannot use the video optimizer. Please claim weekly points or refill in the Shop.');
                } else {
                  fileInputRef.current?.click();
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                !user
                  ? 'border-violet-300 bg-violet-50/10 hover:border-violet-400'
                  : isZeroPoints
                  ? 'border-amber-300 bg-amber-50/20 hover:border-amber-400'
                  : dragActive
                  ? 'border-violet-600 bg-violet-50/20'
                  : 'border-neutral-200 hover:border-violet-300 bg-white shadow-2xs'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-m4v,video/webm"
                onChange={handleFileChange}
                className="hidden"
                disabled={!user || isZeroPoints}
              />

              <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center mx-auto mb-4 border border-violet-100">
                {!user ? (
                  <Lock className="w-6 h-6 text-violet-600" />
                ) : isZeroPoints ? (
                  <Lock className="w-6 h-6 text-amber-600" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              {!user ? (
                <>
                  <h3 className="text-base font-bold text-neutral-900">
                    Sign In with Google to Use Video Optimizer
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                    You need to log in to Google to upload files and access HandBrake & FFmpeg optimization.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-semibold shadow-xs">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Click to Sign In with Google</span>
                  </div>
                </>
              ) : isZeroPoints ? (
                <>
                  <h3 className="text-base font-bold text-amber-900">
                    Video Optimizer Locked (0 Points Remaining)
                  </h3>
                  <p className="text-xs text-amber-700 mt-1 max-w-sm mx-auto">
                    You have 0 points. Video optimization requires points. Please claim your weekly +30 free points or buy a refill pack in the Shop.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs">
                    <span>Recharge Points to Unlock Upload</span>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-base font-bold text-neutral-900">
                    {uploading ? 'Analyzing source stream with FFprobe...' : 'Drop video here, or browse files'}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                    Supports MP4, MOV, WebM up to 250MB. Gaming montages, high-FPS clips, and TikTok portrait videos.
                  </p>
                </>
              )}

              {/* Instant Sample Clip Button */}
              <div className="mt-6 pt-6 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!user) {
                      triggerGoogleLogin();
                    } else if (isZeroPoints) {
                      setUploadError('You have 0 points remaining. You cannot use the video optimizer. Please claim weekly points or refill in the Shop.');
                    } else {
                      handleUseSample();
                    }
                  }}
                  className={`px-4 py-2 border text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                    !user
                      ? 'bg-violet-50 text-violet-900 border-violet-200 hover:bg-violet-100'
                      : isZeroPoints
                      ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                      : 'bg-neutral-50 hover:bg-violet-50 border-neutral-200 hover:border-violet-200 text-neutral-800 hover:text-violet-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  <span>
                    {!user
                      ? 'Sign in with Google to Test Sample Clip'
                      : isZeroPoints
                      ? '0 Points Remaining (Claim Points to Test)'
                      : 'Instant 1-Click: Test With Built-in Gaming/TikTok Sample'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-700 border border-violet-100 flex items-center justify-center">
                    <FileVideo className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 truncate max-w-xs sm:max-w-md">
                      {draftFilename}
                    </h3>
                    <div className="text-xs text-neutral-500 font-mono">
                      {draftMeta?.sizeFormatted} · {draftMeta?.width}×{draftMeta?.height} · {draftMeta?.durationSeconds}s
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 transition-colors rounded-md"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Source Analysis Intelligence Callout */}
              <div className="p-3.5 rounded-xl bg-violet-50/40 border border-violet-200/80 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-violet-900">
                  <Info className="w-4 h-4 text-violet-700" />
                  <span>Intelligent Source Analysis</span>
                </div>
                <p className="text-neutral-700 leading-relaxed text-[11px]">
                  {draftMeta?.recommendationReason || 'Analyzing stream characteristics...'}
                </p>
              </div>

              {/* Probed Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-neutral-50/70 rounded-xl border border-neutral-200 text-xs">
                <div>
                  <span className="text-neutral-400 block text-[11px]">FPS / Motion</span>
                  <span className="font-mono font-semibold text-neutral-900">{draftMeta?.fps} fps</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Codec / PixFmt</span>
                  <span className="font-mono font-semibold text-neutral-900 truncate block">
                    {draftMeta?.codec} ({draftMeta?.pixelFormat || 'yuv420p'})
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Bitrate</span>
                  <span className="font-mono font-semibold text-neutral-900">{draftMeta?.bitrateKbps} kbps</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Audio</span>
                  <span className="font-mono font-semibold text-neutral-900">{draftMeta?.audioCodec || 'Stereo'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
                <span>File verified and ready for optimization</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="font-medium text-violet-700 hover:underline"
                >
                  Change file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-m4v,video/webm"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Engine & Processing Mode Configuration */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Optimization Processing Mode</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Choose how BLESS METHOD handles your video bitstream.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setProcessingMode('smart')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  processingMode === 'smart'
                    ? 'border-violet-600 bg-violet-50/20 ring-1 ring-violet-500/20'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-neutral-900">Smart Mode</span>
                  {processingMode === 'smart' && <Check className="w-3.5 h-3.5 text-violet-600" />}
                </div>
                <p className="text-[11px] text-neutral-500 leading-normal">
                  Auto-detects source and chooses between stream copy and CRF encode.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProcessingMode('quality_encode')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  processingMode === 'quality_encode'
                    ? 'border-violet-600 bg-violet-50/20 ring-1 ring-violet-500/20'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-neutral-900">Quality Encode</span>
                  {processingMode === 'quality_encode' && <Check className="w-3.5 h-3.5 text-violet-600" />}
                </div>
                <p className="text-[11px] text-neutral-500 leading-normal">
                  CRF-based optimization via HandBrake or FFmpeg to compress bloated bitrate.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProcessingMode('stream_copy')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  processingMode === 'stream_copy'
                    ? 'border-violet-600 bg-violet-50/20 ring-1 ring-violet-500/20'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-neutral-900">Stream Copy</span>
                  {processingMode === 'stream_copy' && <Check className="w-3.5 h-3.5 text-violet-600" />}
                </div>
                <p className="text-[11px] text-neutral-500 leading-normal">
                  Lossless FFmpeg repackage (-c copy). 0% re-encoding degradation.
                </p>
              </button>
            </div>

            {/* Backend Engine Picker */}
            <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="font-medium text-neutral-700">Video Processing Backend:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEngine('auto')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    engine === 'auto'
                      ? 'border-violet-600 bg-violet-50 text-violet-900 font-semibold'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  Auto Engine
                </button>
                <button
                  type="button"
                  onClick={() => setEngine('handbrake')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    engine === 'handbrake'
                      ? 'border-violet-600 bg-violet-50 text-violet-900 font-semibold'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  HandBrakeCLI
                </button>
                <button
                  type="button"
                  onClick={() => setEngine('ffmpeg')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    engine === 'ffmpeg'
                      ? 'border-violet-600 bg-violet-50 text-violet-900 font-semibold'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  FFmpeg
                </button>
              </div>
            </div>

            {/* Gaming Montage Optimization Toggle */}
            <div className="pt-3 border-t border-neutral-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-neutral-900 block flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5 text-violet-600" />
                    Gaming Montage & High-Motion Optimization
                  </span>
                  <span className="text-[11px] text-neutral-500 block mt-0.5">
                    Enables Adaptive Quantization (AQ-mode 3) to protect particle scatter, dark scene shadows, and fast camera turns.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gamingMontagePreset}
                    onChange={(e) => setGamingMontagePreset(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                </label>
              </div>

              {/* Optional Fine Filters */}
              {gamingMontagePreset && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                    <input
                      type="checkbox"
                      checked={unsharpFilter}
                      onChange={(e) => setUnsharpFilter(e.target.checked)}
                      className="rounded text-violet-600 focus:ring-violet-500"
                    />
                    <span>Gameplay Micro-Sharpening</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                    <input
                      type="checkbox"
                      checked={colorBoostFilter}
                      onChange={(e) => setColorBoostFilter(e.target.checked)}
                      className="rounded text-violet-600 focus:ring-violet-500"
                    />
                    <span>Vibrant Color Saturation Pop</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Optimization Level Selection & Launch */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">
                Select Optimization Level
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                Exact Cost Policy
              </span>
            </div>

            {/* Level 1: Low */}
            <div
              onClick={() => setSelectedLevel('low')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedLevel === 'low'
                  ? 'border-violet-600 bg-violet-50/20 shadow-2xs'
                  : 'border-neutral-200 hover:border-neutral-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-neutral-900">LOW OPTIMIZATION</span>
                <span className="font-mono tabular-nums text-xs font-bold text-violet-700">
                  4.5 pts
                </span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Faster encoding preset. Tuned for file size reduction while preserving acceptable visual clarity.
              </p>
              <div className="mt-2 text-[11px] font-mono text-neutral-400">
                HandBrake RF 26 / FFmpeg fast · AAC 128k
              </div>
            </div>

            {/* Level 2: Medium */}
            <div
              onClick={() => setSelectedLevel('medium')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedLevel === 'medium'
                  ? 'border-violet-600 bg-violet-50/20 shadow-2xs'
                  : 'border-neutral-200 hover:border-neutral-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-neutral-900">MEDIUM OPTIMIZATION</span>
                  <span className="text-[10px] text-violet-700 font-semibold bg-violet-100/60 px-1.5 py-0.5 rounded">
                    Recommended
                  </span>
                </div>
                <span className="font-mono tabular-nums text-xs font-bold text-violet-700">
                  8.5 pts
                </span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Balanced quality-based configuration. Ideal for social feeds, crisp textures, and natural motion.
              </p>
              <div className="mt-2 text-[11px] font-mono text-neutral-400">
                HandBrake RF 21 / FFmpeg medium · AAC 192k
              </div>
            </div>

            {/* Level 3: High */}
            <div
              onClick={() => setSelectedLevel('high')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedLevel === 'high'
                  ? 'border-violet-600 bg-violet-50/20 shadow-2xs'
                  : 'border-neutral-200 hover:border-neutral-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-neutral-900">HIGH OPTIMIZATION</span>
                <span className="font-mono tabular-nums text-xs font-bold text-violet-700">
                  10.0 pts
                </span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Quality-prioritized encoding using a slower, thorough preset. Designed for gaming montages and zero artifacting.
              </p>
              <div className="mt-2 text-[11px] font-mono text-neutral-400">
                HandBrake RF 18 / FFmpeg slow (CRF 17) · AAC 256k
              </div>
            </div>

            {/* Point Checkout Confirmation */}
            <div className="pt-4 border-t border-neutral-100 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Required Points:</span>
                <span className="font-mono font-bold text-neutral-900">{currentCost.toFixed(1)} points</span>
              </div>

              {user && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">Your Current Balance:</span>
                  <span className={`font-mono font-bold ${isZeroPoints ? 'text-red-600' : 'text-neutral-900'}`}>
                    {userBalance.toFixed(1)} points
                  </span>
                </div>
              )}

              {user && isZeroPoints && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 text-xs text-amber-900 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>0 Points Remaining — Optimizer Locked</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-normal">
                    You cannot use the video optimizer with 0 points. Claim your weekly points or buy a pack to unlock.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    {pointsStatus?.canClaimWeekly && (
                      <button
                        onClick={onOpenPoints}
                        className="font-bold underline text-violet-700 hover:text-violet-900 cursor-pointer"
                      >
                        Claim 30 Free Points →
                      </button>
                    )}
                    <button
                      onClick={onOpenShop}
                      className="font-bold underline text-amber-900 hover:text-amber-950 cursor-pointer"
                    >
                      Refill in shop →
                    </button>
                  </div>
                </div>
              )}

              {user && !isZeroPoints && !hasEnoughPoints && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-700 space-y-1">
                  <div>
                    Need {(currentCost - userBalance).toFixed(1)} more points to process this job.
                  </div>
                  <button
                    onClick={onOpenShop}
                    className="font-bold underline text-red-900 hover:text-red-950 block cursor-pointer"
                  >
                    Top up points in shop →
                  </button>
                </div>
              )}

              <button
                type="button"
                disabled={
                  startingJob ||
                  (!!user && isZeroPoints) ||
                  (!!user && !hasEnoughPoints) ||
                  (!!user && !draftFileId)
                }
                onClick={() => {
                  if (!user) {
                    triggerGoogleLogin();
                  } else {
                    handleStartOptimization();
                  }
                }}
                className={`w-full py-3 px-4 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                  !user
                    ? 'bg-violet-600 hover:bg-violet-700'
                    : isZeroPoints
                    ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed border border-neutral-300'
                    : !draftFileId || !hasEnoughPoints || startingJob
                    ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                    : 'bg-violet-600 hover:bg-violet-700'
                }`}
              >
                {startingJob ? (
                  <span>Reserving points & launching worker...</span>
                ) : !user ? (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Sign in with Google to Use Video Optimizer</span>
                  </div>
                ) : isZeroPoints ? (
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-neutral-500" />
                    <span>0 Points Remaining — Optimizer Locked</span>
                  </div>
                ) : !draftFileId ? (
                  <span>Upload or Select Video to Start</span>
                ) : !hasEnoughPoints ? (
                  <span>Insufficient Points Balance</span>
                ) : (
                  <>
                    <span>Start {selectedLevel.toUpperCase()} Optimization ({currentCost.toFixed(1)} pts)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-neutral-400 text-center">
                Points are safely reserved and deducted only upon verified output completion.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Processing History Section (Directly on Dashboard) */}
      <div className="pt-6 border-t border-neutral-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Recent Processing Jobs</h2>
            <p className="text-xs text-neutral-500">Verified stream outputs and instant re-downloads.</p>
          </div>
        </div>

        {loadingRecent ? (
          <div className="p-8 text-center text-xs text-neutral-400 font-mono">
            Loading recent jobs...
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="p-8 rounded-xl border border-neutral-200 bg-neutral-50/50 text-center text-xs text-neutral-500">
            No recent jobs processed yet. Upload a clip above to run your first optimization.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-5">Title</th>
                    <th className="py-3 px-5">Tier & Mode</th>
                    <th className="py-3 px-5">Original Size</th>
                    <th className="py-3 px-5">Optimized Size</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-800">
                  {recentJobs.map((job) => {
                    const origBytes = job.originalMeta?.sizeBytes || 1;
                    const optBytes = job.optimizedMeta?.sizeBytes || 0;
                    const pct = Math.round(((optBytes - origBytes) / origBytes) * 100);

                    return (
                      <tr key={job.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-3 px-5 font-semibold text-neutral-900 truncate max-w-xs">
                          {job.originalFilename}
                        </td>

                        <td className="py-3 px-5 capitalize font-medium text-neutral-700">
                          {job.optimizationLevel} ({job.pointCost} pts)
                        </td>

                        <td className="py-3 px-5 font-mono text-neutral-600">
                          {job.originalMeta?.sizeFormatted || '—'}
                        </td>

                        <td className="py-3 px-5">
                          {job.status === 'completed' && job.optimizedMeta ? (
                            <span className="font-mono font-semibold text-neutral-900">
                              {job.optimizedMeta.sizeFormatted}{' '}
                              <span className={`text-[11px] ${pct < 0 ? 'text-emerald-700' : 'text-neutral-500'}`}>
                                ({pct < 0 ? `${pct}%` : `+${pct}%`})
                              </span>
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>

                        <td className="py-3 px-5">
                          {job.status === 'completed' ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Completed</span>
                            </span>
                          ) : (
                            <span className="text-neutral-500 capitalize">{job.status}</span>
                          )}
                        </td>

                        <td className="py-3 px-5 text-right">
                          {job.status === 'completed' && (
                            <a
                              href={`/api/video/download/${job.id}`}
                              download
                              className="inline-flex p-1.5 text-violet-700 hover:text-violet-900 hover:bg-violet-50 rounded transition-colors"
                              title="Download MP4"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
