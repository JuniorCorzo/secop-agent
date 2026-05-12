import { ConfigService } from '@nestjs/config';
import { AdminSeedService } from '../src/modules/auth/services/admin-seed.service';
import { UserRole } from '../src/modules/auth/entities/user.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(async (value: string) => `hashed:${value}`),
}));

describe('AdminSeedService', () => {
  const repository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };

  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'ADMIN_EMAIL') return 'admin@secop.com';
      if (key === 'ADMIN_PASSWORD') return 'admin-secret';
      throw new Error('missing');
    }),
  } as never as ConfigService;

  const service = new AdminSeedService(repository as never, configService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an admin on first run', async () => {
    repository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await service.onModuleInit();

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@secop.com',
        passwordHash: 'hashed:admin-secret',
        role: UserRole.admin,
      }),
    );
  });

  it('skips when admin already exists', async () => {
    repository.findOne.mockResolvedValueOnce({ id: 'admin-id' });

    await service.onModuleInit();

    expect(repository.save).not.toHaveBeenCalled();
  });
});
