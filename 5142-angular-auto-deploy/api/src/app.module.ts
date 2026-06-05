import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { BuildModule } from './build/build.module';
import { DeployModule } from './deploy/deploy.module';
import { EnvironmentModule } from './environment/environment.module';
import { RollbackModule } from './rollback/rollback.module';
import { QueueModule } from './queue/queue.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    BuildModule,
    DeployModule,
    EnvironmentModule,
    RollbackModule,
    QueueModule,
    GatewayModule,
  ],
})
export class AppModule {}
