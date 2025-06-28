import { Module } from '@nestjs/common';
import { ChargeService } from './charge.service';
import { ChargeController } from './charge.controller';

@Module({
  controllers: [ChargeController],
  providers: [ChargeService],
})
export class ChargeModule {}
