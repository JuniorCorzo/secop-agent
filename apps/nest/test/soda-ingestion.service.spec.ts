import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { SodaIngestionService } from '../src/modules/soda-ingestion/services/soda-ingestion.service';

describe('SodaIngestionService', () => {
  const configService = {
    get: jest.fn((key: string) =>
      ({
        SODA_API_URL: 'https://www.datos.gov.co',
        SODA_APP_TOKEN: 'token-123',
        SODA_DATASET_SECOP1: 'f789-7hwg',
        SODA_DATASET_SECOP2: 'p6dx-8zbt',
        SODA_PAGE_SIZE: 5000,
        SODA_CRON: '0 */6 * * *',
      })[key],
    ),
  } as any;

  let sodaClientService: { paginateDataset: jest.Mock };
  let procurementNoticesService: { bulkUpsert: jest.Mock };
  let service: SodaIngestionService;

  beforeEach(() => {
    sodaClientService = { paginateDataset: jest.fn() };
    procurementNoticesService = { bulkUpsert: jest.fn().mockResolvedValue(undefined) };
    service = new SodaIngestionService(
      configService,
      sodaClientService as any,
      procurementNoticesService as any,
    );
  });

  it('has Cron metadata on handleCron and method is invocable', async () => {
    const metadata = Reflect.getMetadata(SCHEDULE_CRON_OPTIONS, service.handleCron);
    expect(metadata.cronTime).toBe('0 */6 * * *');

    const spy = jest.spyOn(service, 'runIngestionCycle').mockResolvedValue(undefined);
    await service.handleCron();
    expect(spy).toHaveBeenCalled();
  });

  it('runs both datasets with Promise.allSettled semantics', async () => {
    sodaClientService.paginateDataset
      .mockResolvedValueOnce([{ numero_de_constancia: 'C-001' }])
      .mockRejectedValueOnce(new Error('dataset 2 down'));

    await service.runIngestionCycle();

    expect(sodaClientService.paginateDataset).toHaveBeenCalledTimes(2);
    expect(procurementNoticesService.bulkUpsert).toHaveBeenCalledTimes(1);
  });

  it('skips cycle when another run is in progress', async () => {
    (service as any).isRunning = true;
    const spy = jest.spyOn(sodaClientService, 'paginateDataset');

    await service.runIngestionCycle();

    expect(spy).not.toHaveBeenCalled();
  });

  it('builds incremental where clause using lastRunTimestamp', () => {
    (service as any).failureState.set('SECOP_II', {
      consecutiveFailures: 0,
      lastRunTimestamp: '2024-05-01T00:00:00.000Z',
    });

    expect(service.buildWhereClause('SECOP_II')).toBe(
      "fecha_de_ultima_publicaci > '2024-05-01T00:00:00.000Z'",
    );
  });

  it('resets failure counter on success', async () => {
    (service as any).failureState.set('SECOP_I', {
      consecutiveFailures: 2,
      lastRunTimestamp: null,
    });
    sodaClientService.paginateDataset.mockResolvedValueOnce([{ numero_de_constancia: 'C-001' }]);

    await service.fetchAndIngest('f789-7hwg', 'SECOP_I');

    expect((service as any).failureState.get('SECOP_I').consecutiveFailures).toBe(0);
  });

  it('increments failure counter on error', async () => {
    sodaClientService.paginateDataset.mockRejectedValueOnce(new Error('boom'));

    await service.fetchAndIngest('f789-7hwg', 'SECOP_I');

    expect((service as any).failureState.get('SECOP_I').consecutiveFailures).toBe(1);
  });

  it('emits ERROR log when dataset reaches 3 consecutive failures', async () => {
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    sodaClientService.paginateDataset.mockRejectedValue(new Error('persistent'));

    await service.fetchAndIngest('f789-7hwg', 'SECOP_I');
    await service.fetchAndIngest('f789-7hwg', 'SECOP_I');
    await service.fetchAndIngest('f789-7hwg', 'SECOP_I');

    expect((service as any).failureState.get('SECOP_I').consecutiveFailures).toBe(3);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('3 consecutive failures'),
    );
  });

  it('omits where clause on first run (no lastRunTimestamp)', () => {
    expect(service.buildWhereClause('SECOP_I')).toBeUndefined();
  });

  it('updates lastRunTimestamp after successful ingest', async () => {
    sodaClientService.paginateDataset.mockResolvedValueOnce([{ numero_de_constancia: 'C-001' }]);

    await service.fetchAndIngest('f789-7hwg', 'SECOP_I');

    const state = (service as any).failureState.get('SECOP_I');
    expect(state.lastRunTimestamp).not.toBeNull();
    expect(typeof state.lastRunTimestamp).toBe('string');
  });

  it('triggers runIngestionCycle on bootstrap without blocking', async () => {
    const spy = jest.spyOn(service, 'runIngestionCycle').mockResolvedValue(undefined);

    service.onApplicationBootstrap();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('logs error if bootstrap cycle fails without crashing', async () => {
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn(service, 'runIngestionCycle').mockRejectedValueOnce(new Error('bootstrap fail'));

    service.onApplicationBootstrap();
    await new Promise((r) => setTimeout(r, 10));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap ingestion cycle failed'),
    );
  });
});
