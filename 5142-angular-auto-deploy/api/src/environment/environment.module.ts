import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Environment } from '../entities';
import { EnvironmentService } from './environment.service';
import { EnvironmentController } from './environment.controller';
import { EncryptionService } from '../common/encryption.service';

@Module({
  imports: [TypeOrmModule.forFeature([Environment])],
  controllers: [EnvironmentController],
  providers: [EnvironmentService, EncryptionService],
  exports: [EnvironmentService],
})
export class EnvironmentModule {}
