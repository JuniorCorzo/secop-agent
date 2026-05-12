import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { User, UserRole } from '../src/modules/auth/entities/user.entity';
import { RegisterDto } from '../src/modules/auth/dto/register.dto';
import { LoginDto } from '../src/modules/auth/dto/login.dto';

jest.mock('bcrypt', () => ({
  hash: jest.fn(async (value: string) => `hashed:${value}`),
  compare: jest.fn(async (value: string, hash: string) => hash === `hashed:${value}`),
}));

describe('AuthService', () => {
  const repository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'user-id', ...value })),
  };

  const jwtService = {
    signAsync: jest.fn(async () => 'jwt-token'),
  } as never as JwtService;

  const service = new AuthService(repository as never, jwtService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a new viewer user', async () => {
    repository.findOne.mockResolvedValue(null);

    const result = await service.register({
      email: 'USER@example.com',
      password: 'securePass123',
    } as RegisterDto);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        passwordHash: 'hashed:securePass123',
        role: UserRole.viewer,
      }),
    );
    expect(result.access_token).toBe('jwt-token');
    expect(result.user.email).toBe('user@example.com');
  });

  it('ignores any attempted role escalation on registration', async () => {
    repository.findOne.mockResolvedValue(null);

    await service.register({
      email: 'attacker@example.com',
      password: 'securePass123',
    } as RegisterDto);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'attacker@example.com',
        role: UserRole.viewer,
      }),
    );
  });

  it('rejects duplicate registration', async () => {
    repository.findOne.mockResolvedValue({ id: 'exists' });

    await expect(
      service.register({ email: 'user@example.com', password: 'securePass123' } as RegisterDto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    repository.findOne.mockResolvedValue({
      id: 'user-id',
      email: 'admin@secop.com',
      passwordHash: 'hashed:correct-password',
      role: UserRole.admin,
    } as User);

    const result = await service.login({
      email: 'ADMIN@secop.com',
      password: 'correct-password',
    } as LoginDto);

    expect(result.user.role).toBe(UserRole.admin);
    expect(result.access_token).toBe('jwt-token');
  });

  it('rejects invalid credentials', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@secop.com', password: 'wrong' } as LoginDto),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validates jwt payload against the database', async () => {
    repository.findOne.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash: 'hashed',
      role: UserRole.viewer,
    } as User);

    await expect(service.validateUser({ sub: 'user-id' })).resolves.toMatchObject({
      id: 'user-id',
      role: UserRole.viewer,
    });
  });

  it('returns a profile without password hash', async () => {
    repository.findOne.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash: 'hashed',
      role: UserRole.viewer,
    } as User);

    await expect(service.getProfile('user-id')).resolves.toEqual({
      id: 'user-id',
      email: 'user@example.com',
      role: UserRole.viewer,
    });
  });
});
