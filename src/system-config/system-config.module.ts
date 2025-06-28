import { Module } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { SystemConfigController } from './system-config.controller';

@Module({
  providers: [SystemConfigService],
  exports: [SystemConfigService],
  controllers: [SystemConfigController]
})
export class SystemConfigModule {}
