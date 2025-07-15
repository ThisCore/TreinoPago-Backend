import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client, PaymentStatus, SystemConfig } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/email/email.service';
import { PaymentRecurrenceService } from 'src/payment/payment.service';

@Injectable()
export class ClientService {
  constructor(
    private prisma: PrismaService, 
    private emailService: EmailService,
    private paymentService: PaymentRecurrenceService
  ) {}

 async create(data: CreateClientDto): Promise<Client> {
  const systemConfig: SystemConfig | null = await this.prisma.systemConfig.findUnique({
    where: { id: 'singleton' },
  });

  if (!systemConfig?.pixKey) {
    throw new BadRequestException('Chave PIX não configurada no sistema.');
  }

  const plan = await this.prisma.plan.findUnique({
    where: {id: data.planId }
  })

  if (!plan) {
    throw new BadRequestException('Plano selecionado não foi encontrado no sistema.');
  }

  const timestamp = Number(data.billingStartDate);
  const billingStartDate = new Date(timestamp);

  if (isNaN(timestamp) || isNaN(billingStartDate.getTime())) {
    throw new BadRequestException("Data inválida.");
  }

  const today = new Date().toISOString().split("T")[0];
  const start = billingStartDate.toISOString().split("T")[0];

  if (start < today) {
    throw new BadRequestException("Não é permitido criar com uma data anterior a hoje");
  }

  const result = await this.prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        ...data,
        billingStartDate
      },
      include: {
        plan: true,
        charges: true,
      },
    });

    const firstCharge = await tx.charge.create({
      data: {
        amount: client.plan.price,
        dueDate: client.billingStartDate,
        clientId: client.id,
        reminderSent: false,
        status: PaymentStatus.PENDING,
      },
    });

    return { client, firstCharge };
  });

  const welcomeEmailData = {
    to: result.client.email,
    subject: "Mensagem de boas vindas!",
    clientName: result.client.name,
    planName: result.client.plan.name,
    planPrice: result.client.plan.price,
    recurrence: result.client.plan.recurrence,
    pixKey: systemConfig.pixKey,
    billingStartDate: result.client.billingStartDate,
  }

  try {
    await this.emailService.sendWelcomeEmail(welcomeEmailData)
  } catch (e) {
    console.log("erro no envio do email de boas vindas: ", e)
  }

  const isStartDateToday = start === today;
  const currentHour = new Date().getHours();
  const cronHour = 10; 

  if (isStartDateToday && currentHour >= cronHour) {
    await this.paymentService.sendPaymentEmailAndCreateNext(result.client, billingStartDate, result.firstCharge.id)
  }

  return {
    id: result.client.id,
    name: result.client.name,
    email: result.client.email,
    paymentStatus: result.client.paymentStatus,
    billingStartDate: result.client.billingStartDate,
    planId: result.client.planId,
  } as Client;
}

  async findAll(): Promise<Client[]> {
    return this.prisma.client.findMany({
      include: {
        plan: true,
        charges: {
          orderBy: {
            dueDate: 'desc',
          },
        },
      },
    });
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        plan: true,
        charges: {
          orderBy: {
            dueDate: 'desc',
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    return client;
  }

  async findByEmail(email: string): Promise<Client | null> {
    return this.prisma.client.findUnique({
      where: { email },
      include: {
        plan: true,
        charges: true,
      },
    });
  }

  async update(id: string, data: UpdateClientDto): Promise<Client> {
    await this.validateClient(id)

    const billingStartDate = new Date(data.billingStartDate)
    const  todayDate = new Date()

    const today = todayDate.toISOString().split("T")[0]
    const start = billingStartDate.toISOString().split("T")[0]
    
    if (start < today) {
      throw new BadRequestException("Não é permitido criar com uma data anterior a hoje")
    }

    try {
      return await this.prisma.client.update({
        where: { id },
        data: {
          ...data,
          billingStartDate
        },
        include: {
          plan: true,
          charges: true,
        },
      });
    } catch (error) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
  }

  async remove(id: string): Promise<Client> {
    await this.validateClient(id)
    try {
      return await this.prisma.client.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
  }

  async findByPlan(planId: string): Promise<Client[]> {
    return this.prisma.client.findMany({
      where: { planId },
      include: {
        plan: true,
        charges: true,
      },
    });
  }

  async findByPaymentStatus(status: PaymentStatus): Promise<Client[]> {
    return this.prisma.client.findMany({
      where: { paymentStatus: status },
      include: {
        plan: true,
        charges: true,
      },
    });
  }

    private async validateClient(id: string) {
    const clientExists = await this.prisma.client.findUnique({where: {id}})
    if (!clientExists) throw new NotFoundException(`Cliente com id: ${id} não encontrado`)
  }
}
