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

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('approval_nodes')
export class ApprovalNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'simple-enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING })
  status: ApprovalStatus;

  @Column({ nullable: true, type: 'text' })
  comment: string;

  @Column({ default: 0 })
  order: number;

  @ManyToOne(() => DeployRequest, (req) => req.approvalNodes)
  @JoinColumn({ name: 'deployRequestId' })
  deployRequest: DeployRequest;

  @Column()
  deployRequestId: string;

  @ManyToOne(() => User, (user) => user.approvalNodes)
  @JoinColumn({ name: 'approverId' })
  approver: User;

  @Column({ nullable: true })
  approverId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
