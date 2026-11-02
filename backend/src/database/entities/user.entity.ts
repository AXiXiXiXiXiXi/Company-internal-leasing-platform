import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UserRole, UserStatus } from '../../common/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ length: 64 })
  username: string;

  @Column({ name: 'employee_no', type: 'varchar', length: 32, nullable: true })
  employeeNo: string | null;

  @Column({ name: 'full_name', length: 64 })
  fullName: string;

  @Column({ length: 20 })
  role: UserRole;

  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash: string;

  @Column({ length: 20, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ name: 'last_login_at', type: 'datetime', precision: 6, nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;

  @VersionColumn({ type: 'int', unsigned: true, default: 0 })
  version: number;
}
