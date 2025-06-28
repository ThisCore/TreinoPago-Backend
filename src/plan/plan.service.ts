import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Plan } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PlanService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreatePlanDto): Promise<Plan> {
    return this.prisma.plan.create({
      data,
    });
  }

  async findAll(): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      include: {
        clients: true,
      },
    });
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        clients: true,
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    return plan;
  }

  async update(id: string, data: UpdatePlanDto): Promise<Plan> {
    try {
      return await this.prisma.plan.update({
        where: { id },
        data,
        include: {
          clients: true,
        },
      });
    } catch (error) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
  }

  async remove(id: string): Promise<Plan> {
    try {
      return await this.prisma.plan.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
  }

  async getClientsCount(id: string): Promise<number> {
    const count = await this.prisma.client.count({
      where: { planId: id },
    });
    return count;
  }

}
