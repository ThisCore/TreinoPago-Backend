// payment.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module'; // Ajuste conforme sua estrutura
import { EmailModule } from '../email/email.module'; // Ajuste conforme sua estrutura
import { PaymentRecurrenceService } from './payment.service';

@Module({
  imports: [PrismaModule, EmailModule],
  providers: [PaymentRecurrenceService],
  exports: [PaymentRecurrenceService],
})
export class PaymentModule {}