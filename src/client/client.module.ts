import { Module } from '@nestjs/common';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { EmailModule } from 'src/email/email.module';

@Module({
  controllers: [ClientController],
  providers: [ClientService],
  imports: [EmailModule]
})
export class ClientModule {}
