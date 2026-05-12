import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { UserRole } from '../src/modules/auth/entities/user.entity';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as never as Reflector;
  const guard = new RolesGuard(reflector);

  const createContext = (role?: UserRole) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    }) as never as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows admins on admin routes', () => {
    reflector.getAllAndOverride = jest.fn(() => [UserRole.admin]);

    expect(guard.canActivate(createContext(UserRole.admin))).toBe(true);
  });

  it('denies viewers on admin routes', () => {
    reflector.getAllAndOverride = jest.fn(() => [UserRole.admin]);

    expect(guard.canActivate(createContext(UserRole.viewer))).toBe(false);
  });

  it('allows multiple roles', () => {
    reflector.getAllAndOverride = jest.fn(() => [UserRole.admin, UserRole.analista]);

    expect(guard.canActivate(createContext(UserRole.analista))).toBe(true);
  });

  it('denies requests without a user', () => {
    reflector.getAllAndOverride = jest.fn(() => [UserRole.admin]);

    expect(guard.canActivate(createContext())).toBe(false);
  });
});
