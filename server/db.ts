import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  passwordHash: string;
  displayName: string;
  pointsBalance: number; // Stored with 1 decimal precision, e.g., 30.0
  lastFreePointsClaimedAt: number; // timestamp ms
  authProvider?: 'email' | 'google' | 'discord';
  avatarUrl?: string;
  createdAt: number;
}

export type OptimizationLevel = 'low' | 'medium' | 'high';
export type AspectRatioMode = 'crop' | 'fit' | 'preserve';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type ProcessingEngine = 'handbrake' | 'ffmpeg' | 'auto';
export type ProcessingMode = 'smart' | 'stream_copy' | 'quality_encode';

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
  optionalFilters?: {
    unsharp?: boolean;
    colorBoost?: boolean;
  };
  smartSelectionReason?: string;
  status: JobStatus;
  pointCost: number; // 4.5, 8.5, or 10.0
  pointsReserved: boolean;
  pointsDeducted: boolean;
  progressPercent: number; // 0 - 100
  processingStage: string;
  errorMessage?: string;
  originalMeta?: VideoMetadata;
  optimizedMeta?: VideoMetadata;
  createdAt: number;
  completedAt?: number;
}

export type TransactionType = 'weekly_grant' | 'reservation' | 'deduction' | 'refund' | 'purchase';

export interface PointTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number; // Positive for grant/refund/purchase, negative for reservation/deduction
  balanceAfter: number;
  referenceJobId?: string;
  description: string;
  createdAt: number;
}

interface DatabaseSchema {
  users: Record<string, User>;
  jobs: Record<string, VideoJob>;
  transactions: PointTransaction[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'bless_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache synced with disk
let db: DatabaseSchema = {
  users: {},
  jobs: {},
  transactions: [],
};

// Supabase client instance (if configured)
let supabaseClient: SupabaseClient | null = null;
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

if (supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('[Supabase] Initialized with remote endpoint:', supabaseUrl);
  } catch (err) {
    console.error('[Supabase] Error initializing client:', err);
  }
}

// Load database from file
function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(data);
      if (!db.users) db.users = {};
      if (!db.jobs) db.jobs = {};
      if (!db.transactions) db.transactions = [];
    } catch (err) {
      console.error('[DB] Error parsing db file, reinitializing:', err);
      saveDB();
    }
  } else {
    // Seed default test user: test@blessmethod.com / password123
    const testUserId = 'usr_bless_creator';
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('password123', salt, 1000, 64, 'sha512').toString('hex');
    const fullHash = `${salt}:${hash}`;

    const now = Date.now();
    const testUser: User = {
      id: testUserId,
      email: 'creator@blessmethod.com',
      passwordHash: fullHash,
      displayName: 'Bless Creator',
      pointsBalance: 30.0, // Initial 30 free points
      lastFreePointsClaimedAt: now,
      createdAt: now,
    };

    db.users[testUserId] = testUser;
    db.transactions.push({
      id: 'tx_' + crypto.randomUUID(),
      userId: testUserId,
      type: 'weekly_grant',
      amount: 30.0,
      balanceAfter: 30.0,
      description: 'Welcome grant: 30 free points for TikTok optimization',
      createdAt: now,
    });

    saveDB();
    console.log('[DB] Initialized with sample creator account (creator@blessmethod.com / password123)');
  }
}

// Atomic save to disk
export function saveDB() {
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[DB] Error saving database:', err);
  }
}

loadDB();

// Helper password hashing
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

export const dbService = {
  isSupabaseConfigured(): boolean {
    return !!supabaseClient;
  },

  getSupabaseStatus() {
    return {
      configured: !!supabaseClient,
      url: supabaseUrl || null,
      usingLocalPersistence: !supabaseClient,
      dbFilePath: DB_FILE,
    };
  },

  // USERS
  getUserById(id: string): User | undefined {
    return db.users[id];
  },

  getUserByEmail(email: string): User | undefined {
    const normalized = email.toLowerCase().trim();
    return Object.values(db.users).find((u) => u.email.toLowerCase() === normalized);
  },

  createUser(email: string, password: string, displayName: string): User {
    const normalized = email.toLowerCase().trim();
    const existing = Object.values(db.users).find((u) => u.email.toLowerCase() === normalized);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const userId = 'usr_' + crypto.randomUUID();
    const now = Date.now();
    const passwordHash = hashPassword(password);

    const newUser: User = {
      id: userId,
      email: normalized,
      passwordHash,
      displayName: displayName.trim() || normalized.split('@')[0],
      pointsBalance: 30.0, // 30 free points upon registration!
      lastFreePointsClaimedAt: now,
      createdAt: now,
    };

    db.users[userId] = newUser;

    // Record welcome grant transaction
    db.transactions.push({
      id: 'tx_' + crypto.randomUUID(),
      userId,
      type: 'weekly_grant',
      amount: 30.0,
      balanceAfter: 30.0,
      description: 'Initial weekly reward: 30 free points for TikTok video optimization',
      createdAt: now,
    });

    saveDB();
    return newUser;
  },

  findOrCreateOAuthUser(provider: 'google' | 'discord', email: string, displayName: string, avatarUrl?: string): User {
    const normalized = email.toLowerCase().trim();
    let existing = Object.values(db.users).find((u) => u.email.toLowerCase() === normalized);

    if (existing) {
      if (!existing.avatarUrl && avatarUrl) existing.avatarUrl = avatarUrl;
      if (!existing.authProvider) existing.authProvider = provider;
      saveDB();
      return existing;
    }

    const userId = 'usr_' + crypto.randomUUID();
    const now = Date.now();
    const fakePass = crypto.randomBytes(32).toString('hex');
    const passwordHash = hashPassword(fakePass);

    const newUser: User = {
      id: userId,
      email: normalized,
      passwordHash,
      displayName: displayName.trim() || normalized.split('@')[0],
      pointsBalance: 30.0, // Initial 30 free points for new OAuth signup!
      lastFreePointsClaimedAt: now,
      authProvider: provider,
      avatarUrl,
      createdAt: now,
    };

    db.users[userId] = newUser;

    // Record welcome grant transaction
    db.transactions.push({
      id: 'tx_' + crypto.randomUUID(),
      userId,
      type: 'weekly_grant',
      amount: 30.0,
      balanceAfter: 30.0,
      description: `Welcome grant via ${provider.toUpperCase()}: 30 free points for TikTok optimization`,
      createdAt: now,
    });

    saveDB();
    return newUser;
  },

  updateUserPoints(userId: string, newBalance: number, lastFreeClaimedAt?: number): User {
    const user = db.users[userId];
    if (!user) throw new Error('User not found');
    user.pointsBalance = Math.round(newBalance * 10) / 10;
    if (lastFreeClaimedAt !== undefined) {
      user.lastFreePointsClaimedAt = lastFreeClaimedAt;
    }
    saveDB();
    return user;
  },

  // JOBS
  createJob(job: VideoJob): VideoJob {
    db.jobs[job.id] = { ...job };
    saveDB();
    return db.jobs[job.id];
  },

  getJobById(id: string): VideoJob | undefined {
    return db.jobs[id];
  },

  getUserJobs(userId: string): VideoJob[] {
    return Object.values(db.jobs)
      .filter((j) => j.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  updateJob(id: string, updates: Partial<VideoJob>): VideoJob {
    const job = db.jobs[id];
    if (!job) throw new Error('Job not found');
    db.jobs[id] = { ...job, ...updates };
    saveDB();
    return db.jobs[id];
  },

  deleteJob(id: string, userId: string): boolean {
    const job = db.jobs[id];
    if (!job || job.userId !== userId) return false;
    delete db.jobs[id];
    saveDB();
    return true;
  },

  // TRANSACTIONS
  createTransaction(tx: Omit<PointTransaction, 'id' | 'createdAt'>): PointTransaction {
    const fullTx: PointTransaction = {
      ...tx,
      id: 'tx_' + crypto.randomUUID(),
      createdAt: Date.now(),
    };
    db.transactions.unshift(fullTx);
    saveDB();
    return fullTx;
  },

  getUserTransactions(userId: string): PointTransaction[] {
    return db.transactions
      .filter((t) => t.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  // SYSTEM STATS
  getStats() {
    return {
      totalUsers: Object.keys(db.users).length,
      totalJobs: Object.keys(db.jobs).length,
      completedJobs: Object.values(db.jobs).filter((j) => j.status === 'completed').length,
      totalTransactions: db.transactions.length,
    };
  },

  // Supabase SQL Schema for easy copy-paste
  getSupabaseSQLSchema(): string {
    return `-- BLESS METHOD Supabase PostgreSQL Migration Script
-- Run this in your Supabase SQL Editor to provision tables with Row Level Security (RLS)

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  points_balance NUMERIC(8, 1) DEFAULT 30.0 NOT NULL,
  last_free_points_claimed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. Video Jobs Table
CREATE TABLE IF NOT EXISTS public.video_jobs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  original_filename TEXT NOT NULL,
  original_file_path TEXT NOT NULL,
  optimized_file_path TEXT,
  optimization_level TEXT CHECK (optimization_level IN ('low', 'medium', 'high')) NOT NULL,
  tiktok_preset BOOLEAN DEFAULT TRUE,
  aspect_ratio_mode TEXT CHECK (aspect_ratio_mode IN ('crop', 'fit', 'preserve')) NOT NULL,
  status TEXT CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')) NOT NULL,
  point_cost NUMERIC(4, 1) NOT NULL,
  progress_percent INTEGER DEFAULT 0,
  processing_stage TEXT,
  error_message TEXT,
  original_meta JSONB,
  optimized_meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own video jobs"
  ON public.video_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own video jobs"
  ON public.video_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Point Transactions Table
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('weekly_grant', 'reservation', 'deduction', 'refund', 'purchase')) NOT NULL,
  amount NUMERIC(6, 1) NOT NULL,
  balance_after NUMERIC(8, 1) NOT NULL,
  reference_job_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON public.point_transactions FOR SELECT
  USING (auth.uid() = user_id);
`;
  },
};
