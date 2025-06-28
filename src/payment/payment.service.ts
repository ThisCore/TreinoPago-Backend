import { Injectable, Logger } from '@nestjs/common';
import { Cron,  } from '@nestjs/schedule';
import { PaymentStatus, Recurrence, Client, Plan, Charge, SystemConfig } from '@prisma/client';
import { EmailService } from 'src/email/email.service';
import { PrismaService } from 'src/prisma/prisma.service';

// Tipos para os dados do cliente com relacionamentos
type ClientWithPlanAndCharges = Client & {
  plan: Plan;
  charges: Charge[];
};

type ClientWithPlan = Client & {
  plan: Plan;
};

// Interface para os dados de notificação de pagamento
interface PaymentNotificationData {
  to: string;
  subject: string;
  clientName: string;
  planName: string;
  amount: number;
  dueDate: Date;
  pixKey: string;
  chargeId: string;
}

@Injectable()
export class PaymentRecurrenceService {
  private readonly logger = new Logger(PaymentRecurrenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // Executa todos os dias às 09:00
  @Cron('0 9 * * *', {
    name: 'process-recurring-payments',
    timeZone: 'America/Sao_Paulo',
  })
  async processRecurringPayments(): Promise<void> {
    this.logger.log('Iniciando processamento de pagamentos recorrentes...');

    try {
      const activeClients = await this.getActiveClients();
      
      for (const client of activeClients) {
        await this.processClientPayment(client);
      }

      this.logger.log('Processamento de pagamentos recorrentes concluído');
    } catch (error) {
      this.logger.error('Erro no processamento de pagamentos recorrentes:', error);
    }
  }

  private async getActiveClients(): Promise<ClientWithPlanAndCharges[]> {
    return this.prisma.client.findMany({
      where: {
        paymentStatus: {
          not: PaymentStatus.CANCELED,
        },
      },
      include: {
        plan: true,
        charges: {
          orderBy: {
            dueDate: 'desc',
          },
          take: 1,
        },
      },
    });
  }

  private async processClientPayment(client: ClientWithPlanAndCharges): Promise<void> {
    const nextDueDate = this.calculateNextDueDate(client);
    
    if (!this.shouldCreateCharge(nextDueDate)) {
      return;
    }
    const existingCharge = await this.prisma.charge.findFirst({
      where: {
        clientId: client.id,
        dueDate: {
          gte: new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate()),
          lt: new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate() + 1),
        },
      },
    });

    if (existingCharge) {
      this.logger.log(`Cobrança já existe para cliente ${client.name} na data ${nextDueDate.toISOString()}`);
      return;
    }

    await this.createChargeAndSendEmail(client, nextDueDate);
  }

  private calculateNextDueDate(client: ClientWithPlanAndCharges): Date {
    const lastCharge = client.charges[0];
    const baseDate = lastCharge ? new Date(lastCharge.dueDate) : new Date(client.billingStartDate);
    
    return this.addRecurrencePeriod(baseDate, client.plan.recurrence);
  }

  private addRecurrencePeriod(date: Date, recurrence: Recurrence): Date {
    const newDate = new Date(date);

    switch (recurrence) {
      case Recurrence.WEEKLY:
        newDate.setDate(newDate.getDate() + 7);
        break;
      case Recurrence.MONTHLY:
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case Recurrence.QUARTERLY:
        newDate.setMonth(newDate.getMonth() + 3);
        break;
      case Recurrence.SEMIANNUAL:
        newDate.setMonth(newDate.getMonth() + 6);
        break;
      case Recurrence.ANNUAL:
        newDate.setFullYear(newDate.getFullYear() + 1);
        break;
    }

    return newDate;
  }

  private shouldCreateCharge(dueDate: Date): boolean {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Cria cobrança se a data de vencimento é hoje ou amanhã
    return dueDate <= tomorrow;
  }

  private async createChargeAndSendEmail(client: ClientWithPlanAndCharges, dueDate: Date): Promise<void> {
    try {
      // Busca a chave PIX do sistema
      const systemConfig: SystemConfig | null = await this.prisma.systemConfig.findUnique({
        where: { id: 'singleton' },
      });

      if (!systemConfig?.pixKey) {
        this.logger.error('Chave PIX não configurada no sistema');
        return;
      }

      // Cria a cobrança
      const charge: Charge = await this.prisma.charge.create({
        data: {
          clientId: client.id,
          dueDate,
          amount: client.plan.price,
          status: PaymentStatus.PENDING,
          reminderSent: false,
        },
      });

      const paymentData: PaymentNotificationData = {
        clientName: client.name,
        to: client.email,
        subject: "Lembrete de pagamento",
        planName: client.plan.name,
        amount: client.plan.price,
        dueDate,
        pixKey: systemConfig.pixKey,
        chargeId: charge.id,
      };

      await this.emailService.sendChargeReminderEmail(paymentData);

      await this.prisma.charge.update({
        where: { id: charge.id },
        data: { reminderSent: true },
      });

      this.logger.log(`Cobrança criada e email enviado para ${client.name} - Valor: R$ ${client.plan.price}`);
    } catch (error) {
      this.logger.error(`Erro ao processar pagamento para cliente ${client.name}:`, error);
    }
  }

  async processPaymentsManually(): Promise<void> {
    this.logger.log('Executando processamento manual de pagamentos...');
    await this.processRecurringPayments();
  }

  async processSpecificClient(clientId: string): Promise<void> {
    const client: ClientWithPlanAndCharges | null = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        plan: true,
        charges: {
          orderBy: { dueDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!client) {
      throw new Error(`Cliente com ID ${clientId} não encontrado`);
    }

    if (client.paymentStatus === PaymentStatus.CANCELED) {
      throw new Error(`Cliente ${client.name} está cancelado`);
    }

    await this.processClientPayment(client);
    this.logger.log(`Processamento manual concluído para cliente ${client.name}`);
  }
}