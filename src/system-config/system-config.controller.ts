import { Body, Controller, Get, Post } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { CreateSystemConfigDto } from './dto/create-system-config.dto';

@Controller('system-config')
export class SystemConfigController {
      constructor(private readonly systemConfigService: SystemConfigService) {}
    
    @Post()
    update(@Body() createSystemConfigDto: CreateSystemConfigDto) {
    return this.systemConfigService.updateConfig(createSystemConfigDto);
    }

    @Get()
    find() {
        return this.systemConfigService.getPixKey();
    }
}
