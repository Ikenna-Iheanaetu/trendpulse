import { Controller, Get } from '@nestjs/common';
import { TrackerService } from './tracker.service';
import { NotifyService } from '../../notifications/notify.service';

@Controller('tracker')
export class TrackerController {
  constructor(
    private readonly trackerService: TrackerService,
    private readonly notifyService: NotifyService,
  ) {}

  @Get('trigger')
  async trigger() {
    const results = await this.trackerService.scanAllKeywords();
    await this.notifyService.sendReport(results);
    return {
      message: `Scan complete. Found ${results.length} trending video(s).`,
      results,
    };
  }
}
