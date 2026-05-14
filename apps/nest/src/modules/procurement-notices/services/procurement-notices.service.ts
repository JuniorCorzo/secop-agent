import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProcurementNotice } from '../entities/procurement-notice.entity';
import { CreateProcurementNoticeDto } from '../dto/create-procurement-notice.dto';
import { UpdateProcurementNoticeDto } from '../dto/update-procurement-notice.dto';
import { SearchProcurementNoticeDto } from '../dto/search-procurement-notice.dto';
import {
  ProcurementNoticeSortBy,
  ProcurementNoticeSortOrder,
  ProcurementNoticeStatus,
  canTransitionProcurementNoticeStatus,
  isProcurementNoticeStatus,
} from '../procurement-notice.types';

/** Pagination metadata returned with every search response. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Wraps search results with pagination metadata. */
export interface SearchResult {
  data: ProcurementNotice[];
  meta: PaginationMeta;
}

/**
 * Summary of a bulk ingest operation.
 *
 * - `created`: records that were newly persisted.
 * - `duplicates`: records skipped — either within-batch duplicates or already in the DB.
 * - `invalid`: records missing required fields (`secopId` or `title`).
 */
export interface BulkIngestResult {
  created: number;
  duplicates: number;
  invalid: number;
}

const DEFAULT_STATUS: ProcurementNoticeStatus = 'PENDING';

/**
 * Core service for procurement notice CRUD, search, lifecycle, and bulk ingestion.
 *
 * Uses constructor-injected {@link Repository} and throws NestJS HTTP exceptions
 * from the service layer so controllers stay thin.
 *
 * @see procnotices-spec - All requirements
 */
@Injectable()
export class ProcurementNoticesService {
  constructor(
    @InjectRepository(ProcurementNotice)
    private readonly repository: Repository<ProcurementNotice>,
  ) {}

  /**
   * Creates a single procurement notice.
   *
   * Dates are converted from ISO strings to `Date`. Defaults `status` to `PENDING`.
   *
   * @throws {ConflictException} If a notice with the same `secopId` already exists.
   *
   * @see procnotices-spec - Persisted Procurement Notice Record
   */
  async create(dto: CreateProcurementNoticeDto): Promise<ProcurementNotice> {
    const entity = this.repository.create({
      ...dto,
      status: dto.status ?? DEFAULT_STATUS,
      publicationDate: dto.publicationDate ? new Date(dto.publicationDate) : undefined,
      deadlineDate: dto.deadlineDate ? new Date(dto.deadlineDate) : undefined,
    });

    try {
      return await this.repository.save(entity);
    } catch (error: unknown) {
      this.throwConflictIfDuplicate(error);
      throw error;
    }
  }

  /**
   * Finds a procurement notice by internal UUID.
   *
   * @throws {NotFoundException} If no non-deleted record matches the ID.
   */
  async findOne(id: string): Promise<ProcurementNotice> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Procurement notice not found');
    }
    return entity;
  }

  /**
   * Finds a procurement notice by its stable SECOP identifier.
   *
   * @throws {NotFoundException} If no record matches the `secopId`.
   */
  async findBySecopId(secopId: string): Promise<ProcurementNotice> {
    const entity = await this.repository.findOne({ where: { secopId } });
    if (!entity) {
      throw new NotFoundException('Procurement notice not found');
    }
    return entity;
  }

  /**
   * Partially updates a procurement notice.
   *
   * Only provided fields are merged. If `status` is included, the transition
   * is validated via {@link canTransitionProcurementNoticeStatus}.
   *
   * @throws {NotFoundException} If the record doesn't exist.
   * @throws {BadRequestException} If the status transition is invalid.
   *
   * @see procnotices-spec - CRUD Access
   */
  async update(id: string, dto: UpdateProcurementNoticeDto): Promise<ProcurementNotice> {
    const entity = await this.findOne(id);

    if (dto.status && !canTransitionProcurementNoticeStatus(entity.status, dto.status)) {
      throw new BadRequestException(
        `Cannot transition procurement notice from ${entity.status ?? 'PENDING'} to ${dto.status}`,
      );
    }

    const updated = this.repository.merge(entity, {
      ...dto,
      status: dto.status ?? entity.status ?? DEFAULT_STATUS,
      publicationDate: dto.publicationDate ? new Date(dto.publicationDate) : entity.publicationDate,
      deadlineDate: dto.deadlineDate ? new Date(dto.deadlineDate) : entity.deadlineDate,
    });
    return this.repository.save(updated);
  }

  /**
   * Soft-deletes a procurement notice. Sets `deletedAt` without removing the row.
   *
   * @throws {NotFoundException} If the record doesn't exist or is already deleted.
   */
  async remove(id: string): Promise<void> {
    const result = await this.repository.softDelete(id);
    if (!result.affected) {
      throw new NotFoundException('Procurement notice not found');
    }
  }

  /**
   * Searches and lists procurement notices — delegates to {@link findAll}.
   *
   * @deprecated Use {@link findAll} directly. Kept for backward compatibility.
   */
  async search(dto: SearchProcurementNoticeDto): Promise<SearchResult> {
    return this.findAll(dto);
  }

  /**
   * Lists procurement notices with optional filters, text search, ordering, and pagination.
   *
   * Uses `createQueryBuilder` with conditional `andWhere` clauses to avoid N+1.
   * Sort columns are mapped through a static `COLUMN_MAP` to prevent SQL injection.
   *
   * @param dto - Validated search parameters.
   * @returns Paginated results with metadata.
   *
   * @see procnotices-spec - Search and Pagination
   */
  async findAll(dto: SearchProcurementNoticeDto): Promise<SearchResult> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortBy = dto.sortBy ?? 'createdAt';
    const order = dto.order ?? 'DESC';

    // Static column map prevents SQL injection through dynamic column names
    const COLUMN_MAP: Record<ProcurementNoticeSortBy, string> = {
      createdAt: 'notice.createdAt',
      updatedAt: 'notice.updatedAt',
      publicationDate: 'notice.publicationDate',
      deadlineDate: 'notice.deadlineDate',
      title: 'notice.title',
      status: 'notice.status',
    };
    const sortColumn = COLUMN_MAP[sortBy as ProcurementNoticeSortBy] ?? COLUMN_MAP.createdAt;

    const qb = this.repository.createQueryBuilder('notice');

    if (dto.query) {
      qb.andWhere(
        '(notice.title ILIKE :query OR notice.secopId ILIKE :query OR notice.entityName ILIKE :query OR notice.sector ILIKE :query OR notice.location ILIKE :query)',
        { query: `%${dto.query}%` },
      );
    }

    if (dto.title) {
      qb.andWhere('notice.title ILIKE :title', { title: `%${dto.title}%` });
    }

    if (dto.secopId) {
      qb.andWhere('notice.secopId = :secopId', { secopId: dto.secopId });
    }

    if (dto.entityName) {
      qb.andWhere('notice.entityName ILIKE :entityName', { entityName: `%${dto.entityName}%` });
    }

    if (dto.status) {
      qb.andWhere('notice.status = :status', { status: dto.status });
    }

    if (dto.sector) {
      qb.andWhere('notice.sector ILIKE :sector', { sector: `%${dto.sector}%` });
    }

    if (dto.location) {
      qb.andWhere('notice.location ILIKE :location', { location: `%${dto.location}%` });
    }

    const [data, total] = await qb
      .orderBy(sortColumn, order as ProcurementNoticeSortOrder)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Advances a procurement notice to a new lifecycle state.
   *
   * Validates the transition against {@link canTransitionProcurementNoticeStatus}.
   * Self-transitions and invalid paths are rejected.
   *
   * @param id - Internal UUID of the notice.
   * @param targetStatus - Desired target lifecycle state.
   * @throws {NotFoundException} If the notice doesn't exist.
   * @throws {BadRequestException} If the transition is not allowed.
   *
   * @see procnotices-spec - Lifecycle Progression
   */
  async transitionLifecycle(
    id: string,
    targetStatus: ProcurementNoticeStatus,
  ): Promise<ProcurementNotice> {
    const entity = await this.findOne(id);
    const currentStatus = isProcurementNoticeStatus(entity.status) ? entity.status : DEFAULT_STATUS;

    if (!canTransitionProcurementNoticeStatus(currentStatus, targetStatus)) {
      throw new BadRequestException(
        `Cannot transition procurement notice from ${currentStatus} to ${targetStatus}`,
      );
    }

    entity.status = targetStatus;
    return this.repository.save(entity);
  }

  /**
   * Ingests a batch of procurement notices, handling deduplication and validation.
   *
   * Processing steps:
   * 1. Deduplicate within the batch by `secopId` (first occurrence wins).
   * 2. Filter out invalid records (missing `secopId` or `title`).
   * 3. Query existing `secopId` values from the DB to avoid re-insertion.
   * 4. Upsert remaining records in chunks of 50 using `repository.upsert`.
   *
   * @returns Summary with `created`, `duplicates`, and `invalid` counts.
   *
   * @see procnotices-spec - Duplicate-safe Bulk Ingest
   */
  async bulkIngest(records: CreateProcurementNoticeDto[]): Promise<BulkIngestResult> {
    const deduplicated = new Map<string, CreateProcurementNoticeDto>();
    let duplicates = 0;

    for (const record of records) {
      if (deduplicated.has(record.secopId)) {
        duplicates++;
      }
      deduplicated.set(record.secopId, record);
    }

    const uniqueRecords = Array.from(deduplicated.values());

    // Filter invalid records before DB operations
    const validRecords = uniqueRecords.filter(
      (record) => record.secopId && record.title,
    );
    const invalidCount = uniqueRecords.length - validRecords.length;

    const existingEntities =
      validRecords.length > 0
        ? await this.repository.find({
            where: validRecords.map((record) => ({ secopId: record.secopId })),
            select: ['secopId'],
          })
        : [];
    const existingSet = new Set(existingEntities.map((entity) => entity.secopId));

    const entities = validRecords.map((dto) => ({
      ...dto,
      status: dto.status ?? DEFAULT_STATUS,
      publicationDate: dto.publicationDate ? new Date(dto.publicationDate) : null,
      deadlineDate: dto.deadlineDate ? new Date(dto.deadlineDate) : null,
      description: dto.description ?? null,
      entityName: dto.entityName ?? null,
      contactInfo: dto.contactInfo ?? null,
      value: dto.value ?? null,
      currency: dto.currency ?? null,
      sector: dto.sector ?? null,
      location: dto.location ?? null,
      sourceMetadata: dto.sourceMetadata ?? null,
    }));

    for (let index = 0; index < entities.length; index += 50) {
      await this.repository.upsert(entities.slice(index, index + 50) as any, ['secopId']);
    }

    return {
      created: validRecords.filter((record) => !existingSet.has(record.secopId)).length,
      duplicates: duplicates + existingSet.size,
      invalid: invalidCount,
    };
  }

  /**
   * Extracts the PostgreSQL error from a caught exception and throws
   * {@link ConflictException} if it's a unique-constraint violation (`23505`).
   *
   * Handles both raw PG errors and TypeORM's {@link QueryFailedError} wrapper.
   */
  private throwConflictIfDuplicate(error: unknown): void {
    const pgError = error instanceof QueryFailedError ? error.driverError : error;
    if (this.extractErrorCode(pgError) === '23505') {
      throw new ConflictException('Procurement notice already exists for that SECOP identifier');
    }
  }

  /**
   * Safely extracts a PostgreSQL error code string from any error shape.
   *
   * @returns The PG error code (e.g., `'23505'`) or `undefined` if not present.
   */
  private extractErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const maybeCode = (error as { code?: unknown }).code;
    return typeof maybeCode === 'string' ? maybeCode : undefined;
  }
}
