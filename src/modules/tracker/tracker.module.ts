import { Module } from '@nestjs/common';
import { TrackerService } from './tracker.service';
import { TrackerController } from './tracker.controller';
import { NotifyModule } from '../../notifications/notify.module';
import { TranscriptModule } from '../transcript/transcript.module';
import { ScriptModule } from '../script/script.module';

@Module({
  imports: [NotifyModule, TranscriptModule, ScriptModule],
  providers: [TrackerService],
  controllers: [TrackerController],
  exports: [TrackerService],
})
export class TrackerModule {}
