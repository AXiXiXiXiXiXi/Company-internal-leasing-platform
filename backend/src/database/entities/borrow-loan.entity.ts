import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { BorrowApplication } from './borrow-application.entity';
import { User } from './user.entity';

@Entity('borrow_loans')
export class BorrowLoan {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'application_id', type: 'bigint', unsigned: true })
  applicationId: string;

  @Column({ name: 'checked_out_at', type: 'datetime', precision: 6 })
  checkedOutAt: Date;

  @Column({ name: 'expected_return_at', type: 'datetime', precision: 6 })
  expectedReturnAt: Date;

  @Column({ name: 'handover_handled_by_user_id', type: 'bigint', unsigned: true })
  handoverHandledByUserId: string;

  @Column({ name: 'handover_note', type: 'varchar', length: 1000, nullable: true })
  handoverNote: string | null;

  @Column({ name: 'returned_at', type: 'datetime', precision: 6, nullable: true })
  returnedAt: Date | null;

  @Column({ name: 'return_handled_by_user_id', type: 'bigint', unsigned: true, nullable: true })
  returnHandledByUserId: string | null;

  @Column({ name: 'return_note', type: 'varchar', length: 1000, nullable: true })
  returnNote: string | null;

  @ManyToOne(() => BorrowApplication, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'application_id' })
  application: BorrowApplication;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'handover_handled_by_user_id' })
  handoverHandledBy: User;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'return_handled_by_user_id' })
  returnHandledBy: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;

  @VersionColumn({ type: 'int', unsigned: true, default: 0 })
  version: number;
}
