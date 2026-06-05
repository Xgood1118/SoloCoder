import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { BuildLog } from './build-log.entity';
import { DeployRequest } from './deploy-request.entity';

export enum BuildStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('build_tasks')
export class BuildTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  repository: string;

  @Column()
  branch: string;

  @Column({ nullable: true })
  commit: string;

  @Column({ nullable: true })
  environment: string;

  @Column({ type: 'simple-json', nullable: true })
  parameters: Record<string, string>;

  @Column({ type: 'simple-enum', enum: BuildStatus, default: BuildStatus.PENDING })
  status: BuildStatus;

  @Column({ nullable: true, type: 'text' })
  config: string;

  @ManyToOne(() => User, (user) => user.buildTasks)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => BuildLog, (log) => log.buildTask)
  logs: BuildLog[];

  @OneToMany(() => DeployRequest, (req) => req.buildTask)
  deployRequests: DeployRequest[];
}
