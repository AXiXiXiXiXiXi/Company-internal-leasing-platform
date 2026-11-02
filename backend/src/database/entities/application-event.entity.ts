import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApplicationEventType, ApplicationStatus } from '../../common/enums';
import { BorrowApplication } from './borrow-application.entity';
import { User } from './user.entity';

@Entity('application_events')
export class ApplicationEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'application_id', type: 'bigint', unsigned: true })
  applicationId: string;

  @Column({ name: 'event_type', length: 20 })
  eventType: ApplicationEventType;

  @Column({ name: 'actor_user_id', type: 'bigint', unsigned: true })
  actorUserId: string;

  @Column({ name: 'from_status', type: 'varchar', length: 20, nullable: true })
  fromStatus: ApplicationStatus | null;

  @Column({ name: 'to_status', length: 20 })
  toStatus: ApplicationStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'occurred_at', type: 'datetime', precision: 6 })
  occurredAt: Date;

  @ManyToOne(() => BorrowApplication, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'application_id' })
  application: BorrowApplication;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_user_id' })
  actor: User;
}
