import { HealthController } from '../src/modules/health/health.controller';

describe('HealthController', () => {
  it('returns service payload', async () => {
    const controller = new HealthController({ check: jest.fn().mockResolvedValue({ status: 'ok' }) } as never);
    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
  });
});
