export type OptimizationLevel = 'low' | 'medium' | 'high';
export type AspectRatioMode = 'crop' | 'fit' | 'preserve';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type TransactionType = 'weekly_grant' | 'reservation' | 'deduction' | 'refund' | 'purchase';
export type ProcessingEngine = 'handbrake' | 'ffmpeg' | 'auto';
export type ProcessingMode = 'smart' | 'stream_copy' | 'quality_encode';

export interface VideoMetadata {
  sizeBytes: number;
  sizeFormatted: string;
  width: number;
  height: number;
  durationSeconds: number;
  fps: number;
  codec: string;
  bitrateKbps: number;
  audioCodec?: string;
  audioBitrateKbps?: number;
  pixelFormat?: string;
  colorSpace?: string;
  colorPrimaries?: string;
  colorTransfer?: string;
  isHdr?: boolean;
  isEfficientAlready?: boolean;
  recommendedMode?: 'stream_copy' | 'quality_encode';
  recommendationReason?: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  pointsBalance: number;
  lastFreePointsClaimedAt: number;
  authProvider?: 'email' | 'google' | 'discord';
  avatarUrl?: string;
}

export interface VideoJob {
  id: string;
  userId: string;
  originalFilename: string;
  originalFilePath: string;
  optimizedFilePath?: string;
  optimizationLevel: OptimizationLevel;
  tiktokPreset: boolean;
  aspectRatioMode: AspectRatioMode;
  engine: ProcessingEngine;
  processingMode: ProcessingMode;
  gamingMontagePreset: boolean;
  motionBlur?: boolean;
  motionBlurIntensity?: 'subtle' | 'standard' | 'heavy';
  optionalFilters?: {
    unsharp?: boolean;
    colorBoost?: boolean;
  };
  smartSelectionReason?: string;
  status: JobStatus;
  pointCost: number;
  pointsReserved: boolean;
  pointsDeducted: boolean;
  progressPercent: number;
  processingStage: string;
  errorMessage?: string;
  originalMeta?: VideoMetadata;
  optimizedMeta?: VideoMetadata;
  createdAt: number;
  completedAt?: number;
}

export interface PointTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  referenceJobId?: string;
  description: string;
  createdAt: number;
}

export interface PointsStatus {
  balance: number;
  lastClaimedAt: number;
  canClaimWeekly: boolean;
  nextClaimAt: number;
  secondsUntilNextClaim: number;
  pointCosts: Record<OptimizationLevel, number>;
}

export interface PointsPackage {
  id: string;
  name: string;
  points: number;
  priceEur: number;
  priceFormatted: string;
  bonus?: string;
  popular?: boolean;
}

export interface SystemStatus {
  app: string;
  tagline: string;
  uptime: number;
  db: {
    totalUsers: number;
    totalJobs: number;
    completedJobs: number;
    totalTransactions: number;
  };
  handbrake?: {
    available: boolean;
    name: string;
    version: string;
  };
  ffmpeg?: {
    available: boolean;
    name: string;
    version: string;
  };
  supabase: {
    configured: boolean;
    url: string | null;
    usingLocalPersistence: boolean;
    dbFilePath: string;
  };
  stripe: {
    configured: boolean;
    hasWebhook: boolean;
    packages: PointsPackage[];
    instructions: string;
  };
  sqlSchema: string;
}
