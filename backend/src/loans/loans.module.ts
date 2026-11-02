import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ApplicationEvent,
  Asset,
  BorrowApplication,
  BorrowLoan,
} from '../database/entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BorrowLoan,
      BorrowApplication,
      Asset,
      ApplicationEvent,
    ]),
    NotificationsModule,
  ],
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}
