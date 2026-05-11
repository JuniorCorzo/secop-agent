export interface HermesConfig {
  baseUrl: string;
}

/**
 * Placeholder factory for Hermes service configuration.
 * Not wired to any module yet; intended for future alert/notification issues.
 */
export const hermesConfig = (): HermesConfig => ({
  baseUrl: process.env.HERMES_BASE_URL ?? '',
});
