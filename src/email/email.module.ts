import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { SystemConfigModule } from 'src/system-config/system-config.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  providers: [EmailService],
  imports: [SystemConfigModule, ConfigModule]
})
export class EmailModule {}
