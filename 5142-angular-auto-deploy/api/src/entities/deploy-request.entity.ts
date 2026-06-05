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
import { BuildTask } from './build-task.entity';
import { Environment } from './environment.entity';
import { User } from './user.entity';
import { ApprovalNode } from './approval-node.entity';
import { QueueItem } from './queue-item.entity';
import { RollbackRequest } from './rollback-request.entity';

export enum DeployStatus {
  PENDING = 'pending',
  APPROVING = 'approving',
  APPROVED = 'approved',
  DEPLOYING = 'deploying',
  DEPLOYED = 'deployed',
  FAILED = 'failed',
  REJECTED = 'rejected',
  ROLLED_BACK = 'rolled_back',
}

@Entity('deploy_requests')
export class DeployRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ type: 'simple-enum', enum: DeployStatus, default: DeployStatus.PENDING })
  status: DeployStatus;

  @ManyToOne(() => BuildTask, (task) => task.deployRequests)
  @JoinColumn({ name: 'buildTaskId' })
  buildTask: BuildTask;

  @Column()
  buildTaskId: string;

  @ManyToOne(() => Environment, (env) => env.deployRequests)
  @JoinColumn({ name: 'environmentId' })
  environment: Environment;

  @Column()
  environmentId: string;

  @ManyToOne(() => User, (user) => user.deployRequests)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ nullable: true, type: 'text' })
  deployConfig: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ApprovalNode, (node) => node.deployRequest)
  approvalNodes: ApprovalNode[];

  @OneToMany(() => QueueItem, (item) => item.deployRequest)
  queueItems: QueueItem[];

  @OneToMany(() => RollbackRequest, (req) => req.deployRequest)
  rollbackRequests: RollbackRequest[];
}
