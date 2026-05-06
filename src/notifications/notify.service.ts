import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TrendResult } from '../modules/tracker/trend-result.interface';
import { EnrichedTrendResult } from '../interfaces/enriched-trend-result.interface';

const MAX_MESSAGE_LENGTH = 4000;

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(private readonly config: ConfigService) {}

  async sendReport(results: (TrendResult | EnrichedTrendResult)[]): Promise<void> {
    const date = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const count = results.length;
    const header = `🎯 *TrendPulse Daily Report — ${date}*\nHere are your top ${count} trending topic${count !== 1 ? 's' : ''} to recreate today:`;

    await this.sendMessage(header);

    for (const result of results) {
      await this.sendMessage(this.formatOverview(result));
      await this.delay(1000);

      const enriched = result as EnrichedTrendResult;
      if (enriched.analysis) {
        await this.sendMessage(this.formatAnalysis(enriched));
        await this.delay(1000);
        await this.sendMessage(this.formatScript(enriched));
        await this.delay(1000);
      }
    }
  }

  private formatOverview(result: TrendResult): string {
    const views = result.viewCount.toLocaleString('en-US');
    const timeAgo = this.formatTimeAgo(result.publishedAt);
    return [
      '🔥 *Trending Now*',
      '━━━━━━━━━━━━━━━',
      `📌 ${result.title}`,
      `👁 Views: ${views}`,
      `📺 Channel: ${result.channelTitle}`,
      `🕐 Posted: ${timeAgo}`,
      `🏷 Niche: ${result.keyword}`,
      `🔗 https://youtube.com/watch?v=${result.videoId}`,
      '━━━━━━━━━━━━━━━',
    ].join('\n');
  }

  private formatAnalysis(result: EnrichedTrendResult): string {
    const a = result.analysis!;
    return [
      "🧠 *Why It's Trending:*",
      a.whyTrending,
      '',
      '👁 *Visual Strategy:*',
      a.visualStrategy,
      '',
      '🎣 *Hook Analysis:*',
      a.hookAnalysis,
    ].join('\n');
  }

  private formatScript(result: EnrichedTrendResult): string {
    const a = result.analysis!;
    const script =
      a.generatedScript.length > MAX_MESSAGE_LENGTH - 200
        ? a.generatedScript.slice(0, MAX_MESSAGE_LENGTH - 200) + '\n...[truncated]'
        : a.generatedScript;

    return [
      '📝 *Suggested Title:*',
      a.suggestedTitle,
      '',
      '🪝 *Hook Overlay:*',
      a.suggestedHook,
      '',
      '📋 *Script:*',
      script,
      '━━━━━━━━━━━━━━━',
    ].join('\n');
  }

  private async sendMessage(text: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID');
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
      await axios.post(url, { chat_id: chatId, text, parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.warn(`[${new Date().toISOString()}] Telegram send failed, retrying in 5s...`);
      await this.delay(5000);
      try {
        await axios.post(url, { chat_id: chatId, text, parse_mode: 'Markdown' });
      } catch (retryError: any) {
        this.logger.error(
          `[${new Date().toISOString()}] Telegram retry failed: ${retryError.message}\nMessage preview: ${text.slice(0, 100)}`,
        );
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatTimeAgo(publishedAt: string): string {
    const diff = Date.now() - new Date(publishedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days >= 1) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (hours >= 1) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
}
