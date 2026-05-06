import { Module } from '@nestjs/common';
import { TranscriptService } from './transcript.service';

@Module({
  providers: [TranscriptService],
  exports: [TranscriptService],
})
export class TranscriptModule {}
