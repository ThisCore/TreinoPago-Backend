import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Plan } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PlanService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreatePlanDto): Promise<Plan> {
    const planExists = await this.prisma.plan.findFirst({
      where: {
        name: data.name
      }
    })

    if (planExists) {
      throw new BadRequestException("Já existe um plano com esse nome. Por favor, escolha outro.")
    }


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
      throw new NotFoundException(`Plano com id: ${id} não encontrado`);
    }

    return plan;
  }

  async update(id: string, data: UpdatePlanDto): Promise<Plan> {
    await this.validatePlan(id)

    try {
      return await this.prisma.plan.update({
        where: { id },
        data,
        include: {
          clients: true,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(`Erro interno no servidor`);
    }
  }

  async remove(id: string): Promise<Plan> {
    await this.validatePlan(id)

    try {
      return await this.prisma.plan.delete({
        where: { id },
      });
    } catch (error) {
      throw new InternalServerErrorException(`Erro interno no servidor`);
    }
  }

  private async validatePlan(id: string) {
    const planExists = await this.prisma.plan.findUnique({where: {id}})
    if (!planExists) throw new NotFoundException(`Plano com id: ${id} não encontrado`)
  }

  async getClientsCount(id: string): Promise<number> {
    const count = await this.prisma.client.count({
      where: { planId: id },
    });
    return count;
  }

}
