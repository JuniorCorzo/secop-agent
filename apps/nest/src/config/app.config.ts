import type { EnvironmentConfig } from './env.validation';

export interface AppConfig {
  port: number;
  nodeEnv: string;
}

export const appConfig = (env: Pick<EnvironmentConfig, 'PORT' | 'NODE_ENV'>): AppConfig => ({
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
});
