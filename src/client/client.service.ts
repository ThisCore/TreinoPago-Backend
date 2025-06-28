import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client, PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ClientService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateClientDto): Promise<Client> {
    return this.prisma.client.create({
      data,
      include: {
        plan: true,
        charges: true,
      },
    });
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
    try {
      return await this.prisma.client.update({
        where: { id },
        data,
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
}
