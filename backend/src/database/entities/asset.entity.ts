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
import { AssetStatus } from '../../common/enums';
import { User } from './user.entity';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'asset_no', length: 64 })
  assetNo: string;

  @Column({ length: 128 })
  name: string;

  @Column({ length: 64 })
  category: string;

  @Column({ name: 'serial_no', type: 'varchar', length: 128, nullable: true })
  serialNo: string | null;

  @Column({ name: 'storage_location', length: 128 })
  storageLocation: string;

  @Column({ length: 20, default: AssetStatus.AVAILABLE })
  status: AssetStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes: string | null;

  @Column({ name: 'created_by_user_id', type: 'bigint', unsigned: true })
  createdByUserId: string;

  @Column({ name: 'updated_by_user_id', type: 'bigint', unsigned: true })
  updatedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedBy: User;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;

  @VersionColumn({ type: 'int', unsigned: true, default: 0 })
  version: number;
}
