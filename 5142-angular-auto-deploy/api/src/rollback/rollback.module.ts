import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RollbackRequest, DeployRequest } from '../entities';
import { RollbackService } from './rollback.service';
import { RollbackController } from './rollback.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RollbackRequest, DeployRequest])],
  controllers: [RollbackController],
  providers: [RollbackService],
  exports: [RollbackService],
})
export class RollbackModule {}
