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
import { ApplicationStatus } from '../../common/enums';
import { Asset } from './asset.entity';
import { User } from './user.entity';

@Entity('borrow_applications')
export class BorrowApplication {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'application_no', length: 40 })
  applicationNo: string;

  @Column({ name: 'asset_id', type: 'bigint', unsigned: true })
  assetId: string;

  @Column({ name: 'applicant_user_id', type: 'bigint', unsigned: true })
  applicantUserId: string;

  @Column({ length: 1000 })
  purpose: string;

  @Column({ name: 'expected_return_at', type: 'datetime', precision: 6 })
  expectedReturnAt: Date;

  @Column({ length: 20, default: ApplicationStatus.PENDING })
  status: ApplicationStatus;

  @Column({ name: 'submitted_at', type: 'datetime', precision: 6 })
  submittedAt: Date;

  @Column({ name: 'decision_by_user_id', type: 'bigint', unsigned: true, nullable: true })
  decisionByUserId: string | null;

  @Column({ name: 'decision_at', type: 'datetime', precision: 6, nullable: true })
  decisionAt: Date | null;

  @Column({ name: 'decision_comment', type: 'varchar', length: 1000, nullable: true })
  decisionComment: string | null;

  @ManyToOne(() => Asset, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'applicant_user_id' })
  applicant: User;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'decision_by_user_id' })
  decisionBy: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;

  @VersionColumn({ type: 'int', unsigned: true, default: 0 })
  version: number;
}
