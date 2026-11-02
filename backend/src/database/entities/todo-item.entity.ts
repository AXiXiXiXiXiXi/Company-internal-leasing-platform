import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TodoStatus, TodoType } from '../../common/enums';
import { BorrowApplication } from './borrow-application.entity';
import { User } from './user.entity';

@Entity('todo_items')
export class TodoItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'assignee_user_id', type: 'bigint', unsigned: true })
  assigneeUserId: string;

  @Column({ name: 'todo_type', length: 40 })
  todoType: TodoType;

  @Column({ length: 160 })
  title: string;

  @Column({ name: 'related_application_id', type: 'bigint', unsigned: true })
  relatedApplicationId: string;

  @Column({ name: 'dedupe_key', length: 160 })
  dedupeKey: string;

  @Column({ length: 20, default: TodoStatus.PENDING })
  status: TodoStatus;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'datetime', precision: 6, nullable: true })
  readAt: Date | null;

  @Column({ name: 'due_at', type: 'datetime', precision: 6, nullable: true })
  dueAt: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', precision: 6, nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assignee_user_id' })
  assignee: User;

  @ManyToOne(() => BorrowApplication, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'related_application_id' })
  relatedApplication: BorrowApplication;
}
