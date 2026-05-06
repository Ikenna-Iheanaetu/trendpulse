import { Module } from '@nestjs/common';
import { ScriptService } from './script.service';

@Module({
  providers: [ScriptService],
  exports: [ScriptService],
})
export class ScriptModule {}
