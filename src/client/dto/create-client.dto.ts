import { PaymentStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsISO8601, IsNumber, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'João da Silva', description: 'Nome completo do cliente' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'joao@email.com', description: 'E-mail do cliente' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'c2e6f3a4-8d76-4b12-930b-b543b1a9d9e1', description: 'UUID do plano associado' })
  @IsUUID()
  planId: string;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING, description: 'Status do pagamento do cliente' })
  @IsEnum(PaymentStatus)
  paymentStatus: PaymentStatus;

  @ApiProperty({ example: 1930677600000, description: 'Data de início da cobrança em milisegundos' })
  @IsNumber()
  billingStartDate: number;
}
