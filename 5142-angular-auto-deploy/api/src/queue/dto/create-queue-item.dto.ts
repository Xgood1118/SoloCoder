import { IsUUID, IsOptional, IsArray, IsInt, Min } from 'class-validator';

export class CreateQueueItemDto {
  @IsUUID()
  deployRequestId: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  dependencyIds?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;
}
