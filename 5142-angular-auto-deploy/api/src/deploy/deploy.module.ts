import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeployRequest, ApprovalNode, QueueItem } from '../entities';
import { DeployService } from './deploy.service';
import { DeployController } from './deploy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeployRequest, ApprovalNode, QueueItem])],
  controllers: [DeployController],
  providers: [DeployService],
  exports: [DeployService],
})
export class DeployModule {}
