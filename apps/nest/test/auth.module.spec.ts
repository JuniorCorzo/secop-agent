import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { User } from '../src/modules/auth/entities/user.entity';

describe('AuthModule', () => {
  it('wires auth providers and guards', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'secret',
              JWT_EXPIRES_IN: '7d',
              ADMIN_EMAIL: 'admin@secop.com',
              ADMIN_PASSWORD: 'admin-secret',
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue({ findOne: jest.fn(), create: jest.fn(), save: jest.fn() })
      .compile();

    expect(moduleRef.get(AuthService)).toBeDefined();
    expect(moduleRef.get(JwtAuthGuard)).toBeDefined();
    expect(moduleRef.get(RolesGuard)).toBeDefined();
  });
});
