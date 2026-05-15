import { of, throwError } from 'rxjs';
import { SodaClientService } from '../src/modules/soda-ingestion/services/soda-client.service';

describe('SodaClientService', () => {
  const configService = {
    get: jest.fn((key: string) =>
      ({
        SODA_API_URL: 'https://www.datos.gov.co',
        SODA_APP_TOKEN: 'token-123',
        SODA_DATASET_SECOP1: 'f789-7hwg',
        SODA_DATASET_SECOP2: 'p6dx-8zbt',
        SODA_PAGE_SIZE: 2,
        SODA_CRON: '0 */6 * * *',
      })[key],
    ),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds dataset query URL', () => {
    const service = new SodaClientService({ get: jest.fn() } as any, configService);
    expect(service.buildUrl('f789-7hwg')).toBe(
      'https://www.datos.gov.co/api/v3/views/f789-7hwg/query.json',
    );
  });

  it('fetches page with X-App-Token header', async () => {
    const httpService = {
      get: jest.fn().mockReturnValue(of({ data: [{ id: 1 }] })),
    } as any;
    const service = new SodaClientService(httpService, configService);

    const page = await service.fetchPage('f789-7hwg', 0, 2, 'id > 1');

    expect(page).toEqual([{ id: 1 }]);
    expect(httpService.get).toHaveBeenCalledWith(
      expect.stringContaining('%24where=id+%3E+1'),
      expect.objectContaining({
        headers: { 'X-App-Token': 'token-123' },
        timeout: 30000,
      }),
    );
  });

  it('retries failed requests and eventually succeeds', async () => {
    jest.useFakeTimers();
    const httpService = {
      get: jest
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('network')))
        .mockReturnValueOnce(throwError(() => new Error('network')))
        .mockReturnValueOnce(of({ data: [{ id: 2 }] })),
    } as any;
    const service = new SodaClientService(httpService, configService);

    const promise = service.fetchPage('f789-7hwg', 0, 2);
    await jest.advanceTimersByTimeAsync(3000);
    const page = await promise;

    expect(page).toEqual([{ id: 2 }]);
    expect(httpService.get).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('paginates until page length is smaller than page size', async () => {
    const service = new SodaClientService({ get: jest.fn() } as any, configService);
    const fetchPageSpy = jest
      .spyOn(service, 'fetchPage')
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }] as any)
      .mockResolvedValueOnce([{ id: 3 }] as any);

    const results = await service.paginateDataset('f789-7hwg');

    expect(results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchPageSpy).toHaveBeenNthCalledWith(1, 'f789-7hwg', 0, 2, undefined);
    expect(fetchPageSpy).toHaveBeenNthCalledWith(2, 'f789-7hwg', 2, 2, undefined);
  });

  it('throws after exhausting all 3 retries', async () => {
    jest.useFakeTimers();
    const httpService = {
      get: jest
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('fail 1')))
        .mockReturnValueOnce(throwError(() => new Error('fail 2')))
        .mockReturnValueOnce(throwError(() => new Error('fail 3'))),
    } as any;
    const service = new SodaClientService(httpService, configService);

    const promise = service.fetchPage('f789-7hwg', 0, 2).catch((e) => e);
    await jest.advanceTimersByTimeAsync(8000);

    const result = await promise;
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('fail 3');
    expect(httpService.get).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('omits $where clause when no whereClause provided', async () => {
    const httpService = {
      get: jest.fn().mockReturnValue(of({ data: [] })),
    } as any;
    const service = new SodaClientService(httpService, configService);

    await service.fetchPage('f789-7hwg', 0, 2);

    const calledUrl: string = httpService.get.mock.calls[0][0];
    expect(calledUrl).not.toContain('%24where');
  });
});
