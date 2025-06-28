import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ClientModule } from './client/client.module';
import { PlanModule } from './plan/plan.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { ChargeModule } from './charge/charge.module';
import { EmailModule } from './email/email.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, ClientModule, PlanModule, SystemConfigModule, ChargeModule, EmailModule],
  providers: [AppService],
})
export class AppModule {}
