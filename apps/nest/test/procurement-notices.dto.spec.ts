import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProcurementNoticeDto } from '../src/modules/procurement-notices/dto/create-procurement-notice.dto';
import { UpdateProcurementNoticeDto } from '../src/modules/procurement-notices/dto/update-procurement-notice.dto';
import { BulkIngestionDto } from '../src/modules/procurement-notices/dto/bulk-ingestion.dto';
import { SearchProcurementNoticeDto } from '../src/modules/procurement-notices/dto/search-procurement-notice.dto';
import { LifecycleTransitionDto } from '../src/modules/procurement-notices/dto/lifecycle-transition.dto';

function createValidRecord(): CreateProcurementNoticeDto {
  return {
    secopId: 'SECOP-123',
    title: 'Test Notice',
    description: 'A description',
    status: 'PENDING',
    entityName: 'Test Entity',
    contactInfo: 'contact@test.com',
    value: 1000000,
    currency: 'COP',
    publicationDate: '2024-01-01',
    deadlineDate: '2024-12-31',
    sector: 'Technology',
    location: 'Bogotá',
    sourceMetadata: { rawId: 'raw-1' },
  };
}

describe('CreateProcurementNoticeDto', () => {
  it('accepts a fully valid DTO', async () => {
    const dto = plainToInstance(CreateProcurementNoticeDto, createValidRecord());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts minimal valid DTO (only required fields)', async () => {
    const dto = plainToInstance(CreateProcurementNoticeDto, {
      secopId: 'SECOP-001',
      title: 'Minimal',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing secopId', async () => {
    const dto = plainToInstance(CreateProcurementNoticeDto, {
      title: 'Missing ID',
    } as CreateProcurementNoticeDto);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'secopId')).toBe(true);
  });

  it('rejects empty secopId', async () => {
    const dto = plainToInstance(CreateProcurementNoticeDto, {
      secopId: '',
      title: 'Empty ID',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'secopId')).toBe(true);
  });

  it('rejects secopId longer than 64 chars', async () => {
    const dto = plainToInstance(CreateProcurementNoticeDto, {
      secopId: 'A'.repeat(65),
      title: 'Long ID',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'secopId')).toBe(true);
  });

  it('rejects missing title', async () => {
    const dto = plainToInstance(CreateProcurementNoticeDto, {
      secopId: 'SECOP-001',
    } as CreateProcurementNoticeDto);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects title longer than 512 chars', async () => {
    const dto = plainToInstance(CreateProcurementNoticeDto, {
      secopId: 'SECOP-001',
      title: 'T'.repeat(513),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects invalid date strings', async () => {
    const dto = plainToInstance(CreateProcurementNoticeDto, {
      secopId: 'SECOP-001',
      title: 'Bad Dates',
      publicationDate: 'not-a-date',
      deadlineDate: 'also-bad',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'publicationDate')).toBe(true);
    expect(errors.some((e) => e.property === 'deadlineDate')).toBe(true);
  });

  it('rejects currency longer than 8 chars', async () => {
    const dto = plainToInstance(CreateProcurementNoticeDto, {
      secopId: 'SECOP-001',
      title: 'Currency',
      currency: 'TOOLONGGG',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'currency')).toBe(true);
  });

  it('rejects invalid status values', async () => {
    const dto = plainToInstance(CreateProcurementNoticeDto, {
      secopId: 'SECOP-001',
      title: 'Status',
      status: 'UNKNOWN',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});

describe('UpdateProcurementNoticeDto', () => {
  it('accepts partial updates', async () => {
    const dto = plainToInstance(UpdateProcurementNoticeDto, {
      title: 'Updated Title',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts empty payload', async () => {
    const dto = plainToInstance(UpdateProcurementNoticeDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid field values in partial update', async () => {
    const dto = plainToInstance(UpdateProcurementNoticeDto, {
      secopId: '',
      title: 'T'.repeat(513),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'secopId')).toBe(true);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });
});

describe('BulkIngestionDto', () => {
  it('accepts a valid batch of records', async () => {
    const dto = plainToInstance(BulkIngestionDto, {
      records: [createValidRecord(), createValidRecord()],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts empty records array', async () => {
    const dto = plainToInstance(BulkIngestionDto, { records: [] });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects more than 1000 records', async () => {
    const dto = plainToInstance(BulkIngestionDto, {
      records: Array.from({ length: 1001 }, (_, i) => ({
        ...createValidRecord(),
        secopId: `SECOP-${i}`,
      })),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'records')).toBe(true);
  });

  it('accepts exactly 1000 records', async () => {
    const dto = plainToInstance(BulkIngestionDto, {
      records: Array.from({ length: 1000 }, (_, i) => ({
        ...createValidRecord(),
        secopId: `SECOP-${i}`,
      })),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects non-array records', async () => {
    const dto = plainToInstance(BulkIngestionDto, {
      records: 'not-an-array',
    } as unknown as BulkIngestionDto);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'records')).toBe(true);
  });

  it('rejects records with invalid nested DTOs', async () => {
    const dto = plainToInstance(BulkIngestionDto, {
      records: [{ secopId: '', title: '' }],
    });
    const errors = await validate(dto);
    // The nested validation should surface errors on the records array
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('SearchProcurementNoticeDto', () => {
  it('accepts empty query (uses defaults)', async () => {
    const dto = plainToInstance(SearchProcurementNoticeDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('accepts valid filter fields', async () => {
    const dto = plainToInstance(SearchProcurementNoticeDto, {
      title: 'Software',
      secopId: 'SECOP-001',
      entityName: 'Ministry',
      status: 'PENDING',
      sector: 'IT',
      location: 'Bogotá',
      page: 2,
      limit: 50,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it('rejects page below 1', async () => {
    const dto = plainToInstance(SearchProcurementNoticeDto, { page: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limit below 1', async () => {
    const dto = plainToInstance(SearchProcurementNoticeDto, { limit: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects title longer than 512 chars', async () => {
    const dto = plainToInstance(SearchProcurementNoticeDto, {
      title: 'T'.repeat(513),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('accepts default ordering fields', async () => {
    const dto = plainToInstance(SearchProcurementNoticeDto, {
      sortBy: 'updatedAt',
      order: 'ASC',
      query: 'tech',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.sortBy).toBe('updatedAt');
    expect(dto.order).toBe('ASC');
  });
});

describe('LifecycleTransitionDto', () => {
  it('accepts valid target status', async () => {
    const dto = plainToInstance(LifecycleTransitionDto, { targetStatus: 'SCORING' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid target status', async () => {
    const dto = plainToInstance(LifecycleTransitionDto, { targetStatus: 'INVALID' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'targetStatus')).toBe(true);
  });
});
