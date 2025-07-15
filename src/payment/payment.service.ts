import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentStatus, Recurrence, Client, Plan, Charge, SystemConfig } from '@prisma/client';
import { EmailService } from 'src/email/email.service';
import { PrismaService } from 'src/prisma/prisma.service';

type ClientWithPlan = Client & {
  plan: Plan;
};

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

  @Cron('0 10 * * *', {
    name: 'process-recurring-payments',
    timeZone: 'America/Sao_Paulo',
  })
  async processRecurringPayments(): Promise<void> {
    this.logger.log('Verificando cobranças que vencem HOJE...');

    try {
      await this.processChargesDueToday();

      this.logger.log('Processamento concluído');
    } catch (error) {
      this.logger.error('Erro no processamento:', error);
    }
  }

  private async processChargesDueToday(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Busca cobranças que vencem HOJE e ainda não enviaram email
    const chargesDueToday = await this.prisma.charge.findMany({
      where: {
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
        status: PaymentStatus.PENDING,
        reminderSent: false,
      },
      include: {
        client: {
          include: {
            plan: true,
          },
        },
      },
    });

    this.logger.log(`Encontradas ${chargesDueToday.length} cobranças que vencem hoje`);

    for (const charge of chargesDueToday) {
      if (charge.client.paymentStatus === PaymentStatus.CANCELED) {
        this.logger.log(`Pulando cobrança ${charge.id} - cliente cancelado`);
        continue;
      }

      // Envia email e cria próxima cobrança
      await this.sendPaymentEmailAndCreateNext(charge.client, charge.dueDate, charge.id);
    }
  }

  /**
   * Função principal: Envia email de cobrança e cria a próxima charge
   * @param client Cliente com plano
   * @param dueDate Data de vencimento da cobrança atual
   * @param chargeId ID da cobrança atual (opcional, para casos onde já existe)
   */
  public async sendPaymentEmailAndCreateNext(
    client: ClientWithPlan, 
    dueDate: Date, 
    chargeId?: string
  ): Promise<void> {
    try {
      const systemConfig = await this.prisma.systemConfig.findUnique({
        where: { id: 'singleton' },
      });

      if (!systemConfig?.pixKey) {
        this.logger.error('Chave PIX não configurada no sistema');
        return;
      }

      // Se não foi passado chargeId, busca a cobrança para essa data
      let currentChargeId = chargeId;
      if (!currentChargeId) {
        const existingCharge = await this.prisma.charge.findFirst({
          where: {
            clientId: client.id,
            dueDate: {
              gte: new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()),
              lt: new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() + 1),
            },
          },
        });
        
        if (!existingCharge) {
          this.logger.error(`Cobrança não encontrada para cliente ${client.name} na data ${dueDate.toLocaleDateString('pt-BR')}`);
          return;
        }
        
        currentChargeId = existingCharge.id;
      }

      // Prepara dados do email
      const paymentData: PaymentNotificationData = {
        clientName: client.name,
        to: client.email,
        subject: "🔔 Pagamento vence HOJE!",
        planName: client.plan.name,
        amount: client.plan.price,
        dueDate: dueDate,
        pixKey: systemConfig.pixKey,
        chargeId: currentChargeId,
      };

      // Envia email
      await this.emailService.sendChargeReminderEmail(paymentData);

      // Marca como enviado
      await this.prisma.charge.update({
        where: { id: currentChargeId },
        data: { reminderSent: true },
      });

      this.logger.log(`✅ Email enviado para ${client.name} - Cobrança vence HOJE (${dueDate.toLocaleDateString('pt-BR')})`);

      // Cria próxima cobrança
      await this.createNextCharge(client, dueDate);

    } catch (error) {
      this.logger.error(`Erro ao processar pagamento para cliente ${client.name}:`, error);
    }
  }

  private async createNextCharge(client: ClientWithPlan, currentDueDate: Date): Promise<void> {
    try {
      // Calcula próxima data baseada na recorrência
      const nextDueDate = this.addRecurrencePeriod(currentDueDate, client.plan.recurrence);
      
      // Verifica se já existe cobrança para a próxima data
      const existingNextCharge = await this.prisma.charge.findFirst({
        where: {
          clientId: client.id,
          dueDate: {
            gte: new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate()),
            lt: new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate() + 1),
          },
        },
      });

      if (existingNextCharge) {
        this.logger.log(`Próxima cobrança já existe para ${client.name} - Data: ${nextDueDate.toLocaleDateString('pt-BR')}`);
        return;
      }

      // Cria próxima cobrança
      const nextCharge = await this.prisma.charge.create({
        data: {
          clientId: client.id,
          dueDate: nextDueDate,
          amount: client.plan.price,
          status: PaymentStatus.PENDING,
          reminderSent: false,
        },
      });

      this.logger.log(`📅 Próxima cobrança criada para ${client.name} - ID: ${nextCharge.id} - Vencimento: ${nextDueDate.toLocaleDateString('pt-BR')}`);

    } catch (error) {
      this.logger.error(`Erro ao criar próxima cobrança para ${client.name}:`, error);
    }
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

  /**
   * Função utilitária: Envia email para uma data específica
   * @param clientId ID do cliente
   * @param dueDate Data de vencimento
   */
  public async sendPaymentEmailForDate(clientId: string, dueDate: Date): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { plan: true },
    });

    if (!client) {
      throw new Error(`Cliente com ID ${clientId} não encontrado`);
    }

    if (client.paymentStatus === PaymentStatus.CANCELED) {
      throw new Error(`Cliente ${client.name} está cancelado`);
    }

    await this.sendPaymentEmailAndCreateNext(client, dueDate);
  }

  /**
   * Função utilitária: Cria cobrança para uma data específica (sem enviar email)
   * @param clientId ID do cliente
   * @param dueDate Data de vencimento
   */
  public async createChargeForDate(clientId: string, dueDate: Date): Promise<Charge> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { plan: true },
    });

    if (!client) {
      throw new Error(`Cliente com ID ${clientId} não encontrado`);
    }

    const charge = await this.prisma.charge.create({
      data: {
        clientId: client.id,
        dueDate,
        amount: client.plan.price,
        status: PaymentStatus.PENDING,
        reminderSent: false,
      },
    });

    this.logger.log(`💳 Cobrança criada para ${client.name} - ID: ${charge.id} - Vencimento: ${dueDate.toLocaleDateString('pt-BR')}`);
    return charge;
  }

  // Métodos utilitários para execução manual
  async processPaymentsManually(): Promise<void> {
    this.logger.log('🔧 Executando processamento manual...');
    await this.processRecurringPayments();
  }

  async processSpecificClient(clientId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Busca cobrança do cliente para hoje
    const charge = await this.prisma.charge.findFirst({
      where: {
        clientId,
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
        status: PaymentStatus.PENDING,
      },
      include: {
        client: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!charge) {
      throw new Error(`Nenhuma cobrança encontrada para hoje para o cliente ${clientId}`);
    }

    if (charge.client.paymentStatus === PaymentStatus.CANCELED) {
      throw new Error(`Cliente ${charge.client.name} está cancelado`);
    }

    await this.sendPaymentEmailAndCreateNext(charge.client, charge.dueDate, charge.id);
    this.logger.log(`Processamento manual concluído para cliente ${charge.client.name}`);
  }

  async retryFailedChargeReminders(): Promise<void> {
    this.logger.log('🔄 Reprocessando cobranças com lembretes falhados...');
    await this.processChargesDueToday();
  }
}