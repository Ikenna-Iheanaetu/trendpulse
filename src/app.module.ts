import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { TrackerModule } from './modules/tracker/tracker.module';
import { NotifyModule } from './notifications/notify.module';
import { TranscriptModule } from './modules/transcript/transcript.module';
import { ScriptModule } from './modules/script/script.module';
import { TrendScheduler } from './scheduler/trend.scheduler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    TrackerModule,
    NotifyModule,
    TranscriptModule,
    ScriptModule,
  ],
  controllers: [AppController],
  providers: [TrendScheduler],
})
export class AppModule {}
