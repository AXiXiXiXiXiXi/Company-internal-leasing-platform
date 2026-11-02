import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums';
import { RolesGuard } from './roles.guard';

function contextForRole(role: UserRole): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          id: '2',
          username: 'zhangsan',
          employeeNo: 'EMP002',
          fullName: '张三',
          role,
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows a matching role', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextForRole(UserRole.ADMIN))).toBe(true);
  });

  it('rejects a mismatched role', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextForRole(UserRole.EMPLOYEE)))
      .toThrow(ForbiddenException);
  });
});
