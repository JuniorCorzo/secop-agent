type HttpHealthStatus = 'up' | 'down' | 'disabled';

export async function checkHttpHealth(
  name: string,
  baseUrl?: string,
): Promise<{ status: HttpHealthStatus; name: string; details?: string }> {
  if (!baseUrl) {
    return { name, status: 'disabled', details: 'baseUrl not configured' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(new URL('/health', baseUrl), {
        signal: controller.signal,
      });
      return response.ok
        ? { name, status: 'up' }
        : { name, status: 'down', details: `HTTP ${response.status}` };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return {
      name,
      status: 'down',
      details: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

export async function checkLlmHealth(baseUrl?: string, apiKey?: string) {
  if (!apiKey) {
    return { name: 'llm', status: 'down' as const, details: 'apiKey not configured' };
  }

  if (!baseUrl) {
    return { name: 'llm', status: 'disabled' as const, details: 'baseUrl not configured' };
  }

  return checkHttpHealth('llm', baseUrl);
}
