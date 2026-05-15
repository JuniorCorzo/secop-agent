import { SodaIngestionService } from '../src/modules/soda-ingestion/services/soda-ingestion.service';

describe('Soda Ingestion Integration', () => {
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

  it('processes both datasets and persists mapped records', async () => {
    const sodaClientService = {
      paginateDataset: jest
        .fn()
        .mockResolvedValueOnce([{ numero_de_constancia: 'C-001', objeto_a_contratar: 'Contrato 1' }])
        .mockResolvedValueOnce([{ id_del_proceso: 'P-001', nombre_del_procedimiento: 'Proceso 1' }]),
    };
    const procurementNoticesService = { bulkUpsert: jest.fn().mockResolvedValue(undefined) };
    const service = new SodaIngestionService(
      configService,
      sodaClientService as any,
      procurementNoticesService as any,
    );

    await service.runIngestionCycle();

    expect(procurementNoticesService.bulkUpsert).toHaveBeenCalledTimes(2);
    expect(procurementNoticesService.bulkUpsert).toHaveBeenNthCalledWith(
      1,
      [expect.objectContaining({ secopId: 'C-001', source: 'SECOP_I' })],
    );
    expect(procurementNoticesService.bulkUpsert).toHaveBeenNthCalledWith(
      2,
      [expect.objectContaining({ secopId: 'P-001', source: 'SECOP_II' })],
    );
  });
});
