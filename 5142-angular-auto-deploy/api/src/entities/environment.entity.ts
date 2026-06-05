import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { DeployRequest } from './deploy-request.entity';

export enum EnvironmentType {
  TESTING = 'testing',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

@Entity('environments')
export class Environment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'simple-enum', enum: EnvironmentType })
  type: EnvironmentType;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true, type: 'text' })
  credentials: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true })
  serverHost: string;

  @Column({ nullable: true })
  deployPath: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => DeployRequest, (req) => req.environment)
  deployRequests: DeployRequest[];
}
