import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import {
  User,
  BuildTask,
  Environment,
  DeployRequest,
  ApprovalNode,
  QueueItem,
  RollbackRequest,
  BuildLog,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: path.join(process.cwd(), 'data', 'deploy-pipeline.db'),
      autoSave: true,
      entities: [
        User,
        BuildTask,
        Environment,
        DeployRequest,
        ApprovalNode,
        QueueItem,
        RollbackRequest,
        BuildLog,
      ],
      synchronize: true,
      logging: false,
    }),
  ],
})
export class DatabaseModule {}
