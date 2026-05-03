import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TrendResult } from '../modules/tracker/trend-result.interface';

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(private readonly config: ConfigService) {}

  async sendReport(results: TrendResult[]): Promise<void> {
    const date = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const count = results.length;
    const header = `🎯 *TrendPulse Daily Report — ${date}*\nHere are your top ${count} trending topic${count !== 1 ? 's' : ''} to recreate today:`;

    await this.sendMessage(header);
    for (const result of results) {
      await this.sendMessage(this.formatMessage(result));
    }
  }

  private async sendMessage(text: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID');
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
      await axios.post(url, { chat_id: chatId, text, parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.warn(`[${new Date().toISOString()}] Telegram send failed, retrying in 5s...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        await axios.post(url, { chat_id: chatId, text, parse_mode: 'Markdown' });
      } catch (retryError) {
        this.logger.error(
          `[${new Date().toISOString()}] Telegram retry failed: ${retryError.message}\nMessage preview: ${text.slice(0, 100)}`,
        );
      }
    }
  }

  private formatMessage(result: TrendResult): string {
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
