import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { YoutubeTranscript, TranscriptResponse } from 'youtube-transcript';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TranscriptResult, VideoMetadata } from '../../interfaces/enriched-trend-result.interface';

const execFileAsync = promisify(execFile);
const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3';

interface YoutubeVideoApiResponse {
  items: {
    snippet: {
      title: string;
      description?: string;
      tags?: string[];
    };
    statistics: {
      viewCount?: string;
      likeCount?: string;
    };
    contentDetails: {
      duration: string;
    };
  }[];
}

@Injectable()
export class TranscriptService {
  private readonly logger = new Logger(TranscriptService.name);

  constructor(private readonly config: ConfigService) {}

  async getTranscript(videoId: string): Promise<TranscriptResult> {
    const apiKey = this.config.getOrThrow<string>('YOUTUBE_API_KEY');
    const metadata = await this.fetchMetadata(videoId, apiKey);
    const transcript = await this.fetchTranscript(videoId);
    const durationSec = this.parseIso8601Duration(metadata.duration);
    const frames = await this.extractFrames(videoId, durationSec);
    return { transcript, frames, metadata };
  }

  private async fetchMetadata(videoId: string, apiKey: string): Promise<VideoMetadata> {
    const response = await axios.get<YoutubeVideoApiResponse>(`${YOUTUBE_BASE}/videos`, {
      params: { id: videoId, part: 'snippet,statistics,contentDetails', key: apiKey },
    });
    const item = response.data.items[0];
    return {
      title: item.snippet.title,
      description: item.snippet.description ?? '',
      tags: item.snippet.tags ?? [],
      viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
      likeCount: parseInt(item.statistics.likeCount ?? '0', 10),
      duration: item.contentDetails.duration,
    };
  }

  private async fetchTranscript(videoId: string): Promise<string | null> {
    try {
      const entries = await YoutubeTranscript.fetchTranscript(videoId);
      return entries.map((e: TranscriptResponse) => e.text).join(' ');
    } catch {
      return null;
    }
  }

  private async extractFrames(videoId: string, durationSec: number): Promise<string[]> {
    const timestamps = this.calculateTimestamps(durationSec);
    const tmpDir = os.tmpdir();
    const outputPattern = path.join(tmpDir, `${videoId}-frame-%02d.jpg`);
    const frameFiles = timestamps.map((_, i) =>
      path.join(tmpDir, `${videoId}-frame-${String(i + 1).padStart(2, '0')}.jpg`),
    );

    try {
      // yt-dlp resolves the signed stream URL — updated constantly by the community
      const ytDlpBin = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
      const { stdout } = await execFileAsync(
        ytDlpBin,
        [
          '--get-url',
          '-f',
          'worstvideo[height<=360][ext=mp4]/worstvideo[height<=360]/worstvideo',
          '--no-warnings',
          `https://www.youtube.com/watch?v=${videoId}`,
        ],
        { timeout: 30_000 },
      );

      const videoUrl = stdout.trim().split('\n')[0];
      if (!videoUrl) {
        this.logger.warn(`[${new Date().toISOString()}] yt-dlp returned no URL for ${videoId}`);
        return [];
      }

      // Frame 1 = hook (2s), frames 2-10 distributed across the rest
      const selectExpr = timestamps
        .map((t) => `between(t\\,${(t - 0.5).toFixed(1)}\\,${(t + 0.5).toFixed(1)})`)
        .join('+');

      await new Promise<void>((resolve) => {
        ffmpeg(videoUrl)
          .outputOptions([
            `-vf`,
            `select='${selectExpr}',scale=480:-1`,
            `-vsync`,
            `vfr`,
            `-vframes`,
            String(timestamps.length),
            `-q:v`,
            `3`,
          ])
          .output(outputPattern)
          .on('end', () => resolve())
          .on('error', (err: Error) => {
            this.logger.warn(
              `[${new Date().toISOString()}] ffmpeg frame extraction failed for ${videoId}: ${err.message}`,
            );
            resolve();
          })
          .run();
      });

      const frames: string[] = [];
      for (const filePath of frameFiles) {
        try {
          const buf = await fs.readFile(filePath);
          frames.push(buf.toString('base64'));
        } catch {
          // individual frame missing — skip
        }
      }

      this.logger.log(
        `[${new Date().toISOString()}] Extracted ${frames.length}/${timestamps.length} frames for ${videoId}`,
      );
      return frames;
    } catch (error) {
      const err = error as { message: string };
      this.logger.warn(`[${new Date().toISOString()}] Frame extraction failed for ${videoId}: ${err.message}`);
      return [];
    } finally {
      await Promise.all(frameFiles.map((f) => fs.unlink(f).catch(() => {})));
    }
  }

  private calculateTimestamps(durationSec: number): number[] {
    const hookTs = 2;
    const remaining = 9;
    const interval = Math.max(1, (durationSec - 3) / (remaining - 1));
    const timestamps = [hookTs];
    for (let i = 0; i < remaining; i++) {
      timestamps.push(Math.round(3 + interval * i));
    }
    return timestamps.filter((t) => t < durationSec);
  }

  private parseIso8601Duration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 60;
    const h = parseInt(match[1] ?? '0', 10);
    const m = parseInt(match[2] ?? '0', 10);
    const s = parseInt(match[3] ?? '0', 10);
    return h * 3600 + m * 60 + s;
  }
}
