import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { BuildTask } from './build-task.entity';
import { DeployRequest } from './deploy-request.entity';
import { ApprovalNode } from './approval-node.entity';
import { RollbackRequest } from './rollback-request.entity';

export enum UserRole {
  ADMIN = 'admin',
  APPROVER = 'approver',
  SUBMITTER = 'submitter',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Exclude()
  @Column()
  password: string;

  @Column({ type: 'simple-enum', enum: UserRole, default: UserRole.SUBMITTER })
  role: UserRole;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => BuildTask, (task) => task.user)
  buildTasks: BuildTask[];

  @OneToMany(() => DeployRequest, (req) => req.user)
  deployRequests: DeployRequest[];

  @OneToMany(() => ApprovalNode, (node) => node.approver)
  approvalNodes: ApprovalNode[];

  @OneToMany(() => RollbackRequest, (req) => req.user)
  rollbackRequests: RollbackRequest[];
}
