import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProcurementNoticesController } from '../src/modules/procurement-notices/controllers/procurement-notices.controller';
import { ProcurementNoticesService } from '../src/modules/procurement-notices/services/procurement-notices.service';
import { ProcurementIngestionService } from '../src/modules/procurement-notices/services/ingestion.service';
import { ProcurementIngestionProducer } from '../src/modules/queues/producers/procurement-ingestion.producer';
import { QUEUE_NAMES } from '../src/modules/queues/constants/queue-names';
import { ProcurementNotice } from '../src/modules/procurement-notices/entities/procurement-notice.entity';
import { UserRole } from '../src/modules/auth/entities/user.entity';

describe('ProcurementNoticesController (E2E-style)', () => {
  let controller: ProcurementNoticesController;
  let service: jest.Mocked<ProcurementNoticesService>;
  let ingestionService: jest.Mocked<ProcurementIngestionService>;

  beforeEach(async () => {
    const addMock = jest.fn().mockResolvedValue({ id: 'job-123' });

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              REDIS_HOST: 'localhost',
              REDIS_PORT: 6379,
              REDIS_PASSWORD: '',
            }),
          ],
        }),
        BullModule.forRoot({
          connection: {
            host: 'localhost',
            port: 6379,
          },
        }),
      ],
      controllers: [ProcurementNoticesController],
      providers: [
        {
          provide: ProcurementNoticesService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findBySecopId: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            search: jest.fn(),
            findAll: jest.fn(),
            transitionLifecycle: jest.fn(),
          },
        },
        {
          provide: ProcurementIngestionService,
          useValue: {
            enqueueBulkIngestion: jest.fn(),
          },
        },
        {
          provide: ProcurementIngestionProducer,
          useValue: { add: addMock },
        },
      ],
    })
      .overrideProvider(getQueueToken(QUEUE_NAMES.PROCUREMENT_NOTICE_INGESTION))
      .useValue({ add: addMock })
      .overrideProvider(getRepositoryToken(ProcurementNotice))
      .useValue({
        find: jest.fn(),
        upsert: jest.fn(),
      })
      .compile();

    controller = moduleRef.get(ProcurementNoticesController);
    service = moduleRef.get(ProcurementNoticesService);
    ingestionService = moduleRef.get(ProcurementIngestionService);
  });

  describe('POST /procurement-notices', () => {
    it('creates a procurement notice', async () => {
      const dto = {
        secopId: 'SECOP-001',
        title: 'Test Notice',
      };
      const created = { id: 'uuid-1', ...dto } as ProcurementNotice;
      service.create.mockResolvedValue(created);

      const result = await controller.create(dto as any);
      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST /procurement-notices/bulk', () => {
    it('enqueues bulk ingestion and returns jobId', async () => {
      const dto = {
        records: [
          { secopId: 'SECOP-001', title: 'Notice 1' },
          { secopId: 'SECOP-002', title: 'Notice 2' },
        ],
      };
      ingestionService.enqueueBulkIngestion.mockResolvedValue({ jobId: 'job-123' });

      const result = await controller.bulkIngest(dto as any);
      expect(result).toEqual({ jobId: 'job-123' });
      expect(ingestionService.enqueueBulkIngestion).toHaveBeenCalledWith(dto);
    });
  });

  describe('GET /procurement-notices', () => {
    it('searches with filters and pagination', async () => {
      const dto = {
        title: 'Software',
        page: 1,
        limit: 10,
      };
      const searchResult = {
        data: [{ id: 'uuid-1', secopId: 'SECOP-001', title: 'Software License' }] as ProcurementNotice[],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      service.findAll.mockResolvedValue(searchResult as any);

      const result = await controller.search(dto as any);
      expect(result).toEqual(searchResult);
      expect(service.findAll).toHaveBeenCalledWith(dto);
    });
  });

  describe('GET /procurement-notices/:id', () => {
    it('returns a single notice', async () => {
      const entity = { id: 'uuid-1', secopId: 'SECOP-001', title: 'Found' } as ProcurementNotice;
      service.findOne.mockResolvedValue(entity);

      const result = await controller.findOne('uuid-1');
      expect(result).toEqual(entity);
      expect(service.findOne).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('PATCH /procurement-notices/:id', () => {
    it('updates a notice', async () => {
      const dto = { title: 'Updated' };
      const updated = { id: 'uuid-1', secopId: 'SECOP-001', title: 'Updated' } as ProcurementNotice;
      service.update.mockResolvedValue(updated);

      const result = await controller.update('uuid-1', dto as any);
      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith('uuid-1', dto);
    });
  });

  describe('DELETE /procurement-notices/:id', () => {
    it('removes a notice', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove('uuid-1');
      expect(service.remove).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('PATCH /procurement-notices/:id/lifecycle', () => {
    it('transitions lifecycle state', async () => {
      const dto = { targetStatus: 'ENRICHING' };
      const updated = { id: 'uuid-1', secopId: 'SECOP-001', status: 'ENRICHING' } as ProcurementNotice;
      service.transitionLifecycle.mockResolvedValue(updated as never);

      const result = await controller.transitionLifecycle('uuid-1', dto as any);
      expect(result).toEqual(updated);
      expect(service.transitionLifecycle).toHaveBeenCalledWith('uuid-1', 'ENRICHING');
    });
  });

  describe('guards', () => {
    it('controller is defined with all dependencies', () => {
      expect(controller).toBeDefined();
    });
  });
});
