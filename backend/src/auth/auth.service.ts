import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { UserStatus } from '../common/enums';
import { JwtPayload } from '../common/types';
import { User } from '../database/entities';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private static readonly DUMMY_PASSWORD_HASH =
    '$argon2id$v=19$m=65536,t=3,p=4$LGxx2SM2G4LsHX6Zj/dUqw$nr9+el1J1Cw7KEQF2FqSIm7q8LUkUoWR2mmi7//KV94';

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.username = :username', { username: dto.username })
      .getOne();

    let passwordValid = false;
    try {
      passwordValid = await argon2.verify(
        user?.passwordHash ?? AuthService.DUMMY_PASSWORD_HASH,
        dto.password,
      );
    } catch {
      passwordValid = false;
    }
    if (!user || user.status !== UserStatus.ACTIVE || !passwordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload: JwtPayload = {
      sub: String(user.id),
      username: user.username,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    await this.usersRepository.update(user.id, { lastLoginAt: new Date() });

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: String(user.id),
        username: user.username,
        employeeNo: user.employeeNo,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
