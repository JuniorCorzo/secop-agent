import type { EnvironmentConfig } from './env.validation';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
}

export const authConfig = (env: Pick<EnvironmentConfig, 'JWT_SECRET' | 'JWT_EXPIRES_IN'>): AuthConfig => ({
  jwtSecret: env.JWT_SECRET ?? '',
  jwtExpiresIn: env.JWT_EXPIRES_IN ?? '7d',
});
