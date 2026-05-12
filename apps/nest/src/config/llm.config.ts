import type { EnvironmentConfig } from './env.validation';

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Placeholder factory for OpenCode Go LLM configuration.
 * Not wired to any module yet; intended for ANC-63+.
 */
export const llmConfig = (env: Pick<EnvironmentConfig, 'LLM_BASE_URL' | 'LLM_API_KEY'>): LlmConfig => ({
  baseUrl: env.LLM_BASE_URL ?? '',
  apiKey: env.LLM_API_KEY ?? '',
});
