import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ApplicationEvent,
  Asset,
  BorrowApplication,
  BorrowLoan,
} from '../database/entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BorrowApplication,
      Asset,
      BorrowLoan,
      ApplicationEvent,
    ]),
    NotificationsModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
