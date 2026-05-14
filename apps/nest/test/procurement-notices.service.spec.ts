import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProcurementNoticesService } from '../src/modules/procurement-notices/services/procurement-notices.service';
import { ProcurementNotice } from '../src/modules/procurement-notices/entities/procurement-notice.entity';
import { CreateProcurementNoticeDto } from '../src/modules/procurement-notices/dto/create-procurement-notice.dto';
import { UpdateProcurementNoticeDto } from '../src/modules/procurement-notices/dto/update-procurement-notice.dto';
import { SearchProcurementNoticeDto } from '../src/modules/procurement-notices/dto/search-procurement-notice.dto';

describe('ProcurementNoticesService', () => {
  let service: ProcurementNoticesService;
  let repository: jest.Mocked<any>;

  beforeEach(() => {
      repository = {
        create: jest.fn((data) => data as ProcurementNotice),
        save: jest.fn(async (entity) => ({ ...entity, id: 'uuid-1', createdAt: new Date(), updatedAt: new Date() } as ProcurementNotice)),
        findOne: jest.fn(),
        find: jest.fn(),
        upsert: jest.fn(),
        merge: jest.fn((entity, update) => ({ ...entity, ...update })),
        softDelete: jest.fn(),
        remove: jest.fn(async () => undefined),
        createQueryBuilder: jest.fn(() => queryBuilderMock()),
      };

    service = new ProcurementNoticesService(repository);
  });

  function queryBuilderMock() {
    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    return qb;
  }

  function createDto(): CreateProcurementNoticeDto {
    return {
      secopId: 'SECOP-001',
      title: 'Test Notice',
      description: 'Desc',
      status: 'PENDING',
      entityName: 'Entity',
      contactInfo: 'contact@test.com',
      value: 500000,
      currency: 'COP',
      publicationDate: '2024-01-15',
      deadlineDate: '2024-06-30',
      sector: 'IT',
      location: 'Bogotá',
      sourceMetadata: { raw: true },
    };
  }

  describe('create', () => {
    it('creates and saves an entity with date conversion', async () => {
      const dto = createDto();
      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          secopId: 'SECOP-001',
          title: 'Test Notice',
          publicationDate: new Date('2024-01-15'),
          deadlineDate: new Date('2024-06-30'),
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(result.id).toBe('uuid-1');
    });

    it('handles undefined dates', async () => {
      const dto = { ...createDto(), publicationDate: undefined, deadlineDate: undefined };
      await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          publicationDate: undefined,
          deadlineDate: undefined,
        }),
      );
    });

    it('rejects duplicate secopId as ConflictException', async () => {
      repository.save.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));

      await expect(service.create(createDto())).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOne', () => {
    it('returns the entity when found', async () => {
      const entity = { id: 'uuid-1', secopId: 'SECOP-001', title: 'Found' } as ProcurementNotice;
      repository.findOne.mockResolvedValue(entity);

      const result = await service.findOne('uuid-1');
      expect(result).toEqual(entity);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
    });

    it('throws NotFoundException when not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing-uuid')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates entity with date conversion', async () => {
      const existing = { id: 'uuid-1', secopId: 'SECOP-001', title: 'Old', publicationDate: new Date('2024-01-01'), deadlineDate: new Date('2024-02-01') } as ProcurementNotice;
      repository.findOne.mockResolvedValue(existing);

      const dto: UpdateProcurementNoticeDto = { title: 'New', publicationDate: '2024-03-01' };
      repository.merge.mockReturnValue({ ...existing, ...dto, publicationDate: new Date('2024-03-01') });

      await service.update('uuid-1', dto);

      expect(repository.merge).toHaveBeenCalledWith(
        existing,
        expect.objectContaining({
          title: 'New',
          publicationDate: new Date('2024-03-01'),
        }),
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('preserves existing dates when not provided', async () => {
      const existing = { id: 'uuid-1', secopId: 'SECOP-001', title: 'Old', publicationDate: new Date('2024-01-01'), deadlineDate: new Date('2024-02-01') } as ProcurementNotice;
      repository.findOne.mockResolvedValue(existing);

      const dto: UpdateProcurementNoticeDto = { title: 'New' };
      repository.merge.mockReturnValue({ ...existing, title: 'New' });

      await service.update('uuid-1', dto);

      expect(repository.merge).toHaveBeenCalledWith(
        existing,
        expect.objectContaining({
          title: 'New',
          publicationDate: existing.publicationDate,
          deadlineDate: existing.deadlineDate,
        }),
      );
    });

    it('throws NotFoundException when entity missing', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { title: 'New' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the entity via softDelete', async () => {
      repository.softDelete.mockResolvedValue({ affected: 1 });

      await service.remove('uuid-1');
      expect(repository.softDelete).toHaveBeenCalledWith('uuid-1');
    });

    it('throws NotFoundException when entity missing', async () => {
      repository.softDelete.mockResolvedValue({ affected: 0 });

      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findBySecopId', () => {
    it('returns the entity when found', async () => {
      const entity = { id: 'uuid-1', secopId: 'SECOP-001', title: 'Found' } as ProcurementNotice;
      repository.findOne.mockResolvedValue(entity);

      const result = await service.findBySecopId('SECOP-001');
      expect(result).toEqual(entity);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { secopId: 'SECOP-001' } });
    });

    it('throws NotFoundException when not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findBySecopId('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('search', () => {
    it('returns paginated results with meta', async () => {
      const data = [{ id: 'uuid-1', secopId: 'SECOP-001' }] as ProcurementNotice[];
      const qb = queryBuilderMock();
      qb.getManyAndCount.mockResolvedValue([data, 1]);
      repository.createQueryBuilder.mockReturnValue(qb);

      const dto: SearchProcurementNoticeDto = { page: 1, limit: 10 };
      const result = await service.search(dto);

      expect(result.data).toEqual(data);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('applies title filter with ILIKE', async () => {
      const qb = queryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(qb);

      await service.search({ title: 'Software' });

      expect(qb.andWhere).toHaveBeenCalledWith('notice.title ILIKE :title', { title: '%Software%' });
    });

    it('applies secopId filter with exact match', async () => {
      const qb = queryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(qb);

      await service.search({ secopId: 'SECOP-001' });

      expect(qb.andWhere).toHaveBeenCalledWith('notice.secopId = :secopId', { secopId: 'SECOP-001' });
    });

    it('applies entityName, status, sector, location filters', async () => {
      const qb = queryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(qb);

      await service.search({ entityName: 'Ministry', status: 'PENDING', sector: 'IT', location: 'Bogotá' });

      expect(qb.andWhere).toHaveBeenCalledWith('notice.entityName ILIKE :entityName', { entityName: '%Ministry%' });
      expect(qb.andWhere).toHaveBeenCalledWith('notice.status = :status', { status: 'PENDING' });
      expect(qb.andWhere).toHaveBeenCalledWith('notice.sector ILIKE :sector', { sector: '%IT%' });
      expect(qb.andWhere).toHaveBeenCalledWith('notice.location ILIKE :location', { location: '%Bogotá%' });
    });

    it('returns empty page with correct meta when no results', async () => {
      const qb = queryBuilderMock();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.search({ page: 2, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ page: 2, limit: 20, total: 0, totalPages: 0 });
      expect(qb.skip).toHaveBeenCalledWith(20);
    });

    it('defaults page and limit when omitted', async () => {
      const qb = queryBuilderMock();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(qb);

      await service.search({});

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('orders by createdAt DESC', async () => {
      const qb = queryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(qb);

      await service.search({});

      expect(qb.orderBy).toHaveBeenCalledWith('notice.createdAt', 'DESC');
    });

    it('applies generic text query across searchable fields and custom ordering', async () => {
      const qb = queryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(qb);

      await service.search({ query: 'tech', sortBy: 'publicationDate', order: 'ASC' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('notice.title ILIKE :query'),
        { query: '%tech%' },
      );
      expect(qb.orderBy).toHaveBeenCalledWith('notice.publicationDate', 'ASC');
    });
  });

  describe('transitionLifecycle', () => {
    it('advances lifecycle when transition is valid', async () => {
      const existing = { id: 'uuid-1', secopId: 'SECOP-001', title: 'Old', status: 'PENDING' } as ProcurementNotice;
      repository.findOne.mockResolvedValue(existing);

      await service.transitionLifecycle('uuid-1', 'ENRICHING');

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'ENRICHING' }));
    });

    it('rejects invalid transition', async () => {
      const existing = { id: 'uuid-1', secopId: 'SECOP-001', title: 'Old', status: 'PENDING' } as ProcurementNotice;
      repository.findOne.mockResolvedValue(existing);

      await expect(service.transitionLifecycle('uuid-1', 'AWARDED')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('bulkIngest', () => {
    it('creates new records and counts correctly', async () => {
      repository.find.mockResolvedValue([]);
      repository.upsert.mockResolvedValue({ identifiers: [{ id: 'uuid-1' }, { id: 'uuid-2' }] });

      const records = [
        { secopId: 'SECOP-001', title: 'Notice 1' },
        { secopId: 'SECOP-002', title: 'Notice 2' },
      ] as CreateProcurementNoticeDto[];

      const result = await service.bulkIngest(records);

      expect(result.created).toBe(2);
      expect(result.duplicates).toBe(0);
      expect(result.invalid).toBe(0);
      expect(repository.upsert).toHaveBeenCalled();
    });

    it('deduplicates records with same secopId within the batch', async () => {
      repository.find.mockResolvedValue([]);
      repository.upsert.mockResolvedValue({ identifiers: [{ id: 'uuid-1' }] });

      const records = [
        { secopId: 'SECOP-001', title: 'Notice 1' },
        { secopId: 'SECOP-001', title: 'Notice 1 Duplicate' },
      ] as CreateProcurementNoticeDto[];

      const result = await service.bulkIngest(records);

      expect(result.created).toBe(1);
      expect(result.duplicates).toBe(1);
      expect(result.invalid).toBe(0);
    });

    it('counts already-existing records as duplicates', async () => {
      repository.find.mockResolvedValue([{ secopId: 'SECOP-001' } as ProcurementNotice]);
      repository.upsert.mockResolvedValue({ identifiers: [{ id: 'uuid-2' }] });

      const records = [
        { secopId: 'SECOP-001', title: 'Already Exists' },
        { secopId: 'SECOP-002', title: 'New Notice' },
      ] as CreateProcurementNoticeDto[];

      const result = await service.bulkIngest(records);

      expect(result.created).toBe(1);
      expect(result.duplicates).toBe(1);
      expect(result.invalid).toBe(0);
    });

    it('reports invalid records missing secopId or title', async () => {
      repository.find.mockResolvedValue([]);
      repository.upsert.mockResolvedValue({ identifiers: [] });

      const records = [
        { secopId: '', title: 'No Secop' },
        { secopId: 'SECOP-001', title: '' },
        { secopId: 'SECOP-002', title: 'Valid Notice' },
      ] as CreateProcurementNoticeDto[];

      const result = await service.bulkIngest(records);

      expect(result.created).toBe(1);
      expect(result.duplicates).toBe(0);
      expect(result.invalid).toBe(2);
    });
  });
});
