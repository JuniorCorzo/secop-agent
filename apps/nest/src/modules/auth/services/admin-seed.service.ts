import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';

@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const existingAdmin = await this.usersRepository.findOne({ where: { role: UserRole.admin } });

      if (existingAdmin) {
        return;
      }

      const email = this.configService.getOrThrow<string>('ADMIN_EMAIL').trim().toLowerCase();
      const password = this.configService.getOrThrow<string>('ADMIN_PASSWORD');
      const passwordHash = await bcrypt.hash(password, 12);

      const existingUser = await this.usersRepository.findOne({ where: { email } });

      if (existingUser) {
        existingUser.role = UserRole.admin;
        existingUser.passwordHash = passwordHash;
        await this.usersRepository.save(existingUser);
        return;
      }

      await this.usersRepository.save(
        this.usersRepository.create({
          email,
          passwordHash,
          role: UserRole.admin,
        }),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Admin seed skipped: ${reason}`);
    }
  }
}
