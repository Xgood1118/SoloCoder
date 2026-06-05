import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { EnvironmentType } from '../../entities';

export class CreateEnvironmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(EnvironmentType)
  type: EnvironmentType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  credentials?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  serverHost?: string;

  @IsString()
  @IsOptional()
  deployPath?: string;
}

export class UpdateEnvironmentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(EnvironmentType)
  @IsOptional()
  type?: EnvironmentType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  credentials?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  serverHost?: string;

  @IsString()
  @IsOptional()
  deployPath?: string;
}
