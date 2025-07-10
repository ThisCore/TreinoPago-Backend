import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';
import { Charge, PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ChargeService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateChargeDto): Promise<Charge> {
    return this.prisma.charge.create({
      data,
      include: {
        client: {
          include: {
            plan: true,
          },
        },
      },
    });
  }

  async findAll() {
    const charges =  await this.prisma.charge.findMany({
        include: {
          client: {
            include: {
              plan: true,
            },
          },
        },
        orderBy: {
          dueDate: 'desc',
        },
      })

    return charges
  }

  async findOne(id: string): Promise<Charge> {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!charge) {
      throw new NotFoundException(`Charge with ID ${id} not found`);
    }

    return charge;
  }

  async update(id: string, data: UpdateChargeDto): Promise<Charge> {
    await this.validateCharge(id)

    try {
      return await this.prisma.charge.update({
        where: { id },
        data,
        include: {
          client: {
            include: {
              plan: true,
            },
          },
        },
      });
    } catch (error) {
      throw new NotFoundException(`Charge with ID ${id} not found`);
    }
  }

  async remove(id: string): Promise<Charge> {
    await this.validateCharge(id)
    try {
      return await this.prisma.charge.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Charge with ID ${id} not found`);
    }
  }

  async findByClient(clientId: string): Promise<Charge[]> {
    return this.prisma.charge.findMany({
      where: { clientId },
      include: {
        client: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        dueDate: 'desc',
      },
    });
  }

  async findByStatus(status: PaymentStatus): Promise<Charge[]> {
    return this.prisma.charge.findMany({
      where: { status },
      include: {
        client: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        dueDate: 'desc',
      },
    });
  }

  async findOverdue(): Promise<Charge[]> {
    const now = new Date();
    return this.prisma.charge.findMany({
      where: {
        dueDate: {
          lt: now,
        },
        status: {
          in: [PaymentStatus.PENDING],
        },
      },
      include: {
        client: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
  }

  async findPendingReminders(): Promise<Charge[]> {
    return this.prisma.charge.findMany({
      where: {
        reminderSent: false,
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
  }

  async markReminderSent(id: string): Promise<Charge> {
    return this.update(id, { reminderSent: true });
  }

  async markAsPaid(id: string): Promise<Charge> {
    return this.update(id, { status: PaymentStatus.PAID });
  }

  async markAsCanceled(id: string): Promise<Charge> {
    return this.update(id, { status: PaymentStatus.CANCELED });
  }

  async findByClientId(clientId: string): Promise<any[]> {
    return await this.prisma.charge.findMany({
      where: {
        clientId: clientId,
      },
      orderBy: {
        dueDate: 'desc',
      },
    });
  }

  private async validateCharge(id: string) {
    const chargeExists = await this.prisma.charge.findUnique({where: {id}})
    if (!chargeExists) throw new NotFoundException(`Cobrança com id: ${id} não encontrada`)
  }
}
