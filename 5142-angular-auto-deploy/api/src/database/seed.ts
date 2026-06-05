import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import {
  User,
  UserRole,
  Environment,
  EnvironmentType,
  BuildTask,
  DeployRequest,
  ApprovalNode,
  QueueItem,
  RollbackRequest,
  BuildLog,
} from '../entities';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function seed() {
  const dataSource = new DataSource({
    type: 'sqljs',
    location: './data/deploy-pipeline.db',
    autoSave: true,
    entities: [User, BuildTask, Environment, DeployRequest, ApprovalNode, QueueItem, RollbackRequest, BuildLog],
    synchronize: true,
  });

  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);
  const envRepo = dataSource.getRepository(Environment);

  const existingUsers = await userRepo.count();
  if (existingUsers === 0) {
    const users = [
      userRepo.create({
        username: 'admin',
        password: hashPassword('admin123'),
        role: UserRole.ADMIN,
        active: true,
      }),
      userRepo.create({
        username: 'approver',
        password: hashPassword('approver123'),
        role: UserRole.APPROVER,
        active: true,
      }),
      userRepo.create({
        username: 'submitter',
        password: hashPassword('submitter123'),
        role: UserRole.SUBMITTER,
        active: true,
      }),
    ];
    await userRepo.save(users);
    console.log('Seeded 3 default users');
  }

  const existingEnvs = await envRepo.count();
  if (existingEnvs === 0) {
    const environments = [
      envRepo.create({
        name: 'Testing',
        type: EnvironmentType.TESTING,
        description: '测试环境',
        enabled: true,
        serverHost: 'test.example.com',
        deployPath: '/var/www/test',
      }),
      envRepo.create({
        name: 'Staging',
        type: EnvironmentType.STAGING,
        description: '预发布环境',
        enabled: true,
        serverHost: 'staging.example.com',
        deployPath: '/var/www/staging',
      }),
      envRepo.create({
        name: 'Production',
        type: EnvironmentType.PRODUCTION,
        description: '生产环境',
        enabled: false,
        serverHost: 'prod.example.com',
        deployPath: '/var/www/prod',
      }),
    ];
    await envRepo.save(environments);
    console.log('Seeded 3 default environments');
  }

  await dataSource.destroy();
  console.log('Seed completed');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
