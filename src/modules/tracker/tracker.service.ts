import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TrendResult } from './trend-result.interface';

const KEYWORDS = [
  // AI & Automation
  'AI automation 2026', 'AI agent tutorial', 'AI tools 2026',
  'automate with AI', 'n8n automation', 'make money with AI',
  'AI workflow tutorial', 'ChatGPT automation',
  // Tech & Engineering
  'system design 2026', 'backend development tips',
  'software architecture explained', 'developer side hustle',
  // Business & Income
  'passive income 2026', 'faceless YouTube automation',
  'online business AI', 'digital product income',
  'AI side hustle 2026',
  // Real Estate Tech
  'real estate technology', 'proptech 2026',
  'real estate investing AI', 'property market analysis',
];

const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3';
const MIN_VIEWS = 100_000;
const TOP_N = 3;

@Injectable()
export class TrackerService {
  private readonly logger = new Logger(TrackerService.name);

  constructor(private readonly config: ConfigService) {}

  async scanAllKeywords(): Promise<TrendResult[]> {
    const apiKey = this.config.getOrThrow<string>('YOUTUBE_API_KEY');
    const publishedAfter = this.getPublishedAfter();

    const searchResults = await Promise.all(
      KEYWORDS.map(keyword => this.searchKeyword(keyword, publishedAfter, apiKey)),
    );

    const flat = searchResults.flat();
    if (flat.length === 0) return [];

    const withStats = await this.fetchStatistics(flat, apiKey);
    return this.filterAndRank(withStats);
  }

  private async searchKeyword(
    keyword: string,
    publishedAfter: string,
    apiKey: string,
  ): Promise<Omit<TrendResult, 'viewCount'>[]> {
    try {
      const response = await axios.get(`${YOUTUBE_BASE}/search`, {
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

      return response.data.items.map((item: any) => ({
        title: item.snippet.title,
        videoId: item.id.videoId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        keyword,
      }));
    } catch (error) {
      if (error.response?.status === 403) {
        this.logger.error(
          `[${new Date().toISOString()}] YouTube API quota exceeded for keyword "${keyword}". Skipping.`,
        );
        return [];
      }
      this.logger.warn(
        `[${new Date().toISOString()}] Search failed for "${keyword}": ${error.message}`,
      );
      return [];
    }
  }

  private async fetchStatistics(
    items: Omit<TrendResult, 'viewCount'>[],
    apiKey: string,
  ): Promise<TrendResult[]> {
    const chunks = this.chunk(items, 50);
    const results: TrendResult[] = [];

    for (const chunk of chunks) {
      const ids = chunk.map(i => i.videoId).join(',');
      try {
        const response = await axios.get(`${YOUTUBE_BASE}/videos`, {
          params: { id: ids, part: 'statistics', key: apiKey },
        });

        const statsMap = new Map<string, number>();
        for (const item of response.data.items) {
          statsMap.set(item.id, parseInt(item.statistics.viewCount ?? '0', 10));
        }

        for (const item of chunk) {
          results.push({ ...item, viewCount: statsMap.get(item.videoId) ?? 0 });
        }
      } catch (error) {
        this.logger.warn(
          `[${new Date().toISOString()}] Statistics fetch failed for batch: ${error.message}`,
        );
      }
    }

    return results;
  }

  private filterAndRank(items: TrendResult[]): TrendResult[] {
    const seen = new Set<string>();
    const deduped = items.filter(item => {
      if (seen.has(item.videoId)) return false;
      seen.add(item.videoId);
      return true;
    });

    return deduped
      .filter(item => item.viewCount >= MIN_VIEWS)
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
