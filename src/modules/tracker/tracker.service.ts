import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TrendResult } from './trend-result.interface';
import { EnrichedTrendResult } from '../../interfaces/enriched-trend-result.interface';
import { TranscriptService } from '../transcript/transcript.service';
import { ScriptService } from '../script/script.service';

const KEYWORDS = [
  // AI & Automation
  'AI automation 2026',
  'AI agent tutorial',
  'AI tools 2026',
  'automate with AI',
  'n8n automation',
  'make money with AI',
  'AI workflow tutorial',
  'ChatGPT automation',
  // Tech & Engineering
  'system design 2026',
  'backend development tips',
  'software architecture explained',
  'developer side hustle',
  // Business & Income
  'passive income 2026',
  'faceless YouTube automation',
  'online business AI',
  'digital product income',
  'AI side hustle 2026',
  // Real Estate Tech
  'real estate technology',
  'proptech 2026',
  'real estate investing AI',
  'property market analysis',
];

const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3';
const MIN_VIEWS = 100_000;
const TOP_N = 3;

@Injectable()
export class TrackerService {
  private readonly logger = new Logger(TrackerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly transcriptService: TranscriptService,
    private readonly scriptService: ScriptService,
  ) {}

  async scanAllKeywords(): Promise<EnrichedTrendResult[]> {
    const apiKey = this.config.getOrThrow<string>('YOUTUBE_API_KEY');
    const publishedAfter = this.getPublishedAfter();

    const allResults: Omit<TrendResult, 'viewCount'>[] = [];
    for (const keyword of KEYWORDS) {
      const results = await this.searchKeyword(keyword, publishedAfter, apiKey);
      if (results === null) break; // quota exceeded — stop early
      allResults.push(...results);
    }

    if (allResults.length === 0) return [];

    const withStats = await this.fetchStatistics(allResults, apiKey);
    const top = this.filterAndRank(withStats);
    return this.enrichResults(top);
  }

  private async enrichResults(results: TrendResult[]): Promise<EnrichedTrendResult[]> {
    const enriched: EnrichedTrendResult[] = [];

    for (const result of results) {
      let transcriptData: EnrichedTrendResult['transcriptData'];
      let analysis: EnrichedTrendResult['analysis'];

      try {
        transcriptData = await this.transcriptService.getTranscript(result.videoId);
      } catch (error) {
        const err = error as { message: string };
        this.logger.warn(
          `[${new Date().toISOString()}] Transcript fetch failed for ${result.videoId}: ${err.message}`,
        );
      }

      if (transcriptData) {
        try {
          analysis = await this.scriptService.analyzeVideo(result, transcriptData);
        } catch (error) {
          const err = error as { message: string };
          this.logger.warn(`[${new Date().toISOString()}] GPT analysis failed for ${result.videoId}: ${err.message}`);
        }
      }

      enriched.push({ ...result, transcriptData, analysis });
    }

    return enriched;
  }

  private async searchKeyword(
    keyword: string,
    publishedAfter: string,
    apiKey: string,
  ): Promise<Omit<TrendResult, 'viewCount'>[] | null> {
    try {
      const response = await axios.get<{
        items: {
          id: { videoId: string };
          snippet: { title: string; channelTitle: string; publishedAt: string };
        }[];
      }>(`${YOUTUBE_BASE}/search`, {
        params: {
          q: keyword,
          part: 'snippet',
          type: 'video',
          order: 'viewCount',
          publishedAfter,
          maxResults: 10,
          key: apiKey,
        },
      });

      return response.data.items.map(
        (item): Omit<TrendResult, 'viewCount'> => ({
          title: item.snippet.title,
          videoId: item.id.videoId,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          keyword,
        }),
      );
    } catch (error) {
      const err = error as { response?: { status: number }; message: string };
      if (err.response?.status === 403) {
        this.logger.error(`[${new Date().toISOString()}] YouTube API quota exceeded. Stopping scan.`);
        return null;
      }
      this.logger.warn(`[${new Date().toISOString()}] Search failed for "${keyword}": ${err.message}`);
      return [];
    }
  }

  private async fetchStatistics(items: Omit<TrendResult, 'viewCount'>[], apiKey: string): Promise<TrendResult[]> {
    const chunks = this.chunk(items, 50);
    const results: TrendResult[] = [];

    for (const chunk of chunks) {
      const ids = chunk.map((i) => i.videoId).join(',');
      try {
        const response = await axios.get<{ items: { id: string; statistics: { viewCount?: string } }[] }>(
          `${YOUTUBE_BASE}/videos`,
          { params: { id: ids, part: 'statistics', key: apiKey } },
        );

        const statsMap = new Map<string, number>();
        for (const item of response.data.items) {
          statsMap.set(item.id, parseInt(item.statistics.viewCount ?? '0', 10));
        }

        for (const item of chunk) {
          results.push({ ...item, viewCount: statsMap.get(item.videoId) ?? 0 });
        }
      } catch (error) {
        const err = error as { response?: { status: number }; message: string };
        if (err.response?.status === 403) {
          this.logger.error(`[${new Date().toISOString()}] YouTube API quota exceeded during statistics fetch. Aborting batch.`);
          break;
        }
        this.logger.warn(`[${new Date().toISOString()}] Statistics fetch failed for batch: ${err.message}`);
      }
    }

    return results;
  }

  private filterAndRank(items: TrendResult[]): TrendResult[] {
    const seen = new Set<string>();
    const deduped = items.filter((item) => {
      if (seen.has(item.videoId)) return false;
      seen.add(item.videoId);
      return true;
    });

    return deduped
      .filter((item) => item.viewCount >= MIN_VIEWS)
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, TOP_N);
  }

  private getPublishedAfter(): string {
    const d = new Date();
    d.setHours(d.getHours() - 48);
    return d.toISOString();
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }
}
