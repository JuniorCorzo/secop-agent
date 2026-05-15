import 'reflect-metadata';
import { ProcurementNotice } from '../src/modules/procurement-notices/entities/procurement-notice.entity';
import {
  IngestionJob,
  IngestionJobStatus,
} from '../src/modules/procurement-notices/entities/ingestion-job.entity';

describe('IngestionJob entity', () => {
  it('exposes expected ingestion job statuses', () => {
    expect(IngestionJobStatus).toEqual({
      ACCEPTED: 'ACCEPTED',
      PROCESSING: 'PROCESSING',
      COMPLETED: 'COMPLETED',
      PARTIAL: 'PARTIAL',
      FAILED: 'FAILED',
    });
  });

  it('defines ingestion job defaults and table name', () => {
    const metadata = Reflect.getMetadata('design:type', IngestionJob.prototype, 'status');

    expect(metadata).toBe(String);
    expect(new IngestionJob()).toMatchObject({
      createdCount: 0,
      updatedCount: 0,
      failedCount: 0,
    });
  });

  it('adds rawData field to procurement notice entity', () => {
    const metadata = Reflect.getMetadata('design:type', ProcurementNotice.prototype, 'rawData');
    expect(metadata).toBe(Object);
  });
});
