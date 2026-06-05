import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApprovalStatus } from '../../entities';

export class ApprovalDto {
  @IsEnum(ApprovalStatus)
  @IsNotEmpty()
  status: ApprovalStatus;

  @IsString()
  @IsOptional()
  comment?: string;
}
