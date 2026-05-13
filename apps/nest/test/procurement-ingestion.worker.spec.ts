import { Job } from 'bullmq';
import { ProcurementIngestionWorker, IngestionJobResult } from '../src/modules/queues/workers/procurement-ingestion.worker';

describe('ProcurementIngestionWorker', () => {
  let worker: ProcurementIngestionWorker;
  let repository: jest.Mocked<any>;

  beforeEach(() => {
    repository = {
      find: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(undefined),
    };

    worker = new ProcurementIngestionWorker(repository);
  });

  function makeJob(records: Array<{ secopId: string; title: string }>): Job<any> {
    return {
      id: 'job-123',
      data: { records },
    } as Job;
  }

  function makeRecords(count: number): Array<{ secopId: string; title: string }> {
    return Array.from({ length: count }, (_, i) => ({
      secopId: `SECOP-${i}`,
      title: `Notice ${i}`,
    }));
  }

  describe('chunking', () => {
    it('processes 150 records in 3 chunks of 50', async () => {
      const records = makeRecords(150);
      const job = makeJob(records);

      const result = await worker.process(job);

      expect(repository.upsert).toHaveBeenCalledTimes(3);
      expect(repository.upsert).toHaveBeenNthCalledWith(
        1,
        expect.arrayContaining([expect.objectContaining({ secopId: 'SECOP-0' })]),
        ['secopId'],
      );
      expect(repository.upsert).toHaveBeenNthCalledWith(
        2,
        expect.arrayContaining([expect.objectContaining({ secopId: 'SECOP-50' })]),
        ['secopId'],
      );
      expect(repository.upsert).toHaveBeenNthCalledWith(
        3,
        expect.arrayContaining([expect.objectContaining({ secopId: 'SECOP-100' })]),
        ['secopId'],
      );
      expect(result.created).toBe(150);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('processes a single record in one chunk', async () => {
      const records = makeRecords(1);
      const job = makeJob(records);

      await worker.process(job);

      expect(repository.upsert).toHaveBeenCalledTimes(1);
      expect(repository.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ secopId: 'SECOP-0' })]),
        ['secopId'],
      );
    });

    it('processes 50 records in exactly one chunk', async () => {
      const records = makeRecords(50);
      const job = makeJob(records);

      await worker.process(job);

      expect(repository.upsert).toHaveBeenCalledTimes(1);
      expect(repository.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ secopId: 'SECOP-49' })]),
        ['secopId'],
      );
    });

    it('processes 51 records in two chunks (50 + 1)', async () => {
      const records = makeRecords(51);
      const job = makeJob(records);

      await worker.process(job);

      expect(repository.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('deduplication', () => {
    it('keeps the last occurrence when duplicate secopIds exist', async () => {
      const records = [
        { secopId: 'SECOP-DUP', title: 'First' },
        { secopId: 'SECOP-DUP', title: 'Second' },
        { secopId: 'SECOP-UNIQUE', title: 'Unique' },
      ];
      const job = makeJob(records);

      const result = await worker.process(job);

      expect(repository.upsert).toHaveBeenCalledTimes(1);
      expect(repository.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ secopId: 'SECOP-DUP', title: 'Second' }),
          expect.objectContaining({ secopId: 'SECOP-UNIQUE', title: 'Unique' }),
        ]),
        ['secopId'],
      );
      expect(result.created).toBe(2);
    });
  });

  describe('created vs updated counts', () => {
    it('counts existing records as updated', async () => {
      repository.find.mockResolvedValue([
        { secopId: 'SECOP-0' },
        { secopId: 'SECOP-2' },
      ]);

      const records = makeRecords(5);
      const job = makeJob(records);

      const result = await worker.process(job);

      expect(result.updated).toBe(2);
      expect(result.created).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('counts all new records as created when none exist', async () => {
      repository.find.mockResolvedValue([]);

      const records = makeRecords(10);
      const job = makeJob(records);

      const result = await worker.process(job);

      expect(result.created).toBe(10);
      expect(result.updated).toBe(0);
    });

    it('counts all existing records as updated', async () => {
      repository.find.mockResolvedValue([
        { secopId: 'SECOP-0' },
        { secopId: 'SECOP-1' },
      ]);

      const records = makeRecords(2);
      const job = makeJob(records);

      const result = await worker.process(job);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(2);
    });
  });

  describe('error handling', () => {
    it('marks chunk as failed when upsert throws', async () => {
      repository.upsert.mockRejectedValueOnce(new Error('DB timeout')).mockResolvedValue(undefined);

      const records = makeRecords(55); // 2 chunks: 50 + 5
      const job = makeJob(records);

      const result = await worker.process(job);

      expect(repository.upsert).toHaveBeenCalledTimes(2);
      expect(result.failed).toBe(50);
      expect(result.created).toBe(5);
      expect(result.errors).toHaveLength(50);
      expect(result.errors[0]).toEqual({ secopId: 'SECOP-0', reason: 'DB timeout' });
    });

    it('continues processing remaining chunks after one fails', async () => {
      repository.upsert
        .mockResolvedValueOnce(undefined) // chunk 1 (0-49)
        .mockRejectedValueOnce(new Error('DB error')) // chunk 2 (50-99)
        .mockResolvedValueOnce(undefined); // chunk 3 (100-149)

      const records = makeRecords(150);
      const job = makeJob(records);

      const result = await worker.process(job);

      expect(repository.upsert).toHaveBeenCalledTimes(3);
      expect(result.created).toBe(100); // 50 + 0 + 50
      expect(result.failed).toBe(50);
      expect(result.errors).toHaveLength(50);
    });

    it('returns all failed when every chunk errors', async () => {
      repository.upsert.mockRejectedValue(new Error('Total failure'));

      const records = makeRecords(100);
      const job = makeJob(records);

      const result = await worker.process(job);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(100);
      expect(result.errors).toHaveLength(100);
    });

    it('handles empty records gracefully', async () => {
      const job = makeJob([]);
      const result = await worker.process(job);

      // When no records, find is skipped and upsert is never called
      expect(repository.find).not.toHaveBeenCalled();
      expect(repository.upsert).not.toHaveBeenCalled();
      expect(result).toEqual({ created: 0, updated: 0, failed: 0, errors: [] });
    });
  });

  describe('event handlers', () => {
    it('has onCompleted handler', () => {
      const loggerSpy = jest.spyOn((worker as any).logger, 'log').mockImplementation(() => {});
      const job = { id: 'job-99' } as Job;
      worker.onCompleted(job);
      expect(loggerSpy).toHaveBeenCalledWith('Procurement ingestion job job-99 completed');
      loggerSpy.mockRestore();
    });

    it('has onFailed handler', () => {
      const loggerSpy = jest.spyOn((worker as any).logger, 'error').mockImplementation(() => {});
      const job = { id: 'job-99' } as Job;
      worker.onFailed(job, new Error('boom'));
      expect(loggerSpy).toHaveBeenCalledWith('Procurement ingestion job job-99 failed: boom');
      loggerSpy.mockRestore();
    });
  });
});
