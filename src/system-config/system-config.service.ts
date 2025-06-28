import { Injectable } from '@nestjs/common';
import { SystemConfig } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

export interface UpdateSystemConfigDto {
  pixKey: string;
}

@Injectable()
export class SystemConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig(): Promise<SystemConfig> {
    let config = await this.prisma.systemConfig.findUnique({
      where: { id: 'singleton' },
    });

    if (!config) {
      config = await this.prisma.systemConfig.create({
        data: {
          id: 'singleton',
          pixKey: '',
        },
      });
    }

    return config;
  }

  async updateConfig(data: UpdateSystemConfigDto): Promise<SystemConfig> {
    return this.prisma.systemConfig.upsert({
      where: { id: 'singleton' },
      update: data,
      create: {
        id: 'singleton',
        ...data,
      },
    });
  }

  async getPixKey(): Promise<string> {
    const config = await this.getConfig();
    return config.pixKey;
  }

  async updatePixKey(pixKey: string): Promise<SystemConfig> {
    return this.updateConfig({ pixKey });
  }
}