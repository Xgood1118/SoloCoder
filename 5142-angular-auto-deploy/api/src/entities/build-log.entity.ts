import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BuildTask } from './build-task.entity';

@Entity('build_logs')
export class BuildLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', default: 'info' })
  level: string;

  @ManyToOne(() => BuildTask, (task) => task.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buildTaskId' })
  buildTask: BuildTask;

  @Column()
  buildTaskId: string;

  @Column({ type: 'bigint' })
  timestamp: number;
}
