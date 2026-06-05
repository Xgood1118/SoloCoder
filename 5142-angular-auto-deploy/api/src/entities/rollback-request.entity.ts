import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DeployRequest } from './deploy-request.entity';
import { User } from './user.entity';

export enum RollbackStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REJECTED = 'rejected',
}

@Entity('rollback_requests')
export class RollbackRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'simple-enum', enum: RollbackStatus, default: RollbackStatus.PENDING })
  status: RollbackStatus;

  @Column({ nullable: true, type: 'text' })
  targetVersion: string;

  @ManyToOne(() => DeployRequest, (req) => req.rollbackRequests)
  @JoinColumn({ name: 'deployRequestId' })
  deployRequest: DeployRequest;

  @Column()
  deployRequestId: string;

  @ManyToOne(() => User, (user) => user.rollbackRequests)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
