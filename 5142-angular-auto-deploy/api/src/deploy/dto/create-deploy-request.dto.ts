import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateDeployRequestDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  buildTaskId: string;

  @IsUUID()
  @IsNotEmpty()
  environmentId: string;

  @IsString()
  @IsOptional()
  deployConfig?: string;
}
