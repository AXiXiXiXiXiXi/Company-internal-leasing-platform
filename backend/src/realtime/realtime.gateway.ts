import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { UserStatus } from '../common/enums';
import { JwtPayload } from '../common/types';
import { User } from '../database/entities';

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  transports: ['websocket'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = this.readToken(socket);
      if (!token) {
        socket.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.usersRepository.findOne({
        where: { id: payload.sub, status: UserStatus.ACTIVE },
      });
      if (!user) {
        socket.disconnect(true);
        return;
      }

      const userId = String(user.id);
      socket.data.userId = userId;
      await socket.join(this.userRoom(userId));
      if (payload.exp) {
        const remainingMs = payload.exp * 1000 - Date.now();
        socket.data.expiryTimer = setTimeout(
          () => socket.disconnect(true),
          Math.max(remainingMs, 0),
        );
      }
      socket.emit('authenticated', { userId });
    } catch (error) {
      this.logger.debug(`WebSocket authentication failed: ${String(error)}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const timer = socket.data.expiryTimer as NodeJS.Timeout | undefined;
    if (timer) {
      clearTimeout(timer);
    }
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(this.userRoom(userId)).emit(event, payload);
  }

  private readToken(socket: Socket): string | undefined {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken) {
      return authToken.replace(/^Bearer\s+/i, '');
    }
    const authorization = socket.handshake.headers.authorization;
    if (typeof authorization === 'string' && authorization) {
      return authorization.replace(/^Bearer\s+/i, '');
    }
    return undefined;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
