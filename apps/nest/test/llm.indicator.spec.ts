import { checkLlmHealth } from '../src/modules/health/indicators/http.indicator';

describe('checkLlmHealth', () => {
  it('fails when api key is missing', async () => {
    await expect(checkLlmHealth('http://localhost:11434', undefined)).resolves.toEqual(
      expect.objectContaining({ status: 'down', details: 'apiKey not configured' }),
    );
  });
});
