import { AuthController } from '../src/modules/auth/controllers/auth.controller';
import { UserRole } from '../src/modules/auth/entities/user.entity';

describe('AuthController', () => {
  const authService = {
    register: jest.fn(async (value) => ({ access_token: 'token', user: { id: '1', email: value.email, role: UserRole.viewer } })),
    login: jest.fn(async () => ({ access_token: 'token', user: { id: '1', email: 'admin@secop.com', role: UserRole.admin } })),
    getProfile: jest.fn(async () => ({ id: '1', email: 'user@example.com', role: UserRole.viewer })),
  };

  const controller = new AuthController(authService as never);

  it('registers users', async () => {
    await expect(controller.register({ email: 'user@example.com', password: 'securePass123' } as never)).resolves.toEqual(
      expect.objectContaining({ access_token: 'token' }),
    );
  });

  it('logs users in', async () => {
    await expect(controller.login({ email: 'admin@secop.com', password: 'correct-password' } as never)).resolves.toEqual(
      expect.objectContaining({ user: expect.objectContaining({ role: UserRole.admin }) }),
    );
  });

  it('returns the current profile', async () => {
    await expect(controller.me({ id: '1', email: 'user@example.com', role: UserRole.viewer })).resolves.toEqual({
      id: '1',
      email: 'user@example.com',
      role: UserRole.viewer,
    });
  });
});
