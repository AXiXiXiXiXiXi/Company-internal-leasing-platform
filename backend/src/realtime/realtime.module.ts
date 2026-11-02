import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../database/entities';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User])],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
