export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Placeholder factory for OpenCode Go LLM configuration.
 * Not wired to any module yet; intended for ANC-63+.
 */
export const llmConfig = (): LlmConfig => ({
  baseUrl: process.env.LLM_BASE_URL ?? '',
  apiKey: process.env.LLM_API_KEY ?? '',
});
