import { spawn, execFile, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { dbService, VideoJob, VideoMetadata, OptimizationLevel, AspectRatioMode, ProcessingEngine, ProcessingMode } from './db.js';
import { pointsService } from './points.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const PROCESSED_DIR = path.resolve(process.cwd(), 'processed');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });

// Track active child processes for graceful cancellation
const activeProcesses = new Map<string, ReturnType<typeof spawn>>();

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Check HandBrakeCLI binary availability
export function isHandBrakeAvailable(): boolean {
  try {
    execSync('which HandBrakeCLI', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size,bit_rate:stream=codec_name,codec_type,width,height,r_frame_rate,bit_rate,pix_fmt,color_space,color_primaries,color_transfer',
      '-of',
      'json',
      filePath,
    ];

    execFile('ffprobe', ffprobeArgs, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`ffprobe failed: ${stderr || err.message}`));
      }

      try {
        const parsed = JSON.parse(stdout);
        const videoStream = parsed.streams?.find((s: any) => s.codec_type === 'video');
        const audioStream = parsed.streams?.find((s: any) => s.codec_type === 'audio');

        if (!videoStream) {
          return reject(new Error('No valid video stream detected in uploaded file.'));
        }

        // Calculate FPS accurately
        let fps = 30;
        if (videoStream.r_frame_rate) {
          const parts = videoStream.r_frame_rate.split('/');
          if (parts.length === 2 && Number(parts[1]) > 0) {
            fps = Math.round((Number(parts[0]) / Number(parts[1])) * 100) / 100;
          } else {
            fps = parseFloat(videoStream.r_frame_rate) || 30;
          }
        }

        const sizeBytes = Number(parsed.format?.size) || fs.statSync(filePath).size;
        const durationSeconds = Number(parsed.format?.duration) || 0;
        const bitrateKbps = Math.round((Number(parsed.format?.bit_rate) || (sizeBytes * 8) / (durationSeconds || 1)) / 1000);

        const codec = (videoStream.codec_name || 'h264').toLowerCase();
        const audioCodec = audioStream?.codec_name?.toLowerCase();
        const pixelFormat = videoStream.pix_fmt || 'yuv420p';
        const colorSpace = videoStream.color_space;
        const colorPrimaries = videoStream.color_primaries;
        const colorTransfer = videoStream.color_transfer;

        const isHdr =
          colorTransfer === 'smpte2084' ||
          colorTransfer === 'arib-std-b67' ||
          colorPrimaries === 'bt2020' ||
          pixelFormat.includes('10');

        // Check if video is already optimal for mobile feeds
        const isOptimalBitrate = bitrateKbps <= 8500;
        const isCompatibleCodec = codec === 'h264' || codec === 'avc1';
        const isCompatibleAudio = !audioCodec || audioCodec === 'aac' || audioCodec === 'mp4a';
        const isEfficientAlready = isOptimalBitrate && isCompatibleCodec && isCompatibleAudio && !isHdr;

        let recommendedMode: 'stream_copy' | 'quality_encode' = 'quality_encode';
        let recommendationReason = 'High bitrate or non-standard container detected. Quality-preserving re-encoding recommended to prevent TikTok compression artifacts.';

        if (isEfficientAlready) {
          recommendedMode = 'stream_copy';
          recommendationReason = `Source stream is already H.264/AAC with optimal bitrate (${bitrateKbps} kbps < 8.5 Mbps). Smart Stream Copy recommended to keep 100% bit-for-bit quality without re-encoding loss.`;
        } else if (bitrateKbps > 25000) {
          recommendationReason = `Massive ${bitrateKbps} kbps bitrate detected. TikTok will aggressively crush this; BLESS Quality Optimization will preserve sharpness with tuned CRF.`;
        }

        const metadata: VideoMetadata = {
          sizeBytes,
          sizeFormatted: formatBytes(sizeBytes),
          width: Number(videoStream.width) || 0,
          height: Number(videoStream.height) || 0,
          durationSeconds: Math.round(durationSeconds * 100) / 100,
          fps,
          codec,
          bitrateKbps,
          audioCodec,
          audioBitrateKbps: audioStream?.bit_rate ? Math.round(Number(audioStream.bit_rate) / 1000) : undefined,
          pixelFormat,
          colorSpace,
          colorPrimaries,
          colorTransfer,
          isHdr,
          isEfficientAlready,
          recommendedMode,
          recommendationReason,
        };

        resolve(metadata);
      } catch (parseErr) {
        reject(new Error('Failed to parse video metadata: ' + String(parseErr)));
      }
    });
  });
}

function parseFfmpegTime(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

export const videoEngine = {
  getUploadsDir() {
    return UPLOADS_DIR;
  },

  getProcessedDir() {
    return PROCESSED_DIR;
  },

  async startOptimizationJob(jobId: string): Promise<void> {
    const job = dbService.getJobById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    try {
      dbService.updateJob(jobId, {
        status: 'processing',
        processingStage: 'Analyzing source codecs and visual dynamics...',
        progressPercent: 5,
      });

      // 1. Probe original metadata
      let originalMeta = job.originalMeta;
      if (!originalMeta) {
        originalMeta = await probeVideo(job.originalFilePath);
        dbService.updateJob(jobId, { originalMeta });
      }

      const totalDuration = originalMeta.durationSeconds || 1;
      const outputFilename = `opt_${job.id}.mp4`;
      const outputFilePath = path.join(PROCESSED_DIR, outputFilename);

      // 2. Determine effective processing mode & engine
      let effectiveMode = job.processingMode || 'smart';
      let smartReason = job.smartSelectionReason || '';

      if (effectiveMode === 'smart') {
        const canStreamCopy =
          originalMeta.isEfficientAlready &&
          (!job.tiktokPreset || job.aspectRatioMode === 'preserve') &&
          !job.optionalFilters?.unsharp &&
          !job.optionalFilters?.colorBoost;

        if (canStreamCopy) {
          effectiveMode = 'stream_copy';
          smartReason = `Smart Mode: Source is already within target mobile bitrate (${originalMeta.bitrateKbps} kbps) with compatible H.264/AAC. Stream copy selected to preserve 100% original quality.`;
        } else {
          effectiveMode = 'quality_encode';
          smartReason = `Smart Mode: Re-encoding selected with quality-based CRF tuning to optimize ${originalMeta.bitrateKbps} kbps bitrate and prevent TikTok compression degradation.`;
        }
      }

      // 3. Determine engine (HandBrake vs FFmpeg)
      let effectiveEngine = job.engine || 'auto';
      const hbAvailable = isHandBrakeAvailable();

      if (effectiveMode === 'stream_copy') {
        effectiveEngine = 'ffmpeg';
      } else if (effectiveEngine === 'auto') {
        effectiveEngine = hbAvailable ? 'handbrake' : 'ffmpeg';
      } else if (effectiveEngine === 'handbrake' && !hbAvailable) {
        console.warn('[BLESS ENGINE] HandBrakeCLI requested but not installed. Falling back to FFmpeg engine.');
        effectiveEngine = 'ffmpeg';
      }

      dbService.updateJob(jobId, {
        smartSelectionReason: smartReason,
        processingStage: `Launching ${effectiveEngine.toUpperCase()} pipeline (${effectiveMode.replace('_', ' ')})`,
        progressPercent: 12,
      });

      // -----------------------------------------------------------------
      // EXECUTION PATH A: SMART STREAM COPY (FFmpeg -c copy)
      // -----------------------------------------------------------------
      if (effectiveMode === 'stream_copy') {
        console.log(`[StreamCopy] Executing lossless stream copy for job ${job.id}`);
        const ffmpegArgs = [
          '-y',
          '-i', job.originalFilePath,
          '-c:v', 'copy',
          '-c:a', 'copy',
          '-movflags', '+faststart',
          outputFilePath,
        ];

        const child = spawn('ffmpeg', ffmpegArgs);
        activeProcesses.set(job.id, child);

        child.on('close', async (code) => {
          activeProcesses.delete(job.id);
          if (code !== 0) {
            handleJobFailure(job, 'Stream copy failed. Falling back to standard re-encoding.');
            return;
          }
          await verifyAndFinalizeJob(job, outputFilePath);
        });

        child.on('error', (err) => {
          activeProcesses.delete(job.id);
          handleJobFailure(job, `Stream copy process error: ${err.message}`);
        });

        return;
      }

      // -----------------------------------------------------------------
      // EXECUTION PATH B: HANDBRAKE CLI (Quality-Based Encoding)
      // -----------------------------------------------------------------
      if (effectiveEngine === 'handbrake' && hbAvailable) {
        console.log(`[HandBrake] Spawning HandBrakeCLI for job ${job.id}`);

        const rfValues: Record<OptimizationLevel, number> = {
          low: 26,
          medium: 21,
          high: 18,
        };

        const audioBitrates: Record<OptimizationLevel, number> = {
          low: 128,
          medium: 192,
          high: 256,
        };

        const rf = rfValues[job.optimizationLevel] || 21;
        const ab = audioBitrates[job.optimizationLevel] || 192;

        const hbArgs: string[] = [
          '-i', job.originalFilePath,
          '-o', outputFilePath,
          '-e', 'x264',
          '-q', rf.toString(),
          '-E', 'av_aac',
          '-B', ab.toString(),
          '--optimize',
          '--keep-display-aspect',
          '--pfr',
        ];

        const x264Options: string[] = [];
        if (job.gamingMontagePreset) {
          x264Options.push('aq-mode=3', 'aq-strength=1.1', 'rc-lookahead=60', 'b-adapt=2');
        }

        if (job.optimizationLevel === 'high') {
          x264Options.push('profile=high', 'level=4.2', 'ref=4', 'bframes=3');
        }

        if (x264Options.length > 0) {
          hbArgs.push('-x', x264Options.join(':'));
        }

        const child = spawn('HandBrakeCLI', hbArgs);
        activeProcesses.set(job.id, child);

        child.stdout.on('data', (data) => {
          const text = data.toString();
          const match = text.match(/Encoding: task \d+ of \d+, (\d+\.\d+) %/);
          if (match && match[1]) {
            const pct = Math.min(95, Math.max(10, Math.round(parseFloat(match[1]))));
            dbService.updateJob(jobId, {
              progressPercent: pct,
              processingStage: `HandBrake encoding: ${pct}% (RF ${rf})`,
            });
          }
        });

        child.stderr.on('data', (data) => {
          const text = data.toString();
          const match = text.match(/Encoding: task \d+ of \d+, (\d+\.\d+) %/);
          if (match && match[1]) {
            const pct = Math.min(95, Math.max(10, Math.round(parseFloat(match[1]))));
            dbService.updateJob(jobId, {
              progressPercent: pct,
              processingStage: `HandBrake encoding: ${pct}%`,
            });
          }
        });

        child.on('close', async (code) => {
          activeProcesses.delete(job.id);
          if (code !== 0) {
            handleJobFailure(job, `HandBrakeCLI exited with code ${code}`);
            return;
          }
          await verifyAndFinalizeJob(job, outputFilePath);
        });

        child.on('error', (err) => {
          activeProcesses.delete(job.id);
          handleJobFailure(job, `HandBrakeCLI execution error: ${err.message}`);
        });

        return;
      }

      // -----------------------------------------------------------------
      // EXECUTION PATH C: HIGH-PRECISION FFMPEG (With Gaming AQ & Filters)
      // -----------------------------------------------------------------
      console.log(`[FFmpeg] Spawning FFmpeg optimization for job ${job.id}`);
      const ffmpegArgs: string[] = ['-y', '-i', job.originalFilePath];
      const videoFilters: string[] = [];

      // Aspect ratio & framing
      if (job.tiktokPreset) {
        if (job.aspectRatioMode === 'crop') {
          videoFilters.push('scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920');
        } else if (job.aspectRatioMode === 'fit') {
          videoFilters.push('scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2');
        }
      }

      // Optional Gaming Filters
      if (job.optionalFilters?.unsharp) {
        videoFilters.push('unsharp=5:5:0.5:5:5:0.0');
      }

      if (job.optionalFilters?.colorBoost) {
        videoFilters.push('eq=saturation=1.10:contrast=1.03');
      }

      videoFilters.push('format=yuv420p');
      ffmpegArgs.push('-vf', videoFilters.join(','));

      if (job.optimizationLevel === 'low') {
        ffmpegArgs.push(
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '26',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart'
        );
      } else if (job.optimizationLevel === 'medium') {
        ffmpegArgs.push(
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '20',
          '-tune', 'film',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart'
        );
      } else {
        ffmpegArgs.push(
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-crf', '17',
          '-profile:v', 'high',
          '-tune', 'film',
          '-c:a', 'aac',
          '-b:a', '256k',
          '-movflags', '+faststart'
        );
      }

      if (job.gamingMontagePreset) {
        ffmpegArgs.push('-x264opts', 'aq-mode=3:aq-strength=1.1:rc-lookahead=60:b-adapt=2');
      }

      ffmpegArgs.push(outputFilePath);

      const child = spawn('ffmpeg', ffmpegArgs);
      activeProcesses.set(job.id, child);

      child.stderr.on('data', (data) => {
        const text = data.toString();
        const match = text.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (match && match[1]) {
          const currentSec = parseFfmpegTime(match[1]);
          const pct = Math.min(94, Math.max(12, Math.round((currentSec / totalDuration) * 100)));
          dbService.updateJob(jobId, {
            progressPercent: pct,
            processingStage: `Encoding frames: ${(currentSec).toFixed(1)}s / ${totalDuration.toFixed(1)}s (${pct}%)`,
          });
        }
      });

      child.on('close', async (code) => {
        activeProcesses.delete(job.id);
        if (code !== 0) {
          handleJobFailure(job, `FFmpeg exited with error code ${code}`);
          return;
        }
        await verifyAndFinalizeJob(job, outputFilePath);
      });

      child.on('error', (err) => {
        activeProcesses.delete(job.id);
        handleJobFailure(job, `FFmpeg launch error: ${err.message}`);
      });
    } catch (err: any) {
      console.error(`Immediate error starting job ${jobId}:`, err);
      handleJobFailure(job, err.message || 'Job startup failure');
    }
  },

  cancelJob(jobId: string, userId: string): boolean {
    const job = dbService.getJobById(jobId);
    if (!job || job.userId !== userId) return false;

    if (job.status === 'processing' || job.status === 'queued') {
      const proc = activeProcesses.get(jobId);
      if (proc) {
        try {
          proc.kill('SIGKILL');
        } catch (e) {
          console.error('Error killing process:', e);
        }
        activeProcesses.delete(jobId);
      }

      dbService.updateJob(jobId, {
        status: 'cancelled',
        processingStage: 'Cancelled by creator',
        errorMessage: 'Job cancelled before completion. Reserved points refunded.',
      });

      pointsService.refundPointsForJob(userId, jobId, job.optimizationLevel, 'Creator cancelled job');
      return true;
    }

    return false;
  },

  cleanupOldFiles(maxAgeMs = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const dirs = [UPLOADS_DIR, PROCESSED_DIR];

    for (const dir of dirs) {
      try {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > maxAgeMs) {
              fs.unlinkSync(filePath);
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error('[Cleanup] Error during file cleanup:', err);
      }
    }
  },
};

function handleJobFailure(job: VideoJob, reason: string) {
  console.error(`[BLESS ENGINE] Failure on job ${job.id}: ${reason}`);
  dbService.updateJob(job.id, {
    status: 'failed',
    processingStage: 'Processing interrupted',
    errorMessage: reason,
    progressPercent: 0,
  });

  pointsService.refundPointsForJob(job.userId, job.id, job.optimizationLevel, reason);
}

async function verifyAndFinalizeJob(job: VideoJob, outputFilePath: string) {
  try {
    dbService.updateJob(job.id, {
      processingStage: 'Auditing playable container & stream integrity...',
      progressPercent: 96,
    });

    if (!fs.existsSync(outputFilePath) || fs.statSync(outputFilePath).size === 0) {
      throw new Error('Optimized stream file is missing or zero bytes.');
    }

    const optimizedMeta = await probeVideo(outputFilePath);

    dbService.updateJob(job.id, {
      status: 'completed',
      optimizedFilePath: outputFilePath,
      optimizedMeta,
      progressPercent: 100,
      processingStage: 'Complete and verified for upload',
      completedAt: Date.now(),
      pointsDeducted: true,
    });

    pointsService.finalizeDeduction(job.userId, job.id, job.optimizationLevel);
    console.log(`[BLESS ENGINE] Successfully completed & verified job ${job.id}`);
  } catch (err: any) {
    handleJobFailure(job, `Verification failed: ${err.message}`);
  }
}
