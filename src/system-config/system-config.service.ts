import { Injectable } from '@nestjs/common';
import { SystemConfig } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

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

  async updateConfig(data: UpdateSystemConfigDto): Promise<String> {
    const systemConfig = await this.prisma.systemConfig.upsert({
      where: { id: 'singleton' },
      update: data,
      create: {
        id: 'singleton',
        ...data,
      },
    });

    return systemConfig.pixKey
  }

  async getPixKey(): Promise<{pixKey: string}> {
    const config = await this.getConfig();
    return {pixKey: config.pixKey};
  }

  async updatePixKey(pixKey: string): Promise<String> {
    return this.updateConfig({ pixKey });
  }
}