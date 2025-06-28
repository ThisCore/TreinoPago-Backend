import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CreateSystemConfigDto {
    @ApiProperty({ example: 'example@example', description: 'Chave pix' })
    @IsString()
    pixKey: string;
}
