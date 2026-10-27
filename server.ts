import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { dbService, verifyPassword, OptimizationLevel, AspectRatioMode, VideoJob } from './server/db.js';
import { pointsService } from './server/points.js';
import { videoEngine, probeVideo, formatBytes, isHandBrakeAvailable } from './server/videoEngine.js';
import { stripeService } from './server/stripe.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Storage config for uploaded source videos
const uploadsDir = videoEngine.getUploadsDir();
const processedDir = videoEngine.getProcessedDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const unique = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files (MP4, MOV, WEBM, MKV) are accepted.'));
    }
  },
});

// Simple secure session token auth middleware
// Maps Bearer <token> to userId
const sessions = new Map<string, { userId: string; createdAt: number }>();

function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.split(' ')[1];
  const session = sessions.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }

  const user = dbService.getUserById(session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found.' });
  }

  (req as any).user = user;
  (req as any).sessionToken = token;
  next();
}

// Optional auth helper (for preview/guest interactions or authenticated user)
function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const session = sessions.get(token);
    if (session) {
      const user = dbService.getUserById(session.userId);
      if (user) {
        (req as any).user = user;
      }
    }
  }
  next();
}

// ----------------------------------------------------
// AUTH API
// ----------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const newUser = dbService.createUser(email, password, displayName || '');
    const token = crypto.randomUUID();
    sessions.set(token, { userId: newUser.id, createdAt: Date.now() });

    res.json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        pointsBalance: newUser.pointsBalance,
        lastFreePointsClaimedAt: newUser.lastFreePointsClaimedAt,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = dbService.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = crypto.randomUUID();
    sessions.set(token, { userId: user.id, createdAt: Date.now() });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        pointsBalance: user.pointsBalance,
        lastFreePointsClaimedAt: user.lastFreePointsClaimedAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

app.get('/api/auth/me', authenticateUser, (req, res) => {
  const user = (req as any).user;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      pointsBalance: user.pointsBalance,
      lastFreePointsClaimedAt: user.lastFreePointsClaimedAt,
    },
  });
});

app.post('/api/auth/logout', authenticateUser, (req, res) => {
  const token = (req as any).sessionToken;
  sessions.delete(token);
  res.json({ success: true });
});

// ----------------------------------------------------
// OAUTH API (Google & Discord)
// ----------------------------------------------------
const APP_URL = (process.env.APP_URL || 'https://ais-dev-wkzxd55pj4q4uq7ebvxsop-569246022981.europe-west2.run.app').replace(/\/$/, '');

app.get('/api/auth/oauth-config', (_req, res) => {
  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('MY_'));
  const discordConfigured = !!(process.env.DISCORD_CLIENT_ID && !process.env.DISCORD_CLIENT_ID.includes('MY_'));

  res.json({
    appUrl: APP_URL,
    google: {
      configured: googleConfigured,
      clientId: process.env.GOOGLE_CLIENT_ID || null,
      callbackUrl: `${APP_URL}/auth/callback/google`,
    },
    discord: {
      configured: discordConfigured,
      clientId: process.env.DISCORD_CLIENT_ID || null,
      callbackUrl: `${APP_URL}/auth/callback/discord`,
    },
  });
});

app.get('/api/auth/oauth-url/:provider', (req, res) => {
  const { provider } = req.params;

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      return res.status(400).json({
        error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID in your environment, or use Sandbox Sign In.',
        needsConfig: true,
      });
    }

    const redirectUri = `${APP_URL}/auth/callback/google`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      access_type: 'offline',
      prompt: 'consent',
    });

    return res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  }

  if (provider === 'discord') {
    return res.status(400).json({
      error: 'Discord sign-in is coming soon! Please sign in with Google.',
      comingSoon: true,
    });
  }

  res.status(400).json({ error: 'Unsupported OAuth provider' });
});

// Instant Sandbox OAuth Simulation (for testing without external credentials)
app.post('/api/auth/oauth-simulate', (req, res) => {
  try {
    const { provider, email, displayName } = req.body;
    if (provider === 'discord') {
      return res.status(400).json({
        error: 'Discord sign-in is coming soon! Please sign in with Google.',
        comingSoon: true,
      });
    }

    if (provider !== 'google') {
      return res.status(400).json({ error: 'Invalid provider. Please use Google.' });
    }

    const simEmail = email || `${provider}.creator.${Date.now().toString().slice(-4)}@blessmethod.com`;
    const simName = displayName || (provider === 'google' ? 'Google Creator' : 'Discord Gamer');
    const avatar = provider === 'discord'
      ? 'https://cdn.discordapp.com/embed/avatars/0.png'
      : undefined;

    const user = dbService.findOrCreateOAuthUser(provider, simEmail, simName, avatar);
    const token = crypto.randomUUID();
    sessions.set(token, { userId: user.id, createdAt: Date.now() });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        pointsBalance: user.pointsBalance,
        lastFreePointsClaimedAt: user.lastFreePointsClaimedAt,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// OAuth Callback Handler: Google
app.get(['/auth/callback/google', '/auth/callback/google/'], async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h2>Google Sign In Cancelled or Failed</h2>
          <p>${error || 'No authorization code received.'}</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  }

  try {
    const redirectUri = `${APP_URL}/auth/callback/google`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Google token exchange failed: ${await tokenRes.text()}`);
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      throw new Error('Failed to fetch Google user profile');
    }

    const profile = await userRes.json();
    const user = dbService.findOrCreateOAuthUser('google', profile.email, profile.name || profile.given_name, profile.picture);
    const token = crypto.randomUUID();
    sessions.set(token, { userId: user.id, createdAt: Date.now() });

    const safeUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      pointsBalance: user.pointsBalance,
      lastFreePointsClaimedAt: user.lastFreePointsClaimedAt,
      authProvider: user.authProvider,
      avatarUrl: user.avatarUrl,
    };

    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h2>Google Sign In Successful</h2>
          <p>Connecting your BLESS METHOD session...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                provider: 'google',
                token: ${JSON.stringify(token)},
                user: ${JSON.stringify(safeUser)}
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h2>Google Authentication Error</h2>
          <p>${err.message}</p>
          <button onclick="window.close()">Close Window</button>
        </body>
      </html>
    `);
  }
});

// OAuth Callback Handler: Discord
app.get(['/auth/callback/discord', '/auth/callback/discord/'], async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h2>Discord Sign In Cancelled or Failed</h2>
          <p>${error || 'No authorization code received.'}</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  }

  try {
    const redirectUri = `${APP_URL}/auth/callback/discord`;
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.DISCORD_CLIENT_ID || '',
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Discord token exchange failed: ${await tokenRes.text()}`);
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      throw new Error('Failed to fetch Discord user profile');
    }

    const profile = await userRes.json();
    const email = profile.email || `${profile.username}@discord.blessmethod.com`;
    const avatar = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : 'https://cdn.discordapp.com/embed/avatars/0.png';

    const user = dbService.findOrCreateOAuthUser('discord', email, profile.global_name || profile.username, avatar);
    const token = crypto.randomUUID();
    sessions.set(token, { userId: user.id, createdAt: Date.now() });

    const safeUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      pointsBalance: user.pointsBalance,
      lastFreePointsClaimedAt: user.lastFreePointsClaimedAt,
      authProvider: user.authProvider,
      avatarUrl: user.avatarUrl,
    };

    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h2>Discord Sign In Successful</h2>
          <p>Connecting your BLESS METHOD session...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                provider: 'discord',
                token: ${JSON.stringify(token)},
                user: ${JSON.stringify(safeUser)}
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h2>Discord Authentication Error</h2>
          <p>${err.message}</p>
          <button onclick="window.close()">Close Window</button>
        </body>
      </html>
    `);
  }
});

// ----------------------------------------------------
// POINTS API
// ----------------------------------------------------
app.get('/api/points/status', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const status = pointsService.getPointsStatus(user.id);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/points/claim-weekly', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const result = pointsService.claimWeeklyPoints(user.id);
    res.json({
      success: true,
      message: 'Claimed 30.0 free points successfully!',
      newBalance: result.newBalance,
      transaction: result.transaction,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/points/transactions', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const transactions = dbService.getUserTransactions(user.id);
    res.json(transactions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SHOP API
// ----------------------------------------------------
app.get('/api/shop/packages', (_req, res) => {
  res.json(stripeService.getStatus());
});

app.post('/api/shop/simulate-test-purchase', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const { packageId } = req.body;
    if (!packageId) {
      return res.status(400).json({ error: 'Package ID required.' });
    }

    const result = stripeService.simulateTestCheckout(user.id, packageId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// VIDEO JOBS API
// ----------------------------------------------------

// 1. Upload video file & probe metadata
app.post('/api/jobs/upload', authenticateUser, upload.single('video'), async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.pointsBalance <= 0) {
      return res.status(403).json({
        error: 'You have 0 points remaining. You cannot use the video optimizer. Please claim your weekly points or top up in the Shop.',
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided.' });
    }

    const filePath = req.file.path;
    const originalFilename = req.file.originalname;

    // Probe video with ffprobe
    const metadata = await probeVideo(filePath);

    res.json({
      tempFileId: path.basename(filePath),
      originalFilename,
      filePath,
      metadata,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to analyze uploaded video.' });
  }
});

// 2. Use Built-in Sample Clip for Instant 1-Click Verification
app.post('/api/jobs/use-sample', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.pointsBalance <= 0) {
      return res.status(403).json({
        error: 'You have 0 points remaining. You cannot use the video optimizer. Please claim your weekly points or top up in the Shop.',
      });
    }

    const sampleSource = path.resolve(process.cwd(), 'public/samples/sample_raw.mp4');
    if (!fs.existsSync(sampleSource)) {
      return res.status(404).json({ error: 'Sample video not found on server.' });
    }

    const targetFilename = `sample_${Date.now()}_raw.mp4`;
    const targetPath = path.join(uploadsDir, targetFilename);

    // Copy sample to uploads
    fs.copyFileSync(sampleSource, targetPath);

    const metadata = await probeVideo(targetPath);

    res.json({
      tempFileId: targetFilename,
      originalFilename: 'tiktok_creator_vertical_sample.mp4',
      filePath: targetPath,
      metadata,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load sample clip.' });
  }
});

// 3. Start Optimization Job (Atomically reserves points & spawns worker)
app.post('/api/jobs/start', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.pointsBalance <= 0) {
      return res.status(403).json({
        error: 'You have 0 points remaining. You cannot use the video optimizer. Please claim your weekly points or top up in the Shop.',
      });
    }

    const {
      tempFileId,
      originalFilename,
      optimizationLevel,
      tiktokPreset,
      aspectRatioMode,
      engine,
      processingMode,
      gamingMontagePreset,
      optionalFilters,
    } = req.body;

    if (!tempFileId) {
      return res.status(400).json({ error: 'Missing uploaded video reference.' });
    }

    const validLevels: OptimizationLevel[] = ['low', 'medium', 'high'];
    const level: OptimizationLevel = validLevels.includes(optimizationLevel) ? optimizationLevel : 'medium';
    const aspectMode: AspectRatioMode = ['crop', 'fit', 'preserve'].includes(aspectRatioMode) ? aspectRatioMode : 'preserve';

    const sourcePath = path.join(uploadsDir, tempFileId);
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Source video file not found or expired.' });
    }

    const pointCost = pointsService.getPointCost(level);
    const jobId = 'job_' + crypto.randomUUID();

    // 1. Atomically reserve points FIRST (prevents overdrafts and duplicate requests)
    const { newBalance } = pointsService.reservePointsForJob(user.id, jobId, level);

    // 2. Probe metadata
    const originalMeta = await probeVideo(sourcePath);

    // 3. Create Job in database
    const newJob: VideoJob = {
      id: jobId,
      userId: user.id,
      originalFilename: originalFilename || 'video.mp4',
      originalFilePath: sourcePath,
      optimizationLevel: level,
      tiktokPreset: tiktokPreset !== false,
      aspectRatioMode: aspectMode,
      engine: engine || 'auto',
      processingMode: processingMode || 'smart',
      gamingMontagePreset: gamingMontagePreset === true,
      optionalFilters: optionalFilters || {},
      status: 'queued',
      pointCost,
      pointsReserved: true,
      pointsDeducted: false,
      progressPercent: 0,
      processingStage: 'Queued in processing worker...',
      originalMeta,
      createdAt: Date.now(),
    };

    dbService.createJob(newJob);

    // 4. Trigger video engine worker asynchronously
    videoEngine.startOptimizationJob(jobId).catch((workerErr) => {
      console.error(`Worker error for job ${jobId}:`, workerErr);
    });

    res.json({
      success: true,
      job: newJob,
      pointCost,
      newPointsBalance: newBalance,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not start optimization job.' });
  }
});

// 4. Get Job Details & Progress
app.get('/api/jobs/:id', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const job = dbService.getJobById(req.params.id);

  if (!job || job.userId !== user.id) {
    return res.status(404).json({ error: 'Optimization job not found.' });
  }

  res.json(job);
});

// 5. Cancel Job & Refund points
app.post('/api/jobs/:id/cancel', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const success = videoEngine.cancelJob(req.params.id, user.id);

  if (!success) {
    return res.status(400).json({ error: 'Cannot cancel job in current state.' });
  }

  const updatedJob = dbService.getJobById(req.params.id);
  const updatedUser = dbService.getUserById(user.id);

  res.json({
    success: true,
    job: updatedJob,
    newBalance: updatedUser?.pointsBalance,
  });
});

// 6. Delete Job from History
app.delete('/api/jobs/:id', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const job = dbService.getJobById(req.params.id);

  if (!job || job.userId !== user.id) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  // Delete files if they exist
  try {
    if (job.originalFilePath && fs.existsSync(job.originalFilePath)) fs.unlinkSync(job.originalFilePath);
    if (job.optimizedFilePath && fs.existsSync(job.optimizedFilePath)) fs.unlinkSync(job.optimizedFilePath);
  } catch (e) {
    console.error('Error unlinking job files:', e);
  }

  dbService.deleteJob(req.params.id, user.id);
  res.json({ success: true });
});

// 7. Get User's Jobs History
app.get('/api/jobs', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const jobs = dbService.getUserJobs(user.id);
  res.json(jobs);
});

// ----------------------------------------------------
// VIDEO STREAMING & DIRECT DOWNLOAD
// ----------------------------------------------------

// Stream video with HTTP 206 partial range support (crucial for smooth HTML5 video scrubbing!)
app.get('/api/video/stream/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const job = dbService.getJobById(id);

  if (!job) {
    return res.status(404).send('Job not found');
  }

  const filePath = type === 'optimized' ? job.optimizedFilePath : job.originalFilePath;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Video file not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Download verified output file
app.get('/api/video/download/:id', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const job = dbService.getJobById(req.params.id);

  if (!job || job.userId !== user.id) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  if (job.status !== 'completed' || !job.optimizedFilePath || !fs.existsSync(job.optimizedFilePath)) {
    return res.status(400).json({ error: 'Optimized video file is not ready or missing.' });
  }

  const baseName = path.parse(job.originalFilename).name;
  const downloadName = `${baseName}_bless_${job.optimizationLevel}.mp4`;
  res.download(job.optimizedFilePath, downloadName);
});

// ----------------------------------------------------
// AI SUPPORT ASSISTANT (BLESS METHOD AI SPECIALIST)
// ----------------------------------------------------
const aiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

const BLESS_SPECIALIST_PROMPT = `You are the official AI Support Specialist for BLESS METHOD.
Tagline: "USE THE QUALITY YOU FILMED."

Your role is to diagnose and solve any technical, video quality, encoding, points, or account issues users encounter.

Key Facts about BLESS METHOD:
- Purpose: High-precision video optimization platform engineered specifically for TikTok, Reels, and high-motion gaming montages without quality loss or compression mud.
- Encoding Engine: Real HandBrakeCLI & FFmpeg architecture (Constant Rate Factor CRF, H.264 High Profile, faststart metadata placement, AAC 192kbps).
- Optimization Levels & Point Costs:
  1. Low Optimization: 4.5 points (RF 24, fast compression, quick turnaround).
  2. Medium Optimization: 8.5 points (RF 22, balanced high quality for general TikTok/Reels).
  3. High Optimization: 10.0 points (RF 20, visual transparency, best for 60fps fast-motion gaming/montages).
  4. Stream Copy: 2.0 points (instant, preserves exact original stream without re-encoding).
- Strict 0-Points Rule: If a user has 0 points, they cannot start any video optimization job. They must either:
  * Claim the weekly free 30 points (refreshed every 7 days in the Points tab).
  * Purchase a points package in the Points Shop (Starter: 50 pts for $4.99, Creator: 150 pts for $12.99, Studio Pro: 400 pts for $29.99).
- Google Login Requirement: Users MUST sign in with Google to use the Video Optimizer.
- Discord Sign In: Currently marked as "Coming Soon" (OAuth 2.0 integration in active preview).
- Refund Guarantee: If an encoding job ever fails due to a server error or timeout, the user's points are automatically refunded instantly.
- Upload limits: MP4, MOV, WEBM, MKV files up to 250MB.

Common Fixes:
- "Why is my TikTok blurry?": TikTok aggressively recompresses files larger than ~20MB or with fluctuating variable bitrates. Recommend: Use BLESS High Optimization (CRF 20, 1080x1920 9:16 vertical), ensure "Upload HD" toggle is enabled in TikTok app settings, and avoid uploading via low-bandwidth Wi-Fi.
- "Why 0 points error?": Advise user to visit the Points tab to claim their free weekly 30 points if available, or visit the Shop tab.
- "Audio is out of sync": Screen recordings often use Variable Frame Rate (VFR). BLESS METHOD's HandBrake encoder normalizes this to Constant Frame Rate (CFR) with AAC 192k audio.
- "Upload stuck or HandBrake error": Verify file is <250MB, check if file is corrupt, or try selecting FFmpeg Stream Copy if the codec is already H.264.

Tone: Concise, warm, expert, actionable, formatting with bold text and short bullet points. Always provide clear next steps.`;

app.post('/api/ai/help', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { message, history, userContext } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const currentUser = (req as any).user;
    const pointsBalance = currentUser?.pointsBalance ?? userContext?.pointsBalance ?? 0;
    const isGoogleAuth = currentUser?.provider === 'google' || currentUser?.email?.includes('@');

    // Context prefix to give the model immediate awareness of this user's state
    const contextualPrefix = `[User System State: Points Balance = ${pointsBalance.toFixed(1)} pts, Signed In = ${Boolean(currentUser)}, Provider = ${currentUser?.provider || 'Guest'}, Google Authenticated = ${isGoogleAuth}]\n`;

    if (aiClient) {
      try {
        // Construct conversation contents
        const contents: any[] = [];
        if (Array.isArray(history) && history.length > 0) {
          for (const item of history.slice(-8)) {
            if (item.role === 'user' || item.role === 'model' || item.role === 'assistant') {
              contents.push({
                role: item.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: item.text || '' }],
              });
            }
          }
        }
        contents.push({
          role: 'user',
          parts: [{ text: `${contextualPrefix}${message}` }],
        });

        const aiResponse = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction: BLESS_SPECIALIST_PROMPT,
            temperature: 0.7,
          },
        });

        const replyText = aiResponse.text?.trim();
        if (replyText) {
          return res.json({
            reply: replyText,
            source: 'gemini-3.8-flash',
            timestamp: Date.now(),
          });
        }
      } catch (geminiError: any) {
        console.warn('[BLESS AI Help] Gemini API call warning, falling back to local specialist:', geminiError?.message || geminiError);
      }
    }

    // Built-in expert fallback knowledge base if API key is unconfigured or network dropped
    const lower = message.toLowerCase();
    let fallbackReply = '';

    if (lower.includes('point') || lower.includes('balance') || lower.includes('cost') || lower.includes('free') || lower.includes('0 point') || pointsBalance <= 0) {
      fallbackReply = `### Points & Balance Guide
- **Current Balance**: **${pointsBalance.toFixed(1)} Points**
- **0 Points Notice**: If your balance is 0.0, the Video Optimizer is temporarily locked to prevent failed job deductions.
- **How to Get Points**:
  1. **Claim Weekly Free Points**: Head to the **Points** tab to claim your **30 Free Points** (available every 7 days).
  2. **Points Shop**: Visit the **Shop** tab for instant refills (Starter 50 pts, Creator 150 pts, Studio Pro 400 pts).
- **Exact Job Costs**:
  * Low Optimization: **4.5 pts**
  * Medium Optimization: **8.5 pts**
  * High Optimization: **10.0 pts**
  * Stream Copy: **2.0 pts**`;
    } else if (lower.includes('tiktok') || lower.includes('blurry') || lower.includes('quality') || lower.includes('720p') || lower.includes('pixel')) {
      fallbackReply = `### Fixing Blurry TikTok Uploads
TikTok frequently compresses videos into a blurry mess if they exceed file size limits or have variable bitrates. Here is how BLESS METHOD fixes it:

1. **Use High Optimization (10 Points)**:
   * Sets HandBrake CRF to 20 for near-lossless clarity.
   * Forces **1080x1920 (9:16 vertical)** resolution.
   * Embeds \`faststart\` MP4 metadata so TikTok servers buffer immediately without aggressive recompression.
2. **In the TikTok Mobile App**:
   * Before posting, tap **More options** > enable **"Allow high-quality uploads"**.
   * Avoid uploading over spotty cellular data.`;
    } else if (lower.includes('handbrake') || lower.includes('ffmpeg') || lower.includes('fail') || lower.includes('error') || lower.includes('stuck')) {
      fallbackReply = `### Encoding & Job Troubleshooting
- **Automatic Refund**: If any encoding job fails or times out, your points are **automatically refunded** back to your balance immediately.
- **Engine Status**: Check the **Engines & DB** tab to inspect live HandBrakeCLI (v1.6.1) and FFmpeg health.
- **Recommended Upload Specs**:
  * Formats: MP4, MOV, WEBM, MKV.
  * Maximum size: 250MB.
  * Codec: H.264 / H.265.
- If your video is already properly encoded and you just need fast packaging, choose **Stream Copy (2.0 pts)**.`;
    } else if (lower.includes('google') || lower.includes('discord') || lower.includes('login') || lower.includes('sign in') || lower.includes('auth')) {
      fallbackReply = `### Authentication & Access
- **Google Sign-In Required**: To start optimizing videos, you must sign in with Google. This securely links your video jobs, history, and point ledger.
- **Discord Sign-In**: Discord OAuth is currently marked as **Coming Soon** and will be enabled in our next release!
- You can sign in anytime using the button in the top right navigation bar.`;
    } else {
      fallbackReply = `### BLESS METHOD Assistant
**"USE THE QUALITY YOU FILMED."**

I can help you troubleshoot and optimize your workflow:
- **Optimization Levels**: High (10 pts, best for 60FPS gaming), Medium (8.5 pts), Low (4.5 pts), Stream Copy (2 pts).
- **Points Balance**: You currently have **${pointsBalance.toFixed(1)} points**. Check the **Points** tab for your weekly 30 free points or the **Shop** for refills.
- **TikTok Blurry Fix**: How to configure 1080x1920 HandBrake CRF 20 with MP4 faststart.
- **Audio Desync Fix**: How our engine aligns Variable Frame Rate recordings into solid Constant Frame Rate (CFR) tracks.

What specific problem can I help you resolve?`;
    }

    return res.json({
      reply: fallbackReply,
      source: 'bless-specialist-builtin',
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('[BLESS AI Help] Endpoint error:', err);
    return res.status(500).json({
      error: 'Unable to process help query at this moment. Please try again.',
      details: err?.message,
    });
  }
});

// ----------------------------------------------------
// SYSTEM STATUS & SUPABASE MIGRATION
// ----------------------------------------------------
app.get('/api/system/status', (_req, res) => {
  res.json({
    app: 'BLESS METHOD',
    tagline: 'POST THE QUALITY YOU FILMED.',
    uptime: process.uptime(),
    db: dbService.getStats(),
    handbrake: {
      available: isHandBrakeAvailable(),
      name: 'HandBrakeCLI',
      version: '1.6.1',
    },
    ffmpeg: {
      available: true,
      name: 'FFmpeg',
      version: '4.4.2',
    },
    supabase: dbService.getSupabaseStatus(),
    stripe: stripeService.getStatus(),
    sqlSchema: dbService.getSupabaseSQLSchema(),
  });
});

// Periodic cleanup of stale files
setInterval(() => {
  videoEngine.cleanupOldFiles();
}, 60 * 60 * 1000);

// ----------------------------------------------------
// VITE DEV SERVER / STATIC ASSETS MOUNT
// ----------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[BLESS METHOD] Vite dev server mounted in middleware mode');
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BLESS METHOD] Server online at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[BLESS METHOD] Fatal server error:', err);
  process.exit(1);
});
