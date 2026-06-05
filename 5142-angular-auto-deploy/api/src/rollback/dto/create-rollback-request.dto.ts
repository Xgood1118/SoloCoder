import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateRollbackRequestDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsUUID()
  @IsNotEmpty()
  deployRequestId: string;

  @IsString()
  @IsOptional()
  targetVersion?: string;
}
