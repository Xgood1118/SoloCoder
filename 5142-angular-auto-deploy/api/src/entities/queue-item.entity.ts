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

export enum QueueStatus {
  WAITING = 'waiting',
  READY = 'ready',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('queue_items')
export class QueueItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'simple-enum', enum: QueueStatus, default: QueueStatus.WAITING })
  status: QueueStatus;

  @Column({ default: 0 })
  priority: number;

  @Column({ type: 'simple-json', default: '[]' })
  dependencyIds: string[];

  @ManyToOne(() => DeployRequest, (req) => req.queueItems)
  @JoinColumn({ name: 'deployRequestId' })
  deployRequest: DeployRequest;

  @Column()
  deployRequestId: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ default: 3 })
  maxRetries: number;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
