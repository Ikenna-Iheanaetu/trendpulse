import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { TrackerModule } from './modules/tracker/tracker.module';
import { NotifyModule } from './notifications/notify.module';
import { TrendScheduler } from './scheduler/trend.scheduler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    TrackerModule,
    NotifyModule,
  ],
  controllers: [AppController],
  providers: [TrendScheduler],
})
export class AppModule {}
