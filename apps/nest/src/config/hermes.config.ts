import type { EnvironmentConfig } from './env.validation';

export interface HermesConfig {
  baseUrl: string;
}

/**
 * Placeholder factory for Hermes service configuration.
 * Not wired to any module yet; intended for future alert/notification issues.
 */
export const hermesConfig = (env: Pick<EnvironmentConfig, 'HERMES_BASE_URL'>): HermesConfig => ({
  baseUrl: env.HERMES_BASE_URL ?? '',
});
