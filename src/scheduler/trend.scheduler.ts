import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TrackerService } from '../modules/tracker/tracker.service';
import { NotifyService } from '../notifications/notify.service';

@Injectable()
export class TrendScheduler {
  private readonly logger = new Logger(TrendScheduler.name);

  constructor(
    private readonly trackerService: TrackerService,
    private readonly notifyService: NotifyService,
  ) {}

  @Cron('0 6 * * *', { timeZone: 'Africa/Lagos' })
  async handleDailyScan(): Promise<void> {
    this.logger.log(`[${new Date().toISOString()}] Daily trend scan started`);
    try {
      const results = await this.trackerService.scanAllKeywords();
      this.logger.log(`[${new Date().toISOString()}] Found ${results.length} trending video(s)`);
      await this.notifyService.sendReport(results);
      this.logger.log(`[${new Date().toISOString()}] Telegram report sent`);
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Daily scan failed: ${error.message}`);
    }
  }
}
