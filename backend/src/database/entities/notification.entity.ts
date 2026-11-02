import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationType } from '../../common/enums';
import { BorrowApplication } from './borrow-application.entity';
import { User } from './user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'recipient_user_id', type: 'bigint', unsigned: true })
  recipientUserId: string;

  @Column({ name: 'sender_user_id', type: 'bigint', unsigned: true, nullable: true })
  senderUserId: string | null;

  @Column({ name: 'notification_type', length: 40 })
  notificationType: NotificationType;

  @Column({ length: 160 })
  title: string;

  @Column({ length: 2000 })
  body: string;

  @Column({ name: 'related_application_id', type: 'bigint', unsigned: true, nullable: true })
  relatedApplicationId: string | null;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 160, nullable: true })
  dedupeKey: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'datetime', precision: 6, nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recipient_user_id' })
  recipient: User;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'sender_user_id' })
  sender: User | null;

  @ManyToOne(() => BorrowApplication, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'related_application_id' })
  relatedApplication: BorrowApplication | null;
}
