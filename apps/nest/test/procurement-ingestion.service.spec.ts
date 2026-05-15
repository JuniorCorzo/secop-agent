import { ProcurementIngestionService } from '../src/modules/procurement-notices/services/ingestion.service';
import { IngestionJob, IngestionJobStatus } from '../src/modules/procurement-notices/entities/ingestion-job.entity';

describe('ProcurementIngestionService', () => {
  let service: ProcurementIngestionService;
  let producer: jest.Mocked<any>;
  let repository: jest.Mocked<any>;

  beforeEach(() => {
    producer = {
      add: jest.fn().mockResolvedValue({ id: 'bullmq-123' }),
    };

    repository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (entity) => ({ id: 'ingestion-job-123', ...entity })),
    };

    service = new ProcurementIngestionService(producer, repository);
  });

  it('creates ACCEPTED ingestion job before enqueueing work', async () => {
    const dto = {
      records: [
        { secopId: 'SECOP-001', title: 'Notice 1' },
        { secopId: 'SECOP-002', title: 'Notice 2' },
      ],
    } as any;

    await service.enqueueBulkIngestion(dto);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: IngestionJobStatus.ACCEPTED,
        secopId: null,
        createdCount: 0,
        updatedCount: 0,
        failedCount: 0,
        errors: [],
      }),
    );
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(producer.add).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestionJobId: 'ingestion-job-123',
        records: dto.records,
      }),
    );
  });

  it('returns persisted ingestion job id instead of BullMQ id', async () => {
    const result = await service.enqueueBulkIngestion({ records: [] } as any);

    expect(result).toEqual({ jobId: 'ingestion-job-123' });
  });
});
