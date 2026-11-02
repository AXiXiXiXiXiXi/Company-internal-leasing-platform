import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UserStatus } from '../common/enums';
import { AuthenticatedUser, JwtPayload } from '../common/types';
import { User } from '../database/entities';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub, status: UserStatus.ACTIVE },
    });
    if (!user) {
      throw new UnauthorizedException('账号不存在或已停用');
    }
    return {
      id: String(user.id),
      username: user.username,
      employeeNo: user.employeeNo,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
