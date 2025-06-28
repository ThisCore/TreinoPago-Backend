import { Recurrence } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty({ example: 'Plano Mensal', description: 'Nome do plano oferecido' })
  @IsString()
  name: string;

  @ApiProperty({ example: 99.9, description: 'Valor do plano em reais' })
  @IsNumber()
  price: number;

  @ApiProperty({ enum: Recurrence, example: Recurrence.MONTHLY, description: 'Recorrência do plano' })
  @IsEnum(Recurrence)
  recurrence: Recurrence;
}
